/* =========================================================
 * Registration
 * =======================================================*/

function registerPlayer_(input) {
  const context = getAuthRequestContext_();
  if (!context || !context.authenticated) {
    throw new Error('AUTH_REQUIRED');
  }

  const userId = String(context.userId || '');
  const email  = String(context.email || '').toLowerCase();

  if (!userId) throw new Error('AUTH_REQUIRED');

  const rawName = String(input && input.displayName || '');
  const id      = String(input && input.tournamentId || '').trim();
  const token   = String(input && input.inviteToken || '').trim();

  let t = null;
  if (id) t = findTournamentById_(id);
  else if (token) t = findTournamentByInviteToken_(token);

  if (!t) throw new Error('INVALID_TOURNAMENT');
  if (t.state !== TOURNAMENT_STATES.REGISTRATION_OPEN) {
    throw new Error('REGISTRATION_CLOSED');
  }

  const existing = readParticipants_(t.tabName);

  // Unique per (tournamentId, userId)
  if (existing.some(p => p.userId === userId)) {
    throw new Error('ALREADY_REGISTERED');
  }

  if (existing.length >= LAYOUT.PARTICIPANTS_MAX) {
    throw new Error('TOURNAMENT_FULL');
  }

  const result = validateDisplayName_(
    rawName,
    existing.map(p => p.displayName)
  );
  if (!result.valid) throw new Error('INVALID_NAME: ' + result.error);

  const participant = {
    userId:      userId,
    email:       email,
    googleName:  email.split('@')[0] || '',
    displayName: result.value,
    role:        PARTICIPANT_ROLES.PLAYER,
    joinedAt:    nowIso_()
  };

  const updated = existing.concat([participant]);
  writeParticipants_(t, updated);

  return publicParticipant_(participant, ROLES.PLAYER);
}

/* =========================================================
 * Remove (pre-bracket only, owner only)
 * =======================================================*/

function removePlayer_(tournamentId, targetUserId) {
  assertOwner_(tournamentId);
  const t = requireTournament_(tournamentId);

  if (t.state !== TOURNAMENT_STATES.REGISTRATION_OPEN) {
    throw new Error('INVALID_STATE');
  }

  const target = String(targetUserId || '').trim();
  if (!target) throw new Error('NOT_FOUND');

  const list = readParticipants_(t.tabName);
  const next = list.filter(p => p.userId !== target);
  if (next.length === list.length) throw new Error('NOT_FOUND');

  writeParticipants_(t, next);
  return true;
}

/* =========================================================
 * Promote/Revoke manager (owner only)
 * =======================================================*/

function promoteToManager_(tournamentId, targetUserId) {
  assertOwner_(tournamentId);
  const t = requireTournament_(tournamentId);

  const allowed = [
    TOURNAMENT_STATES.REGISTRATION_OPEN,
    TOURNAMENT_STATES.BRACKET_GENERATED
  ];
  if (allowed.indexOf(t.state) === -1) throw new Error('INVALID_STATE');

  const target = String(targetUserId || '').trim();
  const list = readParticipants_(t.tabName);
  let found = false;
  const next = list.map(p => {
    if (p.userId === target) {
      found = true;
      return Object.assign({}, p, { role: PARTICIPANT_ROLES.MANAGER });
    }
    return p;
  });
  if (!found) throw new Error('NOT_FOUND');

  writeParticipants_(t, next);
  return true;
}

function revokeManager_(tournamentId, targetUserId) {
  assertOwner_(tournamentId);
  const t = requireTournament_(tournamentId);
  const allowed = [
    TOURNAMENT_STATES.REGISTRATION_OPEN,
    TOURNAMENT_STATES.BRACKET_GENERATED
  ];
  if (allowed.indexOf(t.state) === -1) throw new Error('INVALID_STATE');

  const target = String(targetUserId || '').trim();
  const list = readParticipants_(t.tabName);
  let found = false;
  const next = list.map(p => {
    if (p.userId === target) {
      found = true;
      return Object.assign({}, p, { role: PARTICIPANT_ROLES.PLAYER });
    }
    return p;
  });
  if (!found) throw new Error('NOT_FOUND');
  writeParticipants_(t, next);
  return true;
}

/* =========================================================
 * Read (sanitized by role)
 * =======================================================*/

function getParticipants_(tournamentId) {
  const t = findTournamentById_(tournamentId);
  if (!t) return [];

  const ctx = getCurrentUserContext_(tournamentId);
  const list = readParticipants_(t.tabName);
  const exposeIdentifiers =
    ctx.role === ROLES.OWNER || ctx.role === ROLES.MANAGER;

  return list.map(p => publicParticipant_(p, ctx.role, exposeIdentifiers));
}

function publicParticipant_(p, role, exposeIdentifiers) {
  const out = {
    displayName: p.displayName,
    role:        p.role,
    joinedAt:    p.joinedAt
  };
  if (exposeIdentifiers) {
    out.userId     = p.userId;
    out.email      = p.email;
    out.googleName = p.googleName;
  }
  return out;
}