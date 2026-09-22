/**
 * Customer Persistence
 * Normalizes customer data and performs compatibility-aware customer writes.
 */

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function nullable(value) {
  return value === undefined || value === null || value === '' ? null : value;
}

function getCustomerType(customer, fallback) {
  return firstDefined(
    customer.customerType,
    customer.customer_type,
    customer.type,
    fallback
  );
}

function getCreditLimit(customer, fallback) {
  return firstDefined(customer.creditLimit, customer.credit_limit, fallback);
}

async function createCustomerRecord(db, customer) {
  const customerCode = customer.customerCode
    || customer.customer_code
    || `CUST-${Date.now().toString().slice(-6)}`;

  const [id] = await db('customers').insert({
    customer_code: customerCode,
    name: customer.name,
    email: nullable(customer.email),
    phone: nullable(customer.phone),
    address: nullable(customer.address),
    city: nullable(customer.city),
    customer_type: firstDefined(getCustomerType(customer), 'Individual'),
    credit_limit: firstDefined(getCreditLimit(customer), 0),
    status: firstDefined(customer.status, 'Active'),
    created_by: firstDefined(customer.userId, customer.created_by, null),
    created_at: db.fn.now(),
    updated_at: db.fn.now()
  });

  return { id, customerCode };
}

async function updateCustomerRecord(db, id, customer) {
  const existing = await db('customers').where('id', id).first();
  if (!existing) {
    return false;
  }

  await db('customers')
    .where('id', id)
    .update({
      name: firstDefined(customer.name, existing.name),
      email: nullable(firstDefined(customer.email, existing.email)),
      phone: nullable(firstDefined(customer.phone, existing.phone)),
      address: nullable(firstDefined(customer.address, existing.address)),
      city: nullable(firstDefined(customer.city, existing.city)),
      customer_type: firstDefined(
        getCustomerType(customer),
        existing.customer_type,
        'Individual'
      ),
      credit_limit: firstDefined(
        getCreditLimit(customer),
        existing.credit_limit,
        0
      ),
      status: firstDefined(customer.status, existing.status, 'Active'),
      updated_at: db.fn.now()
    });

  return true;
}

module.exports = {
  createCustomerRecord,
  updateCustomerRecord
};
