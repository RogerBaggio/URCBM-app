function _testAuthNoTournament() {
  Logger.log(getActiveEmail());           // your email
  Logger.log(resolveRole('nonexistent')); // 'guest'
  try { assertCanWrite('nonexistent'); }
  catch (e) { Logger.log(e.message); }    // 'FORBIDDEN'
}

function _testTournamentLifecycle() {
  const t = createTournament({ name: 'Friday Night', game: 'Street Fighter' });
  Logger.log(t);                                   // owner view, includes inviteToken

  const fetched = getTournament(t.id);
  Logger.log(fetched.state);                       // RegistrationOpen
  Logger.log(fetched.role);                        // owner

  const closed = closeRegistration(t.id);
  Logger.log(closed.state);                        // RegistrationClosed

  const tok = generateInviteToken(t.id);
  Logger.log(tok);                                 // new token

  const archived = archiveTournament(t.id);
  Logger.log(archived.id);                         // unchanged
}

function _testInviteFlow() {
  const t = getTournament("3afec435-5318-4cc5-acb8-c353423d6eb7"); //Friday Night Tournament generated ID
  //const t = createTournament({ name: 'Invite Test', game: 'Tekken' });

  // 1) Owner opens their own invite link while registration is open
  Logger.log(validateInviteToken(t.inviteToken).decision);
  // → 'already-registered'  (owner is always 'registered')

  // 2) Revoke → invalid
  revokeInviteToken(t.id);
  Logger.log(validateInviteToken(t.inviteToken).decision);
  // → 'invalid'  (findTournamentByInviteToken matches on the live token)

  // 3) Regenerate → valid again
  const tok2 = generateInviteToken(t.id);
  Logger.log(validateInviteToken(tok2).decision);
  // → 'already-registered'  (still owner)

  // 4) Close registration → still 'already-registered' for owner
  closeRegistration(t.id);
  Logger.log(validateInviteToken(tok2).decision);
  // → 'already-registered'

  // 5) Fake a guest call by using an unknown token
  Logger.log(validateInviteToken('NOPE').decision);
  // → 'invalid'
}