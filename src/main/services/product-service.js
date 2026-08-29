/**
 * Product Service
 * Coordinates business rules and persistence for product operations.
 */

const productRepository = require('../repositories/product-repository');
const logger = require('../utils/logger');

class ProductService {
  async getAllProducts(filters = {}) {
    try {
      return await productRepository.findAll(filters);
    } catch (error) {
      logger.error('Failed to get products:', error);
      throw error;
    }
  }

  async getProductById(id) {
    try {
      const product = await productRepository.findById(id);
      if (!product) {
        throw new Error(`Product with id ${id} not found`);
      }
      return product;
    } catch (error) {
      logger.error(`Failed to get product ${id}:`, error);
      throw error;
    }
  }

  async createProduct(productData) {
    try {
      if (!productData.sku) {
        productData.sku = await this.generateSKU(productData.name);
      }
      return await productRepository.create(productData);
    } catch (error) {
      logger.error('Failed to create product:', error);
      throw error;
    }
  }

  async updateProduct(id, productData) {
    try {
      return await productRepository.update(id, productData);
    } catch (error) {
      logger.error(`Failed to update product ${id}:`, error);
      throw error;
    }
  }

  async deleteProduct(id) {
    try {
      return await productRepository.delete(id);
    } catch (error) {
      logger.error(`Failed to delete product ${id}:`, error);
      throw error;
    }
  }

  async searchProducts(query) {
    try {
      return await productRepository.search(query);
    } catch (error) {
      logger.error('Failed to search products:', error);
      throw error;
    }
  }

  async getCategories() {
    try {
      return await productRepository.getCategories();
    } catch (error) {
      logger.error('Failed to get categories:', error);
      throw error;
    }
  }

  async createCategory(category) {
    try {
      return await productRepository.createCategory(category);
    } catch (error) {
      logger.error('Failed to create category:', error);
      throw error;
    }
  }

  async generateSKU(productName) {
    const prefix = productName.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  }
}

module.exports = new ProductService();