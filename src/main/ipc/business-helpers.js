/**
 * Business Helpers
 * Provides shared validation, numbering, audit, and document helpers for IPC handlers.
 */

'use strict';

function parseStockQuantity(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getStockValueInput(data) {
  const keys = ['stock', 'initial_stock', 'initialStock', 'quantity_on_hand', 'quantityOnHand'];
  const key = keys.find((candidate) => Object.prototype.hasOwnProperty.call(data || {}, candidate));
  return key ? parseStockQuantity(data[key]) : null;
}

function getCostPriceInput(data) {
  const value = data?.cost_price ?? data?.costPrice;
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function recordStockTransaction(trx, transaction) {
  const quantity = parseStockQuantity(transaction.quantity);

  const row = {
    product_id: transaction.productId,
    transaction_type: transaction.type || 'adjustment',
    quantity,
    quantity_before: parseStockQuantity(transaction.beforeQuantity),
    quantity_after: parseStockQuantity(transaction.afterQuantity),
    reference_type: transaction.referenceType || null,
    reference_id: transaction.referenceId || null,
    notes: transaction.notes || null,
    created_by: transaction.userId || null,
    created_at: trx.fn.now()
  };

  if (
    transaction.referenceText &&
    await trx.schema.hasColumn('stock_transactions', 'reference_text')
  ) {
    row.reference_text = transaction.referenceText;
  }

  await trx('stock_transactions').insert(row);
}

async function loadDocumentItems(dbOrTrx, tableName, foreignKey, documentId) {
  return await dbOrTrx(tableName)
    .select(
      `${tableName}.*`,
      'products.name as product_name',
      'products.sku'
    )
    .leftJoin('products', `${tableName}.product_id`, 'products.id')
    .where(foreignKey, documentId);
}

async function loadInvoicePayments(dbOrTrx, invoiceId) {
  return await dbOrTrx('payments')
    .select('*')
    .where('invoice_id', invoiceId)
    .orderBy('created_at', 'desc');
}

async function loadAuditLogs(dbOrTrx, entityType, entityId) {
  return await dbOrTrx('audit_logs')
    .select('*')
    .where({
      entity_type: entityType,
      entity_id: entityId
    })
    .orderBy('created_at', 'desc')
    .limit(20);
}

function normalizeMoney(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDocumentDate(dateValue, fallbackDays = 30) {
  if (dateValue) {
    return dateValue;
  }

  const date = new Date();
  date.setDate(date.getDate() + fallbackDays);
  return date.toISOString().slice(0, 10);
}

async function generateDocumentNumber(dbOrTrx, tableName, columnName, prefix) {
  const year = new Date().getFullYear();
  const base = `${prefix}-${year}`;
  const rows = await dbOrTrx(tableName)
    .select(columnName)
    .where(columnName, 'like', `${base}-%`);

  const maxSequence = rows.reduce((max, row) => {
    const value = String(row[columnName] || '');
    const match = value.match(new RegExp(`^${base}-(\\d+)$`));
    if (!match) return max;
    return Math.max(max, Number.parseInt(match[1], 10) || 0);
  }, 0);

  return `${base}-${String(maxSequence + 1).padStart(4, '0')}`;
}

function normalizeDocumentItems(items = []) {
  return (items || [])
    .filter(item => item && (item.productId || item.product_id || item.id))
    .map(item => {
      const quantity = parseStockQuantity(item.quantity);
      const unitPrice = normalizeMoney(item.unitPrice || item.price);
      const discountPercent = normalizeMoney(item.discountPercent);

      return {
        productId: item.productId || item.product_id || item.id,
        quantity: quantity > 0 ? quantity : 1,
        unitPrice,
        discountPercent,
        totalPrice: unitPrice * (quantity > 0 ? quantity : 1) * (1 - discountPercent / 100)
      };
    });
}

function resolveInvoiceStatus(requestedStatus, totalAmount, amountPaid) {
  const requested = String(requestedStatus || '').toLowerCase();
  if (requested === 'voided') return 'voided';
  if (requested === 'draft') return 'draft';

  const total = normalizeMoney(totalAmount);
  const paid = normalizeMoney(amountPaid);

  if (total > 0 && paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  if (requested === 'issued' || requested === 'unpaid') return 'unpaid';
  if (requested === 'overdue') return 'overdue';
  return 'issued';
}

async function recordAuditLog(dbOrTrx, entry) {
  await dbOrTrx('audit_logs').insert({
    user_id: entry.userId || null,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId || null,
    old_values: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
    new_values: entry.newValues ? JSON.stringify(entry.newValues) : null,
    ip_address: entry.ipAddress || null,
    created_at: dbOrTrx.fn.now()
  });
}

async function markExpiredQuotations(dbOrTrx) {
  const today = new Date().toISOString().slice(0, 10);
  await dbOrTrx('quotations')
    .whereIn('status', ['draft', 'sent'])
    .where('expiry_date', '<', today)
    .update({
      status: 'expired',
      updated_at: dbOrTrx.fn.now()
    });
}

async function markOverdueInvoices(dbOrTrx) {
  const today = new Date().toISOString().slice(0, 10);
  await dbOrTrx('invoices')
    .whereIn('status', ['issued', 'unpaid', 'partial'])
    .where('due_date', '<', today)
    .update({
      status: 'overdue',
      updated_at: dbOrTrx.fn.now()
    });
}

module.exports = {
  parseStockQuantity,
  getStockValueInput,
  getCostPriceInput,
  recordStockTransaction,
  loadDocumentItems,
  loadInvoicePayments,
  loadAuditLogs,
  normalizeMoney,
  normalizeDocumentDate,
  generateDocumentNumber,
  normalizeDocumentItems,
  resolveInvoiceStatus,
  recordAuditLog,
  markExpiredQuotations,
  markOverdueInvoices
};
