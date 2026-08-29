/**
 * Authorized IPC
 * Centralizes IPC authentication, permission policy, and secure handler registration.
 */

const {
  PERMISSIONS,
  getRolePermissions,
  normalizePermissions
} = require('../../shared/constants/roles');

const PUBLIC_CHANNELS = new Set([
  'get-system-info',
  'auth:login',
  'auth:validate',
  'auth:validate-token',
  'auth:setup-status',
  'auth:setup-admin'
]);

// Every non-public handler must appear here, even when authentication alone is enough.
const CHANNEL_PERMISSIONS = Object.freeze({
  'auth:logout': null,
  'auth:change-password': null,
  'db-test': PERMISSIONS.MANAGE_SETTINGS,
  'system:get-settings': null,
  'system:update-settings': PERMISSIONS.MANAGE_SETTINGS,
  'system:backup': PERMISSIONS.BACKUP_DATABASE,
  'system:backup-status': PERMISSIONS.BACKUP_DATABASE,
  'system:restore': PERMISSIONS.RESTORE_DATABASE,
  'printer:get-installed': PERMISSIONS.MANAGE_SETTINGS,
  'printer:test-print': PERMISSIONS.MANAGE_SETTINGS,
  'printer:print-receipt': PERMISSIONS.CREATE_SALE,
  'dashboard:get-stats': PERMISSIONS.VIEW_DASHBOARD,
  'dashboard:get-chart-data': PERMISSIONS.VIEW_DASHBOARD,
  'get-products': PERMISSIONS.VIEW_PRODUCTS,
  'get-product': PERMISSIONS.VIEW_PRODUCTS,
  'create-product': PERMISSIONS.CREATE_PRODUCT,
  'update-product': PERMISSIONS.EDIT_PRODUCT,
  'delete-product': PERMISSIONS.DELETE_PRODUCT,
  'search-products': PERMISSIONS.VIEW_PRODUCTS,
  'get-categories': PERMISSIONS.VIEW_PRODUCTS,
  'create-category': PERMISSIONS.CREATE_PRODUCT,
  'get-customers': PERMISSIONS.VIEW_CUSTOMERS,
  'get-customer': PERMISSIONS.VIEW_CUSTOMERS,
  'create-customer': PERMISSIONS.CREATE_CUSTOMER,
  'update-customer': PERMISSIONS.EDIT_CUSTOMER,
  'delete-customer': PERMISSIONS.DELETE_CUSTOMER,
  'search-customers': PERMISSIONS.VIEW_CUSTOMERS,
  'get-inventory': PERMISSIONS.VIEW_INVENTORY,
  'adjust-stock': PERMISSIONS.ADJUST_STOCK,
  'get-stock-transactions': PERMISSIONS.VIEW_INVENTORY,
  'get-low-stock': PERMISSIONS.VIEW_INVENTORY,
  'create-sale': PERMISSIONS.CREATE_SALE,
  'get-sales': PERMISSIONS.VIEW_SALES,
  'get-sale': PERMISSIONS.VIEW_SALES,
  'refund-sale': PERMISSIONS.PROCESS_REFUND,
  'get-quotations': PERMISSIONS.VIEW_QUOTATIONS,
  'create-quotation': PERMISSIONS.CREATE_QUOTATION,
  'update-quotation': PERMISSIONS.CREATE_QUOTATION,
  'delete-quotation': PERMISSIONS.DELETE_QUOTATION,
  'clear-quotations': PERMISSIONS.DELETE_QUOTATION,
  'get-invoices': PERMISSIONS.VIEW_INVOICES,
  'create-invoice': PERMISSIONS.CREATE_INVOICE,
  'update-invoice': PERMISSIONS.CREATE_INVOICE,
  'submit-document-for-approval': [PERMISSIONS.CREATE_INVOICE, PERMISSIONS.CREATE_QUOTATION],
  'approve-document-with-credentials': [PERMISSIONS.CREATE_INVOICE, PERMISSIONS.CREATE_QUOTATION],
  'void-invoice': PERMISSIONS.VOID_INVOICE,
  'record-invoice-payment': PERMISSIONS.CREATE_INVOICE,
  'clear-invoices': PERMISSIONS.DELETE_INVOICE,
  'export-document-pdf': PERMISSIONS.EXPORT_REPORTS,
  'get-users': PERMISSIONS.VIEW_USERS,
  'create-user': PERMISSIONS.CREATE_USER,
  'update-user': PERMISSIONS.EDIT_USER,
  'delete-user': PERMISSIONS.DELETE_USER,
  'clear-staff-users': PERMISSIONS.DELETE_USER,
  'set-user-status': PERMISSIONS.EDIT_USER,
  'reset-user-password': PERMISSIONS.EDIT_USER,
  'get-user-activity': PERMISSIONS.VIEW_AUDIT_LOGS,
  'get-role-permissions': PERMISSIONS.MANAGE_ROLES,
  'save-role-permissions': PERMISSIONS.MANAGE_ROLES,
  'audit:get': PERMISSIONS.VIEW_AUDIT_LOGS
});

const MUTATING_CHANNELS = new Set([
  'auth:change-password',
  'system:update-settings',
  'system:backup',
  'system:restore',
  'printer:test-print',
  'printer:print-receipt',
  'create-product',
  'update-product',
  'delete-product',
  'create-category',
  'create-customer',
  'update-customer',
  'delete-customer',
  'adjust-stock',
  'create-sale',
  'refund-sale',
  'create-quotation',
  'update-quotation',
  'delete-quotation',
  'clear-quotations',
  'create-invoice',
  'update-invoice',
  'submit-document-for-approval',
  'approve-document-with-credentials',
  'void-invoice',
  'record-invoice-payment',
  'clear-invoices',
  'create-user',
  'update-user',
  'delete-user',
  'clear-staff-users',
  'set-user-status',
  'reset-user-password',
  'save-role-permissions'
]);

function parsePermissions(value) {
  if (Array.isArray(value)) return normalizePermissions(value);
  if (!value) return [];
  try {
    return normalizePermissions(JSON.parse(value));
  } catch {
    return [];
  }
}

function getTokenEnvelope(args) {
  const envelope = args[0];
  // Authentication metadata is stripped before business handlers receive arguments.
  if (!envelope || typeof envelope !== 'object' || !envelope.__authContext) {
    return { token: null, args };
  }
  return {
    token: envelope.token || null,
    args: args.slice(1)
  };
}

function createAuthorizedIpc(options) {
  const {
    ipcMain,
    authService,
    getDatabase,
    auditService,
    logger = console
  } = options;

  async function authorize(event, channel, token) {
    const session = token ? await authService.validateToken(token) : null;
    if (!session) {
      await auditService.record({
        action: 'authorization_denied',
        entityType: 'ipc',
        userId: null,
        details: { channel, reason: 'missing_or_invalid_session' },
        event
      });
      return null;
    }

    const db = getDatabase();
    const user = await db('users').where('id', session.userId).first();
    const status = String(user?.status || '').toLowerCase();
    const active = user &&
      user.is_active !== false &&
      Number(user.is_active) !== 0 &&
      !['inactive', 'locked'].includes(status);
    if (!active) {
      await authService.invalidateUserSessions(session.userId);
      await auditService.record({
        action: 'authorization_denied',
        entityType: 'ipc',
        userId: session.userId,
        details: { channel, reason: 'account_inactive' },
        event
      });
      return null;
    }

    const role = String(user.role || '').toLowerCase();
    if (Boolean(user.password_must_change) &&
        channel !== 'auth:change-password' &&
        channel !== 'auth:logout') {
      await auditService.record({
        action: 'authorization_denied',
        entityType: 'ipc',
        userId: user.id,
        details: { channel, reason: 'password_change_required' },
        event
      });
      return null;
    }

    const roleRow = await db('role_permissions').where('role', role).first();
    // Built-in role grants form the baseline; database overrides and user grants extend it.
    const permissions = new Set(normalizePermissions([
      ...getRolePermissions(role),
      ...parsePermissions(roleRow?.permissions),
      ...parsePermissions(user.permissions)
    ]));
    const requiredPermission = CHANNEL_PERMISSIONS[channel];
    const hasRequiredPermission = Array.isArray(requiredPermission)
      ? requiredPermission.some((permission) => permissions.has(permission))
      : permissions.has(requiredPermission);
    if (requiredPermission && role !== 'admin' && !hasRequiredPermission) {
      await auditService.record({
        action: 'authorization_denied',
        entityType: 'ipc',
        userId: user.id,
        details: { channel, requiredPermission, reason: 'permission_not_granted' },
        event
      });
      return null;
    }

    return {
      token,
      userId: user.id,
      username: user.username,
      fullName: user.full_name,
      role,
      mustChangePassword: Boolean(user.password_must_change),
      permissions: [...permissions]
    };
  }

  return {
    handle(channel, handler) {
      // Fail closed during startup if a newly registered channel has no declared policy.
      if (!PUBLIC_CHANNELS.has(channel) &&
          !Object.prototype.hasOwnProperty.call(CHANNEL_PERMISSIONS, channel)) {
        throw new Error(`IPC channel lacks an authorization policy: ${channel}`);
      }

      ipcMain.handle(channel, async (event, ...rawArgs) => {
        const { token, args } = getTokenEnvelope(rawArgs);
        let actor = null;

        if (!PUBLIC_CHANNELS.has(channel)) {
          actor = await authorize(event, channel, token);
          if (!actor) {
            return {
              success: false,
              error: 'Authentication or permission check failed',
              code: 'FORBIDDEN'
            };
          }
          event.auth = actor;
        }

        try {
          const result = await handler(event, ...args);
          // Successful writes receive a common audit entry in addition to domain-specific logs.
          if (actor && MUTATING_CHANNELS.has(channel) && result?.success !== false) {
            await auditService.record({
              action: channel,
              entityType: channel.split(':')[0].split('-')[0],
              userId: actor.userId,
              details: { channel, success: true },
              event
            });
          }
          return result;
        } catch (error) {
          logger.error(`IPC ${channel} failed:`, error);
          throw error;
        }
      });
    }
  };
}

module.exports = {
  CHANNEL_PERMISSIONS,
  MUTATING_CHANNELS,
  PUBLIC_CHANNELS,
  createAuthorizedIpc
};

