/**
 * 011 Invoice Manager Approval
 * Adds invoice approval metadata used by manager credential approval.
 */

'use strict';

const MIGRATION_ID = '011_invoice_manager_approval';

async function addColumnIfMissing(db, tableName, columnName, add) {
  if (!await db.schema.hasColumn(tableName, columnName)) {
    await db.schema.alterTable(tableName, (table) => add(table));
  }
}

async function up(db) {
  await addColumnIfMissing(db, 'invoices', 'approval_status', (table) => {
    table.string('approval_status', 20).notNullable().defaultTo('draft');
  });
  await addColumnIfMissing(db, 'invoices', 'submitted_by', (table) => {
    table.integer('submitted_by');
  });
  await addColumnIfMissing(db, 'invoices', 'submitted_at', (table) => {
    table.datetime('submitted_at');
  });
  await addColumnIfMissing(db, 'invoices', 'approved_by', (table) => {
    table.integer('approved_by');
  });
  await addColumnIfMissing(db, 'invoices', 'approved_at', (table) => {
    table.datetime('approved_at');
  });
  await addColumnIfMissing(db, 'invoices', 'approved_name', (table) => {
    table.string('approved_name', 200);
  });
  await addColumnIfMissing(db, 'invoices', 'approved_signature', (table) => {
    table.text('approved_signature');
  });
  await addColumnIfMissing(db, 'invoices', 'approval_note', (table) => {
    table.text('approval_note');
  });

  const missingApprovalStatus = await db('invoices')
    .whereNull('approval_status')
    .count('* as count')
    .first();

  if (Number(missingApprovalStatus?.count || 0) > 0) {
    await db('invoices').whereNull('approval_status').update({ approval_status: 'draft' });
  }
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
    if (await db.schema.hasColumn('invoices', column)) {
      await db.schema.alterTable('invoices', (table) => {
        table.dropColumn(column);
      });
    }
  }
}

module.exports = { id: MIGRATION_ID, up, down };
