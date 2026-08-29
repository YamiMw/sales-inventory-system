/**
 * User Handlers
 * Registers authenticated IPC handlers for user handlers operations.
 */

'use strict';

function registerUserHandlers(context) {
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

  // ============ USERS ============
  const parsePermissions = (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const serializePermissions = (value) => JSON.stringify(parsePermissions(value));
  const passwordRequirementMessage = 'Password must be at least 12 characters and include uppercase, lowercase, number, and symbol';

  const normalizeUserStatus = (status, isActive = true) => {
    const value = String(status || '').trim().toLowerCase();
    if (value === 'locked') return 'locked';
    if (value === 'inactive' || isActive === false || Number(isActive) === 0) return 'inactive';
    return 'active';
  };

  const logUserActivity = async (dbOrTransaction, user, action, details = '') => {
    await dbOrTransaction('user_activity').insert({
      user_id: user?.id || null,
      username: user?.username || null,
      action,
      details,
      created_at: dbOrTransaction.fn.now()
    });
  };

  const detachUserReferences = async (trx, userId) => {
    const references = [
      ['sales', 'created_by'],
      ['quotations', 'created_by'],
      ['invoices', 'created_by'],
      ['stock_transactions', 'created_by'],
      ['payments', 'created_by'],
      ['audit_logs', 'user_id']
    ];

    for (const [table, column] of references) {
      if (await trx.schema.hasTable(table) && await trx.schema.hasColumn(table, column)) {
        await trx(table).where(column, userId).update({ [column]: null });
      }
    }
  };

  secureIpc.handle('get-users', async () => {
    try {
      const db = getDatabase();
      const users = await db('users')
        .select('id', 'username', 'email', 'full_name', 'role', 'is_active', 'status', 'permissions', 'last_login', 'created_at', 'updated_at')
        .orderBy('username');
      return {
        success: true,
        data: users.map((user) => ({
          ...user,
          status: normalizeUserStatus(user.status, user.is_active),
          permissions: parsePermissions(user.permissions)
        }))
      };
    } catch (error) {
      logger.error('Get users error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  secureIpc.handle('create-user', async (event, user) => {
    try {
      const db = getDatabase();
      if (!passwordUtils.validatePasswordStrength(user.password)) {
        return { success: false, error: passwordRequirementMessage };
      }
      const passwordHash = await passwordUtils.hashPassword(user.password);
      const status = normalizeUserStatus(user.status);
      const [id] = await db('users').insert({
        username: user.username,
        email: user.email || null,
        password_hash: passwordHash,
        full_name: user.fullName,
        role: String(user.role || 'Cashier').toLowerCase(),
        is_active: status === 'active',
        status,
        permissions: serializePermissions(user.permissions),
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });

      const createdUser = await db('users').where('id', id).first();
      await logUserActivity(db, createdUser, 'User created', `Role: ${user.role || 'Cashier'}`);

      return {
        success: true,
        data: {
          id,
          username: user.username,
          email: user.email || '',
          full_name: user.fullName,
          role: String(user.role || 'Cashier').toLowerCase(),
          is_active: status === 'active',
          status,
          permissions: parsePermissions(user.permissions),
          last_login: null
        }
      };
    } catch (error) {
      logger.error('Create user error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('update-user', async (event, id, user) => {
    try {
      const db = getDatabase();
      const existing = await db('users').where('id', id).first();
      if (!existing) return { success: false, error: 'User not found' };

      const isMainAdmin = String(existing.username).toLowerCase() === 'admin';
      const status = isMainAdmin
        ? normalizeUserStatus(existing.status, existing.is_active)
        : normalizeUserStatus(user.status);

      await db('users')
        .where('id', id)
        .update({
          username: isMainAdmin ? existing.username : user.username,
          email: user.email || null,
          full_name: user.fullName,
          role: isMainAdmin ? 'admin' : String(user.role || 'Cashier').toLowerCase(),
          is_active: status === 'active',
          status,
          permissions: serializePermissions(user.permissions),
          updated_at: db.fn.now()
        });

      const updatedUser = await db('users').where('id', id).first();
      await authService.invalidateUserSessions(id);
      await logUserActivity(db, updatedUser, 'User updated', `Role: ${updatedUser.role}; status: ${status}`);
      return {
        success: true,
        data: {
          ...updatedUser,
          permissions: parsePermissions(updatedUser.permissions)
        }
      };
    } catch (error) {
      logger.error('Update user error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('delete-user', async (event, id) => {
    try {
      const db = getDatabase();
      const user = await db('users').where('id', id).first();
      if (!user) return { success: false, error: 'User not found' };
      if (String(user.username).toLowerCase() === 'admin') {
        return { success: false, error: 'Cannot delete the admin account' };
      }
      await db.transaction(async (trx) => {
        await logUserActivity(trx, user, 'User deleted', `Deleted account ${user.username}`);
        await detachUserReferences(trx, user.id);
        await trx('users').where('id', id).del();
      });
      await authService.invalidateUserSessions(id);
      return { success: true };
    } catch (error) {
      logger.error('Delete user error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('clear-staff-users', async () => {
    try {
      const db = getDatabase();
      const staff = await db('users').whereNotRaw('LOWER(username) = ?', ['admin']);
      await db.transaction(async (trx) => {
        for (const user of staff) {
          await logUserActivity(trx, user, 'User deleted', 'Removed by Clear Staff');
          await detachUserReferences(trx, user.id);
        }
        await trx('users').whereNotRaw('LOWER(username) = ?', ['admin']).del();
      });
      return { success: true, data: { deleted: staff.length } };
    } catch (error) {
      logger.error('Clear staff users error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('set-user-status', async (event, id, requestedStatus) => {
    try {
      const db = getDatabase();
      const user = await db('users').where('id', id).first();
      if (!user) return { success: false, error: 'User not found' };
      if (String(user.username).toLowerCase() === 'admin') {
        return { success: false, error: 'The main administrator must remain active' };
      }

      const status = normalizeUserStatus(requestedStatus);
      await db('users').where('id', id).update({
        status,
        is_active: status === 'active',
        updated_at: db.fn.now()
      });
      await authService.invalidateUserSessions(id);
      await logUserActivity(db, user, 'Account status changed', `Status: ${status}`);
      return { success: true, data: { status } };
    } catch (error) {
      logger.error('Set user status error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('reset-user-password', async (event, id, newPassword) => {
    try {
      const db = getDatabase();
      if (!passwordUtils.validatePasswordStrength(newPassword)) {
        return { success: false, error: passwordRequirementMessage };
      }
      const user = await db('users').where('id', id).first();
      if (!user) return { success: false, error: 'User not found' };

      const passwordHash = await passwordUtils.hashPassword(newPassword);
      await db('users').where('id', id).update({
        password_hash: passwordHash,
        password_must_change: true,
        updated_at: db.fn.now()
      });
      await authService.invalidateUserSessions(id);
      await logUserActivity(db, user, 'Password reset', 'Password changed by an administrator');
      return { success: true };
    } catch (error) {
      logger.error('Reset user password error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('get-user-activity', async (event, id) => {
    try {
      const db = getDatabase();
      const user = await db('users').where('id', id).first();
      const query = db('user_activity')
        .select('id', 'user_id', 'username', 'action', 'details', 'created_at')
        .orderBy('created_at', 'desc')
        .limit(100);
      const activity = user
        ? await query.where((builder) => builder.where('user_id', id).orWhere('username', user.username))
        : await query.where('user_id', id);
      return { success: true, data: activity };
    } catch (error) {
      logger.error('Get user activity error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  secureIpc.handle('get-role-permissions', async () => {
    try {
      const db = getDatabase();
      const rows = await db('role_permissions').select('role', 'permissions');
      const rolePermissions = {};
      rows.forEach((row) => {
        const role = String(row.role || '').replace(/^\w/, (letter) => letter.toUpperCase());
        rolePermissions[role] = parsePermissions(row.permissions);
      });
      return { success: true, data: rolePermissions };
    } catch (error) {
      logger.error('Get role permissions error:', error.message);
      return { success: false, error: error.message, data: {} };
    }
  });

  secureIpc.handle('save-role-permissions', async (event, rolePermissions) => {
    try {
      const db = getDatabase();
      await db.transaction(async (trx) => {
        for (const [role, permissions] of Object.entries(rolePermissions || {})) {
          const normalizedRole = String(role).toLowerCase();
          const existing = await trx('role_permissions').where('role', normalizedRole).first();
          const values = {
            permissions: serializePermissions(permissions),
            updated_at: trx.fn.now()
          };
          if (existing) {
            await trx('role_permissions').where('role', normalizedRole).update(values);
          } else {
            await trx('role_permissions').insert({ role: normalizedRole, ...values });
          }
        }
      });
      authService.invalidateAllSessions();
      return { success: true };
    } catch (error) {
      logger.error('Save role permissions error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('audit:get', async (event, filters = {}) => {
    try {
      return { success: true, data: await auditService.query(filters) };
    } catch (error) {
      logger.error('Get audit logs error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  // ============ DATABASE TEST ============
  secureIpc.handle('db-test', async () => {
    try {
      const db = getDatabase();
      const result = await db.raw('SELECT 1 as test');
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerUserHandlers };
