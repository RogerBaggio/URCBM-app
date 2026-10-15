/**
 * Resolves what the app should do with a given invite token.
 *
 * Rules:
 *   RegistrationOpen | not registered     → register
 *   RegistrationOpen | registered         → already-registered
 *   BracketGenerated/Completed (any)      → watch
 *   Cancelled                             → cancelled
 *   Unknown token / revoked               → invalid
 *
 * @param {string} token
 * @returns {{
 *   valid: boolean,
 *   decision: string,
 *   role: string,
 *   tournamentId: string|null,
 *   tournament: object|null
 * }}
 */
function validateInviteToken(token) {
  const clean = String(token || '').trim();
  const empty = {
    valid: false,
    decision: INVITE_DECISIONS.INVALID,
    role: ROLES.GUEST,
    tournamentId: null,
    tournament: null
  };

  if (!clean) return empty;

  const t = findTournamentByInviteToken(clean);
  if (!t) return empty;

  return buildInviteResult(t);
}

function buildInviteResult(t) {
  const ctx  = getCurrentUserContext(t.id);
  const role = ctx.role;

  const isRegistered =
    role === ROLES.OWNER ||
    role === ROLES.MANAGER ||
    role === ROLES.PLAYER;

  const bracketReady =
    t.state === TOURNAMENT_STATES.BRACKET_GENERATED ||
    t.state === TOURNAMENT_STATES.COMPLETED;

  let decision;
  if (t.state === TOURNAMENT_STATES.CANCELLED) {
    decision = INVITE_DECISIONS.CANCELLED;
  } else if (bracketReady) {
    decision = INVITE_DECISIONS.WATCH;
  } else if (t.state === TOURNAMENT_STATES.REGISTRATION_OPEN) {
    decision = isRegistered
      ? INVITE_DECISIONS.ALREADY_REGISTERED
      : INVITE_DECISIONS.REGISTER;
  } else {
    decision = INVITE_DECISIONS.INVALID;
  }

  return {
    valid: true,
    decision,
    role,
    tournamentId: t.id,
    tournament: publicTournament(t, ctx)
  };
}