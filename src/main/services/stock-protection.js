/**
 * Stock Protection
 * Applies inventory changes while enforcing stock and concurrency invariants.
 */

class StockProtectionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'StockProtectionError';
    this.code = 'INSUFFICIENT_STOCK';
    this.details = details;
  }
}

function normalizeInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${fieldName} must be a whole number`);
  }
  return parsed;
}

async function supportsReservedStock(trx) {
  return trx.schema.hasColumn('inventory', 'quantity_reserved');
}

async function loadInventory(trx, productId, hasReservedStock) {
  const columns = ['quantity_on_hand'];
  if (hasReservedStock) columns.push('quantity_reserved');

  return trx('inventory')
    .select(columns)
    .where('product_id', productId)
    .first();
}

async function loadProductLabel(trx, productId) {
  const product = await trx('products')
    .select('name', 'sku')
    .where('id', productId)
    .first();
  return product?.name || product?.sku || `Product #${productId}`;
}

async function insufficientStockError(trx, productId, requested, hasReservedStock) {
  const inventory = await loadInventory(trx, productId, hasReservedStock);
  const onHand = Number.parseInt(inventory?.quantity_on_hand, 10) || 0;
  const reserved = Number.parseInt(inventory?.quantity_reserved, 10) || 0;
  const available = Math.max(onHand - reserved, 0);
  const productName = await loadProductLabel(trx, productId);

  return new StockProtectionError(
    `Insufficient stock for ${productName}: requested ${requested}, available ${available}`,
    { productId, requested, available, onHand, reserved }
  );
}

async function insertInventoryRow(trx, productId, quantity, hasReservedStock) {
  const row = {
    product_id: productId,
    quantity_on_hand: quantity,
    updated_at: trx.fn.now()
  };
  if (hasReservedStock) row.quantity_reserved = 0;

  try {
    await trx('inventory').insert(row);
    return true;
  } catch (error) {
    const isUniqueConflict =
      error?.code === 'SQLITE_CONSTRAINT' ||
      String(error?.message || '').includes('UNIQUE constraint failed');
    if (!isUniqueConflict) throw error;
    return false;
  }
}

async function applyStockDelta(trx, options) {
  const productId = normalizeInteger(options.productId, 'Product id');
  const delta = normalizeInteger(options.delta, 'Stock change');
  const allowNegativeStock = options.allowNegativeStock === true;
  const hasReservedStock = await supportsReservedStock(trx);

  if (delta === 0) {
    const inventory = await loadInventory(trx, productId, hasReservedStock);
    const quantity = Number.parseInt(inventory?.quantity_on_hand, 10) || 0;
    return { beforeQuantity: quantity, afterQuantity: quantity, delta: 0 };
  }

  let affected;
  if (delta < 0 && !allowNegativeStock) {
    const requested = Math.abs(delta);
    const updateQuery = trx('inventory').where('product_id', productId);
    if (hasReservedStock) {
      updateQuery.whereRaw(
        '(COALESCE(quantity_on_hand, 0) - COALESCE(quantity_reserved, 0)) >= ?',
        [requested]
      );
    } else {
      updateQuery.whereRaw('COALESCE(quantity_on_hand, 0) >= ?', [requested]);
    }

    // The stock predicate and decrement share one statement to avoid check-then-write races.
    affected = await updateQuery
      .update({
        quantity_on_hand: trx.raw('COALESCE(quantity_on_hand, 0) + ?', [delta]),
        updated_at: trx.fn.now()
      });

    if (!affected) {
      throw await insufficientStockError(
        trx,
        productId,
        requested,
        hasReservedStock
      );
    }
  } else {
    affected = await trx('inventory')
      .where('product_id', productId)
      .update({
        quantity_on_hand: trx.raw('COALESCE(quantity_on_hand, 0) + ?', [delta]),
        updated_at: trx.fn.now()
      });

    if (!affected) {
      const inserted = await insertInventoryRow(
        trx,
        productId,
        delta,
        hasReservedStock
      );
      if (!inserted) {
        // Another writer inserted the row first; retry as an update in this transaction.
        affected = await trx('inventory')
          .where('product_id', productId)
          .update({
            quantity_on_hand: trx.raw('COALESCE(quantity_on_hand, 0) + ?', [delta]),
            updated_at: trx.fn.now()
          });
      }
    }
  }

  const inventory = await loadInventory(trx, productId, hasReservedStock);
  const afterQuantity = Number.parseInt(inventory?.quantity_on_hand, 10) || 0;
  return {
    beforeQuantity: afterQuantity - delta,
    afterQuantity,
    delta
  };
}

async function setStockLevel(trx, options) {
  const productId = normalizeInteger(options.productId, 'Product id');
  const targetQuantity = normalizeInteger(options.targetQuantity, 'Stock level');
  const allowNegativeStock = options.allowNegativeStock === true;
  const hasReservedStock = await supportsReservedStock(trx);

  if (targetQuantity < 0 && !allowNegativeStock) {
    throw new StockProtectionError(
      'Stock level cannot be below zero',
      { productId, requested: Math.abs(targetQuantity), available: 0 }
    );
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inventory = await loadInventory(trx, productId, hasReservedStock);
    if (!inventory) {
      const inserted = await insertInventoryRow(
        trx,
        productId,
        targetQuantity,
        hasReservedStock
      );
      if (inserted) {
        return {
          beforeQuantity: 0,
          afterQuantity: targetQuantity,
          delta: targetQuantity
        };
      }
      continue;
    }

    const beforeQuantity = Number.parseInt(inventory.quantity_on_hand, 10) || 0;
    const reserved = Number.parseInt(inventory.quantity_reserved, 10) || 0;
    if (!allowNegativeStock && targetQuantity < reserved) {
      throw await insufficientStockError(
        trx,
        productId,
        Math.max(beforeQuantity - targetQuantity, 0),
        hasReservedStock
      );
    }

    // Compare-and-swap detects a concurrent stock edit before replacing the level.
    const affected = await trx('inventory')
      .where('product_id', productId)
      .where('quantity_on_hand', beforeQuantity)
      .update({
        quantity_on_hand: targetQuantity,
        updated_at: trx.fn.now()
      });

    if (affected) {
      return {
        beforeQuantity,
        afterQuantity: targetQuantity,
        delta: targetQuantity - beforeQuantity
      };
    }
  }

  throw new Error('Stock changed concurrently; retry the operation');
}

module.exports = {
  StockProtectionError,
  applyStockDelta,
  setStockLevel
};
