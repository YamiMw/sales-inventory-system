/**
 * Commerce Document Helpers
 * Shared document and approval helpers used by live commerce IPC handlers.
 */

'use strict';

const {
  getRolePermissions,
  normalizePermissions
} = require('../../../shared/constants/roles');

function createCommerceDocumentHelpers({
  normalizeMoney,
  parseStockQuantity,
  passwordUtils
}) {
  async function getSettingValue(dbOrTrx, keys, fallback = '') {
    const candidates = Array.isArray(keys) ? keys : [keys];
    for (const key of candidates) {
      const row = await dbOrTrx('settings').where({ key }).first('value');
      if (row?.value !== undefined && row.value !== null && String(row.value).trim() !== '') {
        return String(row.value).trim();
      }
    }
    return fallback;
  }

  function normalizeDocumentPrefix(value, fallback) {
    const cleaned = String(value || fallback)
      .trim()
      .replace(/[-_\s]+$/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .replace(/[-_]+$/g, '');
    return cleaned || fallback;
  }

  function normalizeDocumentDays(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function getDocumentChargeTotals(document = {}) {
    const subtotal = normalizeMoney(document.subtotal);
    const discountAmount = normalizeMoney(document.discountAmount);
    const taxAmount = normalizeMoney(document.taxAmount);
    const totalAmount = Math.max(subtotal - discountAmount, 0);
    return { subtotal, discountAmount, taxAmount, totalAmount };
  }

  function parsePermissionList(value) {
    if (Array.isArray(value)) return normalizePermissions(value);
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalizePermissions(parsed) : [];
    } catch {
      return [];
    }
  }

  function isActiveUser(user) {
    const status = String(user?.status || '').toLowerCase();
    return Boolean(user)
      && user.is_active !== false
      && Number(user.is_active) !== 0
      && !['inactive', 'locked'].includes(status);
  }

  async function verifyManagerCredentials(db, credentials = {}) {
    const username = String(credentials.username || '').trim();
    const password = String(credentials.password || '');
    if (!username || !password) {
      throw new Error('Enter the manager username and password to approve this document.');
    }

    const user = await db('users')
      .whereRaw('LOWER(username) = ?', [username.toLowerCase()])
      .first();
    if (!user || !await passwordUtils.verifyPassword(password, user.password_hash)) {
      throw new Error('Invalid manager username or password');
    }
    if (!isActiveUser(user)) {
      throw new Error('The manager account is not active');
    }
    if (Boolean(user.password_must_change)) {
      throw new Error('The manager password must be changed before approving documents');
    }

    const role = String(user.role || '').toLowerCase();
    const roleRow = await db('role_permissions').where('role', role).first();
    const permissions = new Set(normalizePermissions([
      ...getRolePermissions(role),
      ...parsePermissionList(roleRow?.permissions),
      ...parsePermissionList(user.permissions)
    ]));

    if (!['admin', 'manager'].includes(role)) {
      throw new Error('Only a manager or administrator can approve documents');
    }

    return {
      userId: user.id,
      username: user.username,
      fullName: user.full_name || user.username,
      role,
      permissions
    };
  }

  async function approverAllowsNegativeStock(dbOrTrx, approver) {
    const setting = await dbOrTrx('settings')
      .select('value')
      .where('key', 'allow_negative_stock')
      .first();
    const enabled = setting?.value === true || setting?.value === 1 || setting?.value === '1' || setting?.value === 'true';
    return Boolean(enabled && (approver.role === 'admin' || approver.permissions.has('allow_negative_stock')));
  }

  async function getInvoiceStockShortages(dbOrTrx, items) {
    const requestedByProduct = new Map();
    for (const item of items) {
      const productId = item.product_id;
      const quantity = parseStockQuantity(item.quantity);
      requestedByProduct.set(productId, (requestedByProduct.get(productId) || 0) + quantity);
    }

    const productIds = Array.from(requestedByProduct.keys());
    if (!productIds.length) return [];

    const hasReservedStock = await dbOrTrx.schema.hasColumn('inventory', 'quantity_reserved');
    const inventoryColumns = ['product_id', 'quantity_on_hand'];
    if (hasReservedStock) inventoryColumns.push('quantity_reserved');

    const [inventoryRows, productRows] = await Promise.all([
      dbOrTrx('inventory').select(inventoryColumns).whereIn('product_id', productIds),
      dbOrTrx('products').select('id', 'name', 'sku').whereIn('id', productIds)
    ]);

    const inventoryByProduct = new Map(inventoryRows.map(row => [row.product_id, row]));
    const productById = new Map(productRows.map(row => [row.id, row]));

    return productIds
      .map(productId => {
        const inventory = inventoryByProduct.get(productId);
        const product = productById.get(productId);
        const requested = requestedByProduct.get(productId) || 0;
        const onHand = parseStockQuantity(inventory?.quantity_on_hand);
        const reserved = hasReservedStock ? parseStockQuantity(inventory?.quantity_reserved) : 0;
        const available = Math.max(onHand - reserved, 0);
        return {
          productId,
          productName: product?.name || product?.sku || `Product #${productId}`,
          requested,
          available,
          onHand,
          reserved
        };
      })
      .filter(item => item.requested > item.available);
  }

  return {
    approverAllowsNegativeStock,
    getDocumentChargeTotals,
    getInvoiceStockShortages,
    getSettingValue,
    normalizeDocumentDays,
    normalizeDocumentPrefix,
    verifyManagerCredentials
  };
}

module.exports = {
  createCommerceDocumentHelpers
};
