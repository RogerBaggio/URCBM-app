function jsonForScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/* =========================================================
 * doGet — entry point for all page loads
 * =======================================================*/

function doGet(e) {
  const params = (e && e.parameter) || {};
  const route  = resolveRoute(params);

  const template = HtmlService.createTemplateFromFile('index');
  template.bootstrap = jsonForScript(route);
  template.include   = include; // helper for client partials

  return template
    .evaluate()
    .setTitle('URCBM')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Resolves the page the user should see based on URL params.
 * Returns a plain object that the client reads from `bootstrap`.
 *
 * @param {Object} params - e.parameter from doGet
 * @returns {{page: string, tournamentId: string|null, inviteToken: string|null,
 *           decision: string|null, role: string, tournament: Object|null}}
 */
function resolveRoute(params) {
  const inviteToken = String(params.invite || '').trim();
  const tournamentId = String(params.t  || '').trim();

  // 1) Invite link → decision-based routing
  if (inviteToken) {
    const result = validateInviteToken(inviteToken);
    return {
      page:         'invite',
      tournamentId: result.tournamentId,
      inviteToken:  inviteToken,
      decision:     result.decision,
      role:         result.role,
      tournament:   result.tournament
    };
  }

  // 2) Direct tournament page
  if (tournamentId) {
    const t = findTournamentById(tournamentId);
    if (!t) {
      return { page: 'not-found', tournamentId: null, inviteToken: null,
               decision: null, role: ROLES.GUEST, tournament: null };
    }
    const ctx = getCurrentUserContext(tournamentId);
    return {
      page:         'tournament',
      tournamentId: tournamentId,
      inviteToken:  null,
      decision:     null,
      role:         ctx.role,
      tournament:   publicTournament(t, ctx)
    };
  }

  // 3) Default → hub
  return {
    page:         'hub',
    tournamentId: null,
    inviteToken:  null,
    decision:     null,
    role:         getActiveEmail() ? ROLES.PLAYER : ROLES.GUEST,
    tournament:   null
  };
}

/**
 * Helper used inside HTML templates to include partials.
 * Usage: <?!= include('styles') ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}