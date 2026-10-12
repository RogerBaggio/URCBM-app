/* =========================================================
 * Identity
 * =======================================================*/

/**
 * Returns the active user's email (lowercased), or '' if anonymous.
 * Works only inside Apps Script; returns '' in Node/tests.
 */
function getActiveEmail() {
  try {
    if (typeof Session === 'undefined') return '';
    const email = Session.getActiveUser().getEmail();
    return email ? email.toLowerCase() : '';
  } catch (e) {
    return '';
  }
}

/* =========================================================
 * Role resolution
 * =======================================================*/

/**
 * Resolves the caller's role for a given tournament.
 * @param {string} tournamentId
 * @returns {{email: string, role: string, tournament: object|null, participant: object|null}}
 */
function getCurrentUserContext(tournamentId) {
  const email = getActiveEmail();
  const tournament = findTournamentById(tournamentId);

  const ctx = { email, role: ROLES.GUEST, tournament, participant: null };
  if (!tournament) return ctx;

  if (email && tournament.ownerEmail &&
      String(tournament.ownerEmail).toLowerCase() === email) {
    ctx.role = ROLES.OWNER;
    return ctx;
  }

  if (!email) return ctx;

  const participant = readParticipantByEmail(tournament.tabName, email);
  if (!participant) return ctx;

  ctx.participant = participant;
  ctx.role = participant.role === PARTICIPANT_ROLES.MANAGER
    ? ROLES.MANAGER
    : ROLES.PLAYER;
  return ctx;
}

/**
 * Convenience: role string only.
 * @param {string} tournamentId
 * @returns {string}
 */
function resolveRole(tournamentId) {
  return getCurrentUserContext(tournamentId).role;
}

/* =========================================================
 * Guards
 * =======================================================*/

function assertAuthenticated() {
  const email = getActiveEmail();
  if (!email) throw new Error('AUTH_REQUIRED');
  return email;
}

function assertCanWrite(tournamentId) {
  const ctx = getCurrentUserContext(tournamentId);
  if (ctx.role !== ROLES.OWNER && ctx.role !== ROLES.MANAGER) {
    throw new Error('FORBIDDEN');
  }
  return ctx;
}

function assertOwner(tournamentId) {
  const ctx = getCurrentUserContext(tournamentId);
  if (ctx.role !== ROLES.OWNER) throw new Error('FORBIDDEN');
  return ctx;
}

function isOwner(tournamentId) {
  return resolveRole(tournamentId) === ROLES.OWNER;
}

function isManager(tournamentId) {
  return resolveRole(tournamentId) === ROLES.MANAGER;
}

function canWrite(tournamentId) {
  const role = resolveRole(tournamentId);
  return role === ROLES.OWNER || role === ROLES.MANAGER;
}