/**
 * 009 Integrity Foundation
 * Applies and rolls back migration 009 for integrity foundation.
 */

const crypto = require('crypto');
const {
  ROLE_PERMISSIONS,
  normalizePermissions
} = require('../../../shared/constants/roles');

const MIGRATION_ID = '009_integrity_foundation';

function isKnownDefaultPassword(user) {
  const [salt, encodedHash] = String(user.password_hash || '').split(':');
  if (!salt || !encodedHash) return false;
  const retiredPassword = ['admin', '123'].join('');
  const actual = crypto.pbkdf2Sync(retiredPassword, salt, 10000, 64, 'sha512');
  const expected = Buffer.from(encodedHash, 'hex');
  // Constant-time comparison avoids exposing which hash bytes matched.
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function addColumnIfMissing(db, tableName, columnName, add) {
  if (!await db.schema.hasColumn(tableName, columnName)) {
    await db.schema.alterTable(tableName, (table) => add(table));
  }
}

async function createIndex(db, name, sql) {
  const row = await db('sqlite_master')
    .select('name')
    .where({ type: 'index', name })
    .first();
  if (!row) await db.raw(sql);
}

async function up(db) {
  await addColumnIfMissing(db, 'users', 'email', (table) => table.string('email', 200));
  await addColumnIfMissing(db, 'users', 'full_name', (table) => table.string('full_name', 200));
  await addColumnIfMissing(db, 'users', 'role', (table) => {
    table.string('role', 50).notNullable().defaultTo('viewer');
  });
  await addColumnIfMissing(db, 'users', 'is_active', (table) => {
    table.boolean('is_active').notNullable().defaultTo(true);
  });
  await addColumnIfMissing(db, 'users', 'last_login', (table) => table.datetime('last_login'));
  await addColumnIfMissing(db, 'users', 'created_at', (table) => {
    table.datetime('created_at');
  });
  await addColumnIfMissing(db, 'users', 'updated_at', (table) => {
    table.datetime('updated_at');
  });
  await addColumnIfMissing(db, 'sales', 'customer_id', (table) => table.integer('customer_id'));
  await addColumnIfMissing(db, 'sales', 'subtotal', (table) => table.decimal('subtotal', 12, 2).notNullable().defaultTo(0));
  await addColumnIfMissing(db, 'sales', 'tax_amount', (table) => table.decimal('tax_amount', 12, 2).notNullable().defaultTo(0));
  await addColumnIfMissing(db, 'sales', 'total_amount', (table) => table.decimal('total_amount', 12, 2).notNullable().defaultTo(0));
  await addColumnIfMissing(db, 'sales', 'status', (table) => table.string('status', 20).notNullable().defaultTo('completed'));
  await addColumnIfMissing(db, 'sales', 'notes', (table) => table.text('notes'));
  await addColumnIfMissing(db, 'sales', 'created_by', (table) => table.integer('created_by'));
  await addColumnIfMissing(db, 'sales', 'created_at', (table) => table.datetime('created_at'));
  await addColumnIfMissing(db, 'users', 'password_must_change', (table) => {
    table.boolean('password_must_change').notNullable().defaultTo(false);
  });
  await addColumnIfMissing(db, 'invoices', 'stock_adjusted', (table) => {
    table.boolean('stock_adjusted').notNullable().defaultTo(false);
  });
  await db('users').whereNull('created_at').update({ created_at: db.fn.now() });
  await db('users').whereNull('updated_at').update({ updated_at: db.fn.now() });
  await db('sales').whereNull('created_at').update({ created_at: db.fn.now() });

  const adminUsers = await db('users').whereRaw('LOWER(username) = ?', ['admin']);
  // Existing installations keep working but must replace the retired bootstrap password.
  for (const admin of adminUsers) {
    if (isKnownDefaultPassword(admin)) {
      await db('users').where('id', admin.id).update({ password_must_change: true });
    }
  }

  // Upsert canonical role grants without deleting installation-specific roles.
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    await db('role_permissions')
      .insert({
        role,
        permissions: JSON.stringify(normalizePermissions(permissions)),
        updated_at: db.fn.now()
      })
      .onConflict('role')
      .merge(['permissions', 'updated_at']);
  }

  const userRows = await db('users').select('id', 'permissions');
  for (const user of userRows) {
    let permissions = [];
    try {
      permissions = JSON.parse(user.permissions || '[]');
    } catch {
      permissions = [];
    }
    await db('users').where('id', user.id).update({
      permissions: JSON.stringify(normalizePermissions(permissions))
    });
  }

  const settings = {
    company_name: 'My Business',
    currency: 'MWK',
    currency_symbol: 'K',
    date_format: 'DD/MM/YYYY',
    time_format: '24-hour',
    timezone: 'Africa/Blantyre',
    default_tax_rate: '17.5',
    tax_name: 'VAT',
    receipt_header: 'Thank you for your business!',
    receipt_footer: 'Please come again',
    allow_negative_stock: 'false'
  };
  const rows = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    updated_at: db.fn.now()
  }));
  // Defaults fill missing keys and never overwrite an operator's existing settings.
  await db('settings').insert(rows).onConflict('key').ignore();

  if (!await db.schema.hasTable('document_sequences')) {
    await db.schema.createTable('document_sequences', (table) => {
      table.string('document_type', 50).primary();
      table.integer('last_number').notNullable().defaultTo(0);
      table.datetime('updated_at').notNullable().defaultTo(db.fn.now());
    });
  }

  await createIndex(db, 'idx_audit_logs_created_at',
    'CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)');
  await createIndex(db, 'idx_audit_logs_actor',
    'CREATE INDEX idx_audit_logs_actor ON audit_logs(user_id, created_at)');
  await createIndex(db, 'idx_stock_transactions_product_date',
    'CREATE INDEX idx_stock_transactions_product_date ON stock_transactions(product_id, created_at)');
  await createIndex(db, 'idx_sale_items_sale',
    'CREATE INDEX idx_sale_items_sale ON sale_items(sale_id)');
  await createIndex(db, 'idx_sales_date',
    'CREATE INDEX idx_sales_date ON sales(created_at)');
  await createIndex(db, 'idx_invoice_items_invoice',
    'CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id)');
  await createIndex(db, 'idx_quotation_items_quotation',
    'CREATE INDEX idx_quotation_items_quotation ON quotation_items(quotation_id)');
}

async function down(db) {
  await db.schema.dropTableIfExists('document_sequences');
}

module.exports = { id: MIGRATION_ID, up, down };
