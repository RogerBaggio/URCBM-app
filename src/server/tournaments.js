/* =========================================================
 * Create
 * =======================================================*/

function createTournament(input) {
  const email = assertAuthenticated();
  const name = String(input && input.name || '').trim();
  const game = String(input && input.game || '').trim();

  if (!name || name.length > 80) throw new Error('INVALID_NAME');
  if (!game || game.length > 80) throw new Error('INVALID_GAME');

  const id = makeId();
  const tabName = buildTabName(id);
  const inviteToken = makeInviteToken();

  createTournamentTab(tabName);

  const t = {
    id,
    name:        sanitizeForSheet(name),
    game:        sanitizeForSheet(game),
    state:       TOURNAMENT_STATES.REGISTRATION_OPEN,
    tabName,
    inviteToken,
    ownerEmail:  email,
    created:     nowIso(),
    closed:      '',
    generated:   '',
    completed:   ''
  };

  appendMasterRow(t);
  writeTournamentMeta(t);

  return publicTournament(t, { role: ROLES.OWNER, email });
}

/* =========================================================
 * Read
 * =======================================================*/

function getTournament(id) {
  const t = findTournamentById(id);
  if (!t) return null;
  return publicTournament(t, getCurrentUserContext(id));
}

/**
 * Sanitized tournament object for the frontend.
 * Hides inviteToken + ownerEmail from everyone except owner.
 */
function publicTournament(t, ctx) {
  const role = (ctx && ctx.role) || ROLES.GUEST;
  const out = {
    id:        t.id,
    name:      t.name,
    game:      t.game,
    state:     t.state,
    created:   t.created,
    closed:    t.closed,
    generated: t.generated,
    completed: t.completed,
    role:      role
  };
  if (role === ROLES.OWNER) {
    out.inviteToken = t.inviteToken;
    out.ownerEmail  = t.ownerEmail;
  } else if (role === ROLES.MANAGER) {
    out.inviteToken = t.inviteToken;
  }
  return out;
}

/* =========================================================
 * State transitions (owner only)
 * =======================================================*/

function closeRegistration(id) {
  assertOwner(id);
  const t = requireTournament(id);
  if (t.state !== TOURNAMENT_STATES.REGISTRATION_OPEN) {
    throw new Error('INVALID_STATE');
  }

  const participants = readParticipants(t.tabName);
  if (participants.length < MIN_PLAYERS) {
    throw new Error('MIN_PLAYERS_REQUIRED');
  }

  t.state  = TOURNAMENT_STATES.REGISTRATION_CLOSED;
  t.closed = nowIso();
  updateMasterRow(id, { state: t.state, closed: t.closed });
  writeTournamentMeta(t);
  return publicTournament(t, getCurrentUserContext(id));
}

function completeTournament(id) {
  assertOwner(id);
  const t = requireTournament(id);
  if (t.state !== TOURNAMENT_STATES.BRACKET_GENERATED) {
    throw new Error('INVALID_STATE');
  }
  t.state     = TOURNAMENT_STATES.COMPLETED;
  t.completed = nowIso();
  updateMasterRow(id, { state: t.state, completed: t.completed });
  writeTournamentMeta(t);
  return publicTournament(t, getCurrentUserContext(id));
}

function cancelTournament(id) {
  assertOwner(id);
  const t = requireTournament(id);
  if (t.state === TOURNAMENT_STATES.CANCELLED) {
    throw new Error('ALREADY_CANCELLED');
  }
  t.state = TOURNAMENT_STATES.CANCELLED;
  updateMasterRow(id, { state: t.state });
  writeTournamentMeta(t);
  return publicTournament(t, getCurrentUserContext(id));
}

/* =========================================================
 * Archive (soft delete — rename tab + hide)
 * =======================================================*/

function archiveTournament(id) {
  assertOwner(id);
  const t = requireTournament(id);
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(t.tabName);
  if (!sheet) throw new Error('TAB_NOT_FOUND');

  const archivedName = SHEETS.ARCHIVE_PREFIX + t.tabName;
  if (!ss.getSheetByName(archivedName)) {
    sheet.setName(archivedName);
    sheet.hideSheet();
  }
  t.tabName = archivedName;
  updateMasterRow(id, { tabName: archivedName });
  return publicTournament(t, getCurrentUserContext(id));
}

/* =========================================================
 * Invite token management (owner only)
 * =======================================================*/

function generateInviteToken(id) {
  assertOwner(id);
  const t = requireTournament(id);
  if (t.state === TOURNAMENT_STATES.CANCELLED) {
    throw new Error('INVALID_STATE');
  }
  t.inviteToken = makeInviteToken();
  updateMasterRow(id, { inviteToken: t.inviteToken });
  writeTournamentMeta(t);
  return t.inviteToken;
}

function revokeInviteToken(id) {
  assertOwner(id);
  const t = requireTournament(id);
  t.inviteToken = '';
  updateMasterRow(id, { inviteToken: '' });
  writeTournamentMeta(t);
  return true;
}

/* =========================================================
 * Internal helper
 * =======================================================*/

function requireTournament(id) {
  const t = findTournamentById(id);
  if (!t) throw new Error('NOT_FOUND');
  return t;
}