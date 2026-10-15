/* =========================================================
 * MATCHES — sheet serialization
 * =======================================================*/

function readMatches(tabName) {
  const sheet = getTournamentSheet(tabName);
  const values = sheet.getRange(
    LAYOUT.MATCHES_START, 1,
    LAYOUT.MATCHES_MAX, MATCH_HEADERS.length
  ).getValues();

  const out = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    const parsed = parseMatchIndex(row[0]);
    if (!parsed) continue;
    out.push({
      round:        parsed.round,
      matchInRound: parsed.matchInRound,
      playerA:      row[1] || '',
      playerAScore: row[2] === '' ? '' : Number(row[2]),
      playerB:      row[3] || '',
      playerBScore: row[4] === '' ? '' : Number(row[4]),
      winner:       row[5] || '',
      updatedAt:    toIsoString(row[6]),
      updatedBy:    row[7] || ''
    });
  }
  return out;
}

function writeMatches(tournament, matches) {
  const sheet = getTournamentSheet(tournament.tabName);

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
      matchIndexString(m.round, m.matchInRound),
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

  cacheRemoveSnapshot(tournament.id);
}

/* =========================================================
 * Bracket generation
 * =======================================================*/

function generateBracket(tournamentId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    assertOwner(tournamentId);
    const t = requireTournament(tournamentId);

    if (t.state !== TOURNAMENT_STATES.REGISTRATION_CLOSED) {
      throw new Error('INVALID_STATE');
    }

    const participants = readParticipants(t.tabName);
    if (participants.length < MIN_PLAYERS) {
      throw new Error('MIN_PLAYERS_REQUIRED');
    }

    const displayNames = participants.map(p => p.displayName);
    const bracketSize  = nextBracketSize(displayNames.length);
    const slots        = buildFirstRoundSlots(displayNames, bracketSize);
    const matches      = buildMatches(slots, bracketSize, nowIso);

    writeMatches(t, matches);

    t.state     = TOURNAMENT_STATES.BRACKET_GENERATED;
    t.generated = nowIso();
    updateMasterRow(tournamentId, { state: t.state, generated: t.generated });
    writeTournamentMeta(t);

    return { size: bracketSize, matchCount: matches.length };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * Winner pick (explicit, by dropdown)
 * =======================================================*/

function pickWinner(tournamentId, matchIndex, winnerName) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ctx = assertCanWrite(tournamentId);
    const t = requireTournament(tournamentId);
    if (t.state !== TOURNAMENT_STATES.BRACKET_GENERATED) throw new Error('INVALID_STATE');

    const parsed = parseMatchIndex(matchIndex);
    if (!parsed) throw new Error('INVALID_MATCH_INDEX');

    const matches = readMatches(t.tabName);
    const idx = findMatchIndex(matches, parsed.round, parsed.matchInRound);
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
      clearDownstream(matches, parsed.round, parsed.matchInRound, match.winner);
    }

    match.winner    = name;
    match.updatedAt = nowIso();
    match.updatedBy = ctx.email;

    advanceWinner(matches, parsed.round, parsed.matchInRound, name);

    writeMatches(t, matches);
    return { ok: true, matches: matches };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * Scores (visual only)
 * =======================================================*/

function setMatchScores(tournamentId, matchIndex, scoreA, scoreB) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ctx = assertCanWrite(tournamentId);
    const t = requireTournament(tournamentId);
    if (t.state !== TOURNAMENT_STATES.BRACKET_GENERATED) throw new Error('INVALID_STATE');

    const parsed = parseMatchIndex(matchIndex);
    if (!parsed) throw new Error('INVALID_MATCH_INDEX');

    const matches = readMatches(t.tabName);
    const idx = findMatchIndex(matches, parsed.round, parsed.matchInRound);
    if (idx === -1) throw new Error('MATCH_NOT_FOUND');

    const match = matches[idx];
    match.playerAScore = (scoreA === '' || scoreA == null) ? '' : validateScore(scoreA);
    match.playerBScore = (scoreB === '' || scoreB == null) ? '' : validateScore(scoreB);
    match.updatedAt    = nowIso();
    match.updatedBy    = ctx.email;

    writeMatches(t, matches);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * Clear winner (undo)
 * =======================================================*/

function clearWinner(tournamentId, matchIndex) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ctx = assertCanWrite(tournamentId);
    const t = requireTournament(tournamentId);
    if (t.state !== TOURNAMENT_STATES.BRACKET_GENERATED) throw new Error('INVALID_STATE');

    const parsed = parseMatchIndex(matchIndex);
    if (!parsed) throw new Error('INVALID_MATCH_INDEX');

    const matches = readMatches(t.tabName);
    const idx = findMatchIndex(matches, parsed.round, parsed.matchInRound);
    if (idx === -1) throw new Error('MATCH_NOT_FOUND');

    const match = matches[idx];
    if (!match.winner) throw new Error('NO_RESULT_TO_UNDO');

    clearDownstream(matches, parsed.round, parsed.matchInRound, match.winner);
    match.winner    = '';
    match.updatedAt = nowIso();
    match.updatedBy = ctx.email;

    writeMatches(t, matches);
    return { ok: true, matches: matches };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * Read model
 * =======================================================*/

function getMatches(tournamentId) {
  const t = findTournamentById(tournamentId);
  if (!t) return [];
  return readMatches(t.tabName);
}