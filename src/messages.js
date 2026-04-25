const config = require('./config');
const { getBankLabel } = require('./config');

// ============================================================================
// ALL BOT MESSAGES — Simple English
// Rules: Short (2-6 lines max), friendly, easy for students to understand
// ============================================================================

function mainMenu() {
    return `Welcome to *${config.SCHOOL_NAME}*! 🎓

1️⃣ New admission
2️⃣ Pay monthly fees  
3️⃣ Complain

_Type *menu* anytime to come back here_`;
}

function tooManyMessages() {
    return `⚠️ You sent too many messages 😕
Please wait a bit and try again`;
}

function systemError() {
    return `❌ Something went wrong 😕
Type *menu* to start again`;
}

function cancelDone() {
    return `👋 Cancelled. Type *menu* to go back`;
}

function backInvalid() {
    return `🔙 You can't go back from here 😕
Type *menu* to start over`;
}

function backMenuNewStudent() {
    return `🔙 *Want to edit?*

1. Name
2. School
3. Phone
4. Grade
5. Month
6. Tute Choice

_Type the number_`;
}

function backMenuOldStudent() {
    return `🔙 *Want to edit?*

1. Student ID
2. Tute Choice
3. Month

_Type the number_`;
}

// --- REGISTRATION FLOW ---

function askName() {
    return `🤝 Please send your full name

*back* = edit menu | *menu* = exit`;
}

function askSchool(name) {
    return `Nice to meet you, *${name}*! 😊
Which school do you go to?

*back* = edit menu | *menu* = exit`;
}

function askPhone() {
    return `📱 Please send your phone number
(Example: 0771234567)

*back* = edit menu | *menu* = exit`;
}

function phoneInvalid() {
    return `❌ Invalid phone number 😕
Please enter a 10-digit number starting with 077 or 076`;
}

function phoneAlreadyRegistered(names) {
    return `🔍 This number is already registered under *${names}*.

If you are a different student, please continue.

What is your grade? (6-11)`;
}

function askGrade() {
    return `What is your grade? (6-11)

*back* = edit menu | *menu* = exit`;
}

function gradeInvalid() {
    return `❌ Please enter a grade between 6 and 11 only`;
}

function askMonth() {
    return `🗓️ Which month are you paying for?
(Example: April)

*back* = edit menu | *menu* = exit`;
}

function monthInvalid() {
    return `❌ Invalid month 😕
Please enter like: April, May`;
}

function monthRegistered(month) {
    return `✅ Registered for *${month}* 👍
Want tutes? (yes / no)

*back* = edit menu | *menu* = exit`;
}

function askTutes() {
    return `📦 Want tutes? (yes / no)

*back* = edit menu | *menu* = exit`;
}

function tutesInvalid() {
    return `❌ Please only reply with *yes* or *no* 😊`;
}

function askAddress() {
    return `🏠 Please send your full address
So we can post the tutes to you

*back* = edit menu | *menu* = exit`;
}

function feeInfo(fee) {
    return `💰 *Fee:* LKR ${fee}

${getBankLabel()}

📸 After paying, please upload the receipt

*back* = edit menu | *menu* = exit`;
}

function receiptRequired() {
    return `❌ Please upload the receipt as an image or PDF`;
}

function receiptUploading() {
    return `⏳ Uploading...`;
}

function receiptUploadFailed() {
    return `⚠️ Receipt upload failed 😕
Please send a clear photo (JPG/PNG/PDF)`;
}

function registrationPreview(data) {
    let preview = `📋 *Preview*

Name: ${data.name}
School: ${data.school || 'N/A'}
ID: ${data.idNumber || 'New Registration'}
Month: ${data.months}
Grade: ${data.grade}
Tutes: ${data.wantsTutes ? 'Yes' : 'No'}`;
    if (data.wantsTutes && data.address) {
        preview += `\nAddress: ${data.address}`;
    }
    preview += `\n\n*yes* = submit | *menu* = cancel`;
    return preview;
}

function registrationSubmitted(idNumber) {
    return `✅ Admission submitted 👍

🆔 *Your Student ID:* ${idNumber}

Sir will check and add you to the group`;
}

function registrationCancelled() {
    return `👋 Cancelled. Type *menu* to go back`;
}

function confirmBackInvalid() {
    return `🔙 You already uploaded the receipt
So you can't go back from here

*yes* = submit | *menu* = cancel`;
}

function invalidName() {
    return `❌ Please check your full name and try again`;
}

function invalidSchool() {
    return `❌ Please check your school name and try again`;
}

function submitting() {
    return `⏳ Submitting...`;
}

function confirmPrompt() {
    return `*yes* = submit | *menu* = cancel`;
}

function invalidBackMenuNew() {
    return `❌ Please enter a number between 1 and 6`;
}

function invalidBackMenuOld() {
    return `❌ Please enter a number between 1 and 3`;
}

// --- RETURNING STUDENT FLOW ---

function askOldId() {
    return `🆔 Please send your Student ID or phone number

*back* = edit menu | *menu* = exit`;
}

function oldIdNotFound(input) {
    return `❌ No student found with *${input}*.

If you are new, type *menu* → 1.
If you are an old student, please call Sir 😊`;
}

function oldIdMultipleMatches(matches) {
    let list = `🔍 *Students under this number:*\n\n`;
    matches.forEach(m => {
        list += `• *${m.idNumber}* — ${m.name}\n`;
    });
    list += `\n*Please send the Student ID*`;
    return list;
}

function oldIdFoundAuto(idNumber, name) {
    return `🔍 *ID Found!* Your ID: *${idNumber}* (${name})`;
}

function oldConfirm(name, grade, phone) {
    return `👋 Welcome back, *${name}*!
Grade: ${grade}
Phone: ${phone}

*yes* = continue | *no* = change ID

*back* = edit menu | *menu* = exit`;
}

function oldConfirmInvalid() {
    return `❌ Please only reply with *yes* or *no*`;
}

function oldAskMonth() {
    return `🗓️ Which month are you paying for?

*back* = edit menu | *menu* = exit`;
}

function oldMonthFee(month, fee) {
    return `✅ Registered for *${month}* 👍

💰 *Amount:* LKR ${fee}

${getBankLabel()}

📸 After paying, please upload the receipt`;
}

// --- COMPLAINT ---

function complainPrompt() {
    return `📝 Please type your complaint
It will be sent to Sir`;
}

function complainSent() {
    return `✅ Sent. Thank you! 🙏`;
}

// --- ADMIN MESSAGES ---

function adminHelp() {
    return `🛠️ *ADMIN PANEL*

*Broadcast*
• broadcast msg
• broadcast grade 10 msg

*Settings*
• set school <name>
• set fee basic <val>
• set fee tute <val>
• set bank name|accname|number|branch <val>
• set group <6-11> <id>

*Admin Mgmt*
• set admin add|remove <id>

*Payments*
• check payments <grade> <month>
• remind unpaid <grade> <month>

*Other*
• settings | listadmins | list pending
• status <id> | search name <text>
• approve <id> | reject <id> <reason>
• kick <id> | delete student <id>
• edit student <id> <field> <value>
• getgroups | endyear`;
}

function adminSettings() {
    const { ADMIN_NUMBERS, GROUPS, SCHOOL_NAME } = config;
    let summary = `⚙️ *Settings*\n\n`;
    summary += `🏫 School: ${SCHOOL_NAME}\n`;
    summary += `👥 Admins: ${ADMIN_NUMBERS.length}\n`;
    summary += `\n📦 Groups:\n` + GROUPS.map(g => `• ${g.name}: ${g.id || 'Not Set'}`).join('\n');
    summary += `\n\n💰 *Bank Info*\n${getBankLabel()}`;
    return summary;
}

function adminListAdmins(admins) {
    return `👥 *Admins:*\n\n` + admins.map((id, i) => `${i + 1}. ${id}`).join('\n');
}

function adminSetSuccess(field, value) {
    return `✅ *${field}* updated to: *${value}* 👍
Type *settings* to check`;
}

function adminSetFail(usage) {
    return `❌ Usage: ${usage}`;
}

function adminOnlyMaster() {
    return `🚫 Only the master admin can do this`;
}

function adminBroadcastStart(target) {
    return `🚀 *Broadcast* ${target}...`;
}

function adminBroadcastDone(success, total) {
    return `✅ *Broadcast Done*\nSent ${success}/${total} students`;
}

function adminNoStudents(grade) {
    return `ℹ️ No students found in Grade ${grade}`;
}

function adminCheckPayments(result, grade) {
    let msg = `💰 *Payment Report*\n📅 ${result.monthLabel} | Grade ${grade}\n\n`;
    msg += `✅ Paid: ${result.paid.length}\n`;
    msg += `⏳ Pending: ${result.pending.length}\n`;
    msg += `❌ Unpaid: ${result.unpaid.length}\n`;
    msg += `📊 Total: ${result.total}\n`;

    if (result.paid.length > 0) {
        msg += `\n✅ *Paid:*\n`;
        result.paid.slice(0, 10).forEach((s, i) => msg += `${i + 1}. ${s.idNumber} — ${s.name}\n`);
        if (result.paid.length > 10) msg += `...and ${result.paid.length - 10} more\n`;
    }

    if (result.pending.length > 0) {
        msg += `\n⏳ *Pending:*\n`;
        result.pending.slice(0, 10).forEach((s, i) => msg += `${i + 1}. ${s.idNumber} — ${s.name}\n`);
        if (result.pending.length > 10) msg += `...and ${result.pending.length - 10} more\n`;
    }

    if (result.unpaid.length > 0) {
        msg += `\n❌ *Unpaid:*\n`;
        result.unpaid.slice(0, 10).forEach((s, i) => msg += `${i + 1}. ${s.idNumber} — ${s.name}\n`);
        if (result.unpaid.length > 10) msg += `...and ${result.unpaid.length - 10} more\n`;
    }

    if (result.unpaid.length > 0) {
        msg += `\n_Type "remind unpaid ${grade} ${result.monthLabel.split('-')[0]}" to send reminders_`;
    }
    return msg;
}

function adminCheckPaymentsError(e) {
    return `❌ Error checking payments: ${e.message}`;
}

function adminRemindStart(count) {
    return `🚀 Sending reminders to ${count} students...`;
}

function adminRemindDone(success, failed, total) {
    return `✅ *Reminders Sent*\n📬 Delivered: ${success}\n❌ Failed: ${failed}\n📊 Total Unpaid: ${total}`;
}

function adminAllPaid(grade, monthLabel) {
    return `🎉 All Grade ${grade} students have paid for *${monthLabel}*!`;
}

function adminReminderMsg(studentName, monthLabel, fee) {
    return `📢 *Payment Reminder*

Hi *${studentName}*,
You have not paid for *${monthLabel}*.

💰 *Fee:* LKR ${fee}

${config.getBankLabel()}

Please upload the receipt using this bot.
_If already paid, please ignore this_`;
}

function adminApprovePrompt(approval, groupsList) {
    let msg = `📌 Approve *${approval.idNumber}* (${approval.name})\n`;
    msg += `Grade: ${approval.grade} | Month: ${approval.months}\n`;
    msg += `Tutes: ${approval.wantsTutes ? 'Yes' : 'No'} | Fee: LKR ${approval.fee || approval.totalFee || 'N/A'}\n\n`;
    msg += `Select group:\n\n${groupsList}`;
    return msg;
}

function adminApproveSuccess(studentId, groupName) {
    return `✅ *${studentId}* added to ${groupName} 👍`;
}

function adminApproveNotify(groupName) {
    return `🎉 *APPROVED!* Added to ${groupName} class 🎓
Thank you!`;
}

function adminRejectSuccess(studentId) {
    return `✅ *${studentId}* rejected`;
}

function adminRejectNotify(reason) {
    return `❌ *Registration Rejected*\nReason: ${reason}\n\nPlease fix the issues and resubmit`;
}

function adminPendingList(list, total) {
    let msg = `⏳ *Pending (${total})*\n\n`;
    list.forEach((s, i) => {
        msg += `${i + 1}. *${s.idNumber}* — ${s.name}\nGrade ${s.grade} | ${s.months}\n\n`;
    });
    msg += `_Type "approve <id>" to approve_`;
    return msg;
}

function adminNoPending() {
    return `ℹ️ No pending students found`;
}

function adminSearchResults(query, matches) {
    let msg = `🔍 *"${query}" Results (${matches.length})*\n\n`;
    matches.slice(0, 15).forEach((s, i) => {
        msg += `${i + 1}. *${s.idNumber}* — ${s.name}\nGrade ${s.grade} | ${s.status}\n\n`;
    });
    if (matches.length > 15) msg += `...and ${matches.length - 15} more\n`;
    return msg;
}

function adminSearchNoResults(query) {
    return `ℹ️ No students found for "${query}"`;
}

function adminStudentStatus(student) {
    let details = `👤 *${student.idNumber}*\n\n`;
    details += `Name: ${student.name}\n`;
    details += `School: ${student.school || 'N/A'}\n`;
    details += `Grade: ${student.grade}\n`;
    details += `Month: ${student.months}\n`;
    details += `Status: *${student.status}*`;
    if (student.groupId) details += `\nGroup: ${student.groupId}`;
    return details;
}

function adminKickSuccess(studentId, reason) {
    return `👢 *${studentId}* removed\nReason: ${reason}`;
}

function adminKickNotify(reason) {
    return `🚫 *Access Removed*\nReason: ${reason}\n\nIf this is a mistake, please message Sir`;
}

function adminDeleteSuccess(studentId) {
    return `🗑️ *${studentId}* deleted`;
}

function adminEditSuccess(studentId, field, value) {
    return `✅ *${studentId}* updated: ${field} → *${value}*`;
}

function adminInvalidField(fields) {
    return `❌ Invalid field. Valid: ${fields.join(', ')}`;
}

function adminGroupList(groups) {
    let list = '📂 *Groups:*\n\n';
    groups.forEach(g => {
        list += `*${g.name}*\nID: ${g.id._serialized}\n\n`;
    });
    return list || 'No groups found.';
}

function adminNotFound() {
    return `❌ Student not found`;
}

function adminInvalidSelection() {
    return `❌ Invalid selection`;
}

function adminGroupNotSet(name) {
    return `❌ ${name} not configured`;
}

function adminApprovalNotFound() {
    return `❌ Pending approval not found`;
}

function adminAlreadyAdmin() {
    return `ℹ️ Already admin`;
}

function adminNotAdmin() {
    return `❌ This ID is not an admin`;
}

function adminKickFailNotAdmin() {
    return `❌ I am not an admin in the group 😕`;
}

function adminKickNoGroup() {
    return `❌ This student is not in any group`;
}

// --- GRADUATION ---

function adminGraduationConfirm(toGraduate, toPromote, pending) {
    let msg = `🎓 *END OF YEAR TRANSITION*\n\n`;
    msg += `This will:\n`;
    msg += `✅ Graduate *${toGraduate.length}* Grade-11 students\n`;
    msg += `✅ Promote *${toPromote.length}* students (Grade 6→7, 7→8, ... 10→11)\n`;
    if (pending.length > 0) msg += `⏭️ Skip *${pending.length}* pending students (approve or reject them first)\n`;
    msg += `\nGraduated students:\n`;
    if (toGraduate.length === 0) {
        msg += `• None\n`;
    } else {
        toGraduate.slice(0, 10).forEach(s => msg += `• ${s.idNumber} — ${s.name}\n`);
        if (toGraduate.length > 10) msg += `...and ${toGraduate.length - 10} more\n`;
    }
    msg += `\n⚠️ *This cannot be undone!*\n\n`;
    msg += `Type *endyear confirm* to proceed`;
    return msg;
}

function adminGraduationDone(graduated, promoted, errors, pendingSkipped, errorsList) {
    let msg = `✅ *Year-End Complete!*\n\n`;
    msg += `🎓 Graduated: ${graduated}\n`;
    msg += `📈 Promoted: ${promoted}\n`;
    if (pendingSkipped > 0) msg += `⏭️ Skipped (pending): ${pendingSkipped}\n`;
    if (errors > 0) {
        msg += `❌ Errors: ${errors}\n`;
        errorsList.slice(0, 5).forEach(e => msg += `• ${e}\n`);
    }
    msg += `\nType *settings* to check`;
    return msg;
}

function studentGraduated(name) {
    return `🎓 Hi *${name}*!\n\n`
    + `You have completed your O-Levels and graduated.\n`
    + `This bot is for current students only.\n\n`
    + `Thank you and best wishes for your future! 🌟`;
}

// --- NOTIFICATIONS ---

function newEnrollmentAlert(data) {
    let msg = `🔔 *New Enrollment*\n`;
    msg += `ID: ${data.idNumber}\n`;
    msg += `Name: ${data.name}\n`;
    msg += `School: ${data.school || 'N/A'}\n`;
    msg += `Grade: ${data.grade}\n`;
    msg += `Phone: ${data.phone}\n`;
    msg += `Month: ${data.months}\n`;
    msg += `Tutes: ${data.wantsTutes ? 'Yes' : 'No'}\n`;
    msg += `Fee: LKR ${data.fee || data.totalFee || 'N/A'}`;
    if (data.wantsTutes && data.address) {
        msg += `\nAddress: ${data.address}`;
    }
    msg += `\nReceipt: ${data.receiptUrl}\n\n`;
    msg += `Type "approve ${data.idNumber}" to approve`;
    return msg;
}

function complainAlert(from, body) {
    return `📣 *Complaint* from ${from}:\n\n${body}`;
}

module.exports = {
    mainMenu,
    tooManyMessages,
    systemError,
    cancelDone,
    backInvalid,
    backMenuNewStudent,
    backMenuOldStudent,
    askName,
    askSchool,
    askPhone,
    phoneInvalid,
    phoneAlreadyRegistered,
    askGrade,
    gradeInvalid,
    askMonth,
    monthInvalid,
    monthRegistered,
    askTutes,
    tutesInvalid,
    askAddress,
    feeInfo,
    receiptRequired,
    receiptUploading,
    receiptUploadFailed,
    registrationPreview,
    registrationSubmitted,
    registrationCancelled,
    confirmBackInvalid,
    invalidName,
    invalidSchool,
    submitting,
    confirmPrompt,
    invalidBackMenuNew,
    invalidBackMenuOld,
    askOldId,
    oldIdNotFound,
    oldIdMultipleMatches,
    oldIdFoundAuto,
    oldConfirm,
    oldConfirmInvalid,
    oldAskMonth,
    oldMonthFee,
    complainPrompt,
    complainSent,
    adminHelp,
    adminSettings,
    adminListAdmins,
    adminSetSuccess,
    adminSetFail,
    adminOnlyMaster,
    adminBroadcastStart,
    adminBroadcastDone,
    adminNoStudents,
    adminCheckPayments,
    adminCheckPaymentsError,
    adminRemindStart,
    adminRemindDone,
    adminAllPaid,
    adminReminderMsg,
    adminApprovePrompt,
    adminApproveSuccess,
    adminApproveNotify,
    adminRejectSuccess,
    adminRejectNotify,
    adminPendingList,
    adminNoPending,
    adminSearchResults,
    adminSearchNoResults,
    adminStudentStatus,
    adminKickSuccess,
    adminKickNotify,
    adminDeleteSuccess,
    adminEditSuccess,
    adminInvalidField,
    adminGroupList,
    adminNotFound,
    adminInvalidSelection,
    adminGroupNotSet,
    adminApprovalNotFound,
    adminAlreadyAdmin,
    adminNotAdmin,
    adminKickFailNotAdmin,
    adminKickNoGroup,
    adminGraduationConfirm,
    adminGraduationDone,
    studentGraduated,
    newEnrollmentAlert,
    complainAlert
};
