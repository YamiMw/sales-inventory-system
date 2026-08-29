/**
 * 002 Add Audit Logs
 * Applies and rolls back migration 002 for add audit logs.
 */

const MIGRATION_ID = '002_add_audit_logs';

async function up(db) {
  if (await db.schema.hasTable('audit_logs')) return;
  await db.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('action', 100).notNullable();
    table.string('entity_type', 80).notNullable();
    table.integer('entity_id');
    table.text('old_values');
    table.text('new_values');
    table.string('ip_address', 50);
    table.datetime('created_at').notNullable().defaultTo(db.fn.now());
  });
}

async function down(db) {
  await db.schema.dropTableIfExists('audit_logs');
}

module.exports = { id: MIGRATION_ID, up, down };
