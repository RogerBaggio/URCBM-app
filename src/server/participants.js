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
 * Batch mutation (used by the Manage Players dialog)
 * =======================================================*/

/**
 * changes: [{ action: 'remove' | 'promote' | 'demote', userId: '...' },...]
 * Rules:
 *   - remove  → only in REGISTRATION_OPEN
 *   - promote → REGISTRATION_OPEN or BRACKET_GENERATED
 *   - demote  → REGISTRATION_OPEN or BRACKET_GENERATED
 */
function applyParticipantChanges_(tournamentId, changes) {
  assertOwner_(tournamentId);
  const t = requireTournament_(tournamentId);

  if (!Array.isArray(changes) || changes.length === 0) {
    return { ok: true, noop: true };
  }
  if (changes.length > 64) {
    throw new Error('INVALID_CHANGES');
  }

  const allowed = [
    TOURNAMENT_STATES.REGISTRATION_OPEN,
    TOURNAMENT_STATES.BRACKET_GENERATED
  ];
  if (allowed.indexOf(t.state) === -1) throw new Error('INVALID_STATE');

  const hasRemovals = changes.some(function (c) {
    return c && c.action === 'remove';
  });
  if (hasRemovals && t.state !== TOURNAMENT_STATES.REGISTRATION_OPEN) {
    throw new Error('INVALID_STATE');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const list = readParticipants_(t.tabName);
    const byId = {};
    list.forEach(function (p) { byId[p.userId] = p; });

    let next = list.slice();

    changes.forEach(function (c) {
      const action = String(c && c.action || '');
      const userId = String(c && c.userId || '').trim();

      if (!userId) throw new Error('INVALID_CHANGE');
      if (!byId[userId]) throw new Error('NOT_FOUND');

      if (action === 'remove') {
        next = next.filter(function (p) { return p.userId !== userId; });
      } else if (action === 'promote') {
        next = next.map(function (p) {
          return p.userId === userId
            ? Object.assign({}, p, { role: PARTICIPANT_ROLES.MANAGER })
            : p;
        });
      } else if (action === 'demote') {
        next = next.map(function (p) {
          return p.userId === userId
            ? Object.assign({}, p, { role: PARTICIPANT_ROLES.PLAYER })
            : p;
        });
      } else {
        throw new Error('INVALID_ACTION');
      }
    });

    writeParticipants_(t, next);
    return { ok: true, count: next.length };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * Single-action primitives (thin wrappers over the batch)
 * =======================================================*/

function removePlayer_(tournamentId, targetUserId) {
  applyParticipantChanges_(tournamentId, [
    { action: 'remove', userId: targetUserId }
  ]);
  return true;
}

function promoteToManager_(tournamentId, targetUserId) {
  applyParticipantChanges_(tournamentId, [
    { action: 'promote', userId: targetUserId }
  ]);
  return true;
}

function revokeManager_(tournamentId, targetUserId) {
  applyParticipantChanges_(tournamentId, [
    { action: 'demote', userId: targetUserId }
  ]);
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