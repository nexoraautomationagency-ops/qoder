const { ADMIN_NUMBERS } = require('./config');

async function isUserAdmin(msg) {
    const from = msg.from;

    // Resolve contact phone first (most reliable for LID mismatch)
    try {
        const contact = await msg.getContact();
        if (contact && contact.number) {
            const phoneJid = `${contact.number}@c.us`;
            if (ADMIN_NUMBERS.includes(phoneJid)) {
                if (phoneJid === ADMIN_NUMBERS[0]) {
                    msg._resolvedMaster = true;
                }
                return true;
            }
        }
    } catch (e) {
        console.warn(`[Admin Check] Failed to resolve contact for ${from}:`, e.message);
    }

    // Direct match
    if (ADMIN_NUMBERS.includes(from)) {
        if (from === ADMIN_NUMBERS[0]) msg._resolvedMaster = true;
        return true;
    }

    // LID fallback
    if (from.includes('@lid')) {
        for (const admin of ADMIN_NUMBERS) {
            if (admin.startsWith(from.split('@')[0])) return true;
        }
    }

    return false;
}

function isMasterAdmin(msg, from) {
    return msg._resolvedMaster || from === ADMIN_NUMBERS[0];
}

module.exports = {
    isUserAdmin,
    isMasterAdmin
};
