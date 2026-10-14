/* =========================================================
 * Snapshot builder
 * =======================================================*/

/**
 * Raw snapshot (includes emails). Cached.
 * @param {object} t - master row
 * @returns {object}
 */
function buildRawSnapshot(t) {
  const participants = readParticipants(t.tabName);
  const matches      = readMatches(t.tabName);

  let latestMatchUpdate = '';
  for (let i = 0; i < matches.length; i++) {
    const u = matches[i].updatedAt || '';
    if (u > latestMatchUpdate) latestMatchUpdate = u;
  }

  return {
    tournament: {
      id:        t.id,
      name:      t.name,
      game:      t.game,
      state:     t.state,
      created:   t.created,
      closed:    t.closed,
      generated: t.generated,
      completed: t.completed
    },
    participants: participants,
    matches:      matches,
    version:      t.state + '|' + latestMatchUpdate,
    serverTime:   nowIso()
  };
}

/* =========================================================
 * Sanitizer
 * =======================================================*/

/**
 * Produce a role-safe view of the snapshot.
 * Emails are only included for owner and manager.
 */
function sanitizeSnapshot(raw, role) {
  const exposeEmails = (role === ROLES.OWNER || role === ROLES.MANAGER);

  const participants = raw.participants.map(function (p) {
    if (exposeEmails) return p;
    return {
      displayName: p.displayName,
      role:        p.role,
      joinedAt:    p.joinedAt
    };
  });

  return {
    tournament:   raw.tournament,
    participants: participants,
    matches:      raw.matches,
    version:      raw.version,
    serverTime:   raw.serverTime
  };
}

/* =========================================================
 * Public entry
 * =======================================================*/

/**
 * Returns a role-safe snapshot of a tournament.
 * Uses CacheService; falls back to reading Sheets on miss.
 *
 * @param {string} tournamentId
 * @returns {object|null}
 */
function getTournamentSnapshot(tournamentId) {
  const t = findTournamentById(tournamentId);
  if (!t) return null;

  const ctx  = getCurrentUserContext(tournamentId);
  const role = ctx.role;

  const key = CACHE_KEYS.SNAPSHOT(tournamentId);
  let raw = cacheGet(key);

  if (!raw) {
    raw = buildRawSnapshot(t);
    cachePut(key, raw, CACHE_TTL_SECONDS);
  }

  // Always add role + inviteToken for owner/manager (never cached)
  const view = sanitizeSnapshot(raw, role);
  view.role = role;

  if (role === ROLES.OWNER) {
    view.inviteToken = t.inviteToken;
    view.ownerEmail  = t.ownerEmail;
  } else if (role === ROLES.MANAGER) {
    view.inviteToken = t.inviteToken;
  }

  return view;
}