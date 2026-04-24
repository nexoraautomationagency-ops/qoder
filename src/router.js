const { isUserAdmin } = require('./security');
const stateMachine = require('./state-machine');
const { isRateLimited, getCanonicalId, processedMessages, saveSessions, migrateLidSession } = stateMachine;
const { sendWA } = require('./whatsapp');
const { handleAdminCommand } = require('./handlers/admin');
const { handleStudentMessage } = require('./handlers/student');
const { tooManyMessages, systemError } = require('./messages');

async function routeMessage(msg, client) {
    if (stateMachine.isShuttingDown) return;
    if (!stateMachine.isSystemReady) {
        console.log(`[System] Ignoring message from ${msg.from} — bot still initializing.`);
        return;
    }
    if (msg.fromMe) return;

    // Deduplication
    if (processedMessages.has(msg.id._serialized)) {
        console.log(`[System] Duplicate message ${msg.id._serialized} from ${msg.from}`);
        return;
    }
    processedMessages.add(msg.id._serialized);
    if (processedMessages.size > 2000) processedMessages.clear();

    // Canonical ID resolution
    let from;
    try {
        from = await getCanonicalId(msg, client);
    } catch (e) {
        console.error(`[Router] getCanonicalId failed:`, e.message);
        from = msg.from;
    }

    // Migrate any LID-based sessions to canonical JID
    if (from) migrateLidSession(msg.from, from);

    // Filter non-1:1 chats
    if (
        !from ||
        from.endsWith('@g.us') ||
        from.endsWith('@broadcast') ||
        from.endsWith('@newsletter') ||
        from === 'status@broadcast'
    ) return;

    // Rate limiting
    if (isRateLimited(from)) {
        return await sendWA(from, tooManyMessages());
    }

    const rawBody = typeof msg.body === 'string' ? msg.body : '';
    console.log(`[Incoming] From: ${from} | Body: ${rawBody.slice(0, 60).replace(/\n/g, ' ')}${rawBody.length > 60 ? '...' : ''}`);

    try {
        const body = rawBody.trim();
        const lowerBody = body.toLowerCase();

        const isAdmin = await isUserAdmin(msg);
        if (isAdmin) {
            await handleAdminCommand(msg, from, body, lowerBody);
        } else {
            await handleStudentMessage(msg, from, body, lowerBody);
        }
    } catch (globalError) {
        console.error(`[Message Handler] Unhandled Error from ${from}:`, globalError.stack || globalError.message);
        try {
            const { resetUser } = require('./state-machine');
            resetUser(from);
            await sendWA(from, systemError());
        } catch (e) {
            console.error(`[Message Handler] Failed to send error recovery:`, e.message);
        }
    } finally {
        saveSessions();
    }
}

module.exports = { routeMessage };
