const fs = require('fs');
const { SESSION_FILE, SESSION_TIMEOUT_MS, MESSAGE_RATE_WINDOW_MS, MESSAGE_RATE_MAX } = require('./config');

// --- STATES ---
const STATES = {
    START: 'start',
    NAME: 'name',
    SCHOOL: 'school',
    PHONE: 'phone',
    GRADE: 'grade',
    MONTHS: 'months',
    TUTES_OPTION: 'tutes_option',
    RECEIPT: 'receipt',
    ADDRESS: 'address',
    CONFIRM: 'confirm',
    OLD_ID: 'old_id',
    OLD_CONFIRM: 'old_confirm',
    OLD_TUTES_OPTION: 'old_tutes_option',
    OLD_MONTH: 'old_month',
    COMPLAIN: 'complain',
    BACK_MENU: 'back_menu'
};

// --- RUNTIME STORAGE ---
const userData = new Map();
const userStates = new Map();
const userHistory = new Map();
const registeredStudentIds = new Map();
const pendingApprovals = new Map();
const adminStates = new Map();
const inboundRateBuckets = new Map();
const processedMessages = new Set();

// --- SYSTEM STATE ---
let isShuttingDown = false;
let isSystemReady = false;
let sessionSaveTimer = null;
let sessionSavePending = false;

// --- SESSION PERSISTENCE ---

function resetUser(from) {
    userStates.delete(from);
    userData.delete(from);
    userHistory.delete(from);
    saveSessions();
}

function saveSessions() {
    try {
        sessionSavePending = true;
        if (sessionSaveTimer) return;
        sessionSaveTimer = setTimeout(() => {
            try {
                if (!sessionSavePending) return;
                const data = {
                    userData: Array.from(userData.entries()),
                    userStates: Array.from(userStates.entries()),
                    userHistory: Array.from(userHistory.entries()),
                    adminStates: Array.from(adminStates.entries()),
                    pendingApprovals: Array.from(pendingApprovals.entries())
                };
                atomicWriteSessions(data);
            } catch (error) {
                console.error('[Persistence] Error saving sessions:', error.message);
            } finally {
                sessionSavePending = false;
                sessionSaveTimer = null;
            }
        }, 1000);
        if (sessionSaveTimer.unref) sessionSaveTimer.unref();
    } catch (error) {
        console.error('[Persistence] Error saving sessions:', error.message);
    }
}

function atomicWriteSessions(data) {
    const tempFile = `${SESSION_FILE}.tmp`;
    try {
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
        fs.renameSync(tempFile, SESSION_FILE);
    } catch (error) {
        console.error('[Persistence] Atomic write failed:', error.message);
        try { fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2)); } catch (e) {}
    }
}

function saveSessionsNow() {
    try {
        if (sessionSaveTimer) {
            clearTimeout(sessionSaveTimer);
            sessionSaveTimer = null;
        }
        const data = {
            userData: Array.from(userData.entries()),
            userStates: Array.from(userStates.entries()),
            userHistory: Array.from(userHistory.entries()),
            adminStates: Array.from(adminStates.entries()),
            pendingApprovals: Array.from(pendingApprovals.entries())
        };
        atomicWriteSessions(data);
        sessionSavePending = false;
    } catch (error) {
        console.error('[Persistence] Error saving sessions:', error.message);
    }
}

function loadSessions() {
    try {
        if (!fs.existsSync(SESSION_FILE)) return;
        const raw = fs.readFileSync(SESSION_FILE);
        const data = JSON.parse(raw);

        if (data.userData) data.userData.forEach(([k, v]) => userData.set(k, v));
        if (data.userStates) data.userStates.forEach(([k, v]) => userStates.set(k, v));
        if (data.userHistory) data.userHistory.forEach(([k, v]) => userHistory.set(k, v));
        if (data.adminStates) data.adminStates.forEach(([k, v]) => adminStates.set(k, v));
        if (data.pendingApprovals) data.pendingApprovals.forEach(([k, v]) => pendingApprovals.set(k, v));

        if (userStates.size > 0) {
            console.log(`[Persistence] Restored ${userStates.size} active sessions.`);
        }
    } catch (error) {
        console.warn('[Persistence] Could not load sessions:', error.message);
    }
}

// --- HISTORY / BACK NAVIGATION ---

function pushHistory(from, state, data) {
    if (!userHistory.has(from)) userHistory.set(from, []);
    // Deep clone data to avoid reference issues
    userHistory.get(from).push({ state, data: JSON.parse(JSON.stringify(data)) });
}

function popHistory(from) {
    if (!userHistory.has(from)) return null;
    const history = userHistory.get(from);
    if (history.length === 0) return null;
    return history.pop();
}

function getHistory(from) {
    return userHistory.get(from) || [];
}

function clearHistory(from) {
    userHistory.delete(from);
}

// --- CANONICAL ID RESOLUTION ---

async function getCanonicalId(msg, client) {
    const from = msg.from;
    if (from.includes('@lid')) {
        try {
            const contact = await msg.getContact();
            if (contact?.id?._serialized && !contact.id._serialized.includes('@lid')) {
                return contact.id._serialized;
            }
        } catch (e) {
            console.warn(`[ID Normalization] Failed to resolve LID ${from}:`, e.message);
        }
    }
    return from;
}

// Migrate any existing LID-based session keys to canonical JIDs on load
function migrateLidSession(lid, canonicalId) {
    if (lid === canonicalId) return;
    if (userStates.has(lid)) {
        userStates.set(canonicalId, userStates.get(lid));
        userStates.delete(lid);
    }
    if (userData.has(lid)) {
        userData.set(canonicalId, userData.get(lid));
        userData.delete(lid);
    }
    if (userHistory.has(lid)) {
        userHistory.set(canonicalId, userHistory.get(lid));
        userHistory.delete(lid);
    }
    if (adminStates.has(lid)) {
        adminStates.set(canonicalId, adminStates.get(lid));
        adminStates.delete(lid);
    }
}

// --- RATE LIMITING ---

function isRateLimited(from) {
    const now = Date.now();
    const bucket = inboundRateBuckets.get(from);
    if (!bucket || now - bucket.windowStart > MESSAGE_RATE_WINDOW_MS) {
        inboundRateBuckets.set(from, { count: 1, windowStart: now });
        return false;
    }
    bucket.count += 1;
    return bucket.count > MESSAGE_RATE_MAX;
}

// --- BACKGROUND CLEANUP ---

setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [from, data] of userData.entries()) {
        if (data.lastSeen && (now - data.lastSeen > SESSION_TIMEOUT_MS)) {
            resetUser(from);
            cleanedCount++;
        }
    }
    if (cleanedCount > 0) console.log(`[Sweeper] Cleaned up ${cleanedCount} inactive sessions.`);
}, 15 * 60 * 1000);

setInterval(() => {
    const now = Date.now();
    for (const [from, bucket] of inboundRateBuckets.entries()) {
        if (now - bucket.windowStart > MESSAGE_RATE_WINDOW_MS * 2) inboundRateBuckets.delete(from);
    }
}, 60 * 1000);

setInterval(() => {
    if (processedMessages.size > 2000) processedMessages.clear();
}, 15 * 60 * 1000);

module.exports = {
    STATES,
    userData,
    userStates,
    userHistory,
    registeredStudentIds,
    pendingApprovals,
    adminStates,
    processedMessages,
    get isShuttingDown() { return isShuttingDown; },
    get isSystemReady() { return isSystemReady; },
    setIsShuttingDown: (v) => { isShuttingDown = v; },
    setIsSystemReady: (v) => { isSystemReady = v; },
    resetUser,
    saveSessions,
    saveSessionsNow,
    loadSessions,
    pushHistory,
    popHistory,
    getHistory,
    clearHistory,
    getCanonicalId,
    migrateLidSession,
    isRateLimited
};
