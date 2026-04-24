const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getOAuthClient } = require('./src/google-api');
const { loadSessions, setIsSystemReady, setIsShuttingDown, saveSessionsNow } = require('./src/state-machine');
const { loadStudentsFromSheets } = require('./src/google-api');
const { registeredStudentIds, pendingApprovals } = require('./src/state-machine');
const { setClient } = require('./src/whatsapp');
const { routeMessage } = require('./src/router');
const { executeWithRetry } = require('./src/utils');
const { AUTH_DIR } = require('./src/config');

// ============================================================================
// WHATSAPP CLIENT SETUP
// ============================================================================

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'BOT_SESSION',
        dataPath: AUTH_DIR
    }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1014581023-alpha.html',
    },
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

setClient(client);

// ============================================================================
// EVENT HANDLERS
// ============================================================================

client.on('qr', (qr) => {
    console.log('Scan QR Code:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log('[System] WhatsApp Client Ready! Booting up memory subsystems...');
    loadSessions();
    try {
        await executeWithRetry(async () => {
            await loadStudentsFromSheets(registeredStudentIds, pendingApprovals);
        }, 5, 5000);
        setIsSystemReady(true);
        console.log('[System] Bot is FULLY INITIALIZED and ready to process messages.');
    } catch (error) {
        console.error('\nFATAL STARTUP ERROR: Could not sync with Google Sheets after multiple attempts.');
        console.error('Refusing to process WhatsApp messages with an empty or corrupt memory state.');
        console.error('Exiting process to allow PM2 to restart and try again later.\n');
        process.exit(1);
    }
});

client.on('message', async (msg) => {
    await routeMessage(msg, client);
});

client.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE:', msg);
});

client.on('disconnected', (reason) => {
    console.warn('BOT DISCONNECTED:', reason);
    console.log('Force exiting to allow PM2 to restart the process and recover the session.');
    process.exit(1);
});

// ============================================================================
// PROCESS HANDLERS
// ============================================================================

process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    saveSessionsNow();
    setTimeout(() => process.exit(1), 1000);
});

async function gracefulShutdown(signal) {
    setIsShuttingDown(true);
    console.warn(`[System] Received ${signal}. Shutting down safely...`);
    try {
        saveSessionsNow();
        if (client) {
            console.log('[WhatsApp] Destroying client...');
            await client.destroy();
        }
    } catch (err) {
        console.error('[System] Error during shutdown:', err.message);
    } finally {
        console.log('[System] Exit complete.');
        process.exit(0);
    }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ============================================================================
// INITIALIZATION
// ============================================================================

getOAuthClient()
    .then(() => {
        console.log('Google OAuth Success. Starting Bot...');
        client.initialize().catch(err => {
            console.error('Client Initialization Error:', err.message);
        });
    })
    .catch(err => {
        console.error('OAuth Initialization Failed:', err.message);
        process.exit(1);
    });
