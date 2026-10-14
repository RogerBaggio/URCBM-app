/* =========================================================
 * Client-facing API
 * Every function here is callable from the client.
 * Return values must be JSON-safe (no Date, no functions).
 * =======================================================*/

function apiGetTournament(id) {
  return getTournament(id);
}

function apiGetInviteDecision(token) {
  return validateInviteToken(token);
}

function apiGetCurrentUserRole(id) {
  return resolveRole(id);
}

function apiCreateTournament(input) {
  return createTournament(input);
}

function apiCloseRegistration(id) {
  return closeRegistration(id);
}

function apiRegisterPlayer(input) {
  return registerPlayer(input);
}

function apiGetParticipants(id) {
  return getParticipants(id);
}

function apiRemovePlayer(id, email) {
  return removePlayer(id, email);
}

function apiPromoteToManager(id, email) {
  return promoteToManager(id, email);
}

function apiGenerateBracket(id) {
  return generateBracket(id);
}

function apiGetMatches(id) {
  return getMatches(id);
}

function apiUpdateMatchResult(id, matchIndex, scoreA, scoreB) {
  return updateMatchResult(id, matchIndex, scoreA, scoreB);
}

function apiUndoMatchResult(id, matchIndex) {
  return undoMatchResult(id, matchIndex);
}

function apiGetSnapshot(id) {
  return getTournamentSnapshot(id);
}