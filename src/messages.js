const config = require('./config');
const { getBankLabel } = require('./config');

// ============================================================================
// ALL BOT MESSAGES — Sri Lankan Sinhala-English Mix Style
// Rules: Short (2-6 lines max), friendly, natural chat feel
// ============================================================================

function mainMenu() {
    return `Welcome to *${config.SCHOOL_NAME}*! 🎓

1️⃣ New admission
2️⃣ Pay monthly fees  
3️⃣ Complain

_Type *menu* anytime to come back here_`;
}

function tooManyMessages() {
    return `⚠️ Message godak awa 😕
Tikak idala nawatha try karanna`;
}

function systemError() {
    return `❌ Something went wrong 😕
Type *menu* to start again`;
}

function cancelDone() {
    return `👋 Cancel kala. *menu* type karanna`;
}

function backInvalid() {
    return `🔙 Meken backward karanna ba 😕
*menu* type karanna`;
}

function backMenuNewStudent() {
    return `🔙 *Edit karanna oneda?*

1. Name
2. School
3. Phone
4. Grade
5. Month
6. Tute Choice

_Number eka type karanna_`;
}

function backMenuOldStudent() {
    return `🔙 *Edit karanna oneda?*

1. Student ID
2. Tute Choice
3. Month

_Number eka type karanna_`;
}

// --- REGISTRATION FLOW ---

function askName() {
    return `🤝 Full name eka ewanna

*back* = edit menu | *menu* = exit`;
}

function askSchool(name) {
    return `Nice to meet you, *${name}*! 😊
School eka mokakda?

*back* = edit menu | *menu* = exit`;
}

function askPhone() {
    return `📱 Phone number eka ewanna
(Example: 0771234567)

*back* = edit menu | *menu* = exit`;
}

function phoneInvalid() {
    return `❌ Phone number eka waradi 😕
077/076 wage 10 digit number ekak danna`;
}

function phoneAlreadyRegistered(names) {
    return `🔍 Me number ekata *${names}* already register wela thiyenawa.

Wena student kenek nam continue karanna.

Grade eka mokakda? (6-11)`;
}

function askGrade() {
    return `Grade eka mokakda? (6-11)

*back* = edit menu | *menu* = exit`;
}

function gradeInvalid() {
    return `❌ Grade 6-11 athara number ekak witharak ewanna`;
}

function askMonth() {
    return `🗓️ pay karana Month eka mokakda?
(Example: April)

*back* = edit menu | *menu* = exit`;
}

function monthInvalid() {
    return `❌ Month eka waradi 😕
April, May wage ewanna`;
}

function monthRegistered(month) {
    return `✅ *${month}* walata register kala 👍
Tutes oneda? (yes / no)

*back* = edit menu | *menu* = exit`;
}

function askTutes() {
    return `📦 Tutes oneda? (yes / no)

*back* = edit menu | *menu* = exit`;
}

function tutesInvalid() {
    return `❌ *yes* or *no* witharak ewanna 😊`;
}

function askAddress() {
    return `🏠 Full address eka ewanna
Tutes post karanna 

*back* = edit menu | *menu* = exit`;
}

function feeInfo(fee) {
    return `💰 *Fee:* LKR ${fee}

${getBankLabel()}

📸 Pay karala Receipt eka upload karanna

*back* = edit menu | *menu* = exit`;
}

function receiptRequired() {
    return `❌ Receipt eka image/PDF ekak widiyata upload karanna`;
}

function receiptUploading() {
    return `⏳ Uploading...`;
}

function receiptUploadFailed() {
    return `⚠️ Receipt upload eka fail una 😕
Clear photo ekak ewanna (JPG/PNG/PDF)`;
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
    return `✅ Admission eka submit kala 👍

🆔 *Your Student ID:* ${idNumber}

Sir check karala group ekata add karai`;
}

function registrationCancelled() {
    return `👋 Cancel kala. *menu* type karanna`;
}

function confirmBackInvalid() {
    return `🔙 Receipt eka upload karapu nisa 
Meken backward yanna ba

*yes* = submit | *menu* = cancel`;
}

function invalidName() {
    return `❌ Full name eka nawatha check karanna`;
}

function invalidSchool() {
    return `❌ School name eka nawatha check karanna`;
}

function submitting() {
    return `⏳ Submitting...`;
}

function confirmPrompt() {
    return `*yes* = submit | *menu* = cancel`;
}

function invalidBackMenuNew() {
    return `❌ 1-6 athare number ekak ewanna`;
}

function invalidBackMenuOld() {
    return `❌ 1-3 athare number ekak ewanna`;
}

// --- RETURNING STUDENT FLOW ---

function askOldId() {
    return `🆔 Student ID or phone number eka ewanna

*back* = edit menu | *menu* = exit`;
}

function oldIdNotFound(input) {
    return `❌ *${input}* ta student kenek hambune naha.

New admission ekak nam *menu* -> 1 type karanna. Old student kenek nam
Sir ta call karanna 😊`;
}

function oldIdMultipleMatches(matches) {
    let list = `🔍 *Me number ekata students:*\n\n`;
    matches.forEach(m => {
        list += `• *${m.idNumber}* — ${m.name}\n`;
    });
    list += `\n*Student ID* eka denna`;
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
    return `❌ *yes* or *no* witharak ewanna`;
}

function oldAskMonth() {
    return `🗓️ pay karana Month eka mokakda?

*back* = edit menu | *menu* = exit`;
}

function oldMonthFee(month, fee) {
    return `✅ *${month}* walata register kala 👍

💰 *Amount:* LKR ${fee}

${getBankLabel()}

📸 Pay karala Receipt eka upload karanna`;
}

// --- COMPLAINT ---

function complainPrompt() {
    return `📝 Complain eka type karanna
Sir ta send karannam`;
}

function complainSent() {
    return `✅ Send kala. Thank you! 🙏`;
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
• getgroups`;
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
    return `✅ *${field}* update kara: *${value}* 👍
Type *settings* to check`;
}

function adminSetFail(usage) {
    return `❌ Usage: ${usage}`;
}

function adminOnlyMaster() {
    return `🚫 Master admin witharai meka karanna puluwan`;
}

function adminBroadcastStart(target) {
    return `🚀 *Broadcast* ${target}...`;
}

function adminBroadcastDone(success, total) {
    return `✅ *Broadcast Done*\nSent ${success}/${total} students`;
}

function adminNoStudents(grade) {
    return `ℹ️ Grade ${grade} students hambune naha`;
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
    return `🚀 Reminders ${count} studentslata send karanna...`;
}

function adminRemindDone(success, failed, total) {
    return `✅ *Reminders Sent*\n📬 Delivered: ${success}\n❌ Failed: ${failed}\n📊 Total Unpaid: ${total}`;
}

function adminAllPaid(grade, monthLabel) {
    return `🎉 Grade ${grade} students siyaluma *${monthLabel}* pay kala!`;
}

function adminReminderMsg(studentName, monthLabel, fee) {
    return `📢 *Payment Reminder*

Hi *${studentName}*,
*${monthLabel}* walata payment eka karala naha.

💰 *Fee:* LKR ${fee}

${config.getBankLabel()}

Receipt eka me bot eken upload karanna.
_Already paid nam ignore karanna_`;
}

function adminApprovePrompt(approval, groupsList) {
    let msg = `📌 Approve *${approval.idNumber}* (${approval.name})\n`;
    msg += `Grade: ${approval.grade} | Month: ${approval.months}\n`;
    msg += `Tutes: ${approval.wantsTutes ? 'Yes' : 'No'} | Fee: LKR ${approval.fee || approval.totalFee || 'N/A'}\n\n`;
    msg += `Select group:\n\n${groupsList}`;
    return msg;
}

function adminApproveSuccess(studentId, groupName) {
    return `✅ *${studentId}* ${groupName} ekata add kala 👍`;
}

function adminApproveNotify(groupName) {
    return `🎉 *APPROVED!* ${groupName} class ekata add kala 🎓
Thank you!`;
}

function adminRejectSuccess(studentId) {
    return `✅ *${studentId}* reject kala`;
}

function adminRejectNotify(reason) {
    return `❌ *Registration Rejected*\nReason: ${reason}\n\nPlease fix karala resubmit karanna`;
}

function adminPendingList(list, total) {
    let msg = `⏳ *Pending (${total})*\n\n`;
    list.forEach((s, i) => {
        msg += `${i + 1}. *${s.idNumber}* — ${s.name}\nGrade ${s.grade} | ${s.months}\n\n`;
    });
    msg += `_"approve <id>" type karanna_`;
    return msg;
}

function adminNoPending() {
    return `ℹ️ Pending students hambune naha`;
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
    return `ℹ️ "${query}" ta students hambune naha`;
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
    return `👢 *${studentId}* remove kala\nReason: ${reason}`;
}

function adminKickNotify(reason) {
    return `🚫 *Access Removed*\nReason: ${reason}\n\nMistake ekak nam Sir ta message karanna`;
}

function adminDeleteSuccess(studentId) {
    return `🗑️ *${studentId}* delete kala`;
}

function adminEditSuccess(studentId, field, value) {
    return `✅ *${studentId}* update kala: ${field} -> *${value}*`;
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
    return `❌ Student hambune naha`;
}

function adminInvalidSelection() {
    return `❌ Invalid selection`;
}

function adminGroupNotSet(name) {
    return `❌ ${name} configure kala naha`;
}

function adminApprovalNotFound() {
    return `❌ Pending approval hambune naha`;
}

function adminAlreadyAdmin() {
    return `ℹ️ Already admin`;
}

function adminNotAdmin() {
    return `❌ Me ID eka admin naha`;
}

function adminKickFailNotAdmin() {
    return `❌ Group eke admin naha mama 😕`;
}

function adminKickNoGroup() {
    return `❌ Me student group ekata add wela naha`;
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
    msg += `"approve ${data.idNumber}" type karanna`;
    return msg;
}

function complainAlert(from, body) {
    return `📣 *Complain* from ${from}:\n\n${body}`;
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
    newEnrollmentAlert,
    complainAlert
};
