/**
 * Password Utils Test
 * Verifies password utils behavior and regression boundaries.
 */

'use strict';

const assert = require('node:assert/strict');
const crypto = require('crypto');
const test = require('node:test');
const passwordUtils = require('../../src/main/auth/password-utils');

test('passwords use the current scrypt format and timing-safe verification', async () => {
  const password = 'Strong-Passphrase-42!';
  const hash = await passwordUtils.hashPassword(password);
  assert.match(hash, /^scrypt\$/);
  assert.equal(await passwordUtils.verifyPassword(password, hash), true);
  assert.equal(await passwordUtils.verifyPassword('wrong-password', hash), false);
  assert.equal(passwordUtils.needsRehash(hash), false);
});

test('legacy PBKDF2 hashes verify once and are marked for rehash', async () => {
  const password = 'Legacy-Passphrase-42!';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  const stored = `${salt}:${hash}`;
  assert.equal(await passwordUtils.verifyPassword(password, stored), true);
  assert.equal(passwordUtils.needsRehash(stored), true);
});

test('password strength requires length and mixed character classes', () => {
  assert.equal(passwordUtils.validatePasswordStrength('Short1!'), false);
  assert.equal(passwordUtils.validatePasswordStrength('long-but-no-number!'), false);
  assert.equal(passwordUtils.validatePasswordStrength('Strong-Passphrase-42!'), true);
});
