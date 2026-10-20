/**
 * URCBM account authentication service.
 *
 * Depends on authCrypto.js, authStore.js, config.js and utils.js.
 * This file does not change tournament authorization yet.
 */

const URCBM_AUTH_POLICY = {
  MIN_PASSWORD_LENGTH: 12,
  MAX_PASSWORD_LENGTH: 128,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCK_MINUTES: 15,
  SESSION_DAYS: 7,
  VERIFY_TOKEN_MINUTES: 24 * 60,
  RESET_TOKEN_MINUTES: 30,
  EMAIL_COOLDOWN_SECONDS: 60
};

function authServiceValidatePassword_(password) {
  if (typeof password !== 'string') {
    throw new Error('INVALID_PASSWORD');
  }

  const length = Array.from(password).length;

  if (
    length < URCBM_AUTH_POLICY.MIN_PASSWORD_LENGTH ||
    length > URCBM_AUTH_POLICY.MAX_PASSWORD_LENGTH
  ) {
    throw new Error('INVALID_PASSWORD');
  }

  return password;
}

function authServicePublicUser_(user) {
  return {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    status: user.status
  };
}

function authServiceGetAppUrl_() {
  let url = '';

  try {
    if (typeof getAppUrl_ === 'function') {
      url = getAppUrl_() || '';
    }

    if (!url && typeof ScriptApp !== 'undefined') {
      url = ScriptApp.getService().getUrl() || '';
    }
  } catch (error) {
    url = '';
  }

  if (!/^https:\/\/.+/i.test(url)) {
    throw new Error('AUTH_APP_URL_NOT_CONFIGURED');
  }

  return url;
}

function authServiceBuildActionUrl_(action, token) {
  const base = authServiceGetAppUrl_();
  const separator = base.indexOf('?') === -1 ? '?' : '&';

  return base + separator +
    'auth=' + encodeURIComponent(action) +
    '&token=' + encodeURIComponent(token);
}

function authServiceEscapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function authServiceSendTokenEmail_(user, purpose, token, expiresAt) {
  if (typeof MailApp === 'undefined' || !MailApp.sendEmail) {
    throw new Error('AUTH_MAIL_UNAVAILABLE');
  }

  let subject;
  let heading;
  let explanation;
  let action;
  let buttonLabel;

  if (purpose === 'verify_email') {
    subject = 'Verify your URCBM account';
    heading = 'Verify your email';
    explanation = 'Confirm your email address to activate your URCBM account.';
    action = 'verify';
    buttonLabel = 'Verify email';
  } else if (purpose === 'reset_password') {
    subject = 'Reset your URCBM password';
    heading = 'Reset your password';
    explanation = 'Use the link below to choose a new password for your URCBM account.';
    action = 'reset';
    buttonLabel = 'Reset password';
  } else {
    throw new Error('INVALID_TOKEN_PURPOSE');
  }

  const url = authServiceBuildActionUrl_(action, token);
  const safeUrl = authServiceEscapeHtml_(url);
  const safeName = authServiceEscapeHtml_(user.displayName);
  const expiry = new Date(expiresAt).toLocaleString('en-US', {
    timeZone: 'America/Sao_Paulo'
  });

  MailApp.sendEmail({
    to: user.email,
    subject: subject,
    body:
      'Hello ' + user.displayName + ',\n\n' +
      explanation + '\n\n' +
      url + '\n\n' +
      'This link expires at ' + expiry +
      ' (São Paulo time). If you did not request this, ignore this email.',
    htmlBody:
      '<p>Hello ' + safeName + ',</p>' +
      '<p>' + explanation + '</p>' +
      '<p><a href="' + safeUrl + '">' + buttonLabel + '</a></p>' +
      '<p>This link expires at ' + authServiceEscapeHtml_(expiry) +
      ' (São Paulo time).</p>' +
      '<p>If you did not request this, you can ignore this email.</p>'
  });
}

function authServiceAcquireEmailCooldown_(email, purpose) {
  const normalizedEmail = authStoreNormalizeEmail_(email);
  const cache = CacheService.getScriptCache();
  const key = 'auth_mail_' + purpose + '_' +
    urcbmAuthTokenHash_(normalizedEmail);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    if (cache.get(key)) return false;

    cache.put(
      key,
      '1',
      URCBM_AUTH_POLICY.EMAIL_COOLDOWN_SECONDS
    );

    return true;
  } finally {
    lock.releaseLock();
  }
}


/* =========================================================
 * Registration and email verification
 * =======================================================*/

/**
 * Client-callable.
 * Returns a generic success message for duplicate email addresses.
 */
function authRegisterAccount(input) {
  const data = input || {};

  let email;
  let password;
  let displayName;

  try {
    email = authStoreNormalizeEmail_(data.email);
    password = authServiceValidatePassword_(data.password);
    displayName = String(data.displayName || '').trim();

    if (
      !displayName ||
      displayName.length > 40 ||
      /[\u0000-\u001f\u007f]/.test(displayName)
    ) {
      throw new Error('INVALID_DISPLAY_NAME');
    }
  } catch (error) {
    return {
      ok: false,
      error: error.message === 'INVALID_DISPLAY_NAME'
        ? 'INVALID_DISPLAY_NAME'
        : error.message === 'INVALID_EMAIL'
          ? 'INVALID_EMAIL'
          : 'INVALID_PASSWORD'
    };
  }

  const salt = urcbmAuthCreateSalt_();
  const hash = urcbmAuthPasswordHash_(password, salt);

  let user;

  try {
    user = authStoreCreateUser_({
      email: email,
      passwordSalt: salt,
      passwordHash: hash,
      displayName: displayName
    });
  } catch (error) {
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      return {
        ok: true,
        message: 'If this address can be registered, check your email for next steps.'
      };
    }

    throw error;
  }

  try {
    if (authServiceAcquireEmailCooldown_(email, 'verify')) {
      const token = authStoreCreateOneTimeToken_(
        user.userId,
        'verify_email',
        URCBM_AUTH_POLICY.VERIFY_TOKEN_MINUTES
      );

      authServiceSendTokenEmail_(
        user,
        'verify_email',
        token.token,
        token.expiresAt
      );
    }
  } catch (error) {
    // Never log an email address or token.
    Logger.log('AUTH_EMAIL_DELIVERY_FAILED: verify_email');
  }

  return {
    ok: true,
    message: 'If this address can be registered, check your email for next steps.'
  };
}

/** Client-callable. Accepts either a token string or {token}. */
function authVerifyEmail(input) {
  const token = typeof input === 'string'
    ? input
    : String(input && input.token || '');

  const result = authStoreConsumeOneTimeToken_(
    token,
    'verify_email'
  );

  if (!result) {
    return { ok: false, error: 'INVALID_OR_EXPIRED_TOKEN' };
  }

  authStoreVerifyUserEmail_(result.userId);

  return {
    ok: true,
    message: 'EMAIL_VERIFIED'
  };
}

/** Client-callable. Response does not disclose account existence. */
function authResendVerificationEmail(input) {
  const emailInput = typeof input === 'string'
    ? input
    : String(input && input.email || '');

  let email;

  try {
    email = authStoreNormalizeEmail_(emailInput);
  } catch (error) {
    return {
      ok: true,
      message: 'If the account needs verification, an email will be sent.'
    };
  }

  try {
    if (!authServiceAcquireEmailCooldown_(email, 'verify')) {
      return {
        ok: true,
        message: 'If the account needs verification, an email will be sent.'
      };
    }

    const user = authStoreGetUserByEmail_(email);

    if (user && user.status === 'pending' && !user.emailVerified) {
      const token = authStoreCreateOneTimeToken_(
        user.userId,
        'verify_email',
        URCBM_AUTH_POLICY.VERIFY_TOKEN_MINUTES
      );

      authServiceSendTokenEmail_(
        user,
        'verify_email',
        token.token,
        token.expiresAt
      );
    }
  } catch (error) {
    Logger.log('AUTH_EMAIL_DELIVERY_FAILED: verify_email');
  }

  return {
    ok: true,
    message: 'If the account needs verification, an email will be sent.'
  };
}


/* =========================================================
 * Login and current-session validation
 * =======================================================*/

/** Client-callable. The raw session token is returned only on login. */
function authLogin(input) {
  const data = input || {};
  let email;

  try {
    email = authStoreNormalizeEmail_(data.email);
  } catch (error) {
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }

  const password = data.password;

  if (
    typeof password !== 'string' ||
    password.length < 1 ||
    password.length > URCBM_AUTH_POLICY.MAX_PASSWORD_LENGTH
  ) {
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }

  const user = authStoreGetUserByEmail_(email);

  // Do comparable hash work for an unknown email without revealing it.
  if (!user) {
    urcbmAuthPasswordHash_(
      password,
      '0000000000000000000000000000000000000000000000000000000000000000'
    );
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }

  if (authStoreIsUserLocked_(user)) {
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }

  const suppliedHash = urcbmAuthPasswordHash_(
    password,
    user.passwordSalt
  );

  if (!urcbmAuthConstantTimeEqual_(suppliedHash, user.passwordHash)) {
    authStoreRecordLoginFailure_(
      user.userId,
      URCBM_AUTH_POLICY.MAX_LOGIN_ATTEMPTS,
      URCBM_AUTH_POLICY.LOCK_MINUTES
    );

    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }

  if (!user.emailVerified || user.status === 'pending') {
    return { ok: false, error: 'EMAIL_NOT_VERIFIED' };
  }

  if (user.status !== 'active') {
    return { ok: false, error: 'ACCOUNT_DISABLED' };
  }

  authStoreRecordLoginSuccess_(user.userId);

  const session = authStoreCreateSession_(
    user.userId,
    URCBM_AUTH_POLICY.SESSION_DAYS
  );

  return {
    ok: true,
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    user: authServicePublicUser_(user)
  };
}

/** Client-callable. Pass the raw token returned by authLogin(). */
function authGetCurrentSession(input) {
  const token = typeof input === 'string'
    ? input
    : String(input && input.sessionToken || '');

  const session = authStoreFindSession_(token);

  if (!session) {
    return { ok: false, error: 'INVALID_SESSION' };
  }

  const user = authStoreGetUserById_(session.userId);

  if (!user) {
    return { ok: false, error: 'INVALID_SESSION' };
  }

  return {
    ok: true,
    expiresAt: session.expiresAt,
    user: authServicePublicUser_(user)
  };
}

/** Client-callable. Safe to call when no token is present. */
function authLogout(input) {
  const token = typeof input === 'string'
    ? input
    : String(input && input.sessionToken || '');

  if (!token) return { ok: true };

  authStoreRevokeSession_(token);

  return { ok: true };
}


/* =========================================================
 * Password reset
 * =======================================================*/

/** Client-callable. Does not disclose whether the email is registered. */
function authRequestPasswordReset(input) {
  const emailInput = typeof input === 'string'
    ? input
    : String(input && input.email || '');

  let email;

  try {
    email = authStoreNormalizeEmail_(emailInput);
  } catch (error) {
    return {
      ok: true,
      message: 'If an eligible account exists, a reset email will be sent.'
    };
  }

  try {
    if (!authServiceAcquireEmailCooldown_(email, 'reset')) {
      return {
        ok: true,
        message: 'If an eligible account exists, a reset email will be sent.'
      };
    }

    const user = authStoreGetUserByEmail_(email);

    if (user && user.status === 'active' && user.emailVerified) {
      const token = authStoreCreateOneTimeToken_(
        user.userId,
        'reset_password',
        URCBM_AUTH_POLICY.RESET_TOKEN_MINUTES
      );

      authServiceSendTokenEmail_(
        user,
        'reset_password',
        token.token,
        token.expiresAt
      );
    }
  } catch (error) {
    Logger.log('AUTH_EMAIL_DELIVERY_FAILED: reset_password');
  }

  return {
    ok: true,
    message: 'If an eligible account exists, a reset email will be sent.'
  };
}

/** Client-callable. Expects {token, password}. */
function authResetPassword(input) {
  const data = input || {};
  const token = String(data.token || '');

  let newPassword;

  try {
    newPassword = authServiceValidatePassword_(data.password);
  } catch (error) {
    return { ok: false, error: 'INVALID_PASSWORD' };
  }

  const result = authStoreConsumeOneTimeToken_(
    token,
    'reset_password'
  );

  if (!result) {
    return { ok: false, error: 'INVALID_OR_EXPIRED_TOKEN' };
  }

  const user = authStoreGetUserById_(result.userId);

  if (
    !user ||
    user.status !== 'active' ||
    !user.emailVerified
  ) {
    return { ok: false, error: 'ACCOUNT_NOT_VERIFIED' };
  }

  const salt = urcbmAuthCreateSalt_();
  const hash = urcbmAuthPasswordHash_(newPassword, salt);

  authStoreUpdatePassword_(user.userId, salt, hash);
  authStoreRevokeAllSessions_(user.userId);

  return {
    ok: true,
    message: 'PASSWORD_RESET_SUCCESS'
  };
}