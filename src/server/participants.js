/* =========================================================
 * Registration
 * =======================================================*/

function registerPlayer(input) {
  const email   = assertAuthenticated();
  const rawName = String(input && input.displayName || '');
  const id      = String(input && input.tournamentId || '').trim();
  const token   = String(input && input.inviteToken || '').trim();

  let t = null;
  if (id) t = findTournamentById(id);
  else if (token) t = findTournamentByInviteToken(token);

  // 1) Id or Token must resolve to a tournament in RegistrationOpen
  if (!t) throw new Error('INVALID_TOURNAMENT');
  if (t.state !== TOURNAMENT_STATES.REGISTRATION_OPEN) {
    throw new Error('REGISTRATION_CLOSED');
  }

  // 2) Not already registered
  if (String(t.ownerEmail).toLowerCase() === email) {
    throw new Error('OWNER_CANNOT_REGISTER');
  }
  const existing = readParticipants(t.tabName);
  if (existing.some(p => p.email === email)) {
    throw new Error('ALREADY_REGISTERED');
  }

  // 3) Capacity check (max 32 for v1)
  if (existing.length >= LAYOUT.PARTICIPANTS_MAX) {
    throw new Error('TOURNAMENT_FULL');
  }

  // 4) Validate display name against existing names
  const result = validateDisplayName(
    rawName,
    existing.map(p => p.displayName)
  );
  if (!result.valid) throw new Error('INVALID_NAME: ' + result.error);

  // 5) Build participant row
  const participant = {
    email:       email,
    googleName:  email.split('@')[0],
    displayName: result.value,
    role:        PARTICIPANT_ROLES.PLAYER,
    joinedAt:    nowIso()
  };

  const updated = existing.concat([participant]);
  writeParticipants(t, updated);

  return publicParticipant(participant, ROLES.PLAYER);
}

/* =========================================================
 * Remove (pre-bracket only, owner only)
 * =======================================================*/

function removePlayer(tournamentId, targetEmail) {
  assertOwner(tournamentId);
  const t = requireTournament(tournamentId);

  if (t.state !== TOURNAMENT_STATES.REGISTRATION_OPEN &&
      t.state !== TOURNAMENT_STATES.REGISTRATION_CLOSED) {
    throw new Error('INVALID_STATE');
  }

  const target = String(targetEmail || '').toLowerCase();
  const list = readParticipants(t.tabName);
  const next = list.filter(p => p.email !== target);
  if (next.length === list.length) throw new Error('NOT_FOUND');

  writeParticipants(t, next);
  return true;
}

/* =========================================================
 * Promote/Revoke manager (owner only)
 * =======================================================*/

function promoteToManager(tournamentId, targetEmail) {
  assertOwner(tournamentId);
  const t = requireTournament(tournamentId);

  const allowed = [
    TOURNAMENT_STATES.REGISTRATION_OPEN,
    TOURNAMENT_STATES.BRACKET_GENERATED
  ];
  if (allowed.indexOf(t.state) === -1) throw new Error('INVALID_STATE');

  const target = String(targetEmail || '').toLowerCase();
  const list = readParticipants(t.tabName);
  let found = false;
  const next = list.map(p => {
    if (p.email === target) {
      found = true;
      return Object.assign({}, p, { role: PARTICIPANT_ROLES.MANAGER });
    }
    return p;
  });
  if (!found) throw new Error('NOT_FOUND');

  writeParticipants(t, next);
  return true;
}

function revokeManager(tournamentId, targetEmail) {
  assertOwner(tournamentId);
  const t = requireTournament(tournamentId);
  const allowed = [
    TOURNAMENT_STATES.REGISTRATION_OPEN,
    TOURNAMENT_STATES.BRACKET_GENERATED
  ];
  if (allowed.indexOf(t.state) === -1) throw new Error('INVALID_STATE');

  const target = String(targetEmail || '').toLowerCase();
  const list = readParticipants(t.tabName);
  let found = false;
  const next = list.map(p => {
    if (p.email === target) {
      found = true;
      return Object.assign({}, p, { role: PARTICIPANT_ROLES.PLAYER });
    }
    return p;
  });
  if (!found) throw new Error('NOT_FOUND');
  writeParticipants(t, next);
  return true;
}

/* =========================================================
 * Read (sanitized by role)
 * =======================================================*/

function getParticipants(tournamentId) {
  const t = findTournamentById(tournamentId);
  if (!t) return [];

  const ctx = getCurrentUserContext(tournamentId);
  const list = readParticipants(t.tabName);
  const exposeEmails =
    ctx.role === ROLES.OWNER || ctx.role === ROLES.MANAGER;

  return list.map(p => publicParticipant(p, ctx.role, exposeEmails));
}

function publicParticipant(p, role, exposeEmails) {
  const out = {
    displayName: p.displayName,
    role:        p.role,
    joinedAt:    p.joinedAt
  };
  if (exposeEmails) {
    out.email      = p.email;
    out.googleName = p.googleName;
  }
  return out;
}