/**
 * Sales Commerce Handlers
 * Registers focused authenticated commerce IPC handlers.
 */

'use strict';

function registerCommerceSalesHandlers(context) {
  const {
    secureIpc,
    logger,
    getDatabase,
    authService,
    createTrustedSale,
    resolveNegativeStockPolicy,
    parseStockQuantity
  } = context;

  // ============ SALES / POS ============
  secureIpc.handle('create-sale', async (event, saleData) => {
    try {
      const db = getDatabase();
      const stockPolicy = await resolveNegativeStockPolicy({
        db,
        authService,
        credentials: { token: event.auth.token }
      });
      const data = await createTrustedSale(
        db,
        {
          ...saleData,
          userId: event.auth.userId
        },
        {
          logger,
          allowNegativeStock: stockPolicy.allowed,
          negativeStockActor: stockPolicy.actor
        }
      );
      return { success: true, data };
    } catch (error) {
      logger.error('Create sale error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('get-sales', async (event, filters = {}) => {
    try {
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
      
      const sales = await query.limit(filters.limit || 100).offset(filters.offset || 0);
      
      for (const sale of sales) {
        sale.items = await db('sale_items')
          .select(
            'sale_items.id',
            'sale_items.product_id',
            'sale_items.quantity',
            'sale_items.unit_price',
            'sale_items.unit_cost',
            'sale_items.total_price',
            'products.name as product_name',
            'products.sku',
            'categories.name as category_name'
          )
          .leftJoin('products', 'sale_items.product_id', 'products.id')
          .leftJoin('categories', 'products.category_id', 'categories.id')
          .where('sale_items.sale_id', sale.id);

        sale.item_count = sale.items.length;
        sale.quantity_sold = sale.items.reduce((sum, item) => sum + (parseStockQuantity(item.quantity) || 0), 0);
        sale.item_summary = sale.items.map(item => {
          const quantity = parseStockQuantity(item.quantity) || 0;
          return `${item.product_name || item.sku || 'Item'} x${quantity}`;
        }).join(', ');
      }
      
      return { success: true, data: sales };
    } catch (error) {
      logger.error('Get sales error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  secureIpc.handle('get-sale', async (event, id) => {
    try {
      const db = getDatabase();
      
      const sale = await db('sales')
        .select('sales.*', 'customers.name as customer_name', 'customers.address as customer_address')
        .leftJoin('customers', 'sales.customer_id', 'customers.id')
        .where('sales.id', id)
        .first();
      
      if (!sale) {
        return { success: false, error: 'Sale not found' };
      }
      
      sale.items = await db('sale_items')
        .select('sale_items.*', 'products.name as product_name', 'products.sku')
        .join('products', 'sale_items.product_id', 'products.id')
        .where('sale_id', id);
      
      return { success: true, data: sale };
    } catch (error) {
      logger.error('Get sale error:', error.message);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerCommerceSalesHandlers };
