/**
 * 012 Quotation Manager Approval
 * Adds quotation approval metadata used by manager credential approval.
 */

'use strict';

const MIGRATION_ID = '012_quotation_manager_approval';

async function addColumnIfMissing(db, tableName, columnName, add) {
  if (!await db.schema.hasColumn(tableName, columnName)) {
    await db.schema.alterTable(tableName, (table) => add(table));
  }
}

async function up(db) {
  await addColumnIfMissing(db, 'quotations', 'approval_status', (table) => {
    table.string('approval_status', 20).notNullable().defaultTo('draft');
  });
  await addColumnIfMissing(db, 'quotations', 'submitted_by', (table) => {
    table.integer('submitted_by');
  });
  await addColumnIfMissing(db, 'quotations', 'submitted_at', (table) => {
    table.datetime('submitted_at');
  });
  await addColumnIfMissing(db, 'quotations', 'approved_by', (table) => {
    table.integer('approved_by');
  });
  await addColumnIfMissing(db, 'quotations', 'approved_at', (table) => {
    table.datetime('approved_at');
  });
  await addColumnIfMissing(db, 'quotations', 'approved_name', (table) => {
    table.string('approved_name', 200);
  });
  await addColumnIfMissing(db, 'quotations', 'approved_signature', (table) => {
    table.text('approved_signature');
  });
  await addColumnIfMissing(db, 'quotations', 'approval_note', (table) => {
    table.text('approval_note');
  });

  await db('quotations').whereNull('approval_status').update({ approval_status: 'draft' });
}

async function down(db) {
  const columns = [
    'approval_note',
    'approved_signature',
    'approved_name',
    'approved_at',
    'approved_by',
    'submitted_at',
    'submitted_by',
    'approval_status'
  ];

  for (const column of columns) {
    if (await db.schema.hasColumn('quotations', column)) {
      await db.schema.alterTable('quotations', (table) => {
        table.dropColumn(column);
      });
    }
  }
}

module.exports = { id: MIGRATION_ID, up, down };
