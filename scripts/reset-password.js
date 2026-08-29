/**
 * Password Recovery
 * Resets a local user password and marks it for change at next login.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const knex = require('knex');
const passwordUtils = require('../src/main/auth/password-utils');
const { getDatabasePath } = require('../src/main/database/path-resolver');

function generateTemporaryPassword() {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%+?';
  const alphabet = lower + upper + digits + symbols;
  const required = [
    lower[crypto.randomInt(lower.length)],
    upper[crypto.randomInt(upper.length)],
    digits[crypto.randomInt(digits.length)],
    symbols[crypto.randomInt(symbols.length)]
  ];

  while (required.length < 16) {
    required.push(alphabet[crypto.randomInt(alphabet.length)]);
  }

  for (let index = required.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [required[index], required[swapIndex]] = [required[swapIndex], required[index]];
  }

  return required.join('');
}

function getArg(name) {
  const prefix = `${name}=`;
  const arg = process.argv.slice(2).find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

async function main() {
  const username = getArg('--username') || process.argv[2] || 'admin';
  const password = getArg('--password') || generateTemporaryPassword();
  const databasePath = getArg('--database') || getDatabasePath();

  if (!passwordUtils.validatePasswordStrength(password)) {
    throw new Error('Password must be at least 12 characters and include upper, lower, number, and symbol.');
  }

  if (!fs.existsSync(databasePath)) {
    throw new Error(`Database not found: ${databasePath}`);
  }

  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: databasePath },
    useNullAsDefault: true
  });

  try {
    const user = await db('users')
      .select('id', 'username', 'full_name')
      .where('username', username)
      .first();

    if (!user) {
      throw new Error(`User not found: ${username}`);
    }

    const columnInfo = await db('users').columnInfo();
    const update = {
      password_hash: await passwordUtils.hashPassword(password)
    };

    if (columnInfo.password_must_change) {
      update.password_must_change = true;
    }
    if (columnInfo.updated_at) {
      update.updated_at = db.fn.now();
    }

    await db('users').where('id', user.id).update(update);

    if (await db.schema.hasTable('audit_logs')) {
      await db('audit_logs').insert({
        user_id: user.id,
        action: 'password_recovery_reset',
        entity_type: 'users',
        entity_id: user.id,
        new_values: JSON.stringify({ username: user.username, password_must_change: true })
      });
    }

    console.log('Password reset complete.');
    console.log(`User: ${user.username} (${user.full_name || 'No name'})`);
    console.log(`Temporary password: ${password}`);
    console.log('Sign in with the temporary password, then set a new password when prompted.');
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(`Password reset failed: ${error.message}`);
  process.exitCode = 1;
});
