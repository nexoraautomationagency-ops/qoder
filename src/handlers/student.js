const config = require('../config');
const { MENU_KEYWORD } = config;
const { delay, cleanPhoneNumber, isValidPhone, normalizeStudentId, buildMonthYearLabel } = require('../utils');
const { STATES, userData, userStates, registeredStudentIds, pendingApprovals, pushHistory, popHistory, getHistory, clearHistory, resetUser, saveSessionsNow } = require('../state-machine');
const { sendWA, notifyAdmins, forwardMessage } = require('../whatsapp');
const {
    mainMenu, cancelDone, backInvalid, backMenuNewStudent, backMenuOldStudent,
    askName, askSchool, askPhone, phoneInvalid, phoneAlreadyRegistered,
    askGrade, gradeInvalid, askMonth, monthInvalid, monthRegistered,
    askTutes, tutesInvalid, askAddress, feeInfo, receiptRequired,
    receiptUploading, receiptUploadFailed, registrationPreview,
    registrationSubmitted, registrationCancelled, confirmBackInvalid,
    invalidName, invalidSchool, submitting, confirmPrompt,
    invalidBackMenuNew, invalidBackMenuOld,
    askOldId, oldIdNotFound,
    oldIdMultipleMatches, oldIdFoundAuto, oldConfirm, oldConfirmInvalid,
    oldAskMonth, oldMonthFee, complainPrompt, complainSent,
    newEnrollmentAlert, complainAlert, systemError
} = require('../messages');
const { uploadReceiptToDrive, upsertStudentData, generateBatchStudentId, saveComplaintToSheets } = require('../google-api');

async function handleStudentMessage(msg, from, body, lowerBody) {
    // Global keywords
    if (lowerBody === MENU_KEYWORD) {
        resetUser(from);
        userStates.set(from, STATES.START);
        userData.set(from, { lastSeen: Date.now() });
        return await sendWA(from, mainMenu());
    }

    if (lowerBody === 'cancel') {
        resetUser(from);
        return await sendWA(from, cancelDone());
    }

    // Session init
    if (!userStates.has(from)) {
        userStates.set(from, STATES.START);
        userData.set(from, { contactId: from, lastSeen: Date.now() });
        return await sendWA(from, mainMenu());
    }

    const state = userStates.get(from);
    const data = userData.get(from);
    data.lastSeen = Date.now();

    // Back navigation
    if (lowerBody === 'back') {
        return await handleBack(from, state, data);
    }

    // State machine
    switch (state) {
        case STATES.START:
            return await handleStart(from, body, lowerBody, data);
        case STATES.NAME:
            return await handleName(from, body, data);
        case STATES.SCHOOL:
            return await handleSchool(from, body, data);
        case STATES.PHONE:
            return await handlePhone(from, body, data);
        case STATES.GRADE:
            return await handleGrade(from, body, data);
        case STATES.MONTHS:
            return await handleMonths(from, body, data);
        case STATES.TUTES_OPTION:
            return await handleTutesOption(from, body, lowerBody, data);
        case STATES.ADDRESS:
            return await handleAddress(from, body, data);
        case STATES.RECEIPT:
            return await handleReceipt(msg, from, data);
        case STATES.CONFIRM:
            return await handleConfirm(from, body, lowerBody, data);
        case STATES.OLD_ID:
            return await handleOldId(from, body, data);
        case STATES.OLD_CONFIRM:
            return await handleOldConfirm(from, body, lowerBody, data);
        case STATES.OLD_TUTES_OPTION:
            return await handleOldTutesOption(from, body, lowerBody, data);
        case STATES.OLD_MONTH:
            return await handleOldMonth(from, body, data);
        case STATES.COMPLAIN:
            return await handleComplain(from, body, data);
        case STATES.BACK_MENU:
            return await handleBackMenu(from, body, data);
        default:
            resetUser(from);
            return await sendWA(from, mainMenu());
    }
}

async function handleBack(from, state, data) {
    // Cannot go back after receipt upload or confirm
    if (state === STATES.CONFIRM) {
        return await sendWA(from, confirmBackInvalid());
    }

    const history = getHistory(from);
    if (history.length === 0) {
        return await sendWA(from, backInvalid());
    }

    // Pop the previous state and restore data
    const previous = popHistory(from);
    if (!previous) {
        return await sendWA(from, backInvalid());
    }

    // Restore data (deep clone to avoid mutation issues)
    const restoredData = JSON.parse(JSON.stringify(previous.data));
    userData.set(from, restoredData);
    userStates.set(from, previous.state);

    // Send contextual message for the restored state
    switch (previous.state) {
        case STATES.START:
            return await sendWA(from, mainMenu());
        case STATES.NAME:
            return await sendWA(from, askName());
        case STATES.SCHOOL:
            return await sendWA(from, askSchool(restoredData.name || ''));
        case STATES.PHONE:
            return await sendWA(from, askPhone());
        case STATES.GRADE:
            return await sendWA(from, askGrade());
        case STATES.MONTHS:
            return await sendWA(from, askMonth());
        case STATES.TUTES_OPTION:
            return await sendWA(from, askTutes());
        case STATES.ADDRESS:
            return await sendWA(from, askAddress());
        case STATES.RECEIPT:
            const fee = restoredData.wantsTutes ? config.TUTE_FEE : config.BASIC_FEE;
            return await sendWA(from, feeInfo(fee));
        case STATES.OLD_ID:
            return await sendWA(from, askOldId());
        case STATES.OLD_CONFIRM:
            return await sendWA(from, oldConfirm(restoredData.name || '', restoredData.grade || '', restoredData.phone || ''));
        case STATES.OLD_TUTES_OPTION:
            return await sendWA(from, askTutes());
        case STATES.OLD_MONTH:
            return await sendWA(from, oldAskMonth());
        default:
            return await sendWA(from, mainMenu());
    }
}

async function handleStart(from, body, lowerBody, data) {
    if (body === '1' || lowerBody.includes('admission')) {
        pushHistory(from, STATES.START, data);
        data.isNewStudent = true;
        userStates.set(from, STATES.NAME);
        return await sendWA(from, askName());
    }
    if (body === '2' || lowerBody.includes('monthly') || lowerBody.includes('pay') || lowerBody.includes('fee')) {
        pushHistory(from, STATES.START, data);
        data.isNewStudent = false;
        userStates.set(from, STATES.OLD_ID);
        return await sendWA(from, askOldId());
    }
    if (body === '3' || lowerBody.includes('complain')) {
        pushHistory(from, STATES.START, data);
        userStates.set(from, STATES.COMPLAIN);
        return await sendWA(from, complainPrompt());
    }
    return await sendWA(from, mainMenu());
}

async function handleName(from, body, data) {
    if (body.length < 3) return await sendWA(from, invalidName());
    pushHistory(from, STATES.NAME, data);
    data.name = body;
    userStates.set(from, STATES.SCHOOL);
    return await sendWA(from, askSchool(body));
}

async function handleSchool(from, body, data) {
    if (body.length < 2) return await sendWA(from, invalidSchool());
    pushHistory(from, STATES.SCHOOL, data);
    data.school = body;
    userStates.set(from, STATES.PHONE);
    return await sendWA(from, askPhone());
}

async function handlePhone(from, body, data) {
    if (!isValidPhone(body)) return await sendWA(from, phoneInvalid());
    pushHistory(from, STATES.PHONE, data);
    const cleanedInput = cleanPhoneNumber(body);
    data.phone = cleanedInput;

    const matches = Array.from(registeredStudentIds.values()).filter(s => cleanPhoneNumber(s.phone) === cleanedInput);
    if (matches.length > 0) {
        const studentNames = matches.map(m => m.name).join(', ');
        await sendWA(from, phoneAlreadyRegistered(studentNames));
        userStates.set(from, STATES.GRADE);
        return;
    }

    userStates.set(from, STATES.GRADE);
    return await sendWA(from, askGrade());
}

async function handleGrade(from, body, data) {
    const grade = parseInt(body, 10);
    if (isNaN(grade) || grade < 6 || grade > 11) return await sendWA(from, gradeInvalid());
    pushHistory(from, STATES.GRADE, data);
    data.grade = grade;
    userStates.set(from, STATES.MONTHS);
    return await sendWA(from, askMonth());
}

async function handleMonths(from, body, data) {
    const resolved = buildMonthYearLabel(body);
    if (!resolved) return await sendWA(from, monthInvalid());
    pushHistory(from, STATES.MONTHS, data);
    data.months = resolved;
    userStates.set(from, STATES.TUTES_OPTION);
    return await sendWA(from, monthRegistered(resolved));
}

async function handleTutesOption(from, body, lowerBody, data) {
    if (!['yes', 'no'].includes(lowerBody)) return await sendWA(from, tutesInvalid());
    const wantsT = lowerBody === 'yes';
    pushHistory(from, STATES.TUTES_OPTION, data);
    data.wantsTutes = wantsT;
    if (wantsT) {
        userStates.set(from, STATES.ADDRESS);
        return await sendWA(from, askAddress());
    } else {
        data.fee = config.BASIC_FEE;
        userStates.set(from, STATES.RECEIPT);
        return await sendWA(from, feeInfo(config.BASIC_FEE));
    }
}

async function handleAddress(from, body, data) {
    pushHistory(from, STATES.ADDRESS, data);
    data.address = body;
    if (data.isNewStudent) {
        data.fee = config.TUTE_FEE;
        userStates.set(from, STATES.RECEIPT);
        return await sendWA(from, feeInfo(config.TUTE_FEE));
    } else {
        userStates.set(from, STATES.OLD_MONTH);
        return await sendWA(from, oldAskMonth());
    }
}

async function handleReceipt(msg, from, data) {
    if (!msg.hasMedia) return await sendWA(from, receiptRequired());

    if (data.isUploading) {
        console.log(`[Media] Ignoring parallel receipt upload from ${from}`);
        return;
    }
    data.isUploading = true;

    try {
        await sendWA(from, receiptUploading());

        let media = null;
        for (let i = 0; i < 3; i++) {
            try {
                media = await msg.downloadMedia();
                if (media && media.data) break;
            } catch (err) {
                console.warn(`[Media] Download attempt ${i + 1} failed:`, err.message);
            }
            await delay(2000);
        }

        if (!media || !media.data) {
            return await sendWA(from, receiptUploadFailed());
        }

        const idForFile = data.idNumber || (data.isNewStudent ? `New_${data.phone || 'Student'}` : data.phone || 'Student');
        const receiptUrl = await uploadReceiptToDrive(media, idForFile, data.name || 'Student');
        if (!receiptUrl) return await sendWA(from, receiptUploadFailed());

        data.receiptUrl = receiptUrl;
        data.receiptMsgId = msg.id._serialized;
        saveSessionsNow();

        await sendWA(from, registrationPreview(data));
        userStates.set(from, STATES.CONFIRM);
    } catch (e) {
        console.error('[Media] Error handling receipt:', e.message);
        return await sendWA(from, receiptUploadFailed());
    } finally {
        delete data.isUploading;
    }
}

async function handleConfirm(from, body, lowerBody, data) {
    if (lowerBody === 'yes') {
        await sendWA(from, submitting());

        try {
            if (data.isNewStudent) {
                data.idNumber = await generateBatchStudentId(data.grade);
                saveSessionsNow();
            }

            await upsertStudentData(data);
            pendingApprovals.set(data.idNumber, { ...data, status: 'Pending' });

            await notifyAdmins(newEnrollmentAlert(data));

            if (data.receiptMsgId) {
                for (const admin of config.ADMIN_NUMBERS) {
                    await forwardMessage(data.receiptMsgId, admin);
                }
            }

            resetUser(from);
            return await sendWA(from, registrationSubmitted(data.idNumber));
        } catch (e) {
            console.error('[Confirm] Error:', e.message);
            return await sendWA(from, systemError());
        }
    }

    if (lowerBody === 'no') {
        resetUser(from);
        return await sendWA(from, registrationCancelled());
    }

    return await sendWA(from, confirmPrompt());
}

async function handleOldId(from, body, data) {
    let nid = normalizeStudentId(body);
    let existing = registeredStudentIds.get(nid);

    if (!existing) {
        if (isValidPhone(body)) {
            const cleanedInput = cleanPhoneNumber(body);
            const matches = Array.from(registeredStudentIds.values()).filter(s => cleanPhoneNumber(s.phone) === cleanedInput);
            if (matches.length === 1) {
                existing = matches[0];
                nid = existing.idNumber;
                await sendWA(from, oldIdFoundAuto(nid, existing.name));
            } else if (matches.length > 1) {
                const sorted = matches.sort((a, b) => a.idNumber.localeCompare(b.idNumber));
                return await sendWA(from, oldIdMultipleMatches(sorted));
            }
        }
    }

    if (!existing) return await sendWA(from, oldIdNotFound(body));

    pushHistory(from, STATES.OLD_ID, data);
    Object.assign(data, existing);
    data.idNumber = nid;
    data.isNewStudent = false;
    userStates.set(from, STATES.OLD_CONFIRM);
    return await sendWA(from, oldConfirm(existing.name, existing.grade, existing.phone));
}

async function handleOldConfirm(from, body, lowerBody, data) {
    if (lowerBody === 'yes') {
        pushHistory(from, STATES.OLD_CONFIRM, data);
        userStates.set(from, STATES.OLD_TUTES_OPTION);
        return await sendWA(from, askTutes());
    }
    if (lowerBody === 'no') {
        userStates.set(from, STATES.OLD_ID);
        return await sendWA(from, askOldId());
    }
    return await sendWA(from, oldConfirmInvalid());
}

async function handleOldTutesOption(from, body, lowerBody, data) {
    if (!['yes', 'no'].includes(lowerBody)) return await sendWA(from, tutesInvalid());
    pushHistory(from, STATES.OLD_TUTES_OPTION, data);
    data.wantsTutes = lowerBody === 'yes';
    if (data.wantsTutes) {
        userStates.set(from, STATES.ADDRESS);
        return await sendWA(from, askAddress());
    }
    userStates.set(from, STATES.OLD_MONTH);
    return await sendWA(from, oldAskMonth());
}

async function handleOldMonth(from, body, data) {
    const resolved = buildMonthYearLabel(body);
    if (!resolved) return await sendWA(from, monthInvalid());
    pushHistory(from, STATES.OLD_MONTH, data);
    data.months = resolved;
    data.status = 'Pending';
        data.fee = data.wantsTutes ? config.TUTE_FEE : config.BASIC_FEE;
    userStates.set(from, STATES.RECEIPT);
    return await sendWA(from, oldMonthFee(resolved, data.fee));
}

async function handleComplain(from, body, data) {
    await notifyAdmins(complainAlert(from, body));
    await saveComplaintToSheets(from, body);
    resetUser(from);
    return await sendWA(from, complainSent());
}

async function handleBackMenu(from, body, data) {
    const choice = parseInt(body, 10);
    if (data.isNewStudent) {
        switch (choice) {
            case 1:
                userStates.set(from, STATES.NAME);
                return await sendWA(from, askName());
            case 2:
                userStates.set(from, STATES.SCHOOL);
                return await sendWA(from, askSchool(data.name || ''));
            case 3:
                userStates.set(from, STATES.PHONE);
                return await sendWA(from, askPhone());
            case 4:
                userStates.set(from, STATES.GRADE);
                return await sendWA(from, askGrade());
            case 5:
                userStates.set(from, STATES.MONTHS);
                return await sendWA(from, askMonth());
            case 6:
                userStates.set(from, STATES.TUTES_OPTION);
                return await sendWA(from, askTutes());
            default:
                return await sendWA(from, invalidBackMenuNew());
        }
    } else {
        switch (choice) {
            case 1:
                userStates.set(from, STATES.OLD_ID);
                return await sendWA(from, askOldId());
            case 2:
                userStates.set(from, STATES.OLD_TUTES_OPTION);
                return await sendWA(from, askTutes());
            case 3:
                userStates.set(from, STATES.OLD_MONTH);
                return await sendWA(from, oldAskMonth());
            default:
                return await sendWA(from, invalidBackMenuOld());
        }
    }
}

module.exports = { handleStudentMessage };
