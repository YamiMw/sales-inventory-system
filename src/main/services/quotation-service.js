/**
 * Quotation Service
 * Coordinates business rules and persistence for quotation operations.
 */

const quotationRepository = require('../repositories/quotation-repository');
const inventoryService = require('./inventory-service');
const invoiceService = require('./invoice-service');
const logger = require('../utils/logger');

class QuotationService {
  async createQuotation(quotationData) {
    try {
      const { customerId, items, validityDays, notes, terms, userId } = quotationData;
      
      const quoteNumber = `QUO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      const quoteDate = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (validityDays || 30));

      let subtotal = 0;
      const processedItems = [];
      
      for (const item of items) {
        const inventory = await inventoryService.getProductInventory(item.productId);
        const isBackorder = !inventory || inventory.quantityAvailable < item.quantity;
        
        const itemTotal = item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100);
        subtotal += itemTotal;
        
        processedItems.push({
          ...item,
          isBackorder
        });
      }

      const taxAmount = subtotal * 0.1;
      const totalAmount = subtotal - (quotationData.discountAmount || 0);

      const quotation = await quotationRepository.create({
        quoteNumber,
        customerId,
        quoteDate,
        expiryDate,
        items: processedItems,
        subtotal,
        discountAmount: quotationData.discountAmount || 0,
        taxAmount,
        totalAmount,
        notes,
        terms,
        userId
      });

      logger.info(`Quotation created: ${quoteNumber}`);
      return quotation;
    } catch (error) {
      logger.error('Failed to create quotation:', error);
      throw error;
    }
  }

  async getQuotations(filters = {}) {
    try {
      return await quotationRepository.findAll(filters);
    } catch (error) {
      logger.error('Failed to get quotations:', error);
      throw error;
    }
  }

  async getQuotationById(id) {
    try {
      const quotation = await quotationRepository.findById(id);
      if (!quotation) {
        throw new Error(`Quotation with id ${id} not found`);
      }
      return quotation;
    } catch (error) {
      logger.error(`Failed to get quotation ${id}:`, error);
      throw error;
    }
  }

  async updateStatus(id, status) {
    try {
      return await quotationRepository.updateStatus(id, status);
    } catch (error) {
      logger.error(`Failed to update quotation ${id} status:`, error);
      throw error;
    }
  }

  async convertToInvoice(quotationId) {
    try {
      const quotation = await this.getQuotationById(quotationId);
      
      if (quotation.status === 'converted') {
        throw new Error('Quotation already converted to invoice');
      }

      const stockWarnings = [];
      for (const item of quotation.items) {
        const inventory = await inventoryService.getProductInventory(item.productId);
        if (!inventory || inventory.quantityAvailable < item.quantity) {
          stockWarnings.push({
            productId: item.productId,
            productName: item.productName,
            requested: item.quantity,
            available: inventory?.quantityAvailable || 0
          });
        }
      }

      const invoice = await invoiceService.createInvoice({
        quotationId: quotation.id,
        customerId: quotation.customerId,
        items: quotation.items,
        discountAmount: quotation.discountAmount,
        notes: `Converted from quotation ${quotation.quoteNumber}`
      });

      await this.updateStatus(quotationId, 'converted');

      logger.info(`Quotation ${quotation.quoteNumber} converted to invoice ${invoice.invoiceNumber}`);
      
      return {
        invoice,
        stockWarnings: stockWarnings.length > 0 ? stockWarnings : null
      };
    } catch (error) {
      logger.error(`Failed to convert quotation ${quotationId} to invoice:`, error);
      throw error;
    }
  }

  async generatePDF(id) {
    try {
      const quotation = await this.getQuotationById(id);
      return await quotationRepository.generatePDF(quotation);
    } catch (error) {
      logger.error(`Failed to generate PDF for quotation ${id}:`, error);
      throw error;
    }
  }
}

module.exports = new QuotationService();
