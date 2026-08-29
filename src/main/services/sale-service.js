/**
 * Sale Service
 * Coordinates business rules and persistence for sale operations.
 */

const saleRepository = require('../repositories/sale-repository');
const inventoryService = require('./inventory-service');
const logger = require('../utils/logger');

class SaleService {
  async createSale(saleData) {
    try {
      const { items, customerId, payments, userId } = saleData;
      
      for (const item of items) {
        const inventory = await inventoryService.getProductInventory(item.productId);
        if (!inventory || inventory.quantityAvailable < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.productId}`);
        }
      }

      const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      let subtotal = 0;
      items.forEach(item => {
        subtotal += item.quantity * item.unitPrice * (1 - (item.discountPercent || 0) / 100);
      });

      const taxAmount = subtotal * 0.1;
      const totalAmount = subtotal - (saleData.discountAmount || 0);

      const sale = await saleRepository.create({
        invoiceNumber,
        customerId,
        items,
        subtotal,
        taxAmount,
        discountAmount: saleData.discountAmount || 0,
        totalAmount,
        paymentMethod: payments[0]?.method || 'cash',
        notes: saleData.notes,
        userId
      });

      for (const item of items) {
        await inventoryService.adjustStock({
          productId: item.productId,
          quantity: -item.quantity,
          type: 'sale',
          reference: `Sale ${invoiceNumber}`,
          userId
        });
      }

      logger.info(`Sale created: ${invoiceNumber}, Total: ${totalAmount}`);
      
      return {
        saleId: sale.id,
        invoiceNumber,
        totalAmount
      };
    } catch (error) {
      logger.error('Failed to create sale:', error);
      throw error;
    }
  }

  async getSales(filters = {}) {
    try {
      return await saleRepository.findAll(filters);
    } catch (error) {
      logger.error('Failed to get sales:', error);
      throw error;
    }
  }

  async getSaleById(id) {
    try {
      const sale = await saleRepository.findById(id);
      if (!sale) {
        throw new Error(`Sale with id ${id} not found`);
      }
      return sale;
    } catch (error) {
      logger.error(`Failed to get sale ${id}:`, error);
      throw error;
    }
  }

  async processRefund(refund) {
    try {
      const { saleId, items, reason, userId } = refund;
      
      const sale = await this.getSaleById(saleId);
      
      for (const refundItem of items) {
        await inventoryService.adjustStock({
          productId: refundItem.productId,
          quantity: refundItem.quantity,
          type: 'return',
          reference: `Refund for sale ${sale.invoiceNumber}`,
          notes: reason,
          userId
        });
      }

      logger.info(`Refund processed for sale ${sale.invoiceNumber}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to process refund:', error);
      throw error;
    }
  }
}

module.exports = new SaleService();
