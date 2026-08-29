/**
 * 001 Initial Schema
 * Applies and rolls back migration 001 for initial schema.
 */

const MIGRATION_ID = '001_initial_schema';

async function createTableIfMissing(knex, tableName, defineTable) {
  if (!await knex.schema.hasTable(tableName)) {
    await knex.schema.createTable(tableName, defineTable);
  }
}

async function createIndexIfColumnsExist(knex, tableName, columns, indexName) {
  if (!await knex.schema.hasTable(tableName)) return;
  const columnInfo = await knex(tableName).columnInfo();
  if (columns.every(column => columnInfo[column])) {
    await knex.schema.raw(
      `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columns.join(', ')})`
    );
  }
}

async function up(knex) {
  // Users table
  await createTableIfMissing(knex, 'users', (table) => {
    table.increments('id').primary();
    table.string('username', 50).notNullable().unique();
    table.string('email', 200).unique();
    table.string('password_hash', 255).notNullable();
    table.string('full_name', 200).notNullable();
    table.string('role', 50).defaultTo('viewer');
    table.boolean('is_active').defaultTo(true);
    table.text('permissions');
    table.datetime('last_login');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.integer('created_by').references('id').inTable('users');
  });

  // Sessions table
  await createTableIfMissing(knex, 'sessions', (table) => {
    table.string('token', 64).primary();
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('data');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('last_accessed').defaultTo(knex.fn.now());
    table.datetime('expires_at').notNullable();
  });

  // Categories table
  await createTableIfMissing(knex, 'categories', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique();
    table.text('description');
    table.string('color', 20);
    table.boolean('is_active').defaultTo(true);
    table.datetime('created_at').defaultTo(knex.fn.now());
  });

  // Products table
  await createTableIfMissing(knex, 'products', (table) => {
    table.increments('id').primary();
    table.string('sku', 50).notNullable().unique();
    table.string('name', 200).notNullable();
    table.text('description');
    table.integer('category_id').references('id').inTable('categories').onDelete('SET NULL');
    table.decimal('unit_price', 10, 2).notNullable();
    table.decimal('cost_price', 10, 2);
    table.integer('reorder_level').defaultTo(10);
    table.integer('reorder_quantity').defaultTo(50);
    table.string('barcode', 100).unique();
    table.string('unit', 20).defaultTo('piece');
    table.decimal('tax_rate', 5, 2).defaultTo(10.00);
    table.string('image_path', 500);
    table.boolean('is_active').defaultTo(true);
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.integer('created_by').references('id').inTable('users');
  });

  // Inventory table
  await createTableIfMissing(knex, 'inventory', (table) => {
    table.increments('id').primary();
    table.integer('product_id').notNullable().references('id').inTable('products').onDelete('CASCADE');
    table.integer('quantity_on_hand').defaultTo(0);
    table.integer('quantity_reserved').defaultTo(0);
    table.string('location_code', 50);
    table.datetime('last_counted_at');
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.unique(['product_id']);
  });

  // Stock transactions table
  await createTableIfMissing(knex, 'stock_transactions', (table) => {
    table.increments('id').primary();
    table.integer('product_id').notNullable().references('id').inTable('products');
    table.string('transaction_type', 50).notNullable();
    table.integer('quantity').notNullable();
    table.integer('quantity_before');
    table.integer('quantity_after');
    table.string('reference_type', 50);
    table.integer('reference_id');
    table.text('notes');
    table.integer('created_by').references('id').inTable('users');
    table.datetime('created_at').defaultTo(knex.fn.now());
  });

  // Customers table
  await createTableIfMissing(knex, 'customers', (table) => {
    table.increments('id').primary();
    table.string('customer_code', 50).unique();
    table.string('name', 200).notNullable();
    table.string('email', 200);
    table.string('phone', 50);
    table.string('mobile', 50);
    table.text('address');
    table.string('city', 100);
    table.string('state', 100);
    table.string('postal_code', 20);
    table.string('country', 100).defaultTo('USA');
    table.decimal('credit_limit', 10, 2).defaultTo(0);
    table.decimal('current_balance', 10, 2).defaultTo(0);
    table.string('customer_type', 20).defaultTo('individual');
    table.string('status', 20).defaultTo('active');
    table.text('notes');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    table.integer('created_by').references('id').inTable('users');
  });

  // Sales table
  await createTableIfMissing(knex, 'sales', (table) => {
    table.increments('id').primary();
    table.string('invoice_number', 50).notNullable().unique();
    table.integer('customer_id').references('id').inTable('customers');
    table.decimal('subtotal', 10, 2).notNullable();
    table.decimal('tax_amount', 10, 2).defaultTo(0);
    table.decimal('discount_amount', 10, 2).defaultTo(0);
    table.decimal('total_amount', 10, 2).notNullable();
    table.string('payment_method', 50);
    table.string('payment_status', 20).defaultTo('completed');
    table.text('notes');
    table.integer('created_by').references('id').inTable('users');
    table.datetime('created_at').defaultTo(knex.fn.now());
  });

  // Sale items table
  await createTableIfMissing(knex, 'sale_items', (table) => {
    table.increments('id').primary();
    table.integer('sale_id').notNullable().references('id').inTable('sales').onDelete('CASCADE');
    table.integer('product_id').notNullable().references('id').inTable('products');
    table.integer('quantity').notNullable();
    table.decimal('unit_price', 10, 2).notNullable();
    table.decimal('unit_cost', 10, 2);
    table.decimal('discount_percent', 5, 2).defaultTo(0);
    table.decimal('total_price', 10, 2).notNullable();
  });

  // Quotations table
  await createTableIfMissing(knex, 'quotations', (table) => {
    table.increments('id').primary();
    table.string('quote_number', 50).notNullable().unique();
    table.integer('customer_id').references('id').inTable('customers');
    table.date('quote_date').defaultTo(knex.fn.now());
    table.date('expiry_date').notNullable();
    table.decimal('subtotal', 10, 2).notNullable();
    table.decimal('discount_amount', 10, 2).defaultTo(0);
    table.decimal('tax_amount', 10, 2).notNullable();
    table.decimal('total_amount', 10, 2).notNullable();
    table.string('status', 20).defaultTo('draft');
    table.string('approval_status', 20).notNullable().defaultTo('draft');
    table.integer('submitted_by');
    table.datetime('submitted_at');
    table.integer('approved_by');
    table.datetime('approved_at');
    table.string('approved_name', 200);
    table.text('approved_signature');
    table.text('approval_note');
    table.text('notes');
    table.text('terms');
    table.integer('created_by').references('id').inTable('users');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
  });

  // Quotation items table
  await createTableIfMissing(knex, 'quotation_items', (table) => {
    table.increments('id').primary();
    table.integer('quotation_id').notNullable().references('id').inTable('quotations').onDelete('CASCADE');
    table.integer('product_id').notNullable().references('id').inTable('products');
    table.integer('quantity').notNullable();
    table.decimal('unit_price', 10, 2).notNullable();
    table.decimal('discount_percent', 5, 2).defaultTo(0);
    table.decimal('total_price', 10, 2).notNullable();
    table.boolean('is_backorder').defaultTo(false);
  });

  // Invoices table
  await createTableIfMissing(knex, 'invoices', (table) => {
    table.increments('id').primary();
    table.string('invoice_number', 50).notNullable().unique();
    table.integer('quotation_id').references('id').inTable('quotations');
    table.integer('customer_id').references('id').inTable('customers');
    table.date('invoice_date').defaultTo(knex.fn.now());
    table.date('due_date').notNullable();
    table.decimal('subtotal', 10, 2).notNullable();
    table.decimal('discount_amount', 10, 2).defaultTo(0);
    table.decimal('tax_amount', 10, 2).notNullable();
    table.decimal('total_amount', 10, 2).notNullable();
    table.decimal('amount_paid', 10, 2).defaultTo(0);
    table.string('status', 20).defaultTo('draft');
    table.string('approval_status', 20).notNullable().defaultTo('draft');
    table.integer('submitted_by');
    table.datetime('submitted_at');
    table.integer('approved_by');
    table.datetime('approved_at');
    table.string('approved_name', 200);
    table.text('approved_signature');
    table.text('approval_note');
    table.text('notes');
    table.integer('created_by').references('id').inTable('users');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
  });

  // Invoice items table
  await createTableIfMissing(knex, 'invoice_items', (table) => {
    table.increments('id').primary();
    table.integer('invoice_id').notNullable().references('id').inTable('invoices').onDelete('CASCADE');
    table.integer('product_id').notNullable().references('id').inTable('products');
    table.integer('quantity').notNullable();
    table.decimal('unit_price', 10, 2).notNullable();
    table.decimal('discount_percent', 5, 2).defaultTo(0);
    table.decimal('total_price', 10, 2).notNullable();
  });

  // Payments table
  await createTableIfMissing(knex, 'payments', (table) => {
    table.increments('id').primary();
    table.integer('invoice_id').notNullable().references('id').inTable('invoices').onDelete('CASCADE');
    table.decimal('amount', 10, 2).notNullable();
    table.string('payment_method', 50);
    table.string('reference', 100);
    table.text('notes');
    table.integer('created_by').references('id').inTable('users');
    table.datetime('created_at').defaultTo(knex.fn.now());
  });

  // Backorders table
  await createTableIfMissing(knex, 'backorders', (table) => {
    table.increments('id').primary();
    table.string('backorder_number', 50).notNullable().unique();
    table.integer('product_id').notNullable().references('id').inTable('products');
    table.integer('quantity').notNullable();
    table.integer('quotation_id').references('id').inTable('quotations');
    table.integer('invoice_id').references('id').inTable('invoices');
    table.string('status', 20).defaultTo('pending');
    table.date('expected_date');
    table.datetime('fulfilled_at');
    table.text('notes');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
  });

  // Audit logs table
  await createTableIfMissing(knex, 'audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').references('id').inTable('users');
    table.string('action', 50).notNullable();
    table.string('entity_type', 50).notNullable();
    table.integer('entity_id');
    table.text('old_values');
    table.text('new_values');
    table.string('ip_address', 50);
    table.datetime('created_at').defaultTo(knex.fn.now());
  });

  // Settings table
  await createTableIfMissing(knex, 'settings', (table) => {
    table.string('key', 100).primary();
    table.text('value');
    table.datetime('updated_at').defaultTo(knex.fn.now());
  });

  // Create indexes
  await createIndexIfColumnsExist(knex, 'products', ['sku'], 'idx_products_sku');
  await createIndexIfColumnsExist(knex, 'products', ['barcode'], 'idx_products_barcode');
  await createIndexIfColumnsExist(knex, 'products', ['name'], 'idx_products_name');
  await createIndexIfColumnsExist(knex, 'inventory', ['product_id'], 'idx_inventory_product');
  await createIndexIfColumnsExist(knex, 'sales', ['created_at'], 'idx_sales_date');
  await createIndexIfColumnsExist(knex, 'quotations', ['status'], 'idx_quotations_status');
  await createIndexIfColumnsExist(knex, 'invoices', ['status'], 'idx_invoices_status');
  await createIndexIfColumnsExist(knex, 'customers', ['name'], 'idx_customers_name');
  await createIndexIfColumnsExist(knex, 'customers', ['phone'], 'idx_customers_phone');
}

async function down(knex) {
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('backorders');
  await knex.schema.dropTableIfExists('payments');
  await knex.schema.dropTableIfExists('invoice_items');
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('quotation_items');
  await knex.schema.dropTableIfExists('quotations');
  await knex.schema.dropTableIfExists('sale_items');
  await knex.schema.dropTableIfExists('sales');
  await knex.schema.dropTableIfExists('stock_transactions');
  await knex.schema.dropTableIfExists('inventory');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('categories');
  await knex.schema.dropTableIfExists('customers');
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('users');
}

module.exports = {
  id: MIGRATION_ID,
  up,
  down
};
