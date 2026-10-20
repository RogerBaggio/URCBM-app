/* =========================================================
 * Create
 * =======================================================*/

function createTournament_(input) {
  assertAppOwner_();
  const email = getActiveEmail_();
  const name = String(input && input.name || '').trim();
  const game = String(input && input.game || '').trim();
  const date = String(input && input.date || '').trim();

  if (!name || name.length > 80) throw new Error('INVALID_NAME');
  if (!game || game.length > 80) throw new Error('INVALID_GAME');

  const id = makeId_();
  const tabName = buildTabName_(id);
  const inviteToken = makeInviteToken_();

  createTournamentTab_(tabName);

  const t = {
    id,
    name:        sanitizeForSheet_(name),
    game:        sanitizeForSheet_(game),
    date:        date,
    state:       TOURNAMENT_STATES.REGISTRATION_OPEN,
    tabName,
    inviteToken,
    ownerEmail:  email,
    created:     nowIso_(),
    generated:   '',
    completed:   ''
  };

  appendMasterRow_(t);
  writeTournamentMeta_(t);

  return publicTournament_(t, { role: ROLES.OWNER, email });
}

/* =========================================================
 * Read
 * =======================================================*/

function getTournament_(id) {
  const t = findTournamentById_(id);
  if (!t) return null;
  return publicTournament_(t, getCurrentUserContext_(id));
}

/**
 * Sanitized tournament object for the frontend.
 * Hides inviteToken + ownerEmail from everyone except owner.
 */
function publicTournament_(t, ctx) {
  const role = (ctx && ctx.role) || ROLES.GUEST;
  const out = {
    id:        t.id,
    name:      t.name,
    game:      t.game,
    date:      t.date,
    state:     t.state,
    created:   t.created,
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

function completeTournament_(id) {
  assertOwner_(id);
  const t = requireTournament_(id);
  if (t.state !== TOURNAMENT_STATES.BRACKET_GENERATED) {
    throw new Error('INVALID_STATE');
  }
  t.state     = TOURNAMENT_STATES.COMPLETED;
  t.completed = nowIso_();
  updateMasterRow_(id, { state: t.state, completed: t.completed });
  writeTournamentMeta_(t);
  return publicTournament_(t, getCurrentUserContext_(id));
}

function cancelTournament_(id) {
  assertOwner_(id);
  const t = requireTournament_(id);
  if (t.state === TOURNAMENT_STATES.CANCELLED) {
    throw new Error('ALREADY_CANCELLED');
  }
  t.state = TOURNAMENT_STATES.CANCELLED;
  updateMasterRow_(id, { state: t.state });
  writeTournamentMeta_(t);
  return publicTournament_(t, getCurrentUserContext_(id));
}

/* =========================================================
 * Update metadata info (owner only)
 * =======================================================*/

function updateTournament_(id, input) {
  assertOwner_(id);
  const t = requireTournament_(id);
  if (t.state === TOURNAMENT_STATES.CANCELLED ||
      t.state === TOURNAMENT_STATES.COMPLETED) {
    throw new Error('INVALID_STATE');
  }
  const updates = {};
  if (input.name != null) {
    const n = String(input.name).trim();
    if (!n || n.length > 80) throw new Error('INVALID_NAME');
    t.name = sanitizeForSheet_(n);
    updates.name = t.name;
  }
  if (input.game != null) {
    const g = String(input.game).trim();
    if (!g || g.length > 80) throw new Error('INVALID_GAME');
    t.game = sanitizeForSheet_(g);
    updates.game = t.game;
  }
  if (input.date != null) {
    t.date = String(input.date).trim();
    updates.date = t.date;
  }
  updateMasterRow_(id, updates);
  writeTournamentMeta_(t);
  return publicTournament_(t, getCurrentUserContext_(id));
}

/* =========================================================
 * Archive (soft delete — rename tab + hide)
 * =======================================================*/

function archiveTournament_(id) {
  assertOwner_(id);
  const t = requireTournament_(id);
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(t.tabName);
  if (!sheet) throw new Error('TAB_NOT_FOUND');

  const archivedName = SHEETS.ARCHIVE_PREFIX + t.tabName;
  if (!ss.getSheetByName(archivedName)) {
    sheet.setName(archivedName);
    sheet.hideSheet();
  }
  t.tabName = archivedName;
  updateMasterRow_(id, { tabName: archivedName });
  return publicTournament_(t, getCurrentUserContext_(id));
}

/* =========================================================
 * Invite token management (owner only)
 * =======================================================*/

function generateInviteToken_(id) {
  assertOwner_(id);
  const t = requireTournament_(id);
  if (t.state !== TOURNAMENT_STATES.REGISTRATION_OPEN) {
    throw new Error('INVALID_STATE');
  }
  t.inviteToken = makeInviteToken_();
  updateMasterRow_(id, { inviteToken: t.inviteToken });
  writeTournamentMeta_(t);
  return t.inviteToken;
}

function revokeInviteToken_(id) {
  assertOwner_(id);
  const t = requireTournament_(id);
  t.inviteToken = '';
  updateMasterRow_(id, { inviteToken: '' });
  writeTournamentMeta_(t);
  return true;
}

/* =========================================================
 * Internal helper
 * =======================================================*/

function requireTournament_(id) {
  const t = findTournamentById_(id);
  if (!t) throw new Error('NOT_FOUND');
  return t;
}