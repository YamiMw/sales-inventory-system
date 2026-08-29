/**
 * Integrity Foundation Test
 * Verifies integrity foundation behavior and regression boundaries.
 */

'use strict';

const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const knex = require('knex');
const { migrations, runPendingMigrations } = require('../../src/main/database/migrations');
const { createTestDatabase } = require('../fixtures/database');

test('all migration files are registered', () => {
  const migrationsDirectory = path.resolve(__dirname, '../../src/main/database/migrations');
  const migrationFiles = fs.readdirSync(migrationsDirectory)
    .filter(file => /^\d+_.*\.js$/.test(file))
    .sort()
    .map(file => path.basename(file, '.js'));

  assert.deepEqual(migrations.map(item => item.id), migrationFiles);
});

test('fresh migration creates a versioned schema without a default administrator', async t => {
  const fixture = await createTestDatabase('integrity-foundation-');
  t.after(() => fixture.close());

  const userCount = await fixture.db('users').count('* as count').first();
  assert.equal(Number(userCount.count), 0);
  const applied = await fixture.db('_app_migrations').select('id');
  assert.equal(applied.length, migrations.length);
  assert.deepEqual(await runPendingMigrations(fixture.db), []);

  const settings = await fixture.db('settings').whereIn('key', [
    'currency',
    'date_format',
    'time_format',
    'timezone',
    'tax_name'
  ]);
  assert.equal(settings.length, 5);
});

test('legacy upgrade runs ordered migrations and forces the retired credential to change', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'integrity-upgrade-'));
  const db = knex({
    client: 'better-sqlite3',
    connection: { filename: path.join(directory, 'legacy.db') },
    useNullAsDefault: true
  });
  t.after(async () => {
    await db.destroy();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  await db.schema.createTable('users', table => {
    table.increments('id').primary();
    table.string('username').notNullable().unique();
    table.string('password_hash').notNullable();
  });
  const salt = crypto.randomBytes(16).toString('hex');
  const retiredPassword = ['admin', '123'].join('');
  const hash = crypto.pbkdf2Sync(retiredPassword, salt, 10000, 64, 'sha512').toString('hex');
  await db('users').insert({
    username: 'admin',
    password_hash: `${salt}:${hash}`
  });

  assert.deepEqual(await runPendingMigrations(db), migrations.map(item => item.id));
  const admin = await db('users').where('username', 'admin').first();
  assert.equal(Number(admin.password_must_change), 1);
  assert.equal(admin.status, 'active');
  assert.equal(Number(admin.is_active), 1);
  assert.deepEqual(await runPendingMigrations(db), []);
});
