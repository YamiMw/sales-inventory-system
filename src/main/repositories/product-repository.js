/**
 * Product Repository
 * Provides database access for product records.
 */

const { getDatabase } = require('../database/connection');
const { setStockLevel } = require('../services/stock-protection');

function parseStockQuantity(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStockValueInput(data) {
  const keys = ['stock', 'initial_stock', 'initialStock', 'quantity_on_hand', 'quantityOnHand'];
  const key = keys.find((candidate) => Object.prototype.hasOwnProperty.call(data || {}, candidate));
  return key ? parseStockQuantity(data[key]) : null;
}

class ProductRepository {
  async findAll(filters = {}) {
    const db = getDatabase();
    let query = db('products')
      .select(
        'products.*',
        'categories.name as category_name',
        'inventory.quantity_on_hand',
        'inventory.quantity_reserved'
      )
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .leftJoin('inventory', 'products.id', 'inventory.product_id')
      .where('products.is_active', true);

    if (filters.category) {
      query = query.where('products.category_id', filters.category);
    }

    if (filters.search) {
      query = query.where(function() {
        this.where('products.name', 'like', `%${filters.search}%`)
            .orWhere('products.sku', 'like', `%${filters.search}%`)
            .orWhere('products.barcode', 'like', `%${filters.search}%`);
      });
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    return await query.limit(limit).offset(offset).orderBy('products.name');
  }

  async findById(id) {
    const db = getDatabase();
    const product = await db('products')
      .select(
        'products.*',
        'categories.name as category_name',
        'inventory.quantity_on_hand',
        'inventory.quantity_reserved'
      )
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .leftJoin('inventory', 'products.id', 'inventory.product_id')
      .where('products.id', id)
      .first();

    if (!product) return null;

    product.quantity_available = (product.quantity_on_hand || 0) - (product.quantity_reserved || 0);
    return product;
  }

  async create(productData) {
    const db = getDatabase();
    
    const id = await db.transaction(async (trx) => {
      const initialStock = getStockValueInput(productData) ?? 0;
      const [productId] = await trx('products').insert({
        sku: productData.sku,
        name: productData.name,
        description: productData.description,
        category_id: productData.categoryId,
        unit_price: productData.unitPrice,
        cost_price: productData.costPrice,
        reorder_level: productData.reorderLevel,
        barcode: productData.barcode,
        unit: productData.unit,
        tax_rate: productData.taxRate,
        created_by: productData.userId,
        created_at: trx.fn.now(),
        updated_at: trx.fn.now()
      });

      const stockResult = await setStockLevel(trx, {
        productId,
        targetQuantity: initialStock,
        allowNegativeStock: productData.allowNegativeStock === true
      });

      if (initialStock !== 0) {
        await trx('stock_transactions').insert({
          product_id: productId,
          transaction_type: 'initial_stock',
          quantity: initialStock,
          quantity_before: stockResult.beforeQuantity,
          quantity_after: stockResult.afterQuantity,
          reference_type: 'product',
          reference_id: productId,
          notes: 'Initial stock on product creation',
          created_by: productData.userId,
          created_at: trx.fn.now()
        });
      }

      return productId;
    });

    return this.findById(id);
  }

  async update(id, productData) {
    const db = getDatabase();
    
    await db.transaction(async (trx) => {
      await trx('products')
        .where('id', id)
        .update({
          name: productData.name,
          description: productData.description,
          category_id: productData.categoryId,
          unit_price: productData.unitPrice,
          cost_price: productData.costPrice,
          reorder_level: productData.reorderLevel,
          barcode: productData.barcode,
          updated_at: trx.fn.now()
        });

      const stockValue = getStockValueInput(productData);
      if (stockValue !== null) {
        const stockResult = await setStockLevel(trx, {
          productId: id,
          targetQuantity: stockValue,
          allowNegativeStock: productData.allowNegativeStock === true
        });

        if (stockResult.delta !== 0) {
          await trx('stock_transactions').insert({
            product_id: id,
            transaction_type: 'product_update',
            quantity: stockResult.delta,
            quantity_before: stockResult.beforeQuantity,
            quantity_after: stockResult.afterQuantity,
            reference_type: 'product',
            reference_id: id,
            notes: 'Stock updated from product edit',
            created_by: productData.userId,
            created_at: trx.fn.now()
          });
        }
      }
    });

    return this.findById(id);
  }

  async delete(id) {
    const db = getDatabase();
    await db('products')
      .where('id', id)
      .update({ is_active: false, updated_at: db.fn.now() });
    return true;
  }

  async search(query) {
    return this.findAll({ search: query, limit: 20 });
  }

  async getCategories() {
    const db = getDatabase();
    return await db('categories')
      .select('*')
      .where('is_active', true)
      .orderBy('name');
  }

  async createCategory(category) {
    const db = getDatabase();
    const [id] = await db('categories').insert({
      name: category.name,
      description: category.description,
      created_at: db.fn.now()
    });
    return { id, ...category };
  }
}

module.exports = new ProductRepository();
