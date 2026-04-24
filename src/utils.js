const { MONTH_NAMES } = require('./config');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function executeWithRetry(fn, retries = 3, interval = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            const message = (error && error.message ? error.message : '').toLowerCase();
            const isTransient = message.includes('quota') || message.includes('ratelimit') || message.includes('500') || message.includes('enotfound') || message.includes('etimedout');
            if (i === retries - 1 || !isTransient) throw error;
            console.warn(`API call failed (attempt ${i + 1}/${retries}), retrying in ${interval}ms...`, error.message);
            await delay(interval);
        }
    }
}

function cleanPhoneNumber(phone) {
    if (!phone) return '';
    let cleaned = phone.toString().replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
        cleaned = '94' + cleaned.substring(1);
    }
    else if (cleaned.length === 9 && (cleaned.startsWith('7') || cleaned.startsWith('1') || cleaned.startsWith('6'))) {
        cleaned = '94' + cleaned;
    }

    return cleaned;
}

function isValidPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return /^0(70|71|72|74|75|76|77|78)\d{7}$/.test(cleaned);
}

function normalizeStudentId(id) {
    if (!id) return '';
    const cleaned = id.trim().toUpperCase();

    const legacyMatch = cleaned.match(/^NEX(?:ORA)?[-\s]?0*(\d+)$/i);
    if (legacyMatch) {
        return `NEX-${String(parseInt(legacyMatch[1], 10)).padStart(3, '0')}`;
    }

    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length >= 6 && digitsOnly.length <= 8) return digitsOnly;

    return cleaned;
}

function stringSimilarity(a, b) {
    if (a === b) return 1;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
        if (longer.includes(shorter[i])) matches++;
    }
    return matches / longer.length;
}

function resolveMonthInput(rawInput) {
    if (!rawInput || !rawInput.trim()) return null;
    const text = rawInput.trim();
    const yearMatch = text.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
    const wordPart = text.replace(/(\d{4})/, '').replace(/[-\s]+/g, '').trim().toLowerCase();

    const numericMonth = parseInt(wordPart, 10);
    if (!isNaN(numericMonth) && numericMonth >= 1 && numericMonth <= 12) return `${MONTH_NAMES[numericMonth - 1]}-${year}`;

    for (const month of MONTH_NAMES) {
        if (month.toLowerCase().startsWith(wordPart) || wordPart.startsWith(month.toLowerCase().slice(0, 3))) return `${month}-${year}`;
    }

    let bestMonth = null;
    let bestScore = 0;
    for (const month of MONTH_NAMES) {
        const score = stringSimilarity(wordPart, month.toLowerCase());
        if (score > bestScore) { bestScore = score; bestMonth = month; }
    }

    return bestScore >= 0.6 ? `${bestMonth}-${year}` : null;
}

const buildMonthYearLabel = (monthInput) => resolveMonthInput(monthInput);

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeSheetInput(value) {
    if (value == null) return '';
    const str = String(value).trim();
    // Prevent formula injection
    if (/^[+=\-@]/.test(str)) return `'${str}`;
    return str;
}

module.exports = {
    delay,
    executeWithRetry,
    cleanPhoneNumber,
    isValidPhone,
    normalizeStudentId,
    stringSimilarity,
    resolveMonthInput,
    buildMonthYearLabel,
    isValidEmail,
    sanitizeSheetInput
};
