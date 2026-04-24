const path = require('path');
require('dotenv').config();

// --- ENV VALIDATION ---
const REQUIRED_ENV = [
    'ADMIN_NUMBERS', 'MASTER_BACKUP_SPREADSHEET_ID',
    'MAIN_DATABASE_FOLDER_ID', 'DRIVE_FOLDER_ID',
    'SCHOOL_NAME', 'BANK_NAME', 'BANK_ACC_NAME', 'BANK_ACC_NUMBER', 'BANK_BRANCH'
];

const missing = REQUIRED_ENV.filter(key => !process.env[key]?.trim());
if (missing.length > 0) {
    console.error('CRITICAL ERROR: Missing configuration in .env file:');
    missing.forEach(m => console.error(`   - ${m}`));
    process.exit(1);
}

// --- PATHS ---
const ENV_FILE = path.join(__dirname, '..', '.env');
const TOKEN_PATH = path.join(__dirname, '..', 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');
const AUTH_DIR = path.join(__dirname, '..', '.wwebjs_auth');
const SESSION_FILE = path.join(__dirname, '..', 'sessions.json');

// --- ADMIN & GROUPS ---
let ADMIN_NUMBERS = process.env.ADMIN_NUMBERS
    ? process.env.ADMIN_NUMBERS.split(',').map(n => {
        let id = n.replace(/["']/g, '').trim();
        if (id && !id.includes('@')) id = `${id}@c.us`;
        return id;
    }).filter(id => !!id)
    : [];

let GROUPS = [
    { id: process.env.GROUP_ID_6, name: 'Grade 6' },
    { id: process.env.GROUP_ID_7, name: 'Grade 7' },
    { id: process.env.GROUP_ID_8, name: 'Grade 8' },
    { id: process.env.GROUP_ID_9, name: 'Grade 9' },
    { id: process.env.GROUP_ID_10, name: 'Grade 10' },
    { id: process.env.GROUP_ID_11, name: 'Grade 11' }
];

// --- GOOGLE SHEETS & DRIVE ---
const MASTER_BACKUP_SPREADSHEET_ID = process.env.MASTER_BACKUP_SPREADSHEET_ID;
const MAIN_DATABASE_FOLDER_ID = process.env.MAIN_DATABASE_FOLDER_ID;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const RANGE = 'Sheet1!A:L';
const STUDENT_HEADERS = ['Student ID', 'Name', 'School', 'Grade', 'Month', 'Phone', 'Tutes', 'Address', 'Status', 'Receipt URL', 'Group ID'];

// --- PRICING ---
let BASIC_FEE = parseInt(process.env.FEE_BASIC || '1500', 10);
let TUTE_FEE = parseInt(process.env.FEE_TUTE || '2500', 10);

// --- BRANDING ---
let SCHOOL_NAME = process.env.SCHOOL_NAME;

function getBankLabel() {
    return `🏦 *Bank:* ${process.env.BANK_NAME || 'N/A'}
👤 *Account Name:* ${process.env.BANK_ACC_NAME || 'N/A'}
🔢 *Account Number:* ${process.env.BANK_ACC_NUMBER || 'N/A'}
🏢 *Branch:* ${process.env.BANK_BRANCH || 'N/A'}`;
}

// --- SCOPES ---
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file'
];

// --- MONTHS ---
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// --- SYSTEM CONSTANTS ---
const MENU_KEYWORD = 'menu';
const SESSION_TIMEOUT_MS = 2 * 24 * 60 * 60 * 1000; // 48 hours
const MESSAGE_RATE_WINDOW_MS = 15 * 1000;
const MESSAGE_RATE_MAX = 10;
const ADMIN_BROADCAST_DELAY_MS = 200;
const OUTBOUND_DELAY_MS = 75;

function updateEnvFile(key, value) {
    try {
        const fs = require('fs');
        let content = fs.readFileSync(ENV_FILE, 'utf8');
        const regex = new RegExp(`^\\s*${key}\\s*=.*`, 'm');
        const newLine = `${key}="${value.replace(/"/g, '\\"')}"`;

        if (regex.test(content)) {
            content = content.replace(regex, newLine);
        } else {
            content = content.trim() + `\n${newLine}\n`;
        }

        fs.writeFileSync(ENV_FILE, content, 'utf8');
        process.env[key] = value;

        if (key === 'ADMIN_NUMBERS') {
            ADMIN_NUMBERS = value.split(',').map(n => {
                let id = n.trim();
                if (!id.includes('@')) id = `${id}@c.us`;
                return id;
            });
        }
        if (key === 'SCHOOL_NAME') SCHOOL_NAME = value;
        if (key === 'FEE_BASIC') BASIC_FEE = parseInt(value, 10);
        if (key === 'FEE_TUTE') TUTE_FEE = parseInt(value, 10);
        if (key.startsWith('GROUP_ID_')) {
            const grade = parseInt(key.replace('GROUP_ID_', ''), 10);
            const gIdx = GROUPS.findIndex(g => g.name === `Grade ${grade}`);
            if (gIdx >= 0) GROUPS[gIdx].id = value;
        }
        return true;
    } catch (e) {
        console.error(`Failed to update .env:`, e.message);
        return false;
    }
}

module.exports = {
    get ADMIN_NUMBERS() { return ADMIN_NUMBERS; },
    get GROUPS() { return GROUPS; },
    MASTER_BACKUP_SPREADSHEET_ID,
    MAIN_DATABASE_FOLDER_ID,
    DRIVE_FOLDER_ID,
    RANGE,
    STUDENT_HEADERS,
    get BASIC_FEE() { return BASIC_FEE; },
    get TUTE_FEE() { return TUTE_FEE; },
    get SCHOOL_NAME() { return SCHOOL_NAME; },
    getBankLabel,
    SCOPES,
    MONTH_NAMES,
    MENU_KEYWORD,
    SESSION_TIMEOUT_MS,
    SESSION_FILE,
    MESSAGE_RATE_WINDOW_MS,
    MESSAGE_RATE_MAX,
    ADMIN_BROADCAST_DELAY_MS,
    OUTBOUND_DELAY_MS,
    ENV_FILE,
    TOKEN_PATH,
    CREDENTIALS_PATH,
    AUTH_DIR,
    updateEnvFile
};
