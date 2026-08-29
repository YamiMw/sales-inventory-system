/**
 * Dashboard Repository
 * Provides database access for dashboard records.
 */

const { getDatabase } = require('../database/connection');

function sqliteDateTime(value) {
  return value instanceof Date ? value.toISOString() : String(value || '');
}

class DashboardRepository {
  async getSalesStats(startDate, endDate) {
    const db = getDatabase();
    
    const result = await db('sales')
      .whereRaw('datetime(created_at) >= datetime(?)', [sqliteDateTime(startDate)])
      .whereRaw('datetime(created_at) < datetime(?)', [sqliteDateTime(endDate)])
      .select(
        db.raw('COALESCE(SUM(total_amount), 0) as total'),
        db.raw('COUNT(*) as count')
      )
      .first();

    return {
      total: result.total || 0,
      count: result.count || 0
    };
  }

  async getInventoryStats() {
    const db = getDatabase();
    
    const productCount = await db('products')
      .where('is_active', true)
      .count('* as count')
      .first();

    const lowStock = await db('inventory')
      .join('products', 'inventory.product_id', 'products.id')
      .where('products.is_active', true)
      .whereRaw('inventory.quantity_on_hand <= products.reorder_level')
      .where('inventory.quantity_on_hand', '>', 0)
      .count('* as count')
      .first();

    const outOfStock = await db('inventory')
      .join('products', 'inventory.product_id', 'products.id')
      .where('products.is_active', true)
      .where('inventory.quantity_on_hand', 0)
      .count('* as count')
      .first();

    const valueResult = await db('inventory')
      .join('products', 'inventory.product_id', 'products.id')
      .where('products.is_active', true)
      .select(
        db.raw('SUM(CASE WHEN products.cost_price > 0 THEN inventory.quantity_on_hand * products.cost_price END) as total_value'),
        db.raw('SUM(CASE WHEN inventory.quantity_on_hand > 0 AND (products.cost_price IS NULL OR products.cost_price <= 0) THEN 1 ELSE 0 END) as missing_cost_count')
      )
      .first();

    return {
      totalProducts: productCount.count,
      lowStock: lowStock.count,
      outOfStock: outOfStock.count,
      totalValue: Number(valueResult.missing_cost_count || 0) > 0
        ? null
        : Number(valueResult.total_value || 0),
      totalValueAvailable: Number(valueResult.missing_cost_count || 0) === 0
    };
  }

  async getCustomerStats() {
    const db = getDatabase();
    
    const total = await db('customers')
      .count('* as count')
      .first();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const newThisMonth = await db('customers')
      .whereRaw('datetime(created_at) >= datetime(?)', [sqliteDateTime(monthStart)])
      .count('* as count')
      .first();

    return {
      total: total.count,
      newThisMonth: newThisMonth.count
    };
  }

  async getSalesChartData(days) {
    const db = getDatabase();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const results = await db('sales')
      .select(
        db.raw("strftime('%Y-%m-%d', created_at) as date"),
        db.raw('COALESCE(SUM(total_amount), 0) as sales'),
        db.raw('COUNT(*) as transactions')
      )
      .where('created_at', '>=', startDate.toISOString())
      .groupBy('date')
      .orderBy('date');

    const dateMap = {};
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);
      dateMap[dateStr] = { date: dateStr, sales: 0 };
    }

    results.forEach(r => {
      dateMap[r.date] = {
        date: r.date,
        sales: r.sales || 0
      };
    });

    return Object.values(dateMap);
  }

  async getTopProducts(limit) {
    const db = getDatabase();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await db('sale_items')
      .select(
        'products.id',
        'products.name',
        'products.sku',
        db.raw('SUM(sale_items.quantity) as total_quantity'),
        db.raw('SUM(sale_items.total_price) as total_revenue')
      )
      .join('products', 'sale_items.product_id', 'products.id')
      .join('sales', 'sale_items.sale_id', 'sales.id')
      .whereRaw('datetime(sales.created_at) >= datetime(?)', [sqliteDateTime(thirtyDaysAgo)])
      .groupBy('products.id')
      .orderBy('total_quantity', 'desc')
      .limit(limit);
  }

  async getLowStockProducts() {
    const db = getDatabase();
    return await db('inventory')
      .select(
        'products.id',
        'products.name',
        'products.sku',
        'products.reorder_level',
        'inventory.quantity_on_hand'
      )
      .join('products', 'inventory.product_id', 'products.id')
      .where('products.is_active', true)
      .whereRaw('inventory.quantity_on_hand <= products.reorder_level')
      .orderBy('inventory.quantity_on_hand')
      .limit(10);
  }

  async getRecentSales(limit) {
    const db = getDatabase();
    
    const sales = await db('sales')
      .select(
        'sales.id',
        'sales.invoice_number',
        'sales.total_amount',
        'sales.payment_status',
        'sales.created_at',
        'customers.name as customer_name'
      )
      .leftJoin('customers', 'sales.customer_id', 'customers.id')
      .orderBy('sales.created_at', 'desc')
      .limit(limit);

    for (const sale of sales) {
      const items = await db('sale_items')
        .where('sale_id', sale.id)
        .count('* as count')
        .first();
      sale.item_count = items?.count || 0;
    }

    return sales;
  }
}

module.exports = new DashboardRepository();
