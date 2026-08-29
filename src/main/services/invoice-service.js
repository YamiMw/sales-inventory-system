/**
 * Invoice Service
 * Coordinates business rules and persistence for invoice operations.
 */

const invoiceRepository = require('../repositories/invoice-repository');
const inventoryService = require('./inventory-service');
const logger = require('../utils/logger');

class InvoiceService {
  async createInvoice(invoiceData) {
    try {
      const { quotationId, customerId, items, dueDays, notes, userId } = invoiceData;
      
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      const invoiceDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (dueDays || 30));

      let subtotal = 0;
      for (const item of items) {
        subtotal += item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100);
      }

      const taxAmount = subtotal * 0.1;
      const totalAmount = subtotal - (invoiceData.discountAmount || 0);

      const invoice = await invoiceRepository.create({
        invoiceNumber,
        quotationId,
        customerId,
        invoiceDate,
        dueDate,
        items,
        subtotal,
        discountAmount: invoiceData.discountAmount || 0,
        taxAmount,
        totalAmount,
        notes,
        userId
      });

      if (!quotationId) {
        for (const item of items) {
          await inventoryService.adjustStock({
            productId: item.productId,
            quantity: -item.quantity,
            type: 'sale',
            reference: `Invoice ${invoiceNumber}`,
            userId
          });
        }
      }

      logger.info(`Invoice created: ${invoiceNumber}`);
      return invoice;
    } catch (error) {
      logger.error('Failed to create invoice:', error);
      throw error;
    }
  }

  async getInvoices(filters = {}) {
    try {
      return await invoiceRepository.findAll(filters);
    } catch (error) {
      logger.error('Failed to get invoices:', error);
      throw error;
    }
  }

  async getInvoiceById(id) {
    try {
      const invoice = await invoiceRepository.findById(id);
      if (!invoice) {
        throw new Error(`Invoice with id ${id} not found`);
      }
      return invoice;
    } catch (error) {
      logger.error(`Failed to get invoice ${id}:`, error);
      throw error;
    }
  }

  async recordPayment(payment) {
    try {
      const { invoiceId, amount, method, reference, notes, userId } = payment;
      
      const invoice = await this.getInvoiceById(invoiceId);
      
      const newAmountPaid = (invoice.amountPaid || 0) + amount;
      const status = newAmountPaid >= invoice.totalAmount ? 'paid' : 'partial';
      
      const result = await invoiceRepository.recordPayment({
        invoiceId,
        amount,
        method,
        reference,
        notes,
        userId
      });

      await invoiceRepository.updateStatus(invoiceId, status, newAmountPaid);

      logger.info(`Payment recorded for invoice ${invoice.invoiceNumber}: ${amount}`);
      return {
        paymentId: result.id,
        remainingBalance: invoice.totalAmount - newAmountPaid
      };
    } catch (error) {
      logger.error('Failed to record payment:', error);
      throw error;
    }
  }

  async voidInvoice(id, reason) {
    try {
      const invoice = await this.getInvoiceById(id);
      
      if (invoice.amountPaid > 0) {
        throw new Error('Cannot void invoice with payments');
      }

      await invoiceRepository.updateStatus(id, 'voided');
      
      logger.info(`Invoice ${invoice.invoiceNumber} voided: ${reason}`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to void invoice ${id}:`, error);
      throw error;
    }
  }

  async generatePDF(id) {
    try {
      const invoice = await this.getInvoiceById(id);
      return await invoiceRepository.generatePDF(invoice);
    } catch (error) {
      logger.error(`Failed to generate PDF for invoice ${id}:`, error);
      throw error;
    }
  }
}

module.exports = new InvoiceService();
