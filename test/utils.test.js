const { test } = require('node:test');
const assert = require('node:assert');
const {
  makeId,
  makeInviteToken,
  nowIso,
  toIsoString,
  sanitizeText,
  sanitizeForSheet
} = require('../src/shared/utils.js');

test('makeId returns a non-empty unique string', () => {
  const a = makeId();
  const b = makeId();
  assert.strictEqual(typeof a, 'string');
  assert.ok(a.length > 0);
  assert.notStrictEqual(a, b);
});

test('makeInviteToken length and charset', () => {
  const t = makeInviteToken();
  assert.strictEqual(t.length, 20);
  assert.match(t, /^[A-Za-z0-9]+$/);
});

test('makeInviteToken returns different values', () => {
  assert.notStrictEqual(makeInviteToken(), makeInviteToken());
});

test('nowIso returns ISO-ish string', () => {
  assert.match(nowIso(), /^\d{4}-\d{2}-\d{2}T/);
});

test('toIsoString handles Date, string, empty', () => {
  assert.strictEqual(toIsoString(''), '');
  assert.strictEqual(toIsoString(null), '');
  assert.strictEqual(toIsoString('abc'), 'abc');
  assert.match(toIsoString(new Date(0)), /^1970-01-01T00:00:00/);
});

test('sanitizeText escapes HTML metacharacters', () => {
  assert.strictEqual(
    sanitizeText('<b>"A&B"</b>'),
    '&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;'
  );
});

test('sanitizeForSheet prefixes formula-like strings', () => {
  assert.strictEqual(sanitizeForSheet('=SUM(A1)'), "'=SUM(A1)");
  assert.strictEqual(sanitizeForSheet('+1'), "'+1");
  assert.strictEqual(sanitizeForSheet('@x'), "'@x");
  assert.strictEqual(sanitizeForSheet('-1'), "'-1");
  assert.strictEqual(sanitizeForSheet('Alice'), 'Alice');
});