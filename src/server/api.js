/* =========================================================
 * Client-facing API
 *
 * Existing api... functions are intentionally public.
 * Internal business functions are private (trailing underscore).
 *
 * Contract:
 * - Public reads accept optional sessionToken as the final argument.
 * - Mutations require sessionToken as the final argument.
 * - Authentication endpoints remain in authService.js.
 * =======================================================*/

function apiGetTournament(id, sessionToken) {
  return withOptionalAuthSession_(sessionToken, function () {
    return getTournament_(id);
  });
}

function apiGetInviteDecision(inviteToken, sessionToken) {
  return withOptionalAuthSession_(sessionToken, function () {
    return validateInviteToken_(inviteToken);
  });
}

function apiGetCurrentUserRole(id, sessionToken) {
  return withOptionalAuthSession_(sessionToken, function () {
    return resolveRole_(id);
  });
}

function apiCreateTournament(input, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return createTournament_(input);
  });
}

function apiRegisterPlayer(input, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return registerPlayer_(input);
  });
}

function apiGetParticipants(id, sessionToken) {
  return withOptionalAuthSession_(sessionToken, function () {
    return getParticipants_(id);
  });
}

function apiRemovePlayer(id, targetUserId, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return removePlayer_(id, targetUserId);
  });
}

function apiPromoteToManager(id, targetUserId, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return promoteToManager_(id, targetUserId);
  });
}

function apiRevokeManager(id, targetUserId, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return revokeManager_(id, targetUserId);
  });
}

function apiGenerateBracket(id, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return generateBracket_(id);
  });
}

function apiGetMatches(id, sessionToken) {
  return withOptionalAuthSession_(sessionToken, function () {
    return getMatches_(id);
  });
}

function apiGetSnapshot(id, sessionToken) {
  return withOptionalAuthSession_(sessionToken, function () {
    return getTournamentSnapshot_(id);
  });
}

function apiUpdateTournament(id, input, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return updateTournament_(id, input);
  });
}

function apiCompleteTournament(id, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return completeTournament_(id);
  });
}

function apiCancelTournament(id, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return cancelTournament_(id);
  });
}

function apiArchiveTournament(id, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return archiveTournament_(id);
  });
}

function apiGenerateInviteToken(id, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return generateInviteToken_(id);
  });
}

function apiRevokeInviteToken(id, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return revokeInviteToken_(id);
  });
}

function apiPickWinner(id, matchIndex, winner, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return pickWinner_(id, matchIndex, winner);
  });
}

function apiSetMatchScores(id, matchIndex, scoreA, scoreB, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return setMatchScores_(id, matchIndex, scoreA, scoreB);
  });
}

function apiClearWinner(id, matchIndex, sessionToken) {
  return withAuthSession_(sessionToken, function () {
    return clearWinner_(id, matchIndex);
  });
}

function apiGetHub(sessionToken) {
  return withOptionalAuthSession_(sessionToken, function () {
    return getHub_();
  });
}