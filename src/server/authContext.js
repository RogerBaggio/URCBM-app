/**
 * Request-scoped authenticated identity.
 *
 * This context is set only while a server-side wrapper is executing.
 * Every protected API wrapper must validate its session before calling
 * existing application functions.
 */

var AUTH_REQUEST_CONTEXT_ = null;

function getAuthRequestContext_() {
  return AUTH_REQUEST_CONTEXT_;
}

function withAuthRequestContext_(sessionToken, allowAnonymous, callback) {
  if (typeof callback !== 'function') {
    throw new Error('INVALID_AUTH_CALLBACK');
  }

  const token = String(sessionToken || '').trim();
  let context;

  if (!token && !allowAnonymous) {
    throw new Error('');
  }

  if (!token) {
    context = {
      authenticated: false,
      userId: '',
      email: '',
      displayName: ''
    };
  } else {
    const session = authStoreFindSession_(token);

    if (!session) {
      throw new Error('AUTH_REQUIRED');
    }

    const user = authStoreGetUserById_(session.userId);

    if (
      !user ||
      user.status !== 'active' ||
      !user.emailVerified
    ) {
      throw new Error('AUTH_REQUIRED');
    }

    context = {
      authenticated: true,
      userId: user.userId,
      email: user.email,
      displayName: user.displayName
    };
  }

  const previous = AUTH_REQUEST_CONTEXT_;
  AUTH_REQUEST_CONTEXT_ = context;

  try {
    return callback(context);
  } finally {
    AUTH_REQUEST_CONTEXT_ = previous;
  }
}

function withAuthSession_(sessionToken, callback) {
  return withAuthRequestContext_(sessionToken, false, callback);
}

function withOptionalAuthSession_(sessionToken, callback) {
  return withAuthRequestContext_(sessionToken, true, callback);
}