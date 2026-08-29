/**
 * Inventory Service
 * Coordinates business rules and persistence for inventory operations.
 */

const inventoryRepository = require('../repositories/inventory-repository');
const productRepository = require('../repositories/product-repository');
const logger = require('../utils/logger');

class InventoryService {
  async getInventory(filters = {}) {
    try {
      return await inventoryRepository.findAll(filters);
    } catch (error) {
      logger.error('Failed to get inventory:', error);
      throw error;
    }
  }

  async getProductInventory(productId) {
    try {
      return await inventoryRepository.findByProductId(productId);
    } catch (error) {
      logger.error(`Failed to get inventory for product ${productId}:`, error);
      throw error;
    }
  }

  async adjustStock(adjustment) {
    try {
      const { productId, quantity, type, reference, notes, userId } = adjustment;
      const stockChange = Number.parseInt(quantity, 10) || 0;
      
      const product = await productRepository.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const currentInventory = await inventoryRepository.findByProductId(productId);
      const beforeQuantity = Number.parseInt(currentInventory?.quantity_on_hand ?? currentInventory?.quantityOnHand, 10) || 0;
      
      const result = await inventoryRepository.adjustStock({
        productId,
        quantity: stockChange,
        transactionType: type,
        beforeQuantity,
        referenceType: reference,
        notes,
        userId
      });

      const afterQuantity = beforeQuantity + stockChange;
      
      if (afterQuantity <= product.reorderLevel) {
        logger.warn(`Low stock alert: ${product.name} (${product.sku}) - Quantity: ${afterQuantity}`);
      }

      return {
        success: true,
        transactionId: result.transactionId,
        newQuantity: afterQuantity
      };
    } catch (error) {
      logger.error('Failed to adjust stock:', error);
      throw error;
    }
  }

  async getStockTransactions(productId, filters = {}) {
    try {
      return await inventoryRepository.getTransactions(productId, filters);
    } catch (error) {
      logger.error(`Failed to get stock transactions for product ${productId}:`, error);
      throw error;
    }
  }

  async getLowStockProducts() {
    try {
      return await inventoryRepository.getLowStockProducts();
    } catch (error) {
      logger.error('Failed to get low stock products:', error);
      throw error;
    }
  }

  async transferStock(transfer) {
    try {
      const { productId, quantity, fromLocation, toLocation, userId } = transfer;
      
      await this.adjustStock({
        productId,
        quantity: -quantity,
        type: 'transfer_out',
        reference: `Transfer to ${toLocation}`,
        userId
      });

      await this.adjustStock({
        productId,
        quantity: quantity,
        type: 'transfer_in',
        reference: `Transfer from ${fromLocation}`,
        userId
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to transfer stock:', error);
      throw error;
    }
  }
}

module.exports = new InventoryService();
