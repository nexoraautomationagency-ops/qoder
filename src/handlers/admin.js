const config = require('../config');
const { updateEnvFile, getBankLabel, ADMIN_BROADCAST_DELAY_MS } = config;
const { delay, normalizeStudentId, cleanPhoneNumber, buildMonthYearLabel } = require('../utils');
const { adminStates, registeredStudentIds, pendingApprovals } = require('../state-machine');
const { isMasterAdmin } = require('../security');
const { sendWA, notifyAdmins, addStudentToGroup, removeStudentFromGroup, getGroupList, forwardMessage } = require('../whatsapp');
const {
    adminHelp, adminSettings, adminListAdmins, adminSetSuccess, adminSetFail,
    adminOnlyMaster, adminBroadcastStart, adminBroadcastDone, adminNoStudents,
    adminCheckPayments, adminCheckPaymentsError, adminRemindStart, adminRemindDone,
    adminAllPaid, adminReminderMsg, adminApprovePrompt, adminApproveSuccess,
    adminApproveNotify, adminRejectSuccess, adminRejectNotify, adminPendingList,
    adminNoPending, adminSearchResults, adminSearchNoResults, adminStudentStatus,
    adminKickSuccess, adminKickNotify, adminDeleteSuccess, adminEditSuccess,
    adminInvalidField, adminGroupList, adminNotFound, adminInvalidSelection,
    adminGroupNotSet, adminApprovalNotFound, adminAlreadyAdmin, adminNotAdmin,
    adminKickFailNotAdmin, adminKickNoGroup
} = require('../messages');
const {
    upsertStudentData, getMonthlyPayments, saveComplaintToSheets
} = require('../google-api');

let approvalQueue = Promise.resolve();

async function handleAdminCommand(msg, from, body, lowerBody) {
    // adminhelp
    if (lowerBody === 'adminhelp') {
        return await sendWA(from, adminHelp());
    }

    // settings
    if (lowerBody === 'settings') {
        return await sendWA(from, adminSettings());
    }

    // listadmins
    if (lowerBody === 'listadmins') {
        return await sendWA(from, adminListAdmins(config.ADMIN_NUMBERS));
    }

    // set commands
    if (lowerBody.startsWith('set ')) {
        return await handleSetCommand(msg, from, body, lowerBody);
    }

    // broadcast
    if (lowerBody.startsWith('broadcast ')) {
        return await handleBroadcast(from, body, lowerBody);
    }

    // check payments
    if (lowerBody.startsWith('check payments ')) {
        return await handleCheckPayments(from, body, lowerBody);
    }

    // remind unpaid
    if (lowerBody.startsWith('remind unpaid ')) {
        return await handleRemindUnpaid(from, body, lowerBody);
    }

    // getgroups
    if (lowerBody === 'getgroups') {
        const groups = await getGroupList();
        return await sendWA(from, adminGroupList(groups));
    }

    // Admin state: chooseGroup for approval
    const aState = adminStates.get(from);
    if (aState?.step === 'chooseGroup') {
        return await handleChooseGroup(msg, from, body);
    }

    // approve
    if (lowerBody.startsWith('approve')) {
        return await handleApprove(from, body, lowerBody);
    }

    // reject
    if (lowerBody.startsWith('reject ')) {
        return await handleReject(from, body);
    }

    // list pending
    if (lowerBody === 'list pending') {
        if (pendingApprovals.size === 0) return await sendWA(from, adminNoPending());
        const sorted = Array.from(pendingApprovals.values()).sort((a, b) => (a.grade || 0) - (b.grade || 0));
        return await sendWA(from, adminPendingList(sorted, pendingApprovals.size));
    }

    // search name
    if (lowerBody.startsWith('search name ')) {
        return await handleSearchName(from, body, lowerBody);
    }

    // status
    if (lowerBody.startsWith('status ')) {
        return await handleStatus(from, body);
    }

    // kick
    if (lowerBody.startsWith('kick ')) {
        return await handleKick(msg, from, body);
    }

    // delete student
    if (lowerBody.startsWith('delete student ')) {
        return await handleDeleteStudent(msg, from, body);
    }

    // edit student
    if (lowerBody.startsWith('edit student ')) {
        return await handleEditStudent(from, body);
    }
}

async function handleSetCommand(msg, from, body, lowerBody) {
    const parts = body.split(/\s+/);
    const target = parts[1]?.toLowerCase();

    if (target === 'school') {
        const newName = body.substring(11).trim();
        if (!newName) return await sendWA(from, adminSetFail('set school <name>'));
        if (updateEnvFile('SCHOOL_NAME', newName)) return await sendWA(from, adminSetSuccess('School name', newName));
    }

    if (target === 'fee') {
        const sub = parts[2]?.toLowerCase();
        const value = parts[3];
        if (!sub || isNaN(parseInt(value))) return await sendWA(from, adminSetFail('set fee <basic|tute> <value>'));
        const envKey = sub === 'basic' ? 'FEE_BASIC' : 'FEE_TUTE';
        if (updateEnvFile(envKey, value)) return await sendWA(from, adminSetSuccess(`${sub.toUpperCase()} FEE`, `LKR ${value}`));
    }

    if (target === 'bank') {
        const sub = parts[2]?.toLowerCase();
        const value = body.substring(body.indexOf(parts[2]) + parts[2].length).trim();
        if (!sub || !value) return await sendWA(from, adminSetFail('set bank <name|accname|number|branch> <value>'));
        let key = '';
        if (sub === 'name') key = 'BANK_NAME';
        else if (sub === 'accname') key = 'BANK_ACC_NAME';
        else if (sub === 'number') key = 'BANK_ACC_NUMBER';
        else if (sub === 'branch') key = 'BANK_BRANCH';
        if (key && updateEnvFile(key, value)) return await sendWA(from, adminSetSuccess(`Bank ${sub}`, value));
        return await sendWA(from, adminSetFail('set bank <name|accname|number|branch> <value>'));
    }

    if (target === 'group') {
        const grade = parseInt(parts[2], 10);
        const groupId = parts[3];
        if (Number.isInteger(grade) && grade >= 6 && grade <= 11 && groupId && updateEnvFile(`GROUP_ID_${grade}`, groupId)) {
            return await sendWA(from, adminSetSuccess(`Grade ${grade} Group`, groupId));
        }
        return await sendWA(from, adminSetFail('set group <6-11> <id>'));
    }

    if (target === 'admin') {
        return await handleAdminMgmt(msg, from, parts);
    }
}

async function handleAdminMgmt(msg, from, parts) {
    const action = parts[2]?.toLowerCase();
    let newId = parts[3];
    if (!newId) return await sendWA(from, adminSetFail('set admin <add|remove> <id>'));

    if (!newId.includes('@')) newId = `${newId.replace(/\D/g, '')}@c.us`;

    if (action === 'add') {
        if (config.ADMIN_NUMBERS.includes(newId)) return await sendWA(from, adminAlreadyAdmin());
        const updatedArray = [...config.ADMIN_NUMBERS, newId];
        updateEnvFile('ADMIN_NUMBERS', updatedArray.join(', '));
        return await sendWA(from, adminSetSuccess('Admin added', newId));
    }

    if (action === 'remove') {
        if (!isMasterAdmin(msg, from)) return await sendWA(from, adminOnlyMaster());
        if (!config.ADMIN_NUMBERS.includes(newId)) return await sendWA(from, adminNotAdmin());
        const updatedArray = config.ADMIN_NUMBERS.filter(id => id !== newId);
        updateEnvFile('ADMIN_NUMBERS', updatedArray.join(', ') || from);
        return await sendWA(from, adminSetSuccess('Admin removed', newId));
    }
}

async function handleBroadcast(from, body, lowerBody) {
    let announcement = body.substring(10).trim();
    if (!announcement) return await sendWA(from, adminSetFail('broadcast [grade X] <message>'));

    let targetGrade = null;
    const gradeMatch = announcement.toLowerCase().match(/^grade\s+(\d+)\s+/);
    if (gradeMatch) {
        targetGrade = parseInt(gradeMatch[1], 10);
        announcement = announcement.substring(gradeMatch[0].length).trim();
    }

    let students = Array.from(registeredStudentIds.values());
    if (targetGrade) {
        students = students.filter(s => s.grade === targetGrade);
        if (students.length === 0) return await sendWA(from, adminNoStudents(targetGrade));
    }

    await sendWA(from, adminBroadcastStart(targetGrade ? `Grade ${targetGrade}` : 'ALL'));

    let success = 0;
    for (const student of students) {
        try {
            if (student.contactId) {
                await sendWA(student.contactId, announcement);
                success++;
                await delay(ADMIN_BROADCAST_DELAY_MS);
            }
        } catch (e) { console.error(`Broadcast failed for ${student.idNumber}:`, e.message); }
    }
    return await sendWA(from, adminBroadcastDone(success, students.length));
}

async function handleCheckPayments(from, body, lowerBody) {
    const parts = body.split(/\s+/);
    const grade = parts[2];
    const monthRaw = parts.slice(3).join(' ');
    if (!grade || !monthRaw) return await sendWA(from, adminSetFail('check payments <grade> <month>'));

    await sendWA(from, '⏳ Checking payment records...');
    try {
        const result = await getMonthlyPayments(grade, monthRaw, registeredStudentIds);
        if (!result) return await sendWA(from, adminSetFail('check payments <grade> <month>'));
        if (result.total === 0) return await sendWA(from, adminNoStudents(grade));
        return await sendWA(from, adminCheckPayments(result, grade));
    } catch (e) {
        console.error('[Payments] Check error:', e.message);
        return await sendWA(from, adminCheckPaymentsError(e));
    }
}

async function handleRemindUnpaid(from, body, lowerBody) {
    const parts = body.split(/\s+/);
    const grade = parts[2];
    const monthRaw = parts.slice(3).join(' ');
    if (!grade || !monthRaw) return await sendWA(from, adminSetFail('remind unpaid <grade> <month>'));

    await sendWA(from, '⏳ Fetching unpaid students...');
    try {
        const result = await getMonthlyPayments(grade, monthRaw, registeredStudentIds);
        if (!result) return await sendWA(from, adminSetFail('remind unpaid <grade> <month>'));
        if (result.unpaid.length === 0) return await sendWA(from, adminAllPaid(grade, result.monthLabel));

        await sendWA(from, adminRemindStart(result.unpaid.length));

        let success = 0;
        let failed = 0;
        for (const student of result.unpaid) {
            try {
                const contactId = student.contactId || (student.phone ? `${cleanPhoneNumber(student.phone)}@c.us` : null);
                if (!contactId) { failed++; continue; }
                const fee = student.wantsTutes ? config.TUTE_FEE : config.BASIC_FEE;
                await sendWA(contactId, adminReminderMsg(student.name, result.monthLabel, fee));
                success++;
                await delay(ADMIN_BROADCAST_DELAY_MS);
            } catch (e) {
                console.error(`[Reminder] Failed for ${student.idNumber}:`, e.message);
                failed++;
            }
        }
        return await sendWA(from, adminRemindDone(success, failed, result.unpaid.length));
    } catch (e) {
        console.error('[Reminder] Error:', e.message);
        return await sendWA(from, adminCheckPaymentsError(e));
    }
}

async function handleChooseGroup(msg, from, body) {
    const idx = parseInt(body, 10) - 1;
    if (idx < 0 || idx >= config.GROUPS.length) return await sendWA(from, adminInvalidSelection());

    const group = config.GROUPS[idx];
    if (!group?.id) return await sendWA(from, adminGroupNotSet(group?.name || 'Selected group'));

    const aState = adminStates.get(from);
    const approval = pendingApprovals.get(aState.studentId);
    if (!approval) { adminStates.delete(from); return await sendWA(from, adminApprovalNotFound()); }

    approvalQueue = approvalQueue.then(async () => {
        try {
            const targetAddId = approval.contactId || approval.phone;
            await addStudentToGroup(group.id, targetAddId);
            await sendWA(from, adminApproveSuccess(approval.idNumber, group.name));

            const notifyJid = approval.contactId || (approval.phone ? `${cleanPhoneNumber(approval.phone)}@c.us` : null);
            if (notifyJid) {
                await sendWA(notifyJid, adminApproveNotify(group.name)).catch(e => console.warn(`Failed to notify ${approval.idNumber}:`, e.message));
            }

            approval.status = 'Approved';
            approval.groupId = group.id;
            await upsertStudentData(approval, 'Approved');
            pendingApprovals.delete(aState.studentId);
            adminStates.delete(from);
        } catch (error) {
            await sendWA(from, `❌ Failed: ${error.message}`);
        }
    }).catch(err => {
        console.error('[Approval Queue] Serialization error recovered:', err.message);
    });
}

async function handleApprove(from, body, lowerBody) {
    const parts = body.split(/\s+/);
    let studentId = parts[1] ? normalizeStudentId(parts[1]) : null;

    if (!studentId && pendingApprovals.size === 1) studentId = Array.from(pendingApprovals.keys())[0];
    if (!studentId || !pendingApprovals.has(studentId)) {
        return await sendWA(from, adminSetFail('approve <id>'));
    }

    const approval = pendingApprovals.get(studentId);
    adminStates.set(from, { step: 'chooseGroup', studentId });
    const list = config.GROUPS.map((g, i) => `${i + 1}. ${g.name}`).join('\n');
    return await sendWA(from, adminApprovePrompt(approval, list));
}

async function handleReject(from, body) {
    const parts = body.split(/\s+/);
    const studentId = normalizeStudentId(parts[1]);
    const reason = body.substring(body.indexOf(parts[1]) + parts[1].length).trim() || 'No reason specified.';

    if (!studentId || !pendingApprovals.has(studentId)) {
        return await sendWA(from, adminNotFound());
    }

    approvalQueue = approvalQueue.then(async () => {
        try {
            const student = pendingApprovals.get(studentId);
            await sendWA(student.contactId, adminRejectNotify(reason));
            student.status = 'Rejected';
            await upsertStudentData(student, 'Rejected');
            pendingApprovals.delete(studentId);
            return await sendWA(from, adminRejectSuccess(studentId));
        } catch (e) {
            await sendWA(from, `❌ Rejection failed: ${e.message}`);
        }
    }).catch(err => {
        console.error('[Approval Queue] Rejection serialization error recovered:', err.message);
    });
}

async function handleSearchName(from, body, lowerBody) {
    const query = body.substring(12).trim().toLowerCase();
    if (query.length < 3) return await sendWA(from, adminSetFail('search name <text> (min 3 chars)'));

    const matches = Array.from(registeredStudentIds.values())
        .filter(s => s.name.toLowerCase().includes(query) || (s.school && s.school.toLowerCase().includes(query)));

    if (matches.length === 0) return await sendWA(from, adminSearchNoResults(query));
    return await sendWA(from, adminSearchResults(query, matches));
}

async function handleStatus(from, body) {
    const studentId = normalizeStudentId(body.substring(7));
    const student = registeredStudentIds.get(studentId);
    if (!student) return await sendWA(from, adminNotFound());
    return await sendWA(from, adminStudentStatus(student));
}

async function handleKick(msg, from, body) {
    const parts = body.split(/\s+/);
    const studentId = normalizeStudentId(parts[1]);
    const reason = body.substring(body.indexOf(parts[1]) + parts[1].length).trim() || 'No reason specified.';

    const student = registeredStudentIds.get(studentId);
    if (!student) return await sendWA(from, adminNotFound());
    if (!student.groupId) return await sendWA(from, adminKickNoGroup());

    try {
        await removeStudentFromGroup(student.groupId, student.contactId);
        await sendWA(student.contactId, adminKickNotify(reason));
        student.status = 'Kicked';
        await upsertStudentData(student, 'Kicked');
        return await sendWA(from, adminKickSuccess(studentId, reason));
    } catch (e) {
        if (e.message.includes('not an admin')) return await sendWA(from, adminKickFailNotAdmin());
        return await sendWA(from, `❌ Kick failed: ${e.message}`);
    }
}

async function handleDeleteStudent(msg, from, body) {
    if (!isMasterAdmin(msg, from)) return await sendWA(from, adminOnlyMaster());
    const studentId = normalizeStudentId(body.substring(15));
    const student = registeredStudentIds.get(studentId);
    if (!student) return await sendWA(from, adminNotFound());

    student.status = 'DELETED';
    await upsertStudentData(student, 'DELETED');
    registeredStudentIds.delete(studentId);
    return await sendWA(from, adminDeleteSuccess(studentId));
}

async function handleEditStudent(from, body) {
    const parts = body.split(/\s+/);
    if (parts.length < 5) return await sendWA(from, adminSetFail('edit student <id> <field> <value>'));

    const studentId = normalizeStudentId(parts[2]);
    const field = parts[3].toLowerCase();
    const value = parts.slice(4).join(' ').trim();

    const student = registeredStudentIds.get(studentId);
    if (!student) return await sendWA(from, adminNotFound());

    const validFields = ['name', 'school', 'grade', 'phone', 'address', 'status', 'month'];
    if (!validFields.includes(field)) return await sendWA(from, adminInvalidField(validFields));

    const originalGrade = student.grade;
    const originalMonth = student.months;

    if (field === 'name') student.name = value;
    else if (field === 'school') student.school = value;
    else if (field === 'grade') {
        const g = parseInt(value, 10);
        if (isNaN(g) || g < 6 || g > 11) return await sendWA(from, adminSetFail('grade must be 6-11'));
        student.grade = g;
    }
    else if (field === 'phone') {
        student.phone = cleanPhoneNumber(value);
        student.contactId = `${student.phone}@c.us`;
    }
    else if (field === 'address') student.address = value;
    else if (field === 'status') student.status = value;
    else if (field === 'month') {
        const resolved = buildMonthYearLabel(value);
        if (!resolved) return await sendWA(from, adminSetFail('invalid month format'));
        student.months = resolved;
    }

    try {
        const oldG = field === 'grade' ? originalGrade : null;
        const oldM = field === 'month' ? originalMonth : null;
        await upsertStudentData(student, null, oldG, oldM);
        return await sendWA(from, adminEditSuccess(studentId, field, value));
    } catch (e) {
        return await sendWA(from, `❌ Failed to update Sheets: ${e.message}`);
    }
}

module.exports = { handleAdminCommand };
