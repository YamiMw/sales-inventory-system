/**
 * Sale Repository
 * Provides database access for sale records.
 */

const { getDatabase } = require('../database/connection');

class SaleRepository {
  async create(saleData) {
    const db = getDatabase();
    
    return await db.transaction(async (trx) => {
      const productIds = [...new Set(saleData.items.map(item => item.productId))];
      const products = await trx('products')
        .select('id', 'cost_price')
        .whereIn('id', productIds);
      const costByProductId = new Map(products.map(product => {
        const cost = Number(product.cost_price);
        return [
          Number(product.id),
          Number.isFinite(cost) && cost > 0 ? cost : null
        ];
      }));
      const supportsCostSnapshots = await trx.schema.hasColumn('sale_items', 'unit_cost');

      const [saleId] = await trx('sales').insert({
        invoice_number: saleData.invoiceNumber,
        customer_id: saleData.customerId,
        subtotal: saleData.subtotal,
        tax_amount: saleData.taxAmount,
        discount_amount: saleData.discountAmount,
        total_amount: saleData.totalAmount,
        payment_method: saleData.paymentMethod,
        notes: saleData.notes,
        created_by: saleData.userId,
        created_at: db.fn.now()
      });

      for (const item of saleData.items) {
        const saleItem = {
          sale_id: saleId,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_percent: item.discountPercent || 0,
          total_price: item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100)
        };
        if (supportsCostSnapshots) {
          saleItem.unit_cost = costByProductId.get(Number(item.productId)) ?? null;
        }
        await trx('sale_items').insert(saleItem);
      }

      return { id: saleId };
    });
  }

  async findAll(filters = {}) {
    const db = getDatabase();
    let query = db('sales')
      .select(
        'sales.*',
        'customers.name as customer_name',
        'customers.address as customer_address',
        'users.full_name as user_full_name'
      )
      .leftJoin('customers', 'sales.customer_id', 'customers.id')
      .leftJoin('users', 'sales.created_by', 'users.id')
      .orderBy('sales.created_at', 'desc');

    if (filters.startDate) {
      query = query.where('sales.created_at', '>=', filters.startDate);
    }

    if (filters.endDate) {
      query = query.where('sales.created_at', '<=', filters.endDate);
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const sales = await query.limit(limit).offset(offset);

    for (const sale of sales) {
      sale.items = await db('sale_items')
        .select(
          'sale_items.*',
          'products.name as product_name',
          'products.sku',
          'categories.name as category_name'
        )
        .leftJoin('products', 'sale_items.product_id', 'products.id')
        .leftJoin('categories', 'products.category_id', 'categories.id')
        .where('sale_items.sale_id', sale.id);
      sale.item_count = sale.items.length;
    }

    return sales;
  }

  async findById(id) {
    const db = getDatabase();
    
    const sale = await db('sales')
      .select(
        'sales.*',
        'customers.name as customer_name',
        'customers.email as customer_email',
        'customers.phone as customer_phone',
        'customers.address as customer_address'
      )
      .leftJoin('customers', 'sales.customer_id', 'customers.id')
      .where('sales.id', id)
      .first();

    if (!sale) return null;

    sale.items = await db('sale_items')
      .select(
        'sale_items.*',
        'products.name as product_name',
        'products.sku'
      )
      .join('products', 'sale_items.product_id', 'products.id')
      .where('sale_id', id);

    return sale;
  }
}

module.exports = new SaleRepository();
