/* =========================================================
 * doGet — entry point for all page loads
 * =======================================================*/

function doGet(e) {
  const params = (e && e.parameter) || {};
  const route  = resolveRoute_(params);

  // Capture the real /exec URL while we're in an HTTP context
  route.appUrl = registerAndGetAppUrl_();

  const template = HtmlService.createTemplateFromFile('index');
  template.bootstrap = jsonForScript_(route);
  template.include_   = include_;
  template.appUrl    = route.appUrl || '';

  return template
    .evaluate()
    .setTitle('URCBM')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 
 * Resolves the page the user should see based on URL params.
 * Returns a plain object that the client reads from `bootstrap`.
 *
 * @param {Object} params - e.parameter from doGet
 * @returns {{page: string, tournamentId: string|null, inviteToken: string|null,
 *           decision: string|null, role: string, tournament: Object|null}}
 */
function resolveRoute_(params) {
  const authAction   = String(params.auth || '').trim().toLowerCase();
  const authToken    = String(params.token || '').trim();
  const authRedirect = String(params.redirect || '').trim();

  // 0) Auth routes (login / register / verify / reset)
  if (authAction) {
    return {
      page:         'auth',
      authAction:   authAction,
      authToken:    authToken,
      authRedirect: authRedirect || '?'
    };
  }

  const inviteToken  = String(params.invite || '').trim();
  const tournamentId = String(params.t || '').trim();

  // 1) Invite link → decision-based routing
  if (inviteToken) {
    const result = validateInviteToken_(inviteToken);
    return {
      page:         'invite',
      tournamentId: result.tournamentId,
      inviteToken:  inviteToken,
      decision:     result.decision,
      role:         result.role,
      isLoggedIn:   !!getActiveEmail_(),
      tournament:   result.tournament
    };
  }

  // 2) Direct tournament page
  if (tournamentId) {
    const t = findTournamentById_(tournamentId);
    if (!t) {
      return { page: 'error', code: 'NOT_FOUND', role: ROLES.GUEST };
    }
    const ctx = getCurrentUserContext_(tournamentId);
    return {
      page:         'tournament',
      tournamentId: tournamentId,
      role:         ctx.role,
      tournament:   publicTournament_(t, ctx)
    };
  }

  // 3) Default → hub
  return {
    page:         'hub',
    isAppOwner: isAppOwner_(),
    role:         getActiveEmail_() ? ROLES.PLAYER : ROLES.GUEST,
  };
}

/**
 * Helper used inside HTML templates to include partials.
 * Usage: <?!= include('styles') ?>
 */
function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function jsonForScript_(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}