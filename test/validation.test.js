const { test } = require('node:test');
const assert = require('node:assert');
const {
  validateDisplayName,
  DISPLAY_NAME_MAX
} = require('../src/shared/utils.js');

test('rejects non-string input', () => {
  assert.strictEqual(validateDisplayName(123).valid, false);
  assert.strictEqual(validateDisplayName(null).valid, false);
});

test('rejects empty and whitespace-only names', () => {
  assert.strictEqual(validateDisplayName('').valid, false);
  assert.strictEqual(validateDisplayName('   ').valid, false);
});

test('rejects names longer than max', () => {
  const long = 'a'.repeat(DISPLAY_NAME_MAX + 1);
  assert.strictEqual(validateDisplayName(long).valid, false);
});

test('accepts names at max length', () => {
  const exact = 'a'.repeat(DISPLAY_NAME_MAX);
  const r = validateDisplayName(exact);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.value, exact);
});

test('rejects invalid characters', () => {
  ['<Bob>', 'A&B', 'A"B', 'A;B', 'A/B', 'A\\B', 'A\u0000B'].forEach(n => {
    assert.strictEqual(validateDisplayName(n).valid, false, 'should reject: ' + n);
  });
});

test('accepts allowed punctuation', () => {
  ['Bobby', 'Bobby B', "O'Brien", 'A-B', 'A_B', 'A.B', 'A B'].forEach(n => {
    assert.strictEqual(validateDisplayName(n).valid, true, 'should accept: ' + n);
  });
});

test('trims surrounding whitespace', () => {
  const r = validateDisplayName('  Bob  ');
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.value, 'Bob');
});

test('rejects duplicates case-insensitively', () => {
  const existing = ['Alice', 'Bob'];
  assert.strictEqual(validateDisplayName('alice', existing).valid, false);
  assert.strictEqual(validateDisplayName('ALICE', existing).valid, false);
  assert.strictEqual(validateDisplayName('Charlie', existing).valid, true);
});

test('duplicate check treats whitespace-trimmed name', () => {
  const existing = ['Alice'];
  assert.strictEqual(validateDisplayName('  Alice ', existing).valid, false);
});