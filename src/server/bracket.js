/* =========================================================
 * Bracket engine — pure functions, no side effects
 * =======================================================*/

const BYE = 'BYE';

function defaultNow() {
  return new Date().toISOString();
}

/**
 * Smallest power of two >= n, with a floor of 4.
 * @param {number} n
 * @returns {number}
 */
function nextBracketSize(n) {
  if (n < 2) throw new Error('TOO_FEW_PLAYERS');
  if (n <= 4)  return 4;
  if (n <= 8)  return 8;
  if (n <= 16) return 16;
  if (n <= 32) return 32;
  throw new Error('TOO_MANY_PLAYERS');
}

/**
 * Fisher–Yates shuffle. `rng` defaults to Math.random.
 */
function shuffleArray(arr, rng) {
  const a = arr.slice();
  const r = rng || Math.random;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

/**
 * Builds the initial slot array (length = bracketSize).
 * @param {string[]} players
 * @param {number} bracketSize
 * @param {Function} [rng]
 * @returns {string[]}
 */
function buildFirstRoundSlots(players, bracketSize, rng) {
  const N = players.length;
  const half = bracketSize / 2;
  const shuffled = shuffleArray(players, rng);

  const evenBatch = shuffled.slice(0, Math.min(N, half));
  const oddBatch  = shuffled.slice(Math.min(N, half));

  const slots = new Array(bracketSize).fill(BYE);
  for (let i = 0; i < evenBatch.length; i++) {
    slots[i * 2] = evenBatch[i];
  }

  const oddPositions = [];
  for (let i = 1; i < bracketSize; i += 2) oddPositions.push(i);
  const shuffledOdd = shuffleArray(oddPositions, rng);
  for (let i = 0; i < oddBatch.length; i++) {
    slots[shuffledOdd[i]] = oddBatch[i];
  }

  return slots;
}

/**
 * Produces the match array (length = bracketSize - 1).
 * Byes are auto-advanced; downstream slots are filled.
 * @param {string[]} slots
 * @param {number} bracketSize
 * @param {Function} [nowFn]
 */
function buildMatches(slots, bracketSize, nowFn) {
  const now = nowFn || defaultNow;
  const matches = [];
  const totalRounds = Math.round(Math.log2(bracketSize));
  const half = bracketSize / 2;

  // Round 1
  for (let m = 0; m < half; m++) {
    const a = slots[m * 2];
    const b = slots[m * 2 + 1];
    const aBye = a === BYE;
    const bBye = b === BYE;
    let winner = '';
    if (aBye && !bBye) winner = b;
    else if (bBye && !aBye) winner = a;
    matches.push({
      round: 1,
      matchInRound: m + 1,
      playerA: a,
      playerAScore: '',
      playerB: b,
      playerBScore: '',
      winner: winner,
      updatedAt: winner ? now() : '',
      updatedBy: winner ? 'system' : ''
    });
  }

  // Later rounds
  for (let r = 2; r <= totalRounds; r++) {
    const count = bracketSize / Math.pow(2, r);
    for (let m = 0; m < count; m++) {
      matches.push({
        round: r,
        matchInRound: m + 1,
        playerA: '', playerAScore: '',
        playerB: '', playerBScore: '',
        winner: '', updatedAt: '', updatedBy: ''
      });
    }
  }

  propagateByes(matches, bracketSize);
  return matches;
}

/**
 * Propagates round-1 byes to round 2.
 */
function propagateByes(matches, bracketSize) {
  const half = bracketSize / 2;
  for (let m = 0; m < half; m++) {
    const match = matches[m];
    if (!match.winner) continue;
    const nextIdx = findMatchIndex(matches, 2, Math.floor(m / 2) + 1);
    const side = (m % 2 === 0) ? 'playerA' : 'playerB';
    matches[nextIdx][side] = match.winner;
  }
}

/* =========================================================
 * Indexing helpers
 * =======================================================*/

function matchIndexString(round, matchInRound) {
  return 'R' + round + '-M' + matchInRound;
}

function parseMatchIndex(str) {
  const m = /^R(\d+)-M(\d+)$/.exec(String(str || ''));
  if (!m) return null;
  return { round: parseInt(m[1], 10), matchInRound: parseInt(m[2], 10) };
}

function findMatchIndex(matches, round, matchInRound) {
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].round === round && matches[i].matchInRound === matchInRound) return i;
  }
  return -1;
}

/* =========================================================
 * Node test-export guard
 * =======================================================*/

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BYE,
    nextBracketSize,
    shuffleArray,
    buildFirstRoundSlots,
    buildMatches,
    propagateByes,
    matchIndexString,
    parseMatchIndex,
    findMatchIndex
  };
}