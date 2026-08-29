/**
 * Development
 * Populates the database with development seed data.
 */

const { ROLES } = require('../../../shared/constants/roles');
const crypto = require('crypto');
const passwordUtils = require('../../auth/password-utils');

exports.seed = async function(knex) {
  const oneTimePassword = process.env.DEV_ADMIN_PASSWORD
    || crypto.randomBytes(18).toString('base64url');
  const adminPassword = await passwordUtils.hashPassword(oneTimePassword);
  const [adminId] = await knex('users').insert({
    username: 'admin',
    email: 'admin@example.com',
    password_hash: adminPassword,
    full_name: 'System Administrator',
    role: ROLES.ADMIN,
    status: 'active',
    is_active: true,
    password_must_change: true,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now()
  }).returning('id');

  // Insert default categories
  const categories = [
    { name: 'Electronics', description: 'Electronic devices and accessories' },
    { name: 'Clothing', description: 'Apparel and fashion items' },
    { name: 'Food & Beverages', description: 'Consumable products' },
    { name: 'Books', description: 'Books and publications' },
    { name: 'Office Supplies', description: 'Office and stationery items' },
    { name: 'Other', description: 'Miscellaneous products' }
  ];
  await knex('categories').insert(categories);

  // Get category IDs
  const [electronics] = await knex('categories').where('name', 'Electronics');
  const [office] = await knex('categories').where('name', 'Office Supplies');

  // Insert sample products
  const products = [
    {
      sku: 'WID-001',
      name: 'Premium Widget A',
      description: 'High-quality widget for professional use',
      category_id: electronics.id,
      unit_price: 49.99,
      cost_price: 30.00,
      reorder_level: 20,
      reorder_quantity: 100,
      barcode: '8901234567890',
      created_by: adminId
    },
    {
      sku: 'WID-002',
      name: 'Standard Widget B',
      description: 'Reliable widget for everyday use',
      category_id: electronics.id,
      unit_price: 29.99,
      cost_price: 18.00,
      reorder_level: 15,
      reorder_quantity: 80,
      barcode: '8901234567891',
      created_by: adminId
    },
    {
      sku: 'WID-003',
      name: 'Widget C Pro',
      description: 'Professional grade widget with extended warranty',
      category_id: electronics.id,
      unit_price: 89.99,
      cost_price: 55.00,
      reorder_level: 10,
      reorder_quantity: 50,
      barcode: '8901234567892',
      created_by: adminId
    },
    {
      sku: 'OFF-001',
      name: 'Premium Notebook',
      description: 'A4 size notebook, 200 pages',
      category_id: office.id,
      unit_price: 5.99,
      cost_price: 3.50,
      reorder_level: 30,
      reorder_quantity: 200,
      barcode: '8901234567893',
      created_by: adminId
    }
  ];

  for (const product of products) {
    const [productId] = await knex('products').insert({
      ...product,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }).returning('id');

    // Add inventory for each product
    await knex('inventory').insert({
      product_id: productId,
      quantity_on_hand: Math.floor(Math.random() * 50) + 10,
      quantity_reserved: 0,
      updated_at: knex.fn.now()
    });
  }

  // Insert sample customers
  const customers = [
    {
      customer_code: 'CUST-001',
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '555-0123',
      address: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      postal_code: '62701',
      created_by: adminId
    },
    {
      customer_code: 'CUST-002',
      name: 'ABC Corporation',
      email: 'contact@abccorp.com',
      phone: '555-0456',
      address: '456 Business Ave',
      city: 'Chicago',
      state: 'IL',
      postal_code: '60601',
      customer_type: 'business',
      credit_limit: 5000.00,
      created_by: adminId
    }
  ];

  await knex('customers').insert(customers);

  // Insert default settings
  const settings = [
    { key: 'company_name', value: 'My Business' },
    { key: 'company_address', value: '123 Business St, City, State 12345' },
    { key: 'company_phone', value: '(555) 123-4567' },
    { key: 'company_email', value: 'info@mybusiness.com' },
    { key: 'default_tax_rate', value: '10.00' },
    { key: 'currency_symbol', value: 'K' },
    { key: 'receipt_header', value: 'Thank you for your business!' },
    { key: 'receipt_footer', value: 'Please come again' },
    { key: 'quotation_validity_days', value: '30' },
    { key: 'invoice_due_days', value: '30' }
  ];

  await knex('settings').insert(settings).onConflict('key').ignore();

  console.log('Seed data inserted successfully');
};
