/* =========================================================
 * MATCHES — sheet serialization
 * =======================================================*/

function readMatches_(tabName) {
  const sheet = getTournamentSheet_(tabName);
  const values = sheet.getRange(
    LAYOUT.MATCHES_START, 1,
    LAYOUT.MATCHES_MAX, MATCH_HEADERS.length
  ).getValues();

  const out = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    const parsed = parseMatchIndex_(row[0]);
    if (!parsed) continue;
    out.push({
      round:        parsed.round,
      matchInRound: parsed.matchInRound,
      playerA:      row[1] || '',
      playerAScore: row[2] === '' ? '' : Number(row[2]),
      playerB:      row[3] || '',
      playerBScore: row[4] === '' ? '' : Number(row[4]),
      winner:       row[5] || '',
      updatedAt:    toIsoString_(row[6]),
      updatedBy:    row[7] || ''
    });
  }
  return out;
}

function writeMatches_(tournament, matches) {
  const sheet = getTournamentSheet_(tournament.tabName);

  const blank = [];
  for (let i = 0; i < LAYOUT.MATCHES_MAX; i++) {
    blank.push(['', '', '', '', '', '', '', '']);
  }
  sheet.getRange(
    LAYOUT.MATCHES_START, 1,
    LAYOUT.MATCHES_MAX, MATCH_HEADERS.length
  ).setValues(blank);

  if (matches.length) {
    const rows = matches.map(m => [
      matchIndexString_(m.round, m.matchInRound),
      m.playerA || '',
      m.playerAScore === '' ? '' : m.playerAScore,
      m.playerB || '',
      m.playerBScore === '' ? '' : m.playerBScore,
      m.winner || '',
      m.updatedAt || '',
      m.updatedBy || ''
    ]);
    sheet.getRange(
      LAYOUT.MATCHES_START, 1,
      rows.length, MATCH_HEADERS.length
    ).setValues(rows);
  }

  cacheRemoveSnapshot_(tournament.id);
}

/* =========================================================
 * Bracket generation
 * =======================================================*/

function generateBracket_(tournamentId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    assertOwner_(tournamentId);
    const t = requireTournament_(tournamentId);

    if (t.state !== TOURNAMENT_STATES.REGISTRATION_OPEN) {
      throw new Error('INVALID_STATE');
    }

    const participants = readParticipants_(t.tabName);
    if (participants.length < MIN_PLAYERS) {
      throw new Error('MIN_PLAYERS_REQUIRED');
    }

    const displayNames = participants.map(p => p.displayName);
    const bracketSize  = nextBracketSize_(displayNames.length);
    const slots        = buildFirstRoundSlots_(displayNames, bracketSize);
    const matches      = buildMatches_(slots, bracketSize, nowIso_);

    writeMatches_(t, matches);

    t.state     = TOURNAMENT_STATES.BRACKET_GENERATED;
    t.generated = nowIso_();
    updateMasterRow_(tournamentId, { state: t.state, generated: t.generated });
    writeTournamentMeta_(t);

    return { size: bracketSize, matchCount: matches.length };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * Winner pick (explicit, by dropdown)
 * =======================================================*/

function pickWinner_(tournamentId, matchIndex, winnerName) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ctx = assertCanWrite_(tournamentId);
    const t = requireTournament_(tournamentId);
    if (t.state !== TOURNAMENT_STATES.BRACKET_GENERATED) throw new Error('INVALID_STATE');

    const parsed = parseMatchIndex_(matchIndex);
    if (!parsed) throw new Error('INVALID_MATCH_INDEX');

    const matches = readMatches_(t.tabName);
    const idx = findMatchIndex_(matches, parsed.round, parsed.matchInRound);
    if (idx === -1) throw new Error('MATCH_NOT_FOUND');

    const match = matches[idx];
    if (!match.playerA || !match.playerB ||
        match.playerA === BYE || match.playerB === BYE) {
      throw new Error('MATCH_NOT_READY');
    }

    const name = String(winnerName || '').trim();
    if (name !== match.playerA && name !== match.playerB) {
      throw new Error('INVALID_WINNER');
    }

    if (match.winner && match.winner !== name) {
      clearDownstream_(matches, parsed.round, parsed.matchInRound, match.winner);
    }

    match.winner    = name;
    match.updatedAt = nowIso_();
    match.updatedBy = ctx.email;

    advanceWinner_(matches, parsed.round, parsed.matchInRound, name);

    writeMatches_(t, matches);
    return { ok: true, matches: matches };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * Scores (visual only)
 * =======================================================*/

function setMatchScores_(tournamentId, matchIndex, scoreA, scoreB) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ctx = assertCanWrite_(tournamentId);
    const t = requireTournament_(tournamentId);
    if (t.state !== TOURNAMENT_STATES.BRACKET_GENERATED) throw new Error('INVALID_STATE');

    const parsed = parseMatchIndex_(matchIndex);
    if (!parsed) throw new Error('INVALID_MATCH_INDEX');

    const matches = readMatches_(t.tabName);
    const idx = findMatchIndex_(matches, parsed.round, parsed.matchInRound);
    if (idx === -1) throw new Error('MATCH_NOT_FOUND');

    const match = matches[idx];
    match.playerAScore = (scoreA === '' || scoreA == null) ? '' : validateScore_(scoreA);
    match.playerBScore = (scoreB === '' || scoreB == null) ? '' : validateScore_(scoreB);
    match.updatedAt    = nowIso_();
    match.updatedBy    = ctx.email;

    writeMatches_(t, matches);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * Clear winner (undo)
 * =======================================================*/

function clearWinner_(tournamentId, matchIndex) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ctx = assertCanWrite_(tournamentId);
    const t = requireTournament_(tournamentId);
    if (t.state !== TOURNAMENT_STATES.BRACKET_GENERATED) throw new Error('INVALID_STATE');

    const parsed = parseMatchIndex_(matchIndex);
    if (!parsed) throw new Error('INVALID_MATCH_INDEX');

    const matches = readMatches_(t.tabName);
    const idx = findMatchIndex_(matches, parsed.round, parsed.matchInRound);
    if (idx === -1) throw new Error('MATCH_NOT_FOUND');

    const match = matches[idx];
    if (!match.winner) throw new Error('NO_RESULT_TO_UNDO');

    clearDownstream_(matches, parsed.round, parsed.matchInRound, match.winner);
    match.winner    = '';
    match.updatedAt = nowIso_();
    match.updatedBy = ctx.email;

    writeMatches_(t, matches);
    return { ok: true, matches: matches };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * Read model
 * =======================================================*/

function getMatches_(tournamentId) {
  const t = findTournamentById_(tournamentId);
  if (!t) return [];
  return readMatches_(t.tabName);
}