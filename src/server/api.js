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

function apiGetSnapshot(id) {
  return getTournamentSnapshot(id);
}

function apiUpdateTournament(id, input) { 
  return updateTournament(id, input); 
}

function apiCompleteTournament(id) {
  return completeTournament(id);
}

function apiCancelTournament(id) {
  return cancelTournament(id);
}

function apiArchiveTournament(id) {
  return archiveTournament(id);
}

function apiGenerateInviteToken(id) {
  return generateInviteToken(id);
}

function apiRevokeInviteToken(id) {
  return revokeInviteToken(id);
}

function apiRevokeManager(id, email) {
  return revokeManager(id, email);
}

function apiPickWinner(id, mi, winner) {
  return pickWinner(id, mi, winner);
}

function apiSetMatchScores(id, mi, a, b) {
  return setMatchScores(id, mi, a, b);
}

function apiClearWinner(id, mi) {
  return clearWinner(id, mi);
}

function apiGetHub() {
  return getHub();
}