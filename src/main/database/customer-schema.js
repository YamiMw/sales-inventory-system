/**
 * Customer Schema
 * Inspects and repairs customer table columns across supported database versions.
 */

const CUSTOMER_ENTITY_COLUMNS = Object.freeze([
  'id',
  'customer_code',
  'name',
  'email',
  'phone',
  'address',
  'city',
  'credit_limit',
  'current_balance',
  'customer_type',
  'status',
  'created_by',
  'created_at',
  'updated_at'
]);

async function verifyCustomerSchema(db) {
  const hasCustomers = await db.schema.hasTable('customers');
  if (!hasCustomers) {
    throw new Error('Customer schema verification failed: customers table is missing');
  }

  const columnInfo = await db('customers').columnInfo();
  const columns = Object.keys(columnInfo);
  const missingColumns = CUSTOMER_ENTITY_COLUMNS.filter(
    (column) => !Object.prototype.hasOwnProperty.call(columnInfo, column)
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `Customer schema verification failed: missing columns ${missingColumns.join(', ')}`
    );
  }

  return {
    columns,
    expectedColumns: [...CUSTOMER_ENTITY_COLUMNS],
    missingColumns
  };
}

module.exports = {
  CUSTOMER_ENTITY_COLUMNS,
  verifyCustomerSchema
};
