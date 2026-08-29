/**
 * Approval Commerce Handlers
 * Registers focused authenticated commerce IPC handlers.
 */

'use strict';

function registerCommerceApprovalHandlers(context, helpers = {}) {
  const {
    secureIpc,
    logger,
    getDatabase,
    applyStockDelta,
    parseStockQuantity,
    recordStockTransaction,
    normalizeMoney,
    resolveInvoiceStatus,
    recordAuditLog
  } = context;

  const {
    approverAllowsNegativeStock,
    getInvoiceStockShortages,
    verifyManagerCredentials
  } = helpers;

  secureIpc.handle('submit-document-for-approval', async (event, type, id) => {
    try {
      const normalizedType = String(type || '').toLowerCase();
      const config = {
        invoice: { table: 'invoices', entityType: 'invoice', label: 'invoice' },
        quotation: { table: 'quotations', entityType: 'quotation', label: 'quotation' }
      }[normalizedType];
      if (!config) {
        throw new Error('Only invoices and quotations require manager approval');
      }
      const db = getDatabase();

      return await db.transaction(async (trx) => {
        const documentRow = await trx(config.table).where('id', id).first();
        if (!documentRow) {
          throw new Error(`${config.label.charAt(0).toUpperCase()}${config.label.slice(1)} not found`);
        }
        const approvalStatus = String(documentRow.approval_status || 'draft').toLowerCase();
        if (documentRow.status !== 'draft' || !['draft', 'rejected'].includes(approvalStatus)) {
          throw new Error(`Only editable ${config.label} drafts can be submitted for approval`);
        }

        await trx(config.table)
          .where('id', id)
          .update({
            approval_status: 'pending',
            submitted_by: event.auth.userId,
            submitted_at: trx.fn.now(),
            approved_by: null,
            approved_at: null,
            approved_name: null,
            approved_signature: null,
            approval_note: null,
            updated_at: trx.fn.now()
          });

        await recordAuditLog(trx, {
          action: 'submit_for_approval',
          entityType: config.entityType,
          entityId: id,
          userId: event.auth.userId,
          oldValues: { approvalStatus },
          newValues: { approvalStatus: 'pending' }
        });

        return { success: true, data: { id, approvalStatus: 'pending' } };
      });
    } catch (error) {
      logger.error('Submit document for approval error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('approve-document-with-credentials', async (event, type, id, credentials = {}) => {
    try {
      const normalizedType = String(type || '').toLowerCase();
      if (!['invoice', 'quotation'].includes(normalizedType)) {
        throw new Error('Only invoices and quotations require manager approval');
      }
      const db = getDatabase();
      const approver = await verifyManagerCredentials(db, credentials);
      const requestedAmountPaid = normalizeMoney(credentials.amountPaid);

      return await db.transaction(async (trx) => {
        if (normalizedType === 'quotation') {
          const quotation = await trx('quotations').where('id', id).first();
          if (!quotation) {
            throw new Error('Quotation not found');
          }
          const approvalStatus = String(quotation.approval_status || 'draft').toLowerCase();
          if (quotation.status !== 'draft' || !['draft', 'rejected', 'pending'].includes(approvalStatus)) {
            throw new Error('Only an editable quotation draft can be approved');
          }

          const items = await trx('quotation_items').where('quotation_id', id);
          if (!items.length) {
            throw new Error('Quotation requires at least one product line');
          }

          const approvalNote = String(credentials.note || '').trim();
          const finalStatus = 'sent';

          await trx('quotations')
            .where('id', id)
            .update({
              status: finalStatus,
              approval_status: 'approved',
              submitted_by: quotation.submitted_by || event.auth.userId,
              submitted_at: quotation.submitted_at || trx.fn.now(),
              approved_by: approver.userId,
              approved_at: trx.fn.now(),
              approved_name: approver.fullName,
              approved_signature: null,
              approval_note: approvalNote || null,
              updated_at: trx.fn.now()
            });

          await recordAuditLog(trx, {
            action: 'approve_finalize',
            entityType: 'quotation',
            entityId: id,
            userId: approver.userId,
            oldValues: {
              status: quotation.status,
              approvalStatus
            },
            newValues: {
              status: finalStatus,
              approvalStatus: 'approved',
              approvedBy: approver.username
            }
          });

          return {
            success: true,
            data: {
              id,
              status: finalStatus,
              approvalStatus: 'approved',
              approvedName: approver.fullName
            }
          };
        }

        const invoice = await trx('invoices').where('id', id).first();
        if (!invoice) {
          throw new Error('Invoice not found');
        }
        const approvalStatus = String(invoice.approval_status || 'draft').toLowerCase();
        if (invoice.status !== 'draft' || !['draft', 'rejected', 'pending'].includes(approvalStatus)) {
          throw new Error('Only an editable invoice draft can be approved');
        }

        const items = await trx('invoice_items').where('invoice_id', id);
        if (!items.length) {
          throw new Error('Invoice requires at least one product line');
        }

        const totalAmount = normalizeMoney(invoice.total_amount);
        if (requestedAmountPaid > totalAmount) {
          throw new Error(`Amount paid exceeds invoice total of ${totalAmount.toFixed(2)}`);
        }
        const amountPaid = Math.max(0, requestedAmountPaid);
        const finalStatus = amountPaid > 0
          ? resolveInvoiceStatus('issued', totalAmount, amountPaid)
          : 'issued';
        const stockShortages = invoice.stock_adjusted
          ? []
          : await getInvoiceStockShortages(trx, items);
        const shouldAdjustStock = !invoice.stock_adjusted && stockShortages.length === 0;

        if (shouldAdjustStock) {
          const allowNegativeStock = await approverAllowsNegativeStock(trx, approver);
          for (const item of items) {
            const quantity = parseStockQuantity(item.quantity);
            const stockResult = await applyStockDelta(trx, {
              productId: item.product_id,
              delta: -quantity,
              allowNegativeStock
            });

            await recordStockTransaction(trx, {
              productId: item.product_id,
              type: 'invoice',
              quantity: -quantity,
              beforeQuantity: stockResult.beforeQuantity,
              afterQuantity: stockResult.afterQuantity,
              referenceType: 'invoice',
              referenceId: id,
              notes: stockResult.afterQuantity < 0
                ? `Invoice ${invoice.invoice_number}; negative stock authorized by ${approver.username}`
                : `Invoice ${invoice.invoice_number}; approved by ${approver.username}`,
              userId: approver.userId
            });
          }
        }

        const shortageSummary = stockShortages
          .map(item => `${item.productName}: requested ${item.requested}, available ${item.available}`)
          .join('; ');
        const approvalNote = String(credentials.note || '').trim();
        const stockNote = shortageSummary
          ? `Stock not deducted due to insufficient stock (${shortageSummary})`
          : '';
        const finalApprovalNote = [approvalNote, stockNote].filter(Boolean).join('\n');

        if (amountPaid > 0) {
          await trx('payments').insert({
            invoice_id: id,
            amount: amountPaid,
            payment_method: credentials.paymentMethod || 'cash',
            reference: credentials.paymentReference || `Manager approval ${invoice.invoice_number}`,
            notes: credentials.paymentNotes || null,
            created_by: approver.userId,
            created_at: trx.fn.now()
          });
        }

        await trx('invoices')
          .where('id', id)
          .update({
            amount_paid: amountPaid,
            stock_adjusted: shouldAdjustStock || Boolean(invoice.stock_adjusted),
            status: finalStatus,
            approval_status: 'approved',
            submitted_by: invoice.submitted_by || event.auth.userId,
            submitted_at: invoice.submitted_at || trx.fn.now(),
            approved_by: approver.userId,
            approved_at: trx.fn.now(),
            approved_name: approver.fullName,
            approved_signature: null,
            approval_note: finalApprovalNote || null,
            updated_at: trx.fn.now()
          });

        await recordAuditLog(trx, {
          action: 'approve_finalize',
          entityType: 'invoice',
          entityId: id,
          userId: approver.userId,
          oldValues: {
            status: invoice.status,
            approvalStatus
          },
          newValues: {
            status: finalStatus,
            approvalStatus: 'approved',
            approvedBy: approver.username,
            amountPaid,
            stockAdjusted: shouldAdjustStock || Boolean(invoice.stock_adjusted),
            stockAdjustmentSkipped: Boolean(stockShortages.length),
            stockShortages
          }
        });

        return {
          success: true,
          data: {
            id,
            status: finalStatus,
            approvalStatus: 'approved',
            approvedName: approver.fullName,
            stockAdjusted: shouldAdjustStock || Boolean(invoice.stock_adjusted),
            stockAdjustmentSkipped: Boolean(stockShortages.length),
            stockShortages
          }
        };
      });
    } catch (error) {
      logger.error('Approve document error:', error.message);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerCommerceApprovalHandlers };
