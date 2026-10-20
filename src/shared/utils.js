/* =========================================================
 * IDs, tokens, dates
 * =======================================================*/

function makeId_() {
  if (typeof Utilities !== 'undefined' && Utilities.getUuid) {
    return Utilities.getUuid();
  }
  // Fallback for Node/tests
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return ts + '_' + rand;
}

function makeInviteToken_() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 20; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function nowIso_() {
  return new Date().toISOString();
}

function toIsoString_(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/* =========================================================
 * Sanitization
 * =======================================================*/

function sanitizeText_(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Defensive against spreadsheet formula interpretation.
function sanitizeForSheet_(text) {
  if (text == null) return '';
  const s = String(text);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/* =========================================================
 * Validation
 * =======================================================*/

const DISPLAY_NAME_MAX = 24;
const DISPLAY_NAME_REGEX = /^[A-Za-z0-9 _\-\.']+$/;

/**
 * @param {string} name
 * @param {string[]} [existingNames]
 * @returns {{valid: boolean, value?: string, error?: string}}
 */
function validateDisplayName_(name, existingNames) {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Display name must be a string.' };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Display name cannot be empty.' };
  }
  if (trimmed.length > DISPLAY_NAME_MAX) {
    return { valid: false, error: 'Display name must be ' + DISPLAY_NAME_MAX + ' characters or less.' };
  }
  if (!DISPLAY_NAME_REGEX.test(trimmed)) {
    return { valid: false, error: 'Display name contains invalid characters.' };
  }
  const taken = (existingNames || []).map(n => String(n).toLowerCase());
  if (taken.indexOf(trimmed.toLowerCase()) !== -1) {
    return { valid: false, error: 'Display name already taken.' };
  }
  return { valid: true, value: trimmed };
}

function buildTabName_(id) {
  const short = String(id).replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
  return (typeof SHEETS !== 'undefined' ? SHEETS.TOURNAMENT_PREFIX : 'T_') + short;
}

/* =========================================================
 * Node test-export guard (ignored inside Apps Script)
 * =======================================================*/

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    'makeId': makeId_,
    'makeInviteToken': makeInviteToken_,
    'nowIso': nowIso_,
    'toIsoString': toIsoString_,
    'sanitizeText': sanitizeText_,
    'sanitizeForSheet': sanitizeForSheet_,
    'validateDisplayName': validateDisplayName_,
    'buildTabName': buildTabName_,
    'DISPLAY_NAME_MAX': DISPLAY_NAME_MAX,
    'DISPLAY_NAME_REGEX': DISPLAY_NAME_REGEX
  };
}