/**
 * Quotation Commerce Handlers
 * Registers focused authenticated commerce IPC handlers.
 */

'use strict';

function registerCommerceQuotationHandlers(context, helpers = {}) {
  const {
    secureIpc,
    logger,
    getDatabase,
    loadDocumentItems,
    loadAuditLogs,
    normalizeDocumentDate,
    generateDocumentNumber,
    normalizeDocumentItems,
    recordAuditLog,
    markExpiredQuotations
  } = context;

  const {
    getDocumentChargeTotals,
    getSettingValue,
    normalizeDocumentDays,
    normalizeDocumentPrefix
  } = helpers;

  // ============ QUOTATIONS ============
  secureIpc.handle('get-quotations', async (event, filters = {}) => {
    try {
      const db = getDatabase();
      await markExpiredQuotations(db);
      
      let query = db('quotations')
        .select(
          'quotations.*',
          'customers.name as customer_name',
          'customers.email as customer_email',
          'customers.phone as customer_phone',
          'customers.address as customer_address'
        )
        .leftJoin('customers', 'quotations.customer_id', 'customers.id')
        .orderBy('quotations.created_at', 'desc');
      
      if (filters.status) {
        query = query.where('quotations.status', filters.status);
      }
      
      const quotations = await query.limit(filters.limit || 50);
      for (const quotation of quotations) {
        quotation.items = await loadDocumentItems(db, 'quotation_items', 'quotation_id', quotation.id);
        quotation.audit_logs = await loadAuditLogs(db, 'quotation', quotation.id);
      }
      
      return { success: true, data: quotations };
    } catch (error) {
      logger.error('Get quotations error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  secureIpc.handle('create-quotation', async (event, quotation) => {
    try {
      const db = getDatabase();
      const allowedStatuses = ['draft', 'sent', 'accepted', 'declined', 'expired', 'converted'];
      const status = allowedStatuses.includes(quotation.status) ? quotation.status : 'draft';
      const quoteItems = normalizeDocumentItems(quotation.items || []);
      if (!quoteItems.length) {
        throw new Error('Quotation requires at least one product line');
      }
      const totals = getDocumentChargeTotals(quotation);

      return await db.transaction(async (trx) => {
        const quotePrefix = normalizeDocumentPrefix(
          await getSettingValue(trx, ['doc_quote_prefix', 'quotation_prefix'], 'QUO'),
          'QUO'
        );
        const validityDays = normalizeDocumentDays(
          await getSettingValue(trx, ['doc_validity_days', 'quotation_validity_days'], '30'),
          30
        );
        const quoteNumber = await generateDocumentNumber(trx, 'quotations', 'quote_number', quotePrefix);
        const expiryDate = normalizeDocumentDate(quotation.expiryDate, validityDays);

        const [id] = await trx('quotations').insert({
          quote_number: quoteNumber,
          customer_id: quotation.customerId || null,
          quote_date: trx.fn.now(),
          expiry_date: expiryDate,
          subtotal: totals.subtotal,
          discount_amount: totals.discountAmount,
          tax_amount: totals.taxAmount,
          total_amount: totals.totalAmount,
          status,
          approval_status: status === 'draft' ? 'draft' : 'approved',
          notes: quotation.notes || null,
          created_by: event.auth.userId,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });

        for (const item of quoteItems) {
          await trx('quotation_items').insert({
            quotation_id: id,
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            discount_percent: item.discountPercent,
            total_price: item.totalPrice
          });
        }

        await recordAuditLog(trx, {
          action: status === 'sent' ? 'send' : 'create',
          entityType: 'quotation',
          entityId: id,
          userId: event.auth.userId,
          newValues: {
            quoteNumber,
            status,
            expiryDate,
            totalAmount: totals.totalAmount,
            itemCount: quoteItems.length
          }
        });

        return { success: true, data: { id, quoteNumber } };
      });
    } catch (error) {
      logger.error('Create quotation error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('update-quotation', async (event, id, quotation) => {
    try {
      const db = getDatabase();
      const quoteItems = normalizeDocumentItems(quotation.items || []);
      if (!quoteItems.length) {
        throw new Error('Quotation requires at least one product line');
      }
      const totals = getDocumentChargeTotals(quotation);

      return await db.transaction(async (trx) => {
        const oldQuotation = await trx('quotations').where('id', id).first();
        if (!oldQuotation) {
          throw new Error('Quotation not found');
        }
        const oldApprovalStatus = String(oldQuotation.approval_status || 'draft').toLowerCase();
        if (oldQuotation.status !== 'draft' || !['draft', 'rejected'].includes(oldApprovalStatus)) {
          throw new Error('Only editable quotation drafts can be updated');
        }

        await trx('quotations')
          .where('id', id)
          .update({
            customer_id: quotation.customerId || null,
            expiry_date: normalizeDocumentDate(quotation.expiryDate, 30),
            subtotal: totals.subtotal,
            discount_amount: totals.discountAmount,
            tax_amount: totals.taxAmount,
            total_amount: totals.totalAmount,
            status: 'draft',
            approval_status: 'draft',
            submitted_by: null,
            submitted_at: null,
            approved_by: null,
            approved_at: null,
            approved_name: null,
            approved_signature: null,
            approval_note: null,
            notes: quotation.notes || null,
            updated_at: trx.fn.now()
          });

        await trx('quotation_items').where('quotation_id', id).delete();

        for (const item of quoteItems) {
          await trx('quotation_items').insert({
            quotation_id: id,
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            discount_percent: item.discountPercent,
            total_price: item.totalPrice
          });
        }

        await recordAuditLog(trx, {
          action: 'update',
          entityType: 'quotation',
          entityId: id,
          userId: event.auth.userId,
          oldValues: oldQuotation,
          newValues: {
            status: 'draft',
            approvalStatus: 'draft',
            expiryDate: normalizeDocumentDate(quotation.expiryDate, 30),
            totalAmount: totals.totalAmount,
            itemCount: quoteItems.length
          }
        });

        return { success: true, data: { id } };
      });
    } catch (error) {
      logger.error('Update quotation error:', error.message);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerCommerceQuotationHandlers };
