const { test } = require('node:test');
const assert = require('node:assert');
const {
  BYE,
  nextBracketSize,
  shuffleArray,
  buildFirstRoundSlots,
  buildMatches,
  matchIndexString,
  parseMatchIndex,
  findMatchIndex
} = require('../src/server/bracket.js');

function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ----------------------------------------------ha-----------
 * nextBracketSize
 * -------------------------------------------------------*/

test('nextBracketSize maps N to smallest 4/8/16/32', () => {
  assert.strictEqual(nextBracketSize(2),  4);
  assert.strictEqual(nextBracketSize(3),  4);
  assert.strictEqual(nextBracketSize(4),  4);
  assert.strictEqual(nextBracketSize(5),  8);
  assert.strictEqual(nextBracketSize(8),  8);
  assert.strictEqual(nextBracketSize(9),  16);
  assert.strictEqual(nextBracketSize(16), 16);
  assert.strictEqual(nextBracketSize(17), 32);
  assert.strictEqual(nextBracketSize(32), 32);
});

test('nextBracketSize rejects < 2 and > 32', () => {
  assert.throws(() => nextBracketSize(1), /TOO_FEW_PLAYERS/);
  assert.throws(() => nextBracketSize(33), /TOO_MANY_PLAYERS/);
});

/* ---------------------------------------------------------
 * shuffleArray
 * -------------------------------------------------------*/

test('shuffleArray returns same elements in permuted order', () => {
  const src = ['a', 'b', 'c', 'd', 'e'];
  const out = shuffleArray(src, seededRng(42));
  assert.strictEqual(out.length, src.length);
  assert.deepStrictEqual(out.slice().sort(), src.slice().sort());
  assert.notDeepStrictEqual(out, src); // very unlikely with seed 42
});

/* ---------------------------------------------------------
 * buildFirstRoundSlots
 * -------------------------------------------------------*/

function countByes(slots) {
  return slots.filter(s => s === BYE).length;
}

test('N=4, B=4 → no BYEs', () => {
  const slots = buildFirstRoundSlots(['A','B','C','D'], 4, seededRng(1));
  assert.strictEqual(countByes(slots), 0);
});

test('N=3, B=4 → 1 BYE', () => {
  const slots = buildFirstRoundSlots(['A','B','C'], 4, seededRng(1));
  assert.strictEqual(countByes(slots), 1);
});

test('N=2, B=4 → 2 BYEs', () => {
  const slots = buildFirstRoundSlots(['A','B'], 4, seededRng(1));
  assert.strictEqual(countByes(slots), 2);
});

test('N=5, B=8 → 3 BYEs', () => {
  const slots = buildFirstRoundSlots(['A','B','C','D','E'], 8, seededRng(1));
  assert.strictEqual(countByes(slots), 3);
});

test('N=10, B=16 → 6 BYEs, all even positions filled', () => {
  const players = 'ABCDEFGHIJ'.split('');
  const slots = buildFirstRoundSlots(players, 16, seededRng(7));
  assert.strictEqual(countByes(slots), 6);

  for (let i = 0; i < 16; i += 2) {
    assert.notStrictEqual(slots[i], BYE, 'even slot ' + i + ' should not be BYE');
  }
});

test('no BYE vs BYE in round 1 for any supported N', () => {
  for (let N = 2; N <= 32; N++) {
    const players = [];
    for (let i = 0; i < N; i++) players.push('P' + i);
    const B = nextBracketSize(N);
    const slots = buildFirstRoundSlots(players, B, seededRng(N));
    for (let m = 0; m < B; m += 2) {
      const a = slots[m], b = slots[m + 1];
      assert.ok(!(a === BYE && b === BYE),
        'N=' + N + ' match ' + m + ' is BYE vs BYE');
    }
  }
});

/* ---------------------------------------------------------
 * buildMatches
 * -------------------------------------------------------*/

test('N=10, B=16 → 15 matches, 8/4/2/1 per round', () => {
  const players = 'ABCDEFGHIJ'.split('');
  const slots = buildFirstRoundSlots(players, 16, seededRng(3));
  const matches = buildMatches(slots, 16, () => 'T');

  assert.strictEqual(matches.length, 15);
  const byRound = {};
  matches.forEach(m => { byRound[m.round] = (byRound[m.round] || 0) + 1; });
  assert.strictEqual(byRound[1], 8);
  assert.strictEqual(byRound[2], 4);
  assert.strictEqual(byRound[3], 2);
  assert.strictEqual(byRound[4], 1);
});

test('round-1 byes are auto-advanced, round-2 gets exactly one slot per BYE match', () => {
  const players = 'ABCDEFGHIJ'.split('');
  const slots = buildFirstRoundSlots(players, 16, seededRng(3));
  const matches = buildMatches(slots, 16, () => 'T');

  const round1 = matches.filter(m => m.round === 1);
  const round2 = matches.filter(m => m.round === 2);

  // Every round-1 match with a BYE must have an auto-assigned winner
  const byeMatches = round1.filter(m => m.playerA === BYE || m.playerB === BYE);
  assert.strictEqual(byeMatches.length, 6);
  byeMatches.forEach(m => {
    assert.ok(m.winner, 'bye match should have a winner');
    assert.notStrictEqual(m.winner, BYE, 'winner should be the real player');
  });

  // Every round-1 match without a BYE must NOT have a winner yet
  const realMatches = round1.filter(m => m.playerA !== BYE && m.playerB !== BYE);
  assert.strictEqual(realMatches.length, 2);
  realMatches.forEach(m => {
    assert.strictEqual(m.winner, '', 'real match should have no winner yet');
  });

  // Count filled round-2 slots: must equal number of BYE matches
  let filledSlots = 0;
  round2.forEach(m => {
    if (m.playerA) filledSlots++;
    if (m.playerB) filledSlots++;
  });
  assert.strictEqual(filledSlots, byeMatches.length,
    'exactly one round-2 slot should be filled per round-1 BYE match');
});

test('N=2, B=4 → both round-1 matches auto-advance, final has both players', () => {
  const slots = buildFirstRoundSlots(['A', 'B'], 4, seededRng(1));
  const matches = buildMatches(slots, 4, () => 'T');

  const r1 = matches.filter(m => m.round === 1);
  const r2 = matches.filter(m => m.round === 2)[0];

  assert.strictEqual(r1.length, 2);
  assert.ok(r1[0].winner);
  assert.ok(r1[1].winner);
  assert.ok(r2.playerA);
  assert.ok(r2.playerB);
  assert.notStrictEqual(r2.playerA, BYE);
  assert.notStrictEqual(r2.playerB, BYE);
});

/* ---------------------------------------------------------
 * Indexing
 * -------------------------------------------------------*/

test('matchIndexString / parseMatchIndex round-trip', () => {
  assert.strictEqual(matchIndexString(1, 1), 'R1-M1');
  assert.strictEqual(matchIndexString(3, 2), 'R3-M2');
  assert.deepStrictEqual(parseMatchIndex('R2-M4'), { round: 2, matchInRound: 4 });
  assert.strictEqual(parseMatchIndex('bad'), null);
  assert.strictEqual(parseMatchIndex(''), null);
});

test('findMatchIndex locates correct index', () => {
  const matches = [
    { round: 1, matchInRound: 1 },
    { round: 1, matchInRound: 2 },
    { round: 2, matchInRound: 1 }
  ];
  assert.strictEqual(findMatchIndex(matches, 1, 1), 0);
  assert.strictEqual(findMatchIndex(matches, 1, 2), 1);
  assert.strictEqual(findMatchIndex(matches, 2, 1), 2);
  assert.strictEqual(findMatchIndex(matches, 2, 9), -1);
});

const {
  validateScore,
  advanceWinner,
  clearDownstream
} = require('../src/server/bracket.js');

/* ---------------------------------------------------------
 * validateScore
 * -------------------------------------------------------*/

test('validateScore accepts non-negative integers and numeric strings', () => {
  assert.strictEqual(validateScore(0), 0);
  assert.strictEqual(validateScore(5), 5);
  assert.strictEqual(validateScore('3'), 3);
});

test('validateScore rejects blanks, negatives, non-integers, non-numbers', () => {
  assert.throws(() => validateScore(''), /SCORE_REQUIRED/);
  assert.throws(() => validateScore(null), /SCORE_REQUIRED/);
  assert.throws(() => validateScore(-1), /INVALID_SCORE/);
  assert.throws(() => validateScore(2.5), /INVALID_SCORE/);
  assert.throws(() => validateScore('abc'), /INVALID_SCORE/);
});

/* ---------------------------------------------------------
 * advanceWinner
 * -------------------------------------------------------*/

function makeMiniBracket() {
  // 4-player bracket: R1-M1, R1-M2, R2-M1
  return [
    { round: 1, matchInRound: 1, playerA: 'A', playerB: 'B', winner: '', playerAScore: '', playerBScore: '', updatedAt: '', updatedBy: '' },
    { round: 1, matchInRound: 2, playerA: 'C', playerB: 'D', winner: '', playerAScore: '', playerBScore: '', updatedAt: '', updatedBy: '' },
    { round: 2, matchInRound: 1, playerA: '', playerB: '', winner: '', playerAScore: '', playerBScore: '', updatedAt: '', updatedBy: '' }
  ];
}

test('advanceWinner puts odd matchInRound winner into playerA of next round', () => {
  const m = makeMiniBracket();
  advanceWinner(m, 1, 1, 'A');
  assert.strictEqual(m[2].playerA, 'A');
  assert.strictEqual(m[2].playerB, '');
});

test('advanceWinner puts even matchInRound winner into playerB of next round', () => {
  const m = makeMiniBracket();
  advanceWinner(m, 1, 2, 'C');
  assert.strictEqual(m[2].playerB, 'C');
  assert.strictEqual(m[2].playerA, '');
});

test('advanceWinner is a no-op at the final', () => {
  const m = makeMiniBracket();
  advanceWinner(m, 2, 1, 'A'); // final, no downstream
  assert.strictEqual(m[2].playerA, ''); // unchanged
});

/* ---------------------------------------------------------
 * clearDownstream
 * -------------------------------------------------------*/

test('clearDownstream removes old winner from next match slot', () => {
  const m = makeMiniBracket();
  m[0].winner = 'A';
  m[2].playerA = 'A';
  clearDownstream(m, 1, 1, 'A');
  assert.strictEqual(m[2].playerA, '');
  assert.strictEqual(m[2].winner, '');
});

test('clearDownstream cascades if the propagated player also won downstream', () => {
  // 8-player: R1-M1..M4, R2-M1..M2, R3-M1
  const m = [
    { round: 1, matchInRound: 1, playerA: 'A', playerB: 'B', winner: 'A', playerAScore: 1, playerBScore: 0, updatedAt: '', updatedBy: '' },
    { round: 1, matchInRound: 2, playerA: 'C', playerB: 'D', winner: 'C', playerAScore: 1, playerBScore: 0, updatedAt: '', updatedBy: '' },
    { round: 1, matchInRound: 3, playerA: 'E', playerB: 'F', winner: 'E', playerAScore: 1, playerBScore: 0, updatedAt: '', updatedBy: '' },
    { round: 1, matchInRound: 4, playerA: 'G', playerB: 'H', winner: 'G', playerAScore: 1, playerBScore: 0, updatedAt: '', updatedBy: '' },
    { round: 2, matchInRound: 1, playerA: 'A', playerB: 'C', winner: 'A', playerAScore: 1, playerBScore: 0, updatedAt: '', updatedBy: '' },
    { round: 2, matchInRound: 2, playerA: 'E', playerB: 'G', winner: '', playerAScore: '', playerBScore: '', updatedAt: '', updatedBy: '' },
    { round: 3, matchInRound: 1, playerA: 'A', playerB: '', winner: '', playerAScore: '', playerBScore: '', updatedAt: '', updatedBy: '' }
  ];
  clearDownstream(m, 1, 1, 'A');

  assert.strictEqual(m[4].playerA, '');      // slot cleared
  assert.strictEqual(m[4].winner, '');       // winner cleared
  assert.strictEqual(m[4].playerAScore, ''); // score cleared
  assert.strictEqual(m[6].playerA, '');      // cascade to final
});

test('clearDownstream does not cascade if propagated player lost downstream', () => {
  const m = makeMiniBracket();
  m[0].winner = 'A';
  m[2].playerA = 'A';
  m[2].playerB = 'B';
  m[2].winner = 'B'; // A lost the final
  clearDownstream(m, 1, 1, 'A');

  assert.strictEqual(m[2].playerA, '');
  assert.strictEqual(m[2].winner, 'B'); // untouched
});