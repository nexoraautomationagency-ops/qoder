const fs = require('fs');
const { google } = require('googleapis');
const { Readable } = require('stream');
const {
    SCOPES, TOKEN_PATH, CREDENTIALS_PATH,
    MASTER_BACKUP_SPREADSHEET_ID, MAIN_DATABASE_FOLDER_ID,
    DRIVE_FOLDER_ID, STUDENT_HEADERS
} = require('./config');
const { executeWithRetry, cleanPhoneNumber, normalizeStudentId, buildMonthYearLabel, sanitizeSheetInput } = require('./utils');
const { registeredStudentIds } = require('./state-machine');

let cachedOAuthClient = null;

// Google ID Cache for performance
const driveCache = {
    gradeFolders: new Map(),
    monthlySheets: new Map(),
    sheetTitles: new Map()
};

async function getOAuthClient() {
    if (cachedOAuthClient) return cachedOAuthClient;

    if (!fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error(`CRITICAL: credentials.json missing at ${CREDENTIALS_PATH}`);
    }

    const content = fs.readFileSync(CREDENTIALS_PATH);
    const credentials = JSON.parse(content);
    const key = credentials.installed || credentials.web;

    if (!key) {
        throw new Error('Invalid credentials.json format. Use OAuth 2.0 Client IDs.');
    }

    const redirectUri = (key.redirect_uris && key.redirect_uris.length > 0) ? key.redirect_uris[0] : 'urn:ietf:wg:oauth:2.0:oob';
    const oAuth2Client = new google.auth.OAuth2(key.client_id, key.client_secret, redirectUri);

    oAuth2Client.on('tokens', (tokens) => {
        try {
            let existingToken = {};
            if (fs.existsSync(TOKEN_PATH)) {
                existingToken = JSON.parse(fs.readFileSync(TOKEN_PATH));
            }
            const updatedToken = { ...existingToken, ...tokens };
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(updatedToken, null, 2));
        } catch (err) {
            console.error('[Google Auth] Failed to save refreshed token:', err.message);
        }
    });

    if (!fs.existsSync(TOKEN_PATH)) {
        throw new Error('Authentication required but token.json is missing. Run "node generate_token.js" locally.');
    }

    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);

    if (token.expiry_date && Date.now() >= token.expiry_date) {
        console.log('[Google Auth] Stored token appears expired. Preparing refresh...');
    }

    cachedOAuthClient = oAuth2Client;
    return cachedOAuthClient;
}

const getSheetsClient = async () => google.sheets({ version: 'v4', auth: await getOAuthClient() });
const getDriveClient = async () => google.drive({ version: 'v3', auth: await getOAuthClient() });

async function uploadReceiptToDrive(media, studentId, studentName) {
    try {
        if (!media || !media.data) throw new Error('Invalid media data');

        const drive = await getDriveClient();
        const buffer = Buffer.from(media.data, 'base64');
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        let ext = '';
        if (media.mimetype.includes('pdf')) ext = '.pdf';
        else if (media.mimetype.includes('jpeg') || media.mimetype.includes('jpg')) ext = '.jpg';
        else if (media.mimetype.includes('png')) ext = '.png';
        else ext = '.jpg';

        const fileName = `Receipt_${studentId}_${studentName.replace(/[^a-zA-Z0-9]/g, '_')}${ext}`;
        const fileMetadata = { name: fileName, parents: [DRIVE_FOLDER_ID] };

        console.log(`[Drive] Starting upload for ${fileName}...`);
        const file = await drive.files.create({
            resource: fileMetadata,
            media: { mimeType: media.mimetype, body: stream },
            fields: 'id, webViewLink'
        });

        if (!file.data || !file.data.id) throw new Error('Drive API returned empty response');

        await drive.permissions.create({
            fileId: file.data.id,
            requestBody: { role: 'reader', type: 'anyone' }
        }).catch(e => console.warn('[Drive] Public permission setup failed:', e.message));

        return file.data.webViewLink;
    } catch (error) {
        console.error('[Drive] Upload Error:', error.message);
        return null;
    }
}

async function ensureSpreadsheetHeaders(sheets, spreadsheetId, sheetTitle = 'Sheet1') {
    try {
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetTitle}!A1:L1`,
        });
        const headerRow = (headerResponse.data.values || [])[0] || [];
        const needsHeaderFix = !headerRow[0]
            || headerRow[0].toString().toUpperCase().startsWith('NEX')
            || headerRow.length !== STUDENT_HEADERS.length
            || headerRow[2] !== 'School';
        if (needsHeaderFix) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetTitle}!A1:L1`,
                valueInputOption: 'RAW',
                resource: { values: [STUDENT_HEADERS] }
            });
        }
    } catch (e) {
        console.error(`Error ensuring headers for ${spreadsheetId}:`, e.message);
    }
}

async function getOrCreateSheet(sheets, spreadsheetId, sheetTitle) {
    const ss = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = ss.data.sheets.find(s => s.properties.title === sheetTitle);
    if (!sheet) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests: [{ addSheet: { properties: { title: sheetTitle } } }] }
        });
        await ensureSpreadsheetHeaders(sheets, spreadsheetId, sheetTitle);
    }
    driveCache.sheetTitles.set(spreadsheetId, sheetTitle);
    return sheetTitle;
}

async function getMainSheetTitle(sheets, spreadsheetId) {
    if (driveCache.sheetTitles.has(spreadsheetId)) return driveCache.sheetTitles.get(spreadsheetId);
    try {
        const ss = await sheets.spreadsheets.get({ spreadsheetId });
        const title = ss.data.sheets[0].properties.title;
        driveCache.sheetTitles.set(spreadsheetId, title);
        return title;
    } catch (e) {
        return 'Sheet1';
    }
}

async function loadStudentsFromSheets(registeredStudentIds, pendingApprovals) {
    try {
        const sheets = await getSheetsClient();
        const ss = await sheets.spreadsheets.get({ spreadsheetId: MASTER_BACKUP_SPREADSHEET_ID });
        const batchSheets = ss.data.sheets
            .map(s => s.properties.title)
            .filter(t => t.startsWith('Batch ') || t === 'Sheet1');

        for (const sheetTitle of batchSheets) {
            await ensureSpreadsheetHeaders(sheets, MASTER_BACKUP_SPREADSHEET_ID, sheetTitle);

            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: MASTER_BACKUP_SPREADSHEET_ID,
                range: `${sheetTitle}!A:L`,
            });

            const rows = response.data.values || [];
            if (rows.length > 1) {
                const headers = rows[0].map(h => h.trim().toLowerCase());
                const findIndex = (search) => headers.findIndex(h => h.includes(search.toLowerCase()));

                const idIdx = findIndex('Student ID');
                const nameIdx = findIndex('Name');
                const schoolIdx = findIndex('School');
                const gradeIdx = findIndex('Grade');
                const monthIdx = findIndex('Month');
                const phoneIdx = findIndex('Phone');
                const tutesIdx = findIndex('Tutes');
                const addrIdx = findIndex('Address');
                const statusIdx = findIndex('Status');
                const receiptIdx = findIndex('Receipt');
                const groupIdx = findIndex('Group');

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const id = idIdx >= 0 ? row[idIdx] : row[0];
                    if (!id) continue;

                    const normalizedId = normalizeStudentId(id);
                    const studentObj = {
                        idNumber: normalizedId,
                        name: sanitizeSheetInput(nameIdx >= 0 ? (row[nameIdx] || '') : (row[1] || '')),
                        school: sanitizeSheetInput(schoolIdx >= 0 ? (row[schoolIdx] || '') : ''),
                        grade: gradeIdx >= 0 ? parseInt(row[gradeIdx], 10) : NaN,
                        months: monthIdx >= 0 ? (row[monthIdx] || '') : '',
                        phone: phoneIdx >= 0 ? (row[phoneIdx] || '') : '',
                        address: sanitizeSheetInput(addrIdx >= 0 ? (row[addrIdx] || null) : null),
                        status: statusIdx >= 0 ? (row[statusIdx] || 'Pending') : 'Pending',
                        receiptUrl: receiptIdx >= 0 ? (row[receiptIdx] || null) : null,
                        groupId: groupIdx >= 0 ? (row[groupIdx] || null) : null
                    };

                    if (isNaN(studentObj.grade)) {
                        const hasSchool = row.length >= 12;
                        studentObj.school = hasSchool ? (row[2] || '') : '';
                        studentObj.grade = parseInt(hasSchool ? row[3] : row[2], 10);
                        studentObj.months = hasSchool ? row[4] : row[3];
                        studentObj.phone = hasSchool ? row[5] : row[4];
                        studentObj.wantsTutes = (hasSchool ? row[7] : row[6]) === 'Yes';
                    } else {
                        studentObj.wantsTutes = (tutesIdx >= 0 ? row[tutesIdx] : '') === 'Yes';
                    }

                    studentObj.contactId = studentObj.phone ? (studentObj.phone.includes('@') ? studentObj.phone : `${cleanPhoneNumber(studentObj.phone)}@c.us`) : null;

                    registeredStudentIds.set(normalizedId, studentObj);

                    if (studentObj.status === 'Pending') {
                        pendingApprovals.set(normalizedId, studentObj);
                    }
                }
            }
        }

        if (pendingApprovals.size > 0) {
            console.log(`[Sync] Recovered ${pendingApprovals.size} pending approvals.`);
        }
        console.log(`[Sync] Loaded ${registeredStudentIds.size} students from Master Backup.`);
    } catch (error) {
        console.error('[Sync] CRITICAL: Error loading from Sheets:', error.message);
        throw error;
    }
}

async function upsertStudentData(studentData, forceStatus = null, oldGrade = null, oldMonth = null) {
    return await executeWithRetry(async () => {
        const sheets = await getSheetsClient();
        const drive = await getDriveClient();

        if (oldGrade !== null || oldMonth !== null) {
            const lastGrade = oldGrade !== null ? oldGrade : studentData.grade;
            const lastMonth = oldMonth !== null ? oldMonth : studentData.months;
            if (parseInt(lastGrade) !== parseInt(studentData.grade) || lastMonth !== studentData.months) {
                await deleteStudentFromMonthlyFile(sheets, drive, lastGrade, lastMonth, studentData.idNumber);
            }
        }

        const status = forceStatus || studentData.status || 'Pending';
        const cleanedPhone = cleanPhoneNumber(studentData.phone);
        const monthLabel = buildMonthYearLabel(studentData.months);

        const rowValues = [[
            sanitizeSheetInput(studentData.idNumber),
            sanitizeSheetInput(studentData.name),
            sanitizeSheetInput(studentData.school || ''),
            studentData.grade,
            monthLabel,
            cleanedPhone,
            studentData.wantsTutes ? 'Yes' : 'No',
            sanitizeSheetInput(studentData.address || ''),
            status,
            studentData.receiptUrl || '',
            studentData.groupId || ''
        ]];

        // Master
        const batchYear = new Date().getFullYear() + (11 - parseInt(studentData.grade, 10));
        const batchSheetName = `Batch ${batchYear}`;
        await getOrCreateSheet(sheets, MASTER_BACKUP_SPREADSHEET_ID, batchSheetName);

        const masterRes = await sheets.spreadsheets.values.get({
            spreadsheetId: MASTER_BACKUP_SPREADSHEET_ID,
            range: `${batchSheetName}!A:L`
        });
        const masterRows = masterRes.data.values || [];
        const mIndex = masterRows.findIndex(r => normalizeStudentId(r[0]) === studentData.idNumber);

        if (mIndex >= 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: MASTER_BACKUP_SPREADSHEET_ID,
                range: `${batchSheetName}!A${mIndex + 1}:L${mIndex + 1}`,
                valueInputOption: 'RAW',
                resource: { values: rowValues }
            });
        } else {
            await sheets.spreadsheets.values.append({
                spreadsheetId: MASTER_BACKUP_SPREADSHEET_ID,
                range: `${batchSheetName}!A:L`,
                valueInputOption: 'RAW',
                resource: { values: rowValues }
            });
        }

        // Monthly
        const folderId = await getOrCreateFolder(drive, MAIN_DATABASE_FOLDER_ID, `Grade ${studentData.grade}`);
        const monthlyFileId = await getOrCreateMonthlySpreadsheet(drive, sheets, folderId, monthLabel);
        const monthlySheetTitle = await getMainSheetTitle(sheets, monthlyFileId);

        const monthRes = await sheets.spreadsheets.values.get({
            spreadsheetId: monthlyFileId,
            range: `${monthlySheetTitle}!A:L`
        });
        const monthRows = monthRes.data.values || [];
        const moIndex = monthRows.findIndex(r => normalizeStudentId(r[0]) === studentData.idNumber);

        if (moIndex >= 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: monthlyFileId,
                range: `${monthlySheetTitle}!A${moIndex + 1}:L${moIndex + 1}`,
                valueInputOption: 'RAW',
                resource: { values: rowValues }
            });
        } else {
            await sheets.spreadsheets.values.append({
                spreadsheetId: monthlyFileId,
                range: `${monthlySheetTitle}!A:L`,
                valueInputOption: 'RAW',
                resource: { values: rowValues }
            });
        }

        registeredStudentIds.set(studentData.idNumber, { ...studentData, status });
        console.log(`[Database] Updated ${studentData.idNumber} (Status: ${status})`);
    });
}

async function getOrCreateFolder(drive, parentFolderId, folderName) {
    if (driveCache.gradeFolders.has(folderName)) return driveCache.gradeFolders.get(folderName);

    const query = `'${parentFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const response = await drive.files.list({ q: query, fields: 'files(id, name)' });

    if (response.data.files.length > 0) {
        const id = response.data.files[0].id;
        driveCache.gradeFolders.set(folderName, id);
        return id;
    }

    const folder = await drive.files.create({
        resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [parentFolderId] },
        fields: 'id'
    });
    const newId = folder.data.id;
    driveCache.gradeFolders.set(folderName, newId);
    return newId;
}

async function getOrCreateMonthlySpreadsheet(drive, sheets, gradeFolderId, monthSheetName) {
    if (driveCache.monthlySheets.has(monthSheetName)) return driveCache.monthlySheets.get(monthSheetName);

    const query = `'${gradeFolderId}' in parents and name = '${monthSheetName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
    const response = await drive.files.list({ q: query, fields: 'files(id, name)' });

    if (response.data.files.length > 0) {
        const id = response.data.files[0].id;
        driveCache.monthlySheets.set(monthSheetName, id);
        return id;
    }

    const newFile = await drive.files.create({
        resource: { name: monthSheetName, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [gradeFolderId] },
        fields: 'id'
    });
    const newSpreadsheetId = newFile.data.id;

    await sheets.spreadsheets.values.update({
        spreadsheetId: newSpreadsheetId,
        range: 'Sheet1!A1:L1',
        valueInputOption: 'RAW',
        resource: { values: [STUDENT_HEADERS] }
    });
    driveCache.monthlySheets.set(monthSheetName, newSpreadsheetId);
    return newSpreadsheetId;
}

async function deleteStudentFromMonthlyFile(sheets, drive, grade, month, idNumber) {
    try {
        const monthLabel = buildMonthYearLabel(month);
        if (!monthLabel) return;

        const folderId = await getOrCreateFolder(drive, MAIN_DATABASE_FOLDER_ID, `Grade ${grade}`);
        const query = `'${folderId}' in parents and name = '${monthLabel}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
        const response = await drive.files.list({ q: query, fields: 'files(id, name)' });

        if (response.data.files.length === 0) return;
        const spreadsheetId = response.data.files[0].id;
        const sheetTitle = await getMainSheetTitle(sheets, spreadsheetId);

        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetTitle}!A:A` });
        const rows = res.data.values || [];
        const rowIndex = rows.findIndex(r => normalizeStudentId(r[0]) === normalizeStudentId(idNumber));

        if (rowIndex >= 0) {
            const ss = await sheets.spreadsheets.get({ spreadsheetId });
            const sheet = ss.data.sheets.find(s => s.properties.title === sheetTitle);
            const sheetId = sheet ? sheet.properties.sheetId : 0;

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 }
                        }
                    }]
                }
            });
        }
    } catch (e) {
        console.warn(`[Cleanup] Failed to remove ${idNumber} from Grade ${grade}:`, e.message);
    }
}

async function saveComplaintToSheets(phoneNumber, complaintText) {
    return await executeWithRetry(async () => {
        const sheets = await getSheetsClient();
        const drive = await getDriveClient();

        const query = `'${MAIN_DATABASE_FOLDER_ID}' in parents and name = 'Complaints' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
        const response = await drive.files.list({ q: query, fields: 'files(id, name)' });

        let spreadsheetId;
        if (response.data.files.length > 0) {
            spreadsheetId = response.data.files[0].id;
        } else {
            const newSheetFile = await drive.files.create({
                resource: { name: 'Complaints', mimeType: 'application/vnd.google-apps.spreadsheet', parents: [MAIN_DATABASE_FOLDER_ID] },
                fields: 'id'
            });
            spreadsheetId = newSheetFile.data.id;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'Sheet1!A1:D1',
                valueInputOption: 'RAW',
                resource: { values: [['Timestamp', 'Phone Number', 'Complaint', 'Status']] }
            });
        }

        const sheetTitle = await getMainSheetTitle(sheets, spreadsheetId);
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetTitle}!A:D`,
            valueInputOption: 'RAW',
            resource: { values: [[new Date().toISOString(), phoneNumber, sanitizeSheetInput(complaintText), 'Unresolved']] }
        });
    });
}

async function getMonthlyPayments(grade, monthRaw, registeredStudentIds) {
    const monthLabel = buildMonthYearLabel(monthRaw);
    if (!monthLabel) return null;

    const gradeNum = parseInt(grade, 10);
    if (isNaN(gradeNum) || gradeNum < 6 || gradeNum > 11) return null;

    const allStudents = Array.from(registeredStudentIds.values())
        .filter(s => parseInt(s.grade, 10) === gradeNum && s.status !== 'DELETED' && s.status !== 'Rejected' && s.status !== 'Kicked');

    if (allStudents.length === 0) return { paid: [], unpaid: [], pending: [], monthLabel, total: 0 };

    const paidIds = new Set();
    const pendingIds = new Set();

    try {
        const drive = await getDriveClient();
        const sheets = await getSheetsClient();

        const folderId = await getOrCreateFolder(drive, MAIN_DATABASE_FOLDER_ID, `Grade ${gradeNum}`);
        const query = `'${folderId}' in parents and name = '${monthLabel}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
        const response = await drive.files.list({ q: query, fields: 'files(id, name)' });

        if (response.data.files.length > 0) {
            const spreadsheetId = response.data.files[0].id;
            const sheetTitle = await getMainSheetTitle(sheets, spreadsheetId);
            const res = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetTitle}!A:L`
            });

            const rows = res.data.values || [];
            if (rows.length > 1) {
                const headers = rows[0].map(h => h.trim().toLowerCase());
                const idIdx = headers.findIndex(h => h.includes('student id'));
                const statusIdx = headers.findIndex(h => h.includes('status'));

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const sid = idIdx >= 0 ? normalizeStudentId(row[idIdx]) : normalizeStudentId(row[0]);
                    const status = statusIdx >= 0 ? (row[statusIdx] || '').trim() : '';
                    if (!sid) continue;
                    if (status === 'Approved') paidIds.add(sid);
                    else if (status === 'Pending') pendingIds.add(sid);
                }
            }
        }
    } catch (e) {
        console.error(`[Payments] Error reading monthly sheet for Grade ${gradeNum}:`, e.message);
        throw new Error(`Failed to read payment records for Grade ${gradeNum} (${monthLabel}).`);
    }

    const paid = [];
    const pending = [];
    const unpaid = [];

    for (const student of allStudents) {
        const nid = normalizeStudentId(student.idNumber);
        if (paidIds.has(nid)) paid.push(student);
        else if (pendingIds.has(nid)) pending.push(student);
        else unpaid.push(student);
    }

    return { paid, pending, unpaid, monthLabel, total: allStudents.length };
}

let idGenerationQueue = Promise.resolve();

async function generateBatchStudentId(grade) {
    return new Promise((resolve, reject) => {
        idGenerationQueue = idGenerationQueue.then(async () => {
            try {
                const result = await _doGenerateBatchStudentId(grade);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }).catch(err => {
            console.warn('[Queue Recovered] ID Generation Queue recovered from an isolated failure.');
        });
    });
}

async function _doGenerateBatchStudentId(grade) {
    const sheets = await getSheetsClient();
    const currentYear = new Date().getFullYear();
    const batchYear = currentYear + (11 - parseInt(grade, 10));
    const batchPrefix = String(batchYear).slice(-2);

    const ss = await sheets.spreadsheets.get({ spreadsheetId: MASTER_BACKUP_SPREADSHEET_ID });
    let sheet = ss.data.sheets.find(s => s.properties.title === 'SystemData');

    if (!sheet) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: MASTER_BACKUP_SPREADSHEET_ID,
            resource: { requests: [{ addSheet: { properties: { title: 'SystemData' } } }] }
        });
        await sheets.spreadsheets.values.update({
            spreadsheetId: MASTER_BACKUP_SPREADSHEET_ID,
            range: 'SystemData!A1:B1',
            valueInputOption: 'RAW',
            resource: { values: [['Batch Year', 'Last Serial']] }
        });
    }

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: MASTER_BACKUP_SPREADSHEET_ID,
        range: 'SystemData!A:B'
    });
    const rows = res.data.values || [];
    let rowIndex = rows.findIndex(r => r[0] == batchYear);
    let nextSerial = 1;

    if (rowIndex >= 0) {
        nextSerial = parseInt(rows[rowIndex][1], 10) + 1;
        await sheets.spreadsheets.values.update({
            spreadsheetId: MASTER_BACKUP_SPREADSHEET_ID,
            range: `SystemData!B${rowIndex + 1}`,
            valueInputOption: 'RAW',
            resource: { values: [[nextSerial]] }
        });
    } else {
        rowIndex = rows.length;
        await sheets.spreadsheets.values.append({
            spreadsheetId: MASTER_BACKUP_SPREADSHEET_ID,
            range: 'SystemData!A:B',
            valueInputOption: 'RAW',
            resource: { values: [[batchYear, nextSerial]] }
        });
    }

    return `${batchPrefix}${String(nextSerial).padStart(4, '0')}`;
}

module.exports = {
    getOAuthClient,
    getSheetsClient,
    getDriveClient,
    uploadReceiptToDrive,
    loadStudentsFromSheets,
    upsertStudentData,
    deleteStudentFromMonthlyFile,
    saveComplaintToSheets,
    getMonthlyPayments,
    generateBatchStudentId,
    getOrCreateFolder,
    getMainSheetTitle
};
