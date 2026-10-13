/* =========================================================
 * Client-facing API
 * Every function here is callable from the client.
 * Return values must be JSON-safe (no Date, no functions).
 * =======================================================*/

function apiGetTournament(id) {
  return getTournament(id); // already returns a plain object
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