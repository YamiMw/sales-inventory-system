/**
 * Invoice Commerce Handlers
 * Registers focused authenticated commerce IPC handlers.
 */

'use strict';

function registerCommerceInvoiceHandlers(context, helpers = {}) {
  const {
    secureIpc,
    logger,
    getDatabase,
    authService,
    applyStockDelta,
    resolveNegativeStockPolicy,
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
    markOverdueInvoices
  } = context;

  const {
    getDocumentChargeTotals,
    getSettingValue,
    normalizeDocumentDays,
    normalizeDocumentPrefix
  } = helpers;

  // ============ INVOICES ============
  secureIpc.handle('get-invoices', async (event, filters = {}) => {
    try {
      const db = getDatabase();
      await markOverdueInvoices(db);
      
      let query = db('invoices')
        .select(
          'invoices.*',
          'customers.name as customer_name',
          'customers.email as customer_email',
          'customers.phone as customer_phone',
          'customers.address as customer_address'
        )
        .leftJoin('customers', 'invoices.customer_id', 'customers.id')
        .orderBy('invoices.created_at', 'desc');
      
      if (filters.status === 'unpaid' || filters.status === 'issued') {
        query = query.whereIn('invoices.status', ['unpaid', 'issued']);
      } else if (filters.status) {
        query = query.where('invoices.status', filters.status);
      }
      
      const invoices = await query.limit(filters.limit || 50);
      for (const invoice of invoices) {
        invoice.items = await loadDocumentItems(db, 'invoice_items', 'invoice_id', invoice.id);
        invoice.payments = await loadInvoicePayments(db, invoice.id);
        invoice.audit_logs = await loadAuditLogs(db, 'invoice', invoice.id);
      }
      
      return { success: true, data: invoices };
    } catch (error) {
      logger.error('Get invoices error:', error.message);
      return { success: false, error: error.message, data: [] };
    }
  });

  secureIpc.handle('create-invoice', async (event, invoice) => {
    try {
      const db = getDatabase();
      const stockPolicy = await resolveNegativeStockPolicy({
        db,
        authService,
        credentials: { token: event.auth.token }
      });
      const actorUserId = event.auth.userId;
      const invoiceItems = normalizeDocumentItems(invoice.items || []);
      if (!invoiceItems.length) {
        throw new Error('Invoice requires at least one product line');
      }

      const totals = getDocumentChargeTotals(invoice);
      const totalAmount = totals.totalAmount;
      const requestedAmountPaid = normalizeMoney(invoice.amountPaid);
      if (requestedAmountPaid > totalAmount) {
        throw new Error(`Amount paid exceeds invoice total of ${totalAmount.toFixed(2)}`);
      }

      const status = resolveInvoiceStatus(invoice.status, totalAmount, requestedAmountPaid);
      const amountPaid = status === 'draft' ? 0 : requestedAmountPaid;
      const shouldAdjustStock = invoice.adjustStock !== false && status !== 'draft';
      
      return await db.transaction(async (trx) => {
        if (invoice.quotationId) {
          const quotation = await trx('quotations').where('id', invoice.quotationId).first();
          if (!quotation) {
            throw new Error('Quotation not found');
          }

          const today = new Date().toISOString().slice(0, 10);
          if (quotation.status === 'expired' || (quotation.expiry_date && quotation.expiry_date < today)) {
            throw new Error('Cannot convert an expired quotation');
          }
          if (quotation.status === 'converted') {
            throw new Error('Quotation has already been converted');
          }
        }

        const invoicePrefix = normalizeDocumentPrefix(
          await getSettingValue(trx, ['doc_invoice_prefix', 'invoice_prefix'], 'INV'),
          'INV'
        );
        const dueDays = normalizeDocumentDays(
          await getSettingValue(trx, ['doc_due_days', 'invoice_due_days'], '30'),
          30
        );
        const invoiceNumber = await generateDocumentNumber(trx, 'invoices', 'invoice_number', invoicePrefix);

        const [id] = await trx('invoices').insert({
          invoice_number: invoiceNumber,
          quotation_id: invoice.quotationId || null,
          customer_id: invoice.customerId || null,
          invoice_date: trx.fn.now(),
          due_date: normalizeDocumentDate(invoice.dueDate, dueDays),
          subtotal: totals.subtotal,
          discount_amount: totals.discountAmount,
          tax_amount: totals.taxAmount,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          stock_adjusted: shouldAdjustStock,
          status,
          approval_status: status === 'draft' ? 'draft' : 'approved',
          notes: invoice.notes || null,
          created_by: actorUserId,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });

        for (const item of invoiceItems) {
          await trx('invoice_items').insert({
            invoice_id: id,
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            discount_percent: item.discountPercent,
            total_price: item.totalPrice
          });

          if (shouldAdjustStock) {
            const stockResult = await applyStockDelta(trx, {
              productId: item.productId,
              delta: -item.quantity,
              allowNegativeStock: stockPolicy.allowed
            });

            await recordStockTransaction(trx, {
              productId: item.productId,
              type: 'invoice',
              quantity: -item.quantity,
              beforeQuantity: stockResult.beforeQuantity,
              afterQuantity: stockResult.afterQuantity,
              referenceType: 'invoice',
              referenceId: id,
              notes: stockResult.afterQuantity < 0
                ? `Invoice ${invoiceNumber}; negative stock authorized by ${stockPolicy.actor?.username}`
                : `Invoice ${invoiceNumber}`,
              userId: actorUserId
            });
          }
        }

        if (amountPaid > 0) {
          await trx('payments').insert({
            invoice_id: id,
            amount: amountPaid,
            payment_method: invoice.paymentMethod || 'cash',
            reference: invoice.paymentReference || `Initial payment ${invoiceNumber}`,
            notes: invoice.paymentNotes || null,
            created_by: actorUserId,
            created_at: trx.fn.now()
          });
        }

        if (invoice.quotationId) {
          await trx('quotations')
            .where('id', invoice.quotationId)
            .update({
              status: 'converted',
              updated_at: trx.fn.now()
            });

          await recordAuditLog(trx, {
            action: 'convert',
            entityType: 'quotation',
            entityId: invoice.quotationId,
            userId: actorUserId,
            newValues: { invoiceId: id, invoiceNumber }
          });
        }

        await recordAuditLog(trx, {
          action: status === 'draft' ? 'create_draft' : 'create',
          entityType: 'invoice',
          entityId: id,
          userId: actorUserId,
          newValues: {
            invoiceNumber,
            status,
            amountPaid,
            stockAdjusted: shouldAdjustStock,
            totalAmount,
            itemCount: invoiceItems.length
          }
        });

        return { success: true, data: { id, invoiceNumber } };
      });
    } catch (error) {
      logger.error('Create invoice error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('update-invoice', async (event, id, invoice) => {
    try {
      const db = getDatabase();
      const actorUserId = event.auth.userId;
      const invoiceItems = normalizeDocumentItems(invoice.items || []);
      if (!invoiceItems.length) {
        throw new Error('Invoice requires at least one product line');
      }

      const totals = getDocumentChargeTotals(invoice);
      const totalAmount = totals.totalAmount;
      const requestedAmountPaid = normalizeMoney(invoice.amountPaid);
      if (requestedAmountPaid > totalAmount) {
        throw new Error(`Amount paid exceeds invoice total of ${totalAmount.toFixed(2)}`);
      }

      return await db.transaction(async (trx) => {
        const oldInvoice = await trx('invoices').where('id', id).first();
        if (!oldInvoice) {
          throw new Error('Invoice not found');
        }
        const oldApprovalStatus = String(oldInvoice.approval_status || 'draft').toLowerCase();
        if (oldInvoice.status !== 'draft' || !['draft', 'rejected'].includes(oldApprovalStatus)) {
          throw new Error('Only editable invoice drafts can be updated');
        }

        const dueDays = normalizeDocumentDays(
          await getSettingValue(trx, ['doc_due_days', 'invoice_due_days'], '30'),
          30
        );

        await trx('invoices')
          .where('id', id)
          .update({
            customer_id: invoice.customerId || null,
            due_date: normalizeDocumentDate(invoice.dueDate, dueDays),
            subtotal: totals.subtotal,
            discount_amount: totals.discountAmount,
            tax_amount: totals.taxAmount,
            total_amount: totalAmount,
            amount_paid: 0,
            stock_adjusted: false,
            status: 'draft',
            approval_status: 'draft',
            submitted_by: null,
            submitted_at: null,
            approved_by: null,
            approved_at: null,
            approved_name: null,
            approved_signature: null,
            approval_note: null,
            notes: invoice.notes || null,
            updated_at: trx.fn.now()
          });

        await trx('invoice_items').where('invoice_id', id).delete();
        for (const item of invoiceItems) {
          await trx('invoice_items').insert({
            invoice_id: id,
            product_id: item.productId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            discount_percent: item.discountPercent,
            total_price: item.totalPrice
          });
        }

        await recordAuditLog(trx, {
          action: 'update_draft',
          entityType: 'invoice',
          entityId: id,
          userId: actorUserId,
          oldValues: oldInvoice,
          newValues: {
            status: 'draft',
            approvalStatus: 'draft',
            totalAmount,
            itemCount: invoiceItems.length
          }
        });

        return { success: true, data: { id, invoiceNumber: oldInvoice.invoice_number } };
      });
    } catch (error) {
      logger.error('Update invoice error:', error.message);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerCommerceInvoiceHandlers };
