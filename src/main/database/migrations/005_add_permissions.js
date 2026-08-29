/**
 * 005 Add Permissions
 * Applies and rolls back migration 005 for add permissions.
 */

const MIGRATION_ID = '005_add_permissions';

async function up(db) {
  if (!await db.schema.hasColumn('users', 'status')) {
    await db.schema.alterTable('users', (table) => {
      table.string('status', 20).notNullable().defaultTo('active');
    });
  }
  if (!await db.schema.hasColumn('users', 'permissions')) {
    await db.schema.alterTable('users', (table) => {
      table.text('permissions');
    });
  }
  if (!await db.schema.hasTable('role_permissions')) {
    await db.schema.createTable('role_permissions', (table) => {
      table.string('role', 50).primary();
      table.text('permissions').notNullable().defaultTo('[]');
      table.datetime('updated_at').notNullable().defaultTo(db.fn.now());
    });
  }
  if (!await db.schema.hasTable('user_activity')) {
    await db.schema.createTable('user_activity', (table) => {
      table.increments('id').primary();
      table.integer('user_id').references('id').inTable('users').onDelete('SET NULL');
      table.string('username', 50);
      table.string('action', 80).notNullable();
      table.text('details');
      table.datetime('created_at').notNullable().defaultTo(db.fn.now());
    });
  }
}

async function down(db) {
  await db.schema.dropTableIfExists('user_activity');
  await db.schema.dropTableIfExists('role_permissions');
}

module.exports = { id: MIGRATION_ID, up, down };
