/**
 * Destructive Document Handlers
 * Registers guarded IPC operations that delete or clear business documents.
 */

const {
  DESTRUCTIVE_PERMISSIONS
} = require('../security/destructive-action-guard');

function normalizeReason(credentials) {
  return String(credentials?.reason || '').trim();
}

function validateReason(credentials) {
  const reason = normalizeReason(credentials);
  if (reason.length < 4) {
    return {
      success: false,
      error: 'A reason of at least 4 characters is required',
      code: 'REASON_REQUIRED'
    };
  }
  return null;
}

function trustedCredentials(event, credentials) {
  return event?.auth?.token
    ? { ...credentials, token: event.auth.token }
    : credentials;
}

function registerDestructiveDocumentHandlers(options) {
  const {
    ipcMain,
    getDatabase,
    authorizeDestructiveAction,
    recordAuditLog,
    logger
  } = options;

  ipcMain.handle('delete-quotation', async (event, id, credentials = {}) => {
    try {
      const authorization = await authorizeDestructiveAction({
        event,
        credentials: trustedCredentials(event, credentials),
        permission: DESTRUCTIVE_PERMISSIONS.DELETE_QUOTATIONS,
        action: 'delete_quotation',
        entityType: 'quotation'
      });
      if (!authorization.authorized) return authorization.response;

      const invalidReason = validateReason(credentials);
      if (invalidReason) return invalidReason;

      const db = getDatabase();
      return await db.transaction(async (trx) => {
        const oldQuotation = await trx('quotations').where('id', id).first();
        if (!oldQuotation) {
          return { success: false, error: 'Quotation not found', code: 'NOT_FOUND' };
        }

        await trx('invoices').where('quotation_id', id).update({ quotation_id: null });
        await trx('quotation_items').where('quotation_id', id).delete();
        await trx('quotations').where('id', id).delete();
        await recordAuditLog(trx, {
          action: 'delete',
          entityType: 'quotation',
          entityId: id,
          userId: authorization.actor.userId,
          oldValues: oldQuotation,
          newValues: {
            reason: normalizeReason(credentials),
            authorizedBy: authorization.actor.username
          }
        });
        return { success: true };
      });
    } catch (error) {
      logger.error('Delete quotation error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clear-quotations', async (event, credentials = {}) => {
    try {
      const authorization = await authorizeDestructiveAction({
        event,
        credentials: trustedCredentials(event, credentials),
        permission: DESTRUCTIVE_PERMISSIONS.CLEAR_DOCUMENT_HISTORY,
        action: 'clear_quotation_history',
        entityType: 'quotation'
      });
      if (!authorization.authorized) return authorization.response;

      const invalidReason = validateReason(credentials);
      if (invalidReason) return invalidReason;

      const db = getDatabase();
      return await db.transaction(async (trx) => {
        const count = await trx('quotations').count('* as count').first();
        await trx('invoices').whereNotNull('quotation_id').update({ quotation_id: null });
        await trx('quotation_items').delete();
        await trx('quotations').delete();
        await recordAuditLog(trx, {
          action: 'clear',
          entityType: 'quotation',
          entityId: null,
          userId: authorization.actor.userId,
          newValues: {
            clearedCount: Number(count?.count || 0),
            reason: normalizeReason(credentials),
            authorizedBy: authorization.actor.username
          }
        });
        return { success: true, data: { cleared: Number(count?.count || 0) } };
      });
    } catch (error) {
      logger.error('Clear quotations error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clear-invoices', async (event, credentials = {}) => {
    try {
      const authorization = await authorizeDestructiveAction({
        event,
        credentials: trustedCredentials(event, credentials),
        permission: DESTRUCTIVE_PERMISSIONS.CLEAR_INVOICE_HISTORY,
        action: 'clear_invoice_history',
        entityType: 'invoice'
      });
      if (!authorization.authorized) return authorization.response;

      const invalidReason = validateReason(credentials);
      if (invalidReason) return invalidReason;

      const db = getDatabase();
      return await db.transaction(async (trx) => {
        const count = await trx('invoices').count('* as count').first();
        await trx('payments').delete();
        await trx('invoice_items').delete();
        await trx('invoices').delete();
        await recordAuditLog(trx, {
          action: 'clear',
          entityType: 'invoice',
          entityId: null,
          userId: authorization.actor.userId,
          newValues: {
            clearedCount: Number(count?.count || 0),
            reason: normalizeReason(credentials),
            authorizedBy: authorization.actor.username
          }
        });
        return { success: true, data: { cleared: Number(count?.count || 0) } };
      });
    } catch (error) {
      logger.error('Clear invoices error:', error.message);
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  registerDestructiveDocumentHandlers,
  validateReason
};
