/**
 * Stock Adjustment Service
 * Validates stock update requests and derives the trusted database operation.
 */

'use strict';

const ALLOWED_TYPES = new Set(['receipt', 'return', 'damage', 'lost', 'count', 'adjustment']);
const ALLOWED_DIRECTIONS = new Set(['increase', 'decrease']);

function normalizeStockAdjustment(adjustment = {}) {
  const productId = Number(adjustment.productId);
  const quantity = Number(adjustment.quantity);
  const type = String(adjustment.type || '');
  const direction = String(adjustment.direction || 'increase');
  const notes = String(adjustment.notes || '').trim();
  const requestedStockChange = adjustment.stockChange === undefined
    ? null
    : Number(adjustment.stockChange);

  if (!Number.isSafeInteger(productId) || productId < 1) {
    throw new Error('Product id is invalid');
  }
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error('Stock transaction type is invalid');
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error('Quantity must be a whole number greater than zero');
  }
  if (type === 'adjustment' && !ALLOWED_DIRECTIONS.has(direction)) {
    throw new Error('Correction type is invalid');
  }
  if (notes.length > 2000) {
    throw new Error('Notes must be 2000 characters or fewer');
  }

  if (type === 'count') {
    return {
      productId,
      quantity,
      type,
      direction,
      notes,
      operation: 'set',
      targetQuantity: quantity
    };
  }

  const decreasesStock =
    type === 'damage' ||
    type === 'lost' ||
    (type === 'adjustment' && direction === 'decrease');
  const delta = decreasesStock ? -quantity : quantity;

  if (requestedStockChange !== null && requestedStockChange !== delta) {
    throw new Error('Stock change does not match the selected transaction type');
  }

  return {
    productId,
    quantity,
    type,
    direction,
    notes,
    operation: 'delta',
    delta
  };
}

module.exports = { normalizeStockAdjustment };
