/**
 * 007 Trusted Sale Calculation
 * Applies and rolls back migration 007 for trusted sale calculation.
 */

const MIGRATION_ID = '007_trusted_sale_calculation';

const SALES_CALCULATION_COLUMNS = Object.freeze([
  {
    name: 'discount_rate',
    add(table) {
      table.decimal('discount_rate', 7, 6).notNullable().defaultTo(0);
    }
  },
  {
    name: 'tax_rate',
    add(table) {
      table.decimal('tax_rate', 7, 4).notNullable().defaultTo(0);
    }
  },
  {
    name: 'tax_inclusive',
    add(table) {
      table.boolean('tax_inclusive').notNullable().defaultTo(false);
    }
  },
  {
    name: 'tax_exempt',
    add(table) {
      table.boolean('tax_exempt').notNullable().defaultTo(false);
    }
  }
]);

async function up(db) {
  const hasSales = await db.schema.hasTable('sales');
  if (!hasSales) {
    throw new Error(`${MIGRATION_ID} cannot run because the sales table is missing`);
  }

  for (const column of SALES_CALCULATION_COLUMNS) {
    if (await db.schema.hasColumn('sales', column.name)) continue;

    await db.schema.alterTable('sales', (table) => {
      column.add(table);
    });
  }
}

async function down(db) {
  const hasSales = await db.schema.hasTable('sales');
  if (!hasSales) return;

  for (const column of [...SALES_CALCULATION_COLUMNS].reverse()) {
    if (!await db.schema.hasColumn('sales', column.name)) continue;

    await db.schema.alterTable('sales', (table) => {
      table.dropColumn(column.name);
    });
  }
}

module.exports = {
  id: MIGRATION_ID,
  up,
  down
};
