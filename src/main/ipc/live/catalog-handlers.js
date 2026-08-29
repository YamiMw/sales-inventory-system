/**
 * Catalog Handlers
 * Registers authenticated IPC handlers for catalog handlers operations.
 */

'use strict';

const {
  loadSalesChartData
} = require('../../services/dashboard-chart-service');
const {
  normalizeStockAdjustment
} = require('../../services/stock-adjustment-service');

function registerCatalogHandlers(context) {
  const {
    secureIpc, logger, IPC_CHANNELS, getDatabase, authService, passwordUtils,
    auditService, createDatabaseBackup, recordBackupMetadata, configureAutomaticBackup,
    getAutomaticBackupStatus, getBackupDirectory, restoreDatabaseBackup,
    stopAutomaticBackup, initializeAutomaticBackup, dialog, getMainWindow, fs,
    createCustomerRecord, updateCustomerRecord, createTrustedSale, applyStockDelta,
    setStockLevel, resolveNegativeStockPolicy, parseStockQuantity, getStockValueInput,
    getCostPriceInput, recordStockTransaction, loadDocumentItems, loadInvoicePayments,
    loadAuditLogs, normalizeMoney, normalizeDocumentDate, generateDocumentNumber,
    normalizeDocumentItems, resolveInvoiceStatus, recordAuditLog, markExpiredQuotations,
    markOverdueInvoices
  } = context;

  function parseCategoryId(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
  }

  function toNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function toCount(row) {
    return toNumber(row?.count);
  }

  function sqliteDateTime(value) {
    return value instanceof Date ? value.toISOString() : String(value || '');
  }

  async function getSalesStats(db, startDate, endDate = null) {
    let query = db('sales')
      .whereRaw('datetime(created_at) >= datetime(?)', [sqliteDateTime(startDate)])
      .sum('total_amount as total')
      .count('* as count');

    if (endDate) {
      query = query.whereRaw('datetime(created_at) < datetime(?)', [sqliteDateTime(endDate)]);
    }

    const result = await query.first();
    return {
      total: toNumber(result?.total),
      count: toNumber(result?.count)
    };
  }

  async function getStockAvailabilityExpression(db) {
    const hasReservedStock = await db.schema.hasColumn('inventory', 'quantity_reserved');
    return hasReservedStock
      ? '(COALESCE(inventory.quantity_on_hand, 0) - COALESCE(inventory.quantity_reserved, 0))'
      : 'COALESCE(inventory.quantity_on_hand, 0)';
  }

  async function resolveProductCategoryId(trx, product) {
    const directId = parseCategoryId(product.category_id ?? product.categoryId);
    if (directId) return directId;

    const categoryName = [
      product.category_name,
      product.categoryName,
      product.category,
      product.category_id,
      product.categoryId
    ]
      .map(value => String(value || '').trim())
      .find(value => value && !parseCategoryId(value));

    if (!categoryName) return null;

    const category = await trx('categories')
      .select('id')
      .whereRaw('LOWER(name) = LOWER(?)', [categoryName])
      .where('is_active', true)
      .first();

    return category?.id || null;
  }

  // ============ DASHBOARD ============
  secureIpc.handle(IPC_CHANNELS.DASHBOARD.GET_STATS, async () => {
    try {
      const db = getDatabase();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const todayResult = await getSalesStats(db, today);
      const monthResult = await getSalesStats(db, monthStart);
      
      const productCount = await db('products')
        .where('is_active', true)
        .count('* as count')
        .first();

      const availableStockExpression = await getStockAvailabilityExpression(db);
      const lowStockCount = await db('inventory')
        .join('products', 'inventory.product_id', 'products.id')
        .where('products.is_active', true)
        .whereRaw(`${availableStockExpression} <= products.reorder_level`)
        .count('* as count')
        .first();
      
      const customerCount = await db('customers')
        .count('* as count')
        .first();

      const staffCount = await db('users')
        .count('* as count')
        .first();
      
      const inventoryValue = await db('inventory')
        .join('products', 'inventory.product_id', 'products.id')
        .where('products.is_active', true)
        .select(
          db.raw('SUM(CASE WHEN products.cost_price > 0 THEN inventory.quantity_on_hand * products.cost_price END) as total'),
          db.raw('SUM(CASE WHEN inventory.quantity_on_hand > 0 AND (products.cost_price IS NULL OR products.cost_price <= 0) THEN 1 ELSE 0 END) as missing_cost_count')
        )
        .first();
      
      const inventoryItems = await db('inventory')
        .join('products', 'inventory.product_id', 'products.id')
        .where('products.is_active', true)
        .sum('quantity_on_hand as total')
        .first();
      
      const pendingQuotes = await db('quotations')
        .where('status', 'sent')
        .count('* as count')
        .first();
      
      const outstandingInvoices = await db('invoices')
        .whereIn('status', ['issued', 'unpaid', 'partial'])
        .count('* as count')
        .first();
      
      const outstandingAmount = await db('invoices')
        .whereIn('status', ['issued', 'unpaid', 'partial'])
        .select(db.raw('COALESCE(SUM(total_amount - COALESCE(amount_paid, 0)), 0) as due'))
        .first();
      
      const newCustomers = await db('customers')
        .whereRaw('datetime(created_at) >= datetime(?)', [sqliteDateTime(monthStart)])
        .count('* as count')
        .first();

      return {
        success: true,
        data: {
          today: {
            sales: todayResult.total,
            transactions: todayResult.count,
            trend: 0
          },
          month: {
            sales: monthResult.total,
            transactions: monthResult.count,
            trend: 0
          },
          lowStock: toCount(lowStockCount),
          totalProducts: toCount(productCount),
          inventoryValue: Number(inventoryValue?.missing_cost_count || 0) > 0
            ? null
            : Number(inventoryValue?.total || 0),
          inventoryValueAvailable: Number(inventoryValue?.missing_cost_count || 0) === 0,
          inventoryItems: toNumber(inventoryItems?.total),
          totalCustomers: toCount(customerCount),
          staffCount: toCount(staffCount),
          newCustomers: toCount(newCustomers),
          pendingQuotes: toCount(pendingQuotes),
          outstandingInvoices: toCount(outstandingInvoices),
          outstandingAmount: toNumber(outstandingAmount?.due)
        }
      };
    } catch (error) {
      logger.error('Dashboard stats error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle(IPC_CHANNELS.DASHBOARD.GET_CHART_DATA, async (event, period = 'last7days') => {
    try {
      return {
        success: true,
        data: await loadSalesChartData(getDatabase(), period)
      };
    } catch (error) {
      logger.error('Chart data error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // ============ PRODUCTS ============
  secureIpc.handle('get-products', async (event, filters = {}) => {
    try {
      const db = getDatabase();
      const hasReservedStock = await db.schema.hasColumn('inventory', 'quantity_reserved');
      const productColumns = [
        'products.*',
        'categories.name as category_name',
        'inventory.quantity_on_hand'
      ];
      if (hasReservedStock) {
        productColumns.push('inventory.quantity_reserved');
      } else {
        productColumns.push(db.raw('0 as quantity_reserved'));
      }
      
      let query = db('products')
        .select(productColumns)
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
      
      const products = await query.limit(filters.limit || 100).offset(filters.offset || 0);
      
      return { success: true, data: products };
    } catch (error) {
      logger.error('Get products error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  secureIpc.handle('get-product', async (event, id) => {
    try {
      const db = getDatabase();
      
      const product = await db('products')
        .select('products.*', 'categories.name as category_name', 'inventory.*')
        .leftJoin('categories', 'products.category_id', 'categories.id')
        .leftJoin('inventory', 'products.id', 'inventory.product_id')
        .where('products.id', id)
        .first();
      
      if (!product) {
        return { success: false, error: 'Product not found' };
      }
      
      return { success: true, data: product };
    } catch (error) {
      logger.error('Get product error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('create-product', async (event, product) => {
    try {
      const db = getDatabase();
      const stockPolicy = await resolveNegativeStockPolicy({
        db,
        authService,
        credentials: { token: event.auth.token }
      });
      const actorUserId = event.auth.userId;
      
      if (!product.sku) {
        const prefix = (product.name || '').substring(0, 3).toUpperCase();
        const timestamp = Date.now().toString().slice(-6);
        product.sku = `${prefix}-${timestamp}`;
      }
      
      return await db.transaction(async (trx) => {
        const initialStock = getStockValueInput(product) ?? 0;
        const categoryId = await resolveProductCategoryId(trx, product);
        const [id] = await trx('products').insert({
          sku: product.sku,
          name: product.name,
          description: product.description || '',
          category_id: categoryId,
          unit_price: product.unit_price || product.price || 0,
          cost_price: getCostPriceInput(product),
          reorder_level: product.reorder_level || product.reorderLevel || 10,
          barcode: product.barcode || null,
          unit: product.unit || 'piece',
          tax_rate: product.tax_rate || product.taxRate || 10.00,
          is_active: true,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });

        const stockResult = await setStockLevel(trx, {
          productId: id,
          targetQuantity: initialStock,
          allowNegativeStock: stockPolicy.allowed
        });

        if (initialStock !== 0) {
          await recordStockTransaction(trx, {
            productId: id,
            type: 'initial_stock',
            quantity: initialStock,
            beforeQuantity: stockResult.beforeQuantity,
            afterQuantity: stockResult.afterQuantity,
            referenceType: 'product',
            referenceId: id,
            notes: stockResult.afterQuantity < 0
              ? `Initial stock on product creation; negative stock authorized by ${stockPolicy.actor?.username}`
              : 'Initial stock on product creation',
            userId: actorUserId
          });
        }

        logger.info(`Product created: ${product.sku}`);

        return { success: true, data: { id, sku: product.sku } };
      });
    } catch (error) {
      logger.error('Create product error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('update-product', async (event, id, product) => {
    try {
      const db = getDatabase();
      const stockPolicy = await resolveNegativeStockPolicy({
        db,
        authService,
        credentials: { token: event.auth.token }
      });
      const actorUserId = event.auth.userId;
      
      return await db.transaction(async (trx) => {
        const categoryId = await resolveProductCategoryId(trx, product);
        const productUpdates = {
          name: product.name,
          description: product.description,
          category_id: categoryId,
          unit_price: product.unit_price || product.price,
          cost_price: getCostPriceInput(product),
          reorder_level: product.reorder_level || product.reorderLevel,
          unit: product.unit,
          tax_rate: product.tax_rate || product.taxRate,
          is_active: product.is_active ?? product.isActive ?? product.status !== 'inactive',
          updated_at: trx.fn.now()
        };
        if (Object.prototype.hasOwnProperty.call(product, 'barcode')) {
          productUpdates.barcode = product.barcode || null;
        }

        await trx('products')
          .where('id', id)
          .update(productUpdates);

        const stockValue = getStockValueInput(product);
        if (stockValue !== null) {
          const stockResult = await setStockLevel(trx, {
            productId: id,
            targetQuantity: stockValue,
            allowNegativeStock: stockPolicy.allowed
          });

          if (stockResult.delta !== 0) {
            await recordStockTransaction(trx, {
              productId: id,
              type: 'product_update',
              quantity: stockResult.delta,
              beforeQuantity: stockResult.beforeQuantity,
              afterQuantity: stockResult.afterQuantity,
              referenceType: 'product',
              referenceId: id,
              notes: stockResult.afterQuantity < 0
                ? `Stock updated from product edit; negative stock authorized by ${stockPolicy.actor?.username}`
                : 'Stock updated from product edit',
              userId: actorUserId
            });
          }
        }

        return { success: true };
      });
    } catch (error) {
      logger.error('Update product error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('delete-product', async (event, id) => {
    try {
      const db = getDatabase();
      
      await db('products')
        .where('id', id)
        .update({ is_active: false, updated_at: db.fn.now() });
      
      return { success: true };
    } catch (error) {
      logger.error('Delete product error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('search-products', async (event, query) => {
    try {
      const db = getDatabase();
      
      const products = await db('products')
        .select('products.*', 'categories.name as category_name', 'inventory.quantity_on_hand')
        .leftJoin('categories', 'products.category_id', 'categories.id')
        .leftJoin('inventory', 'products.id', 'inventory.product_id')
        .where('products.is_active', true)
        .where(function() {
          this.where('products.name', 'like', `%${query}%`)
              .orWhere('products.sku', 'like', `%${query}%`)
              .orWhere('products.barcode', 'like', `%${query}%`);
        })
        .limit(50);
      
      return { success: true, data: products };
    } catch (error) {
      logger.error('Search products error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  // ============ CATEGORIES ============
  secureIpc.handle('get-categories', async () => {
    try {
      const db = getDatabase();
      
      const categories = await db('categories')
        .where('is_active', true)
        .orderBy('name');
      
      return { success: true, data: categories };
    } catch (error) {
      logger.error('Get categories error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  secureIpc.handle('create-category', async (event, category) => {
    try {
      const db = getDatabase();
      
      const [id] = await db('categories').insert({
        name: category.name,
        description: category.description || '',
        is_active: true,
        created_at: db.fn.now()
      });
      
      return { success: true, data: { id, ...category } };
    } catch (error) {
      logger.error('Create category error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // ============ CUSTOMERS ============
  secureIpc.handle('get-customers', async (event, filters = {}) => {
    try {
      const db = getDatabase();
      
      let query = db('customers').orderBy('name');
      
      if (filters.search) {
        query = query.where(function() {
          this.where('name', 'like', `%${filters.search}%`)
              .orWhere('email', 'like', `%${filters.search}%`)
              .orWhere('phone', 'like', `%${filters.search}%`);
        });
      }
      
      const customers = await query.limit(filters.limit || 100);
      
      return { success: true, data: customers };
    } catch (error) {
      logger.error('Get customers error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  secureIpc.handle('get-customer', async (event, id) => {
    try {
      const db = getDatabase();
      
      const customer = await db('customers').where('id', id).first();
      
      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }
      
      return { success: true, data: customer };
    } catch (error) {
      logger.error('Get customer error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('create-customer', async (event, customer) => {
    try {
      const db = getDatabase();

      const { id, customerCode } = await createCustomerRecord(db, customer);
      
      logger.info(`Customer created: ${customer.name} (${customerCode})`);
      
      return { success: true, data: { id, customer_code: customerCode, ...customer } };
    } catch (error) {
      logger.error('Create customer error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('update-customer', async (event, id, customer) => {
    try {
      const db = getDatabase();

      const updated = await updateCustomerRecord(db, id, customer);
      if (!updated) {
        return { success: false, error: 'Customer not found' };
      }
      
      return { success: true };
    } catch (error) {
      logger.error('Update customer error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('delete-customer', async (event, id) => {
    try {
      const db = getDatabase();
      
      await db('customers')
        .where('id', id)
        .update({ status: 'inactive', updated_at: db.fn.now() });
      
      return { success: true };
    } catch (error) {
      logger.error('Delete customer error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('search-customers', async (event, query) => {
    try {
      const db = getDatabase();
      
      const customers = await db('customers')
        .where(function() {
          this.where('name', 'like', `%${query}%`)
              .orWhere('email', 'like', `%${query}%`)
              .orWhere('phone', 'like', `%${query}%`);
        })
        .limit(20);
      
      return { success: true, data: customers };
    } catch (error) {
      logger.error('Search customers error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  // ============ INVENTORY ============
  secureIpc.handle('get-inventory', async (event, filters = {}) => {
    try {
      const db = getDatabase();
      const hasReservedStock = await db.schema.hasColumn('inventory', 'quantity_reserved');
      const availableStockExpression = await getStockAvailabilityExpression(db);
      const inventoryColumns = [
        'products.id',
        'products.sku',
        'products.name',
        'products.description as product_description',
        'products.unit_price',
        'products.cost_price',
        'products.reorder_level',
        'categories.name as category_name',
        'inventory.quantity_on_hand',
        'inventory.location_code'
      ];
      if (hasReservedStock) {
        inventoryColumns.splice(-1, 0, 'inventory.quantity_reserved');
      } else {
        inventoryColumns.splice(-1, 0, db.raw('0 as quantity_reserved'));
      }
      
      let query = db('inventory')
        .select(inventoryColumns)
        .join('products', 'inventory.product_id', 'products.id')
        .leftJoin('categories', 'products.category_id', 'categories.id')
        .where('products.is_active', true);
      
      if (filters.lowStock) {
        query = query.whereRaw(`${availableStockExpression} <= products.reorder_level`);
      }
      
      if (filters.location) {
        query = query.where('inventory.location_code', filters.location);
      }
      
      const inventory = await query.orderBy('products.name');
      
      return { success: true, data: inventory };
    } catch (error) {
      logger.error('Get inventory error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  secureIpc.handle('adjust-stock', async (event, adjustment) => {
    try {
      const db = getDatabase();
      const stockPolicy = await resolveNegativeStockPolicy({
        db,
        authService,
        credentials: { token: event.auth.token }
      });
      const actorUserId = event.auth.userId;
      
      return await db.transaction(async (trx) => {
        const normalized = normalizeStockAdjustment(adjustment);
        const {
          productId,
          type,
          notes
        } = normalized;

        let stockResult;
        if (normalized.operation === 'set') {
          stockResult = await setStockLevel(trx, {
            productId,
            targetQuantity: normalized.targetQuantity,
            allowNegativeStock: stockPolicy.allowed
          });
        } else {
          stockResult = await applyStockDelta(trx, {
            productId,
            delta: normalized.delta,
            allowNegativeStock: stockPolicy.allowed
          });
        }
        
        await recordStockTransaction(trx, {
          productId,
          type,
          quantity: stockResult.delta,
          beforeQuantity: stockResult.beforeQuantity,
          afterQuantity: stockResult.afterQuantity,
          referenceType: type,
          notes: stockResult.afterQuantity < 0
            ? `${notes || 'Stock adjustment'}; negative stock authorized by ${stockPolicy.actor?.username}`
            : notes || null,
          userId: actorUserId
        });
        
        return {
          success: true,
          data: {
            beforeQuantity: stockResult.beforeQuantity,
            change: stockResult.delta,
            newQuantity: stockResult.afterQuantity
          }
        };
      });
    } catch (error) {
      logger.error('Adjust stock error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('get-stock-transactions', async (event, productId, filters = {}) => {
    try {
      const db = getDatabase();
      const limit = Number.parseInt(filters.limit, 10) || 50;

      const transactions = await db('stock_transactions')
        .select(
          'stock_transactions.id',
          'stock_transactions.product_id',
          'stock_transactions.transaction_type',
          'stock_transactions.quantity',
          'stock_transactions.quantity_before',
          'stock_transactions.quantity_after',
          'stock_transactions.reference_type',
          'stock_transactions.reference_id',
          'stock_transactions.reference_text',
          'stock_transactions.notes',
          'stock_transactions.created_at',
          'users.full_name as created_by_name'
        )
        .leftJoin('users', 'stock_transactions.created_by', 'users.id')
        .where('stock_transactions.product_id', productId)
        .orderBy('stock_transactions.created_at', 'desc')
        .limit(Math.min(Math.max(limit, 1), 100));

      return { success: true, data: transactions };
    } catch (error) {
      logger.error('Get stock transactions error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  secureIpc.handle('get-low-stock', async () => {
    try {
      const db = getDatabase();
      const hasReservedStock = await db.schema.hasColumn('inventory', 'quantity_reserved');
      const availableStockExpression = await getStockAvailabilityExpression(db);
      const stockColumns = [
        'products.id',
        'products.name',
        'products.sku',
        'products.reorder_level',
        'inventory.quantity_on_hand',
        db.raw(`${availableStockExpression} as available_stock`)
      ];
      if (hasReservedStock) {
        stockColumns.splice(-1, 0, 'inventory.quantity_reserved');
      } else {
        stockColumns.splice(-1, 0, db.raw('0 as quantity_reserved'));
      }
      
      const products = await db('inventory')
        .select(stockColumns)
        .join('products', 'inventory.product_id', 'products.id')
        .where('products.is_active', true)
        .whereRaw(`${availableStockExpression} <= products.reorder_level`)
        .orderBy('available_stock');
      
      return { success: true, data: products };
    } catch (error) {
      logger.error('Get low stock error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });
}

module.exports = { registerCatalogHandlers };
