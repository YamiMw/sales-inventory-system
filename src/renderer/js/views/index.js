/**
 * Views
 * Controls data loading and interactions for the views screen.
 */

class API {
  constructor(electronAPI) {
    this.api = electronAPI;
  }

  // Auth
  async login(credentials) {
    return await this.api.login(credentials);
  }

  async logout() {
    return await this.api.logout();
  }

  // Products
  async getProducts(filters = {}) {
    return await this.api.getProducts(filters);
  }

  async createProduct(product) {
    return await this.api.createProduct(product);
  }

  async updateProduct(id, product) {
    return await this.api.updateProduct(id, product);
  }

  async deleteProduct(id) {
    return await this.api.deleteProduct(id);
  }

  async getCategories() {
    return await this.api.getCategories();
  }

  // Inventory
  async getInventory(filters = {}) {
    return await this.api.getInventory(filters);
  }

  async adjustStock(adjustment) {
    return await this.api.adjustStock(adjustment);
  }

  async getLowStockProducts() {
    return await this.api.getLowStockProducts();
  }

  // Sales
  async createSale(sale) {
    return await this.api.createSale(sale);
  }

  async getSales(filters = {}) {
    return await this.api.getSales(filters);
  }

  // Quotations
  async createQuotation(quotation) {
    return await this.api.createQuotation(quotation);
  }

  async getQuotations(filters = {}) {
    return await this.api.getQuotations(filters);
  }

  async convertQuotationToInvoice(id) {
    return await this.api.convertQuotationToInvoice(id);
  }

  // Invoices
  async createInvoice(invoice) {
    return await this.api.createInvoice(invoice);
  }

  async getInvoices(filters = {}) {
    return await this.api.getInvoices(filters);
  }

  async recordPayment(payment) {
    return await this.api.recordPayment(payment);
  }

  // Customers
  async getCustomers(filters = {}) {
    return await this.api.getCustomers(filters);
  }

  async createCustomer(customer) {
    return await this.api.createCustomer(customer);
  }

  async searchCustomers(query) {
    return await this.api.searchCustomers(query);
  }

  // Dashboard
  async getDashboardStats() {
    return await this.api.getDashboardStats();
  }

  async getSalesChartData(period) {
    return await this.api.getSalesChartData(period);
  }

  async getTopProducts(limit) {
    return await this.api.getTopProducts(limit);
  }

  async getRecentSales(limit) {
    return await this.api.getRecentSales(limit);
  }

  // Users
  async getUsers() {
    return await this.api.getUsers();
  }

  async createUser(user) {
    return await this.api.createUser(user);
  }

  async updateUser(id, user) {
    return await this.api.updateUser(id, user);
  }

  // System
  async getSettings() {
    return await this.api.getSettings();
  }

  async updateSettings(settings) {
    return await this.api.updateSettings(settings);
  }
}

if (typeof window !== 'undefined') window.API = API;
if (typeof module !== 'undefined') module.exports = { API };
