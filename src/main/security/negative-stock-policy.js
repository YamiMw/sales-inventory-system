/**
 * Negative Stock Policy
 * Resolves whether an authenticated actor may bypass negative-stock protection.
 */

const { normalizePermissions } = require('../../shared/constants/roles');

const NEGATIVE_STOCK_PERMISSION = 'allow_negative_stock';

function parseBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function parsePermissions(value) {
  if (Array.isArray(value)) return normalizePermissions(value);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizePermissions(parsed) : [];
  } catch {
    return [];
  }
}

async function resolveNegativeStockPolicy({ db, authService, credentials = {} }) {
  const setting = await db('settings')
    .select('value')
    .where('key', 'allow_negative_stock')
    .first();

  if (!parseBoolean(setting?.value)) {
    return { allowed: false, enabled: false, actor: null };
  }

  const token = credentials && typeof credentials === 'object'
    ? credentials.token
    : null;
  const session = token ? await authService.validateToken(token) : null;
  if (!session) {
    return { allowed: false, enabled: true, actor: null };
  }

  const user = await db('users').where('id', session.userId).first();
  const status = String(user?.status || '').toLowerCase();
  const active = user &&
    user.is_active !== false &&
    Number(user.is_active) !== 0 &&
    !['inactive', 'locked'].includes(status);
  if (!active) {
    return { allowed: false, enabled: true, actor: null };
  }

  const role = String(user.role || session.role || '').toLowerCase();
  const rolePermissionRow = await db('role_permissions').where('role', role).first();
  const permissions = new Set([
    ...parsePermissions(user.permissions),
    ...parsePermissions(rolePermissionRow?.permissions)
  ]);
  const allowed = role === 'admin' || permissions.has(NEGATIVE_STOCK_PERMISSION);

  return {
    allowed,
    enabled: true,
    actor: {
      userId: user.id,
      username: user.username,
      role
    }
  };
}

module.exports = {
  NEGATIVE_STOCK_PERMISSION,
  resolveNegativeStockPolicy
};
