/* =========================================================
 * App-owner helpers
 * =======================================================*/

function getEffectiveEmail_() {
  try {
    if (typeof Session === 'undefined') return '';
    const email = Session.getEffectiveUser().getEmail();
    return email ? email.toLowerCase() : '';
  } catch (e) {
    return '';
  }
}

function isAppOwner_() {
  const active = getActiveEmail_();
  const effective = getEffectiveEmail_();
  return !!active && !!effective && active === effective;
}

function assertAppOwner_() {
  if (!isAppOwner_()) throw new Error('FORBIDDEN');
  return getActiveEmail_();
}

/* =========================================================
 * Identity
 * =======================================================*/

/**
 * Returns the email bound to the validated auth session for this
 * server request, or '' when there is no authenticated request context.
 *
 * Deliberately does not fall back to the Google account of the caller.
 * Client API wrappers must establish this context explicitly.
 */
function getActiveEmail_() {
  const context = getAuthRequestContext_();

  return context && context.authenticated
    ? String(context.email || '').toLowerCase()
    : '';
}

/* =========================================================
 * Role resolution
 * =======================================================*/

/**
 * Resolves the caller's role for a given tournament.
 *
 * The owner's tournament role is determined by ownerEmail, not by a
 * participant row. An owner who has also registered as a player still
 * receives ROLES.OWNER, but ctx.participant will be populated so that
 * bracket seeding and their displayed nickname work.
 *
 * @param {string} tournamentId
 * @returns {{email: string, userId: string, role: string,
 *            tournament: object|null, participant: object|null}}
 */
function getCurrentUserContext_(tournamentId) {
  const context = getAuthRequestContext_();
  const email  = context && context.authenticated
    ? String(context.email || '').toLowerCase()
    : '';
  const userId = context && context.authenticated
    ? String(context.userId || '')
    : '';

  const tournament = findTournamentById_(tournamentId);

  const ctx = {
    email: email,
    userId: userId,
    role: ROLES.GUEST,
    tournament: tournament,
    participant: null
  };
  if (!tournament) return ctx;

  // Participant lookup by userId (applies to everyone, including owner)
  if (userId) {
    const participant = readParticipantByUserId_(tournament.tabName, userId);
    if (participant) ctx.participant = participant;
  }

  // Owner short-circuits participant-based role
  if (email && tournament.ownerEmail &&
      String(tournament.ownerEmail).toLowerCase() === email) {
    ctx.role = ROLES.OWNER;
    return ctx;
  }

  if (!ctx.participant) return ctx;

  ctx.role = ctx.participant.role === PARTICIPANT_ROLES.MANAGER
    ? ROLES.MANAGER
    : ROLES.PLAYER;
  return ctx;
}

/**
 * Convenience: role string only.
 * @param {string} tournamentId
 * @returns {string}
 */
function resolveRole_(tournamentId) {
  return getCurrentUserContext_(tournamentId).role;
}

/* =========================================================
 * Guards
 * =======================================================*/

function assertAuthenticated_() {
  const email = getActiveEmail_();
  if (!email) throw new Error('AUTH_REQUIRED');
  return email;
}

function assertCanWrite_(tournamentId) {
  const ctx = getCurrentUserContext_(tournamentId);
  if (ctx.role !== ROLES.OWNER && ctx.role !== ROLES.MANAGER) {
    throw new Error('FORBIDDEN');
  }
  return ctx;
}

function assertOwner_(tournamentId) {
  const ctx = getCurrentUserContext_(tournamentId);
  if (ctx.role !== ROLES.OWNER) throw new Error('FORBIDDEN');
  return ctx;
}

function isOwner_(tournamentId) {
  return resolveRole_(tournamentId) === ROLES.OWNER;
}

function isManager_(tournamentId) {
  return resolveRole_(tournamentId) === ROLES.MANAGER;
}

function canWrite_(tournamentId) {
  const role = resolveRole_(tournamentId);
  return role === ROLES.OWNER || role === ROLES.MANAGER;
}

function getActiveUserId_() {
  const context = getAuthRequestContext_();
  return context && context.authenticated ? context.userId : '';
}