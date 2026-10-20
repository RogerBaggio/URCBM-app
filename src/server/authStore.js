/**
 * Authentication storage schema.
 *
 * These sheets are private application data, not public API output.
 * Sheet visibility is not an access-control mechanism.
 */

const AUTH_STORE_SHEETS = {
  USERS: '_Users',
  TOKENS: '_AuthTokens',
  SESSIONS: '_Sessions'
};

const AUTH_STORE_HEADERS = {
  USERS: [
    'User ID',
    'Email',
    'Password Salt',
    'Password Hash',
    'Display Name',
    'Email Verified',
    'Status',
    'Failed Attempts',
    'Locked Until',
    'Created At',
    'Updated At',
    'Last Login At'
  ],

  TOKENS: [
    'Token Hash',
    'User ID',
    'Purpose',
    'Expires At',
    'Created At',
    'Used At'
  ],

  SESSIONS: [
    'Token Hash',
    'User ID',
    'Created At',
    'Expires At',
    'Last Seen At',
    'Revoked At'
  ]
};

/**
 * Creates missing authentication sheets and validates existing headers.
 * Safe to run repeatedly; does not modify existing account data.
 */
function ensureAuthSheets_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = getSpreadsheet_();

    ensureAuthSheet_(
      ss,
      AUTH_STORE_SHEETS.USERS,
      AUTH_STORE_HEADERS.USERS
    );

    ensureAuthSheet_(
      ss,
      AUTH_STORE_SHEETS.TOKENS,
      AUTH_STORE_HEADERS.TOKENS
    );

    ensureAuthSheet_(
      ss,
      AUTH_STORE_SHEETS.SESSIONS,
      AUTH_STORE_HEADERS.SESSIONS
    );

    return {
      ok: true,
      sheets: [
        AUTH_STORE_SHEETS.USERS,
        AUTH_STORE_SHEETS.TOKENS,
        AUTH_STORE_SHEETS.SESSIONS
      ]
    };
  } finally {
    lock.releaseLock();
  }
}

function ensureAuthSheet_(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  const lastRow = sheet.getLastRow();

  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existing = sheet
    .getRange(1, 1, 1, headers.length)
    .getDisplayValues()[0];

  const matches = headers.every(function (header, index) {
    return existing[index] === header;
  });

  if (!matches) {
    throw new Error('AUTH_SCHEMA_MISMATCH: ' + sheetName);
  }

  return sheet;
}

/* =========================================================
 * User accounts
 * =======================================================*/

function authStoreNormalizeEmail_(email) {
  const value = String(email || '').trim().toLowerCase();

  if (
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  ) {
    throw new Error('INVALID_EMAIL');
  }

  return value;
}

function authStoreValidatePasswordParts_(salt, hash) {
  if (typeof salt !== 'string' || !/^[a-f0-9]{64}$/i.test(salt)) {
    throw new Error('AUTH_INVALID_SALT');
  }

  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) {
    throw new Error('AUTH_INVALID_HASH');
  }
}

function authStoreUserFromRow_(row) {
  return {
    userId: String(row[0] || ''),
    email: String(row[1] || '').toLowerCase(),
    passwordSalt: String(row[2] || ''),
    passwordHash: String(row[3] || ''),
    displayName: String(row[4] || ''),
    emailVerified: row[5] === true,
    status: String(row[6] || 'pending'),
    failedAttempts: Number(row[7]) || 0,
    lockedUntil: String(row[8] || ''),
    createdAt: String(row[9] || ''),
    updatedAt: String(row[10] || ''),
    lastLoginAt: String(row[11] || '')
  };
}

function authStoreFindUserRecord_(sheet, predicate) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const rows = sheet
    .getRange(2, 1, lastRow - 1, AUTH_STORE_HEADERS.USERS.length)
    .getValues();

  for (let i = 0; i < rows.length; i++) {
    if (predicate(rows[i])) {
      return {
        rowNumber: i + 2,
        user: authStoreUserFromRow_(rows[i])
      };
    }
  }

  return null;
}

function authStoreGetUserByEmail_(email) {
  const normalizedEmail = authStoreNormalizeEmail_(email);
  ensureAuthSheets_();

  const sheet = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.USERS);
  const record = authStoreFindUserRecord_(sheet, function (row) {
    return String(row[1] || '').toLowerCase() === normalizedEmail;
  });

  return record ? record.user : null;
}

function authStoreGetUserById_(userId) {
  const id = String(userId || '').trim();
  if (!id) return null;

  ensureAuthSheets_();

  const sheet = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.USERS);
  const record = authStoreFindUserRecord_(sheet, function (row) {
    return String(row[0] || '') === id;
  });

  return record ? record.user : null;
}

function authStoreCreateUser_(input) {
  const data = input || {};
  const email = authStoreNormalizeEmail_(data.email);
  const displayName = String(data.displayName || '').trim();

  authStoreValidatePasswordParts_(
    data.passwordSalt,
    data.passwordHash
  );

  if (!displayName || displayName.length > 40) {
    throw new Error('INVALID_DISPLAY_NAME');
  }

  ensureAuthSheets_();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.USERS);

    const existing = authStoreFindUserRecord_(sheet, function (row) {
      return String(row[1] || '').toLowerCase() === email;
    });

    if (existing) throw new Error('EMAIL_ALREADY_EXISTS');

    const now = nowIso_();
    const user = {
      userId: Utilities.getUuid(),
      email: email,
      passwordSalt: data.passwordSalt,
      passwordHash: data.passwordHash,
      displayName: displayName,
      emailVerified: false,
      status: 'pending',
      failedAttempts: 0,
      lockedUntil: '',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: ''
    };

    sheet.appendRow([
      user.userId,
      user.email,
      user.passwordSalt,
      user.passwordHash,
      user.displayName,
      user.emailVerified,
      user.status,
      user.failedAttempts,
      user.lockedUntil,
      user.createdAt,
      user.updatedAt,
      user.lastLoginAt
    ]);

    // Do not return password salt or hash to callers.
    return {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      status: user.status,
      createdAt: user.createdAt
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Applies allowlisted field changes to one account.
 * `changes` keys are internal field names, never client input.
 */
function authStoreUpdateUserFields_(userId, changes) {
  const id = String(userId || '').trim();
  if (!id) throw new Error('USER_NOT_FOUND');

  const columns = {
    passwordSalt: 2,
    passwordHash: 3,
    displayName: 4,
    emailVerified: 5,
    status: 6,
    failedAttempts: 7,
    lockedUntil: 8,
    updatedAt: 10,
    lastLoginAt: 11
  };

  const keys = Object.keys(changes || {});
  keys.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(columns, key)) {
      throw new Error('INVALID_USER_FIELD');
    }
  });

  ensureAuthSheets_();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.USERS);
    const record = authStoreFindUserRecord_(sheet, function (row) {
      return String(row[0] || '') === id;
    });

    if (!record) throw new Error('USER_NOT_FOUND');

    const row = sheet
      .getRange(record.rowNumber, 1, 1, AUTH_STORE_HEADERS.USERS.length)
      .getValues()[0];

    keys.forEach(function (key) {
      row[columns[key]] = changes[key];
    });

    sheet
      .getRange(record.rowNumber, 1, 1, row.length)
      .setValues([row]);

    return true;
  } finally {
    lock.releaseLock();
  }
}

function authStoreVerifyUserEmail_(userId) {
  const id = String(userId || '').trim();
  if (!id) throw new Error('USER_NOT_FOUND');

  ensureAuthSheets_();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.USERS);
    const record = authStoreFindUserRecord_(sheet, function (row) {
      return String(row[0] || '') === id;
    });

    if (!record) throw new Error('USER_NOT_FOUND');

    if (
      record.user.emailVerified &&
      record.user.status === 'active'
    ) {
      return true;
    }

    if (record.user.status !== 'pending') {
      throw new Error('ACCOUNT_DISABLED');
    }

    const row = sheet
      .getRange(record.rowNumber, 1, 1, AUTH_STORE_HEADERS.USERS.length)
      .getValues()[0];

    row[5] = true;       // Email Verified
    row[6] = 'active';   // Status
    row[10] = nowIso_();  // Updated At

    sheet
      .getRange(record.rowNumber, 1, 1, row.length)
      .setValues([row]);

    return true;
  } finally {
    lock.releaseLock();
  }
}

function authStoreUpdatePassword_(userId, newSalt, newHash) {
  authStoreValidatePasswordParts_(newSalt, newHash);

  return authStoreUpdateUserFields_(userId, {
    passwordSalt: newSalt,
    passwordHash: newHash,
    failedAttempts: 0,
    lockedUntil: '',
    updatedAt: nowIso_()
  });
}

function authStoreRecordLoginFailure_(userId, maxAttempts, lockMinutes) {
  const id = String(userId || '').trim();
  if (!id) throw new Error('USER_NOT_FOUND');

  const limit = Number(maxAttempts) || 5;
  const lockDuration = Number(lockMinutes) || 15;

  if (limit < 1 || lockDuration < 1) {
    throw new Error('INVALID_LOCK_CONFIG');
  }

  ensureAuthSheets_();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.USERS);
    const record = authStoreFindUserRecord_(sheet, function (row) {
      return String(row[0] || '') === id;
    });

    if (!record) throw new Error('USER_NOT_FOUND');

    const user = record.user;
    const now = Date.now();
    const lockedUntilMs = user.lockedUntil
      ? Date.parse(user.lockedUntil)
      : NaN;

    if (Number.isFinite(lockedUntilMs) && lockedUntilMs > now) {
      return {
        failedAttempts: user.failedAttempts,
        lockedUntil: user.lockedUntil,
        isLocked: true
      };
    }

    // Start a fresh counter once a previous lock expires.
    let attempts = user.failedAttempts;
    if (Number.isFinite(lockedUntilMs) && lockedUntilMs <= now) {
      attempts = 0;
    }

    attempts += 1;

    const newLockedUntil = attempts >= limit
      ? new Date(now + lockDuration * 60 * 1000).toISOString()
      : '';

    sheet.getRange(record.rowNumber, 8).setValue(attempts);
    sheet.getRange(record.rowNumber, 9).setValue(newLockedUntil);
    sheet.getRange(record.rowNumber, 11).setValue(nowIso_());

    return {
      failedAttempts: attempts,
      lockedUntil: newLockedUntil,
      isLocked: Boolean(newLockedUntil)
    };
  } finally {
    lock.releaseLock();
  }
}

function authStoreRecordLoginSuccess_(userId) {
  return authStoreUpdateUserFields_(userId, {
    failedAttempts: 0,
    lockedUntil: '',
    lastLoginAt: nowIso_(),
    updatedAt: nowIso_()
  });
}

function authStoreIsUserLocked_(user) {
  if (!user || !user.lockedUntil) return false;

  const timestamp = Date.parse(user.lockedUntil);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}


/* =========================================================
 * One-time email-verification and password-reset tokens
 * =======================================================*/

function authStoreCreateOneTimeToken_(userId, purpose, expiresMinutes) {
  const id = String(userId || '').trim();

  if (purpose !== 'verify_email' && purpose !== 'reset_password') {
    throw new Error('INVALID_TOKEN_PURPOSE');
  }

  const minutes = Number(expiresMinutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080) {
    throw new Error('INVALID_TOKEN_EXPIRY');
  }

  ensureAuthSheets_();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const users = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.USERS);
    const userRecord = authStoreFindUserRecord_(users, function (row) {
      return String(row[0] || '') === id;
    });

    if (!userRecord) throw new Error('USER_NOT_FOUND');

    const user = userRecord.user;

    if (purpose === 'verify_email') {
      if (user.emailVerified) throw new Error('EMAIL_ALREADY_VERIFIED');
      if (user.status !== 'pending') throw new Error('ACCOUNT_DISABLED');
    } else {
      if (user.status !== 'active' || !user.emailVerified) {
        throw new Error('ACCOUNT_NOT_VERIFIED');
      }
    }

    const token = urcbmAuthCreateToken_();
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + minutes * 60 * 1000).toISOString();

    const tokenSheet = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.TOKENS);
    tokenSheet.appendRow([
      urcbmAuthTokenHash_(token),
      id,
      purpose,
      expiresAt,
      createdAt,
      ''
    ]);

    // Return the raw token only once, for delivery to the intended user.
    return { token: token, expiresAt: expiresAt };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Returns {userId, purpose} on success, or null for invalid, expired,
 * already-used, or purpose-mismatched tokens.
 */
function authStoreConsumeOneTimeToken_(token, expectedPurpose) {
  if (typeof token !== 'string' || !token) return null;

  if (
    expectedPurpose !== 'verify_email' &&
    expectedPurpose !== 'reset_password'
  ) {
    throw new Error('INVALID_TOKEN_PURPOSE');
  }

  ensureAuthSheets_();

  const tokenHash = urcbmAuthTokenHash_(token);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.TOKENS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    const rows = sheet
      .getRange(2, 1, lastRow - 1, AUTH_STORE_HEADERS.TOKENS.length)
      .getValues();

    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];

      if (String(row[0] || '') !== tokenHash) continue;
      if (String(row[2] || '') !== expectedPurpose) return null;
      if (row[5]) return null;

      const expiry = Date.parse(row[3]);
      if (!Number.isFinite(expiry) || expiry <= Date.now()) return null;

      const rowNumber = i + 2;
      sheet.getRange(rowNumber, 6).setValue(nowIso_());

      return {
        userId: String(row[1] || ''),
        purpose: String(row[2] || '')
      };
    }

    return null;
  } finally {
    lock.releaseLock();
  }
}


/* =========================================================
 * Sessions
 * =======================================================*/

function authStoreCreateSession_(userId, lifetimeDays) {
  const id = String(userId || '').trim();
  const days = lifetimeDays == null ? 7 : Number(lifetimeDays);

  if (!Number.isInteger(days) || days < 1 || days > 30) {
    throw new Error('INVALID_SESSION_EXPIRY');
  }

  ensureAuthSheets_();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const users = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.USERS);
    const userRecord = authStoreFindUserRecord_(users, function (row) {
      return String(row[0] || '') === id;
    });

    if (!userRecord) throw new Error('USER_NOT_FOUND');
    if (userRecord.user.status !== 'active' || !userRecord.user.emailVerified) {
      throw new Error('ACCOUNT_NOT_VERIFIED');
    }

    const token = urcbmAuthCreateToken_();
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(
      now + days * 24 * 60 * 60 * 1000
    ).toISOString();

    const sessions = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.SESSIONS);
    sessions.appendRow([
      urcbmAuthTokenHash_(token),
      id,
      createdAt,
      expiresAt,
      createdAt,
      ''
    ]);

    return { token: token, expiresAt: expiresAt };
  } finally {
    lock.releaseLock();
  }
}

function authStoreFindSession_(token) {
  if (typeof token !== 'string' || !token) return null;

  ensureAuthSheets_();

  const tokenHash = urcbmAuthTokenHash_(token);
  const ss = getSpreadsheet_();
  const sessions = ss.getSheetByName(AUTH_STORE_SHEETS.SESSIONS);
  const lastRow = sessions.getLastRow();
  if (lastRow < 2) return null;

  const rows = sessions
    .getRange(2, 1, lastRow - 1, AUTH_STORE_HEADERS.SESSIONS.length)
    .getValues();

  let session = null;

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];

    if (String(row[0] || '') !== tokenHash) continue;
    if (row[5]) return null;

    const expiry = Date.parse(row[3]);
    if (!Number.isFinite(expiry) || expiry <= Date.now()) return null;

    session = {
      userId: String(row[1] || ''),
      expiresAt: String(row[3] || '')
    };
    break;
  }

  if (!session) return null;

  const users = ss.getSheetByName(AUTH_STORE_SHEETS.USERS);
  const userRecord = authStoreFindUserRecord_(users, function (row) {
    return String(row[0] || '') === session.userId;
  });

  if (
    !userRecord ||
    userRecord.user.status !== 'active' ||
    !userRecord.user.emailVerified
  ) {
    return null;
  }

  return session;
}

function authStoreRevokeSession_(token) {
  if (typeof token !== 'string' || !token) return false;

  ensureAuthSheets_();

  const tokenHash = urcbmAuthTokenHash_(token);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.SESSIONS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;

    const hashes = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

    for (let i = hashes.length - 1; i >= 0; i--) {
      if (String(hashes[i][0] || '') !== tokenHash) continue;

      const rowNumber = i + 2;
      const revokedAt = sheet.getRange(rowNumber, 6).getValue();

      if (!revokedAt) {
        sheet.getRange(rowNumber, 6).setValue(nowIso_());
      }

      return true;
    }

    return false;
  } finally {
    lock.releaseLock();
  }
}

function authStoreRevokeAllSessions_(userId) {
  const id = String(userId || '').trim();
  if (!id) return 0;

  ensureAuthSheets_();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSpreadsheet_().getSheetByName(AUTH_STORE_SHEETS.SESSIONS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return 0;

    const rows = sheet
      .getRange(2, 1, lastRow - 1, AUTH_STORE_HEADERS.SESSIONS.length)
      .getValues();

    const now = nowIso_();
    let revoked = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (String(row[1] || '') !== id || row[5]) continue;

      sheet.getRange(i + 2, 6).setValue(now);
      revoked += 1;
    }

    return revoked;
  } finally {
    lock.releaseLock();
  }
}