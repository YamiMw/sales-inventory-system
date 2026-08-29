/**
 * Destructive Action Guard
 * Requires fresh credentials and explicit confirmation for destructive operations.
 */

const { normalizePermissions } = require('../../shared/constants/roles');

const DESTRUCTIVE_PERMISSIONS = Object.freeze({
  DELETE_QUOTATIONS: 'delete_quotation',
  CLEAR_DOCUMENT_HISTORY: 'delete_quotation',
  CLEAR_INVOICE_HISTORY: 'delete_invoice'
});

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

function senderMetadata(event) {
  const sender = event?.sender;
  const frame = event?.senderFrame;

  return {
    senderId: sender?.id || null,
    senderUrl: frame?.url || sender?.getURL?.() || null
  };
}

function createDestructiveActionGuard(options) {
  const {
    authService,
    getDatabase,
    logger = require('../utils/logger'),
    loadUser = async (db, userId) => db('users').where('id', userId).first(),
    loadRolePermissions = async (db, role) =>
      db('role_permissions').where('role', role).first(),
    writeDeniedAudit = async (db, entry) => {
      await db('audit_logs').insert({
        user_id: entry.userId || null,
        action: 'authorization_denied',
        entity_type: 'security',
        entity_id: null,
        old_values: null,
        new_values: JSON.stringify(entry.details),
        ip_address: null,
        created_at: db.fn.now()
      });
    }
  } = options;

  if (!authService || typeof authService.validateToken !== 'function') {
    throw new Error('A valid authentication service is required');
  }
  if (typeof getDatabase !== 'function') {
    throw new Error('A database provider is required');
  }

  async function deny({ db, event, session, action, entityType, permission, reason, code, error }) {
    const details = {
      attemptedAction: action,
      targetEntityType: entityType,
      requiredPermission: permission,
      denialReason: reason,
      ...senderMetadata(event)
    };

    try {
      // A failed audit write must not accidentally authorize the original operation.
      await writeDeniedAudit(db, {
        userId: session?.userId || null,
        details
      });
    } catch (auditError) {
      logger.error('Failed to record denied destructive action:', auditError.message);
    }

    logger.warn(
      `Denied destructive action ${action}: ${reason}` +
      (session?.username ? ` (user: ${session.username})` : '')
    );

    return {
      authorized: false,
      response: {
        success: false,
        error,
        code
      }
    };
  }

  return async function authorizeDestructiveAction({
    event,
    credentials = {},
    permission,
    action,
    entityType
  }) {
    const db = getDatabase();
    const token = typeof credentials === 'object' ? credentials.token : null;
    const session = token ? await authService.validateToken(token) : null;

    if (!session) {
      return deny({
        db,
        event,
        session: null,
        action,
        entityType,
        permission,
        reason: 'missing_or_invalid_session',
        code: 'AUTH_REQUIRED',
        error: 'Authentication is required for this action'
      });
    }

    const user = await loadUser(db, session.userId);
    const normalizedStatus = String(user?.status || '').toLowerCase();
    const isActive = user &&
      user.is_active !== false &&
      Number(user.is_active) !== 0 &&
      !['inactive', 'locked'].includes(normalizedStatus);

    if (!isActive) {
      return deny({
        db,
        event,
        session,
        action,
        entityType,
        permission,
        reason: 'account_missing_or_inactive',
        code: 'ACCOUNT_INACTIVE',
        error: 'The authenticated account is not active'
      });
    }

    const role = String(user.role || session.role || '').toLowerCase();
    const rolePermissionRow = await loadRolePermissions(db, role);
    // Destructive checks use current database permissions, not stale renderer state.
    const permissions = new Set([
      ...parsePermissions(user.permissions),
      ...parsePermissions(rolePermissionRow?.permissions)
    ]);
    const permitted = role === 'admin' || permissions.has(permission);

    if (!permitted) {
      return deny({
        db,
        event,
        session,
        action,
        entityType,
        permission,
        reason: 'permission_not_granted',
        code: 'FORBIDDEN',
        error: 'You do not have permission to perform this action'
      });
    }

    return {
      authorized: true,
      actor: {
        userId: user.id,
        username: user.username,
        role,
        permission
      }
    };
  };
}

module.exports = {
  DESTRUCTIVE_PERMISSIONS,
  createDestructiveActionGuard,
  parsePermissions
};
