const config = require('./config');
const { OUTBOUND_DELAY_MS } = require('./config');

let clientInstance = null;

function setClient(client) {
    clientInstance = client;
}

function getClient() {
    return clientInstance;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function sendWA(to, text, options = {}) {
    try {
        if (!clientInstance) throw new Error('WhatsApp client not initialized');
        let recipient = typeof to === 'object' ? (to.from || to.id?._serialized) : to;
        if (typeof recipient !== 'string') throw new Error('Recipient must be a string JID');

        if (!recipient.includes('@')) recipient = `${recipient.replace(/\D/g, '')}@c.us`;

        if (recipient.includes('@lid')) {
            try {
                const contact = await clientInstance.getContactById(recipient);
                if (contact?.id?._serialized) {
                    const resolved = contact.id._serialized;
                    if (resolved !== recipient) {
                        console.log(`[LID Resolution] Resolved ${recipient} -> ${resolved}`);
                        recipient = resolved;
                    }
                }
            } catch (e) {}
        }

        console.log(`[Outgoing] To ${recipient}: ${typeof text === 'string' ? text.slice(0, 60).replace(/\n/g, ' ') + '...' : '[Media]'}`);

        // Retry on "Promise was collected" errors (known whatsapp-web.js/Chromium issue)
        let lastErr;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const result = await clientInstance.sendMessage(recipient, text, options);
                await delay(OUTBOUND_DELAY_MS);
                return result;
            } catch (err) {
                lastErr = err;
                if (err.message && err.message.includes('Promise was collected') && attempt < 2) {
                    console.warn(`[Outgoing] Promise collected, retry ${attempt + 1}/2 for ${recipient}`);
                    await delay(300);
                    continue;
                }
                throw err;
            }
        }
        throw lastErr;
    } catch (err) {
        console.error(`Failed to send message to ${to}:`, err.message);
        throw err;
    }
}

async function notifyAdmins(content, options = {}) {
    for (const admin of config.ADMIN_NUMBERS) {
        try {
            if (content.data && content.mimetype) {
                await clientInstance.sendMessage(admin, content);
            } else {
                await sendWA(admin, content, options);
            }
        } catch (e) {
            console.error(`Admin Notification Failed for ${admin}:`, e.message);
        }
    }
}

async function addStudentToGroup(groupId, contactId) {
    if (!groupId || !contactId) throw new Error('Invalid IDs');

    let participantId = contactId.trim();
    if (participantId.includes('@lid')) {
        try {
            const contact = await clientInstance.getContactById(participantId);
            if (contact?.id?._serialized && !contact.id._serialized.includes('@lid')) {
                participantId = contact.id._serialized;
            }
        } catch (e) { console.warn(`[Group Add] LID fetch failed for ${participantId}:`, e.message); }
    }

    if (!participantId.includes('@')) participantId = `${participantId}@c.us`;
    if (participantId.includes('@lid')) {
        try {
            const contact = await clientInstance.getContactById(participantId);
            const resolved = contact.id?._serialized;
            if (resolved && !resolved.includes('@lid')) participantId = resolved;
        } catch (e) {}
    }

    const chat = await clientInstance.getChatById(groupId);
    if (!chat || !chat.isGroup) throw new Error('Invalid Group');
    return await chat.addParticipants([participantId]);
}

async function removeStudentFromGroup(groupId, contactId) {
    if (!groupId || !contactId) throw new Error('Invalid IDs');

    let targetJid = contactId.trim();
    if (targetJid.includes('@lid')) {
        try {
            const contact = await clientInstance.getContactById(targetJid);
            if (contact?.id?._serialized && !contact.id._serialized.includes('@lid')) {
                targetJid = contact.id._serialized;
            }
        } catch (e) {}
    }

    const chat = await clientInstance.getChatById(groupId);
    const me = chat.participants.find(p => p.id._serialized === clientInstance.info.me._serialized || p.id.user === clientInstance.info.wid.user);
    if (!me || !me.isAdmin) throw new Error('I am not an admin in that group');

    await chat.removeParticipants([targetJid]);
}

async function getGroupList() {
    const chats = await clientInstance.getChats();
    return chats.filter(c => c.isGroup);
}

async function forwardMessage(messageId, toJid) {
    try {
        const msg = await clientInstance.getMessageById(messageId);
        await msg.forward(toJid);
    } catch (e) {
        console.warn('Failed to forward message:', e.message);
    }
}

module.exports = {
    setClient,
    getClient,
    sendWA,
    notifyAdmins,
    addStudentToGroup,
    removeStudentFromGroup,
    getGroupList,
    forwardMessage
};
