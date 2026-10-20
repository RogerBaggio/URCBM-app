/**
 * URCBM authentication crypto helpers.
 *
 * Lightweight, low-assurance password storage for a small private app.
 * Uses a unique random salt and a separately stored HMAC secret.
 *
 * This is NOT equivalent to Argon2id, bcrypt, or PBKDF2.
 * Keep the pepper out of source code and Google Sheets.
 */

function urcbmAuthCreateRandomHex_() {
  return (
    Utilities.getUuid() + Utilities.getUuid()
  ).replace(/-/g, '').toLowerCase();
}

function urcbmAuthCreateSalt_() {
  return urcbmAuthCreateRandomHex_();
}

function urcbmAuthCreateToken_() {
  return urcbmAuthCreateRandomHex_();
}

function urcbmAuthGetPepper_() {
  const pepper = PropertiesService
    .getScriptProperties()
    .getProperty('URCBM_AUTH_PEPPER');

  if (!pepper || !/^[a-f0-9]{64}$/i.test(pepper)) {
    throw new Error('AUTH_CONFIG_ERROR');
  }

  return pepper;
}

function urcbmAuthBytesToHex_(bytes) {
  return bytes.map(function (byte) {
    return ((byte + 256) % 256)
      .toString(16)
      .padStart(2, '0');
  }).join('');
}

/**
 * Computes a password verifier.
 *
 * Store the returned hash and the salt in the Users sheet.
 * Never store the original password.
 */
function urcbmAuthPasswordHash_(password, salt) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('AUTH_INVALID_PASSWORD');
  }

  if (typeof salt !== 'string' || !/^[a-f0-9]{64}$/i.test(salt)) {
    throw new Error('AUTH_INVALID_SALT');
  }

  const input = 'URCBM-AUTH-PASSWORD-V1\n' + salt + '\n' + password;

  const signature = Utilities.computeHmacSha256Signature(
    input,
    urcbmAuthGetPepper_(),
    Utilities.Charset.UTF_8
  );

  return urcbmAuthBytesToHex_(signature);
}

/**
 * Hashes a random token before it is stored in Sheets.
 * The original token should be given to the user only.
 */
function urcbmAuthTokenHash_(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('AUTH_INVALID_TOKEN');
  }

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    token,
    Utilities.Charset.UTF_8
  );

  return urcbmAuthBytesToHex_(digest);
}

/**
 * Avoids returning immediately when two hashes differ.
 */
function urcbmAuthConstantTimeEqual_(first, second) {
  if (typeof first !== 'string' || typeof second !== 'string') {
    return false;
  }

  let difference = first.length ^ second.length;
  const length = Math.max(first.length, second.length);

  for (let i = 0; i < length; i++) {
    const a = i < first.length ? first.charCodeAt(i) : 0;
    const b = i < second.length ? second.charCodeAt(i) : 0;
    difference |= a ^ b;
  }

  return difference === 0;
}