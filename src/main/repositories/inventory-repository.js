/**
 * Inventory Repository
 * Provides database access for inventory records.
 */

const { getDatabase } = require('../database/connection');
const { applyStockDelta } = require('../services/stock-protection');

class InventoryRepository {
  async findAll(filters = {}) {
    const db = getDatabase();
    let query = db('inventory')
      .select(
        'products.id',
        'products.sku',
        'products.name',
        'products.description as product_description',
        'products.unit_price',
        'products.cost_price',
        'products.reorder_level',
        'categories.name as category_name',
        'inventory.quantity_on_hand',
        'inventory.quantity_reserved',
        'inventory.location_code'
      )
      .join('products', 'inventory.product_id', 'products.id')
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .where('products.is_active', true);

    if (filters.lowStock) {
      query = query.whereRaw('inventory.quantity_on_hand <= products.reorder_level');
    }

    if (filters.location) {
      query = query.where('inventory.location_code', filters.location);
    }

    const results = await query.orderBy('products.name');
    
    return results.map(r => ({
      ...r,
      quantity_available: (r.quantity_on_hand || 0) - (r.quantity_reserved || 0)
    }));
  }

  async findByProductId(productId) {
    const db = getDatabase();
    const inventory = await db('inventory')
      .select('*')
      .where('product_id', productId)
      .first();
    
    if (!inventory) return null;
    
    inventory.quantity_available = (inventory.quantity_on_hand || 0) - (inventory.quantity_reserved || 0);
    return inventory;
  }

  async adjustStock(adjustment) {
    const db = getDatabase();
    
    return await db.transaction(async (trx) => {
      const stockChange = Number.parseInt(adjustment.quantity, 10) || 0;
      const stockResult = await applyStockDelta(trx, {
        productId: adjustment.productId,
        delta: stockChange,
        allowNegativeStock: adjustment.allowNegativeStock === true
      });

      const [transactionId] = await trx('stock_transactions').insert({
        product_id: adjustment.productId,
        transaction_type: adjustment.transactionType,
        quantity: stockChange,
        quantity_before: stockResult.beforeQuantity,
        quantity_after: stockResult.afterQuantity,
        reference_type: adjustment.referenceType,
        reference_id: adjustment.referenceId,
        notes: adjustment.notes,
        created_by: adjustment.userId,
        created_at: db.fn.now()
      });

      return { transactionId, newQuantity: stockResult.afterQuantity };
    });
  }

  async getTransactions(productId, filters = {}) {
    const db = getDatabase();
    let query = db('stock_transactions')
      .select('*')
      .where('product_id', productId)
      .orderBy('created_at', 'desc');

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    return await query;
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
      .orderBy('inventory.quantity_on_hand');
  }
}

module.exports = new InventoryRepository();
