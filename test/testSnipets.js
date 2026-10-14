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

function _testRegisterPlayerAs(token, displayName, fakeEmail) {
  const original = Session.getActiveUser;
  try {
    Session.getActiveUser = function () {
      return { getEmail: function () { return fakeEmail; } };
    };
    return registerPlayer({ inviteToken: token, displayName: displayName });
  } finally {
    Session.getActiveUser = original;
  }
}

function _runParticipantSmokeTest() {
  const t = getTournament("3afec435-5318-4cc5-acb8-c353423d6eb7"); 
  //const t = createTournament({ name: 'Party', game: 'Smash' });
  Logger.log('Token: ' + t.inviteToken);

  // Register two fake players
  _testRegisterPlayerAs(t.inviteToken, 'Alice', 'alice@example.com');
  _testRegisterPlayerAs(t.inviteToken, 'Bob',   'bob@example.com');

  // Duplicate display name → error
  try {
    _testRegisterPlayerAs(t.inviteToken, 'alice', 'charlie@example.com');
  } catch (e) {
    Logger.log('Duplicate rejected: ' + e.message);
  }

  // Duplicate email → error
  try {
    _testRegisterPlayerAs(t.inviteToken, 'Charlie', 'alice@example.com');
  } catch (e) {
    Logger.log('Duplicate email rejected: ' + e.message);
  }

  // List as owner
  Logger.log(getParticipants(t.id));  // includes emails

  // Promote Alice
  promoteToManager(t.id, 'alice@example.com');
  Logger.log('Alice promoted');

  // Remove Bob
  removePlayer(t.id, 'bob@example.com');
  Logger.log('Bob removed');

  Logger.log(getParticipants(t.id));
}

function _runMatchSmokeTest() {
  const t = getTournament("3afec435-5318-4cc5-acb8-c353423d6eb7"); 
  //const t = createTournament({ name: 'Smoke', game: 'Test' });
  ['A','B','C','D','E','F','G','H','I','J'].forEach((n, i) => {
    _testRegisterPlayerAs(t.inviteToken, n, n.toLowerCase() + '@example.com');
  });
  closeRegistration(t.id);
  generateBracket(t.id);

  const matches = getMatches(t.id);
  Logger.log('bracket size matches: ' + matches.length); // expect 15 for 10 players

  // Find a ready R1 match
  const r1 = matches.filter(m => m.round === 1 && m.playerA && m.playerB &&
                                 m.playerA !== 'BYE' && m.playerB !== 'BYE')[0];
  Logger.log('ready match: ' + r1.playerA + ' vs ' + r1.playerB);

  updateMatchResult(t.id, matchIndexString(r1.round, r1.matchInRound), 3, 1);
  Logger.log('after result:');
  Logger.log(getMatches(t.id).filter(m => m.round <= 2));

  undoMatchResult(t.id, matchIndexString(r1.round, r1.matchInRound));
  Logger.log('after undo:');
  Logger.log(getMatches(t.id).filter(m => m.round <= 2));
}

function _testSnapshot() {
  const t = createTournament({ name: 'Snap', game: 'Test' });
  ['A','B','C','D'].forEach(n => {
    _testRegisterPlayerAs(t.inviteToken, n, n.toLowerCase() + '@example.com');
  });
  closeRegistration(t.id);
  generateBracket(t.id);

  // First call: cache miss
  const a = getTournamentSnapshot(t.id);
  Logger.log('version 1: ' + a.version);
  Logger.log('participants: ' + a.participants.length);
  Logger.log('matches: ' + a.matches.length);
  Logger.log('role: ' + a.role); // owner

  // Second call: cache hit
  const b = getTournamentSnapshot(t.id);
  Logger.log('version 2: ' + b.version); // should match
  Logger.log('same version: ' + (a.version === b.version));

  // Change a result → version changes
  const r1 = a.matches.filter(m => m.round === 1 &&
    m.playerA && m.playerB && m.playerA !== 'BYE' && m.playerB !== 'BYE')[0];
  updateMatchResult(t.id, matchIndexString(r1.round, r1.matchInRound), 2, 0);

  const c = getTournamentSnapshot(t.id);
  Logger.log('version 3: ' + c.version); // different
}