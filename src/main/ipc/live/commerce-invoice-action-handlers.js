/**
 * Invoice Action Commerce Handlers
 * Registers focused authenticated commerce IPC handlers.
 */

'use strict';

function registerCommerceInvoiceActionHandlers(context) {
  const {
    secureIpc,
    logger,
    getDatabase,
    parseStockQuantity,
    recordStockTransaction,
    normalizeMoney,
    resolveInvoiceStatus,
    recordAuditLog
  } = context;

  secureIpc.handle('void-invoice', async (event, id, reason = null) => {
    try {
      const db = getDatabase();
      return await db.transaction(async (trx) => {
        const invoice = await trx('invoices').where('id', id).first();
        if (!invoice) {
          throw new Error('Invoice not found');
        }

        if (invoice.status === 'voided') {
          return { success: true };
        }

        const items = await trx('invoice_items').where('invoice_id', id);
        if (invoice.stock_adjusted) {
          for (const item of items) {
            const inventory = await trx('inventory')
              .where('product_id', item.product_id)
              .first();
            const currentQuantity = parseStockQuantity(inventory?.quantity_on_hand);
            const restoredQuantity = currentQuantity + parseStockQuantity(item.quantity);

            if (inventory) {
              await trx('inventory')
                .where('product_id', item.product_id)
                .update({
                  quantity_on_hand: restoredQuantity,
                  updated_at: trx.fn.now()
                });
            } else {
              await trx('inventory').insert({
                product_id: item.product_id,
                quantity_on_hand: restoredQuantity,
                updated_at: trx.fn.now()
              });
            }

            await recordStockTransaction(trx, {
              productId: item.product_id,
              type: 'invoice_void',
              quantity: parseStockQuantity(item.quantity),
              beforeQuantity: currentQuantity,
              afterQuantity: restoredQuantity,
              referenceType: 'invoice',
              referenceId: id,
              notes: `Voided invoice ${invoice.invoice_number}`,
              userId: event.auth.userId
            });
          }
        }

        await trx('invoices')
          .where('id', id)
          .update({
            status: 'voided',
            stock_adjusted: false,
            notes: reason || invoice.notes || 'Voided',
            updated_at: trx.fn.now()
          });

        await recordAuditLog(trx, {
          action: 'void',
          entityType: 'invoice',
          entityId: id,
          userId: event.auth.userId,
          oldValues: invoice,
          newValues: {
            status: 'voided',
            reason: reason || 'Voided',
            stockRestored: Boolean(invoice.stock_adjusted)
          }
        });

        return { success: true };
      });
    } catch (error) {
      logger.error('Void invoice error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('record-invoice-payment', async (event, payment) => {
    try {
      const db = getDatabase();
      const invoiceId = payment.invoiceId || payment.invoice_id;
      const amount = normalizeMoney(payment.amount);
      if (!invoiceId) {
        throw new Error('Invoice is required');
      }
      if (amount <= 0) {
        throw new Error('Payment amount must be greater than zero');
      }

      return await db.transaction(async (trx) => {
        const invoice = await trx('invoices').where('id', invoiceId).first();
        if (!invoice) {
          throw new Error('Invoice not found');
        }
        if (invoice.status === 'voided') {
          throw new Error('Cannot record payment on a voided invoice');
        }

        const totalAmount = normalizeMoney(invoice.total_amount);
        const currentPaid = normalizeMoney(invoice.amount_paid);
        const balanceDue = Math.max(totalAmount - currentPaid, 0);
        if (balanceDue <= 0) {
          throw new Error('Invoice is already fully paid');
        }
        if (amount > balanceDue) {
          throw new Error(`Payment exceeds balance due of ${balanceDue.toFixed(2)}`);
        }

        const newPaid = currentPaid + amount;
        const newStatus = resolveInvoiceStatus('issued', totalAmount, newPaid);

        await trx('payments').insert({
          invoice_id: invoiceId,
          amount,
          payment_method: payment.method || payment.paymentMethod || 'cash',
          reference: payment.reference || null,
          notes: payment.notes || null,
          created_by: event.auth.userId,
          created_at: trx.fn.now()
        });

        await trx('invoices')
          .where('id', invoiceId)
          .update({
            amount_paid: newPaid,
            status: newStatus,
            updated_at: trx.fn.now()
          });

        await recordAuditLog(trx, {
          action: 'payment',
          entityType: 'invoice',
          entityId: invoiceId,
          userId: event.auth.userId,
          oldValues: {
            amountPaid: currentPaid,
            status: invoice.status
          },
          newValues: {
            amountPaid: newPaid,
            paymentAmount: amount,
            status: newStatus
          }
        });

        return {
          success: true,
          data: {
            amountPaid: newPaid,
            status: newStatus,
            balanceDue: Math.max(totalAmount - newPaid, 0)
          }
        };
      });
    } catch (error) {
      logger.error('Record invoice payment error:', error.message);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerCommerceInvoiceActionHandlers };
