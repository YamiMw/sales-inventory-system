/**
 * Reports View Module
 * Generates and exports business reports.
 */

const VERIFIED_COST_UNAVAILABLE = 'Unavailable - missing verified cost data';
const EXPENSE_DATA_UNAVAILABLE = 'Unavailable - expense data is not recorded';

class ReportsView {
  constructor() {
    this.startDate = null;
    this.endDate = null;
    this.format = 'csv';
    this.includeCharts = false;
    this.includeSummary = false;
    this.reportData = null;
    this.currentReportType = null;
    this.cachedData = null;

    this.init();
  }

  iconImage(name, className = 'custom-ui-icon') {
    const icons = {
      'search': 'search_icon.png',
      'shield': 'staff_shield_icon.svg',
      'chevron-down': 'chevron_down_icon.svg',
      'refresh-cw': 'refresh_icon.png',
      'eye': 'eye_icon.svg',
      'eye-off': 'eye_off_icon.svg',
      'trash': 'trash_icon.svg',
      'trash-2': 'trash_icon.svg',
      'user-plus': 'user_plus_icon.svg',
      'users': 'user_icon.svg',
      'more-vertical': 'more_vertical_icon.svg',
      'plus': 'add_icon.svg',
      'bar-chart-3': 'bar_chart_icon.png',
      'package': 'product_cube_icon.png',
      'alert-triangle': 'warning_triangle_icon.png',
      'alert-circle': 'reorder_alert_icon.png',
      'clipboard-list': 'clipboard_tasks_icon.png',
      'check-circle': 'check_status_icon.png',
      'check-circle-2': 'check_status_icon.png',
      'x-circle': 'out_of_stock_icon.png',
      'tags': 'category_tag_icon.png',
      'banknote': 'cash_sales_icon.png',
      'calendar': 'calendar_icon.png',
      'file-text': 'file_text_icon.svg',
      'file-clock': 'file_clock_icon.svg',
      'send': 'send_icon.svg',
      'arrow-left': 'arrow_left_icon.svg',
      'arrow-right': 'arrow_right_icon.svg',
      'file-down': 'download_icon.svg',
      'download': 'download_icon.svg',
      'printer': 'printer_icon.svg',
      'copy': 'copy_icon.svg',
      'credit-card': 'credit_card_icon.svg',
      'file-check': 'file_check_icon.svg',
      'edit-3': 'edit_icon.svg',
      'badge-check': 'badge_check_icon.svg',
      'ban': 'ban_icon.svg',
      'x': 'x_icon.svg',
      'sliders-horizontal': 'sliders_icon.svg',
      'trending-up': 'trending_up_icon.svg',
      'pie-chart': 'pie_chart_icon.svg',
      'history': 'history_icon.svg',
      'dollar-sign': 'dollar_sign_icon.svg',
      'triangle-alert': 'warning_triangle_icon.png',
      'chart-no-axes-combined': 'bar_chart_icon.png',
      'building-2': 'building_icon.svg',
      'database': 'database_icon.svg',
      'database-backup': 'database_icon.svg',
      'info': 'info_icon.svg',
      'save': 'save_icon.svg',
      'camera': 'camera_icon.svg',
      'upload': 'upload_icon.svg',
      'globe-2': 'globe_icon.svg',
      'percent': 'percent_icon.svg',
      'map-pin': 'map_pin_icon.svg',
      'phone': 'phone_icon.svg',
      'mail': 'mail_icon.svg',
      'link': 'link_icon.svg',
      'hard-drive': 'hard_drive_icon.svg',
      'rotate-ccw': 'refresh_icon.png',
      'file-up': 'file_upload_icon.svg',
      'activity': 'activity_icon.svg',
      'receipt-text': 'receipt_icon.png',
      'user-round-check': 'check_status_icon.png'
    };
    const file = icons[name] || 'check_status_icon.png';
    return `<img src="assets/images/icons/custom/${file}" alt="" class="${className}" aria-hidden="true">`;
  }

  init() {
    this.render();
    this.setDefaultDates();
    this.setupEventListeners();
    this.refreshIcons();
  }

  render() {
    const view = document.getElementById('reports-view');
    if (!view) return;

    view.innerHTML = `
      <section class="report-config-card" aria-labelledby="report-config-title">
        <div class="report-config-heading">
          <span class="report-section-icon neutral"><img src="assets/images/icons/custom/sliders_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"></span>
          <h2 id="report-config-title">REPORT CONFIGURATION</h2>
        </div>

        <div class="report-config-grid">
          <div class="report-field-group">
            <label>DATE RANGE</label>
            <div class="report-date-fields" id="custom-date-range">
              <div class="report-date-input">
                <img src="assets/images/icons/custom/calendar_icon.png" alt="" class="custom-ui-icon" aria-hidden="true">
                <input type="date" id="report-start-date">
              </div>
              <span>to</span>
              <div class="report-date-input">
                <img src="assets/images/icons/custom/calendar_icon.png" alt="" class="custom-ui-icon" aria-hidden="true">
                <input type="date" id="report-end-date">
              </div>
            </div>
          </div>

          <div class="report-field-group">
            <label for="report-format">OUTPUT FORMAT</label>
            <select id="report-format" class="report-select">
              <option value="csv" selected>CSV</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
        </div>

        <div class="report-options-row">
          <label class="report-option">
            <input type="checkbox" id="report-include-charts" ${this.includeCharts ? 'checked' : ''}>
            <span><img src="assets/images/icons/custom/bar_chart_icon.png" alt="" class="custom-ui-icon" aria-hidden="true"></span>
            Include Visualization Charts
          </label>
          <label class="report-option">
            <input type="checkbox" id="report-include-summary" ${this.includeSummary ? 'checked' : ''}>
            <span><img src="assets/images/icons/custom/file_text_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"></span>
            Include Executive Summary
          </label>
        </div>
      </section>

      <div class="reports-grid">
        ${this.renderReportSection('SALES REPORTS', [
          ['sales-summary', 'trending-up', 'Sales Summary', 'Revenue and tax come from sales records. Gross profit requires transaction-time cost.'],
          ['sales-by-product', 'package', 'Sales by Product', 'Revenue by SKU, with gross profit unavailable wherever transaction-time cost is missing.'],
          ['sales-by-customer', 'pie-chart', 'Sales by Customer', 'Analyze revenue contribution from your top clients.'],
          ['sales-by-category', 'bar-chart-3', 'Sales by Category', 'Performance analysis across different product departments.']
        ], 'sales-report-cards')}

        ${this.renderReportSection('INVENTORY REPORTS', [
          ['stock-status', 'check-circle-2', 'Stock Status', 'Current stock levels, locations, and availability.'],
          ['stock-movement', 'history', 'Stock Movement', 'Track ins/outs and adjustments over time.'],
          ['inventory-valuation', 'dollar-sign', 'Inventory Valuation', 'Stock value using recorded cost prices, with missing costs clearly identified.'],
          ['low-stock', 'triangle-alert', 'Low Stock Report', 'List of products below reorder points needing attention.']
        ])}

        ${this.renderReportSection('FINANCIAL REPORTS', [
          ['profit-loss', 'trending-up', 'Profit & Loss', 'Gross profit requires transaction-time cost. Net profit requires recorded expenses.'],
          ['tax-summary', 'clipboard-list', 'Tax Summary', 'Calculated taxes collected and owed for the period.'],
          ['accounts-receivable', 'chart-no-axes-combined', 'Accounts Receivable', 'Aging analysis of outstanding customer invoices.']
        ], 'financial-report-cards')}

        ${this.renderReportSection('DOCUMENT REPORTS', [
          ['quotation-summary', 'file-text', 'Quotation Summary', 'Status tracking for all generated sales quotes.'],
          ['invoice-summary', 'file-text', 'Invoice Summary', 'Comprehensive listing of all issued invoices.'],
          ['customer-statements', 'file-text', 'Customer Statements', 'Detailed activity logs for specific client accounts.']
        ], 'document-report-cards')}
      </div>

      <div id="report-preview-modal" class="modal-overlay" style="display: none;">
        <div class="modal report-preview-modal">
          <div class="modal-header">
            <h2 id="report-preview-title">Report Preview</h2>
            <div class="report-preview-actions">
              <button type="button" class="btn-secondary" id="report-print-btn"><img src="assets/images/icons/custom/printer_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Print</button>
              <button type="button" class="btn-primary" id="report-download-btn"><img src="assets/images/icons/custom/download_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Download</button>
              <button type="button" class="modal-close" id="report-preview-close" aria-label="Close report preview">
                <img src="assets/images/icons/custom/x_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true">
              </button>
            </div>
          </div>
          <div class="modal-body report-preview-body">
            <div id="report-preview-content"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" id="report-preview-footer-close">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  renderReportSection(title, reports, className = '') {
    return `
      <section class="report-category">
        <div class="category-header">
          <h3>${title}</h3>
        </div>
        <div class="report-cards ${className}">
          ${reports.map(([type, cardIcon, reportTitle, description]) => `
            <button type="button" class="report-card" data-report="${type}">
              <span class="report-card-icon ${this.getReportIconClass(type)}"><img src="assets/images/icons/custom/check_status_icon.png" alt="" class="custom-ui-icon" aria-hidden="true"></span>
              <span class="report-card-info">
                <strong>${reportTitle}</strong>
                <span>${description}</span>
              </span>
              <span class="report-generate-btn">Generate</span>
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }

  setupEventListeners() {
    document.getElementById('report-format')?.addEventListener('change', (event) => {
      this.format = event.target.value;
    });

    document.getElementById('report-start-date')?.addEventListener('change', (event) => {
      this.startDate = event.target.value;
    });

    document.getElementById('report-end-date')?.addEventListener('change', (event) => {
      this.endDate = event.target.value;
    });

    const includeChartsInput = document.getElementById('report-include-charts');
    if (includeChartsInput) {
      includeChartsInput.checked = this.includeCharts;
      includeChartsInput.addEventListener('change', (event) => {
        this.includeCharts = event.target.checked;
      });
    }

    const includeSummaryInput = document.getElementById('report-include-summary');
    if (includeSummaryInput) {
      includeSummaryInput.checked = this.includeSummary;
      includeSummaryInput.addEventListener('change', (event) => {
        this.includeSummary = event.target.checked;
      });
    }

    document.querySelectorAll('.report-card').forEach(card => {
      card.addEventListener('click', () => {
        this.generateReport(card.dataset.report, card);
      });
    });

    document.getElementById('report-print-btn')?.addEventListener('click', () => {
      window.print();
    });

    document.getElementById('report-download-btn')?.addEventListener('click', () => {
      this.downloadReport();
    });

    ['report-preview-close', 'report-preview-footer-close'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => this.closePreview());
    });

    document.getElementById('report-preview-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) this.closePreview();
    });
  }

  setDefaultDates() {
    const now = new Date();
    this.startDate = this.toISODate(now);
    this.endDate = this.toISODate(now);

    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');
    if (startInput) startInput.value = this.startDate;
    if (endInput) endInput.value = this.endDate;
  }

  getDateRange() {
    const now = new Date();
    const today = this.toISODate(now);
    const start = this.startDate ? new Date(`${this.startDate}T00:00:00`) : new Date(`${today}T00:00:00`);
    const end = this.endDate ? new Date(`${this.endDate}T23:59:59`) : new Date(`${today}T23:59:59`);
    return { start, end };
  }

  async generateReport(reportType, card = null) {
    this.currentReportType = reportType;
    this.setReportLoading(card, true);

    try {
      const { start, end } = this.getDateRange();
      const context = await this.loadReportContext(start, end);

      switch (reportType) {
        case 'sales-summary':
          this.reportData = this.generateSalesSummary(context, start, end);
          break;
        case 'sales-by-product':
          this.reportData = this.generateSalesByProduct(context, start, end);
          break;
        case 'sales-by-customer':
          this.reportData = this.generateSalesByCustomer(context, start, end);
          break;
        case 'sales-by-category':
          this.reportData = this.generateSalesByCategory(context, start, end);
          break;
        case 'stock-status':
          this.reportData = this.generateStockStatus(context);
          break;
        case 'stock-movement':
          this.reportData = await this.generateStockMovement(context, start, end);
          break;
        case 'inventory-valuation':
          this.reportData = this.generateInventoryValuation(context);
          break;
        case 'low-stock':
          this.reportData = this.generateLowStockReport(context);
          break;
        case 'profit-loss':
          this.reportData = this.generateProfitLoss(context, start, end);
          break;
        case 'tax-summary':
          this.reportData = this.generateTaxSummary(context, start, end);
          break;
        case 'accounts-receivable':
          this.reportData = this.generateAccountsReceivable(context);
          break;
        case 'quotation-summary':
          this.reportData = this.generateQuotationSummary(context, start, end);
          break;
        case 'invoice-summary':
          this.reportData = this.generateInvoiceSummary(context, start, end);
          break;
        case 'customer-statements':
          this.reportData = this.generateCustomerStatements(context);
          break;
        default:
          this.reportData = this.generateEmptyReport(reportType, start, end);
      }

      this.showPreview();
      if (this.format === 'pdf') {
        await this.downloadReport();
      } else {
        this.showNotification(`${this.reportData.title} generated`, 'success');
      }
    } catch (error) {
      console.error('Report generation failed:', error);
      this.reportData = null;
      this.showReportError(reportType, error);
      this.showNotification(error.message || 'Failed to generate report', 'error');
    } finally {
      this.setReportLoading(card, false);
    }
  }

  async loadReportContext(start, end) {
    const dateFilters = {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
    const listFilters = { limit: 1000 };

    const [sales, products, inventory, lowStock, customers, quotations, invoices] = await Promise.all([
      this.safePagedApiCall('getSales', dateFilters),
      this.safeApiCall('getProducts', listFilters),
      this.safeApiCall('getInventory', listFilters),
      this.safeApiCall('getLowStock'),
      this.safeApiCall('getCustomers', listFilters),
      this.safeApiCall('getQuotations', listFilters),
      this.safeApiCall('getInvoices', listFilters)
    ]);

    const context = {
      sales: this.filterByDate(sales, start, end, ['created_at', 'sale_date', 'invoice_date']),
      products,
      inventory,
      lowStock,
      customers,
      quotations: this.filterByDate(quotations, start, end, ['quote_date', 'created_at']),
      invoices: this.filterByDate(invoices, start, end, ['invoice_date', 'created_at'])
    };

    context.productMap = this.indexById(context.products);
    context.customerMap = this.indexById(context.customers);
    this.cachedData = context;
    return context;
  }

  async safePagedApiCall(method, filters = {}, pageSize = 1000) {
    const allRows = [];
    let offset = 0;

    for (let page = 0; page < 100; page += 1) {
      const rows = await this.safeApiCall(method, { ...filters, limit: pageSize, offset });
      allRows.push(...rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }

    return allRows;
  }

  async safeApiCall(method, ...args) {
    if (!window.electronAPI || typeof window.electronAPI[method] !== 'function') {
      throw new Error(`${this.labelize(method)} service is unavailable`);
    }

    try {
      const result = await window.electronAPI[method](...args);
      if (Array.isArray(result)) return result;
      if (result && result.success !== false && Array.isArray(result.data)) return result.data;
      throw new Error(result?.error || `${this.labelize(method)} request failed`);
    } catch (error) {
      throw new Error(`${this.labelize(method)}: ${error.message || 'request failed'}`);
    }
  }

  generateSalesSummary(context, start, end) {
    const rows = context.sales.map(sale => {
      const saleProfit = this.getSaleProfit(sale);
      return [
        sale.invoice_number || sale.invoiceNumber || `Sale #${sale.id || ''}`,
        this.formatDate(this.getDateValue(sale, ['created_at', 'sale_date', 'invoice_date'])),
        sale.customer_name || sale.customerName || 'Walk-in Customer',
        this.formatSaleUserNames(sale),
        this.formatSaleCategories(sale, context.productMap),
        this.formatSaleItems(sale),
        this.formatNumber(this.getSaleQuantity(sale)),
        this.formatPaymentMethod(sale.payment_method || sale.paymentMethod),
        this.formatCurrency(this.toNumber(sale.subtotal)),
        this.formatCurrency(this.toNumber(sale.discount_amount || sale.discountAmount)),
        this.formatCurrency(this.toNumber(sale.tax_amount || sale.taxAmount)),
        this.formatCurrency(this.getSaleTotal(sale)),
        saleProfit === null ? VERIFIED_COST_UNAVAILABLE : this.formatCurrency(saleProfit)
      ];
    });

    return {
      title: 'Sales Summary Report',
      period: this.formatPeriod(start, end),
      headers: [
        'Sale Number',
        'Date',
        'Customer',
        'User',
        'Category',
        'Items',
        'Quantity',
        'Payment Method',
        'Subtotal',
        'Discount',
        window.AppFormatters?.taxLabel || 'Tax',
        'Total',
        'Gross Profit'
      ],
      rows,
      chart: this.buildChartData(context.sales.map(sale => ({
        label: sale.invoice_number || sale.invoiceNumber || `Sale #${sale.id || ''}`,
        value: this.getSaleNetRevenue(sale)
      }))),
      summary: {
        totalRevenue: this.sum(context.sales, sale => this.getSaleNetRevenue(sale)),
        totalTransactions: context.sales.length,
        totalQuantity: this.sum(context.sales, sale => this.getSaleQuantity(sale)),
        totalTax: this.sum(context.sales, sale => this.toNumber(sale.tax_amount || sale.taxAmount)),
        totalGrossProfit: this.sumAvailable(context.sales, sale => this.getSaleProfit(sale))
      },
      notices: this.getCostNotices(context.sales, sale => this.getSaleProfit(sale))
    };
  }

  generateSalesByProduct(context, start, end) {
    const grouped = new Map();
    this.getSaleItems(context.sales).forEach(({ sale, item }) => {
      const product = context.productMap.get(String(item.product_id || item.productId)) || {};
      const key = String(item.product_id || item.productId || item.sku || item.product_name || item.name);
      const quantity = this.toNumber(item.quantity);
      const revenue = this.toNumber(item.total_price || item.totalPrice) || quantity * this.toNumber(item.unit_price || item.unitPrice);
      const unitCost = this.getItemUnitCost(item);

      if (!grouped.has(key)) {
        grouped.set(key, {
          product: item.product_name || item.productName || product.name || item.name || 'Unknown Product',
          sku: item.sku || product.sku || '',
          quantity: 0,
          revenue: 0,
          profit: 0,
          profitAvailable: true
        });
      }

      const entry = grouped.get(key);
      entry.quantity += quantity;
      entry.revenue += revenue;
      if (unitCost === null) {
        entry.profitAvailable = false;
      } else {
        entry.profit += revenue - (quantity * unitCost);
      }
    });

    const data = [...grouped.values()].sort((a, b) => b.revenue - a.revenue);
    return {
      title: 'Sales by Product Report',
      period: this.formatPeriod(start, end),
      headers: ['Product', 'SKU', 'Quantity Sold', 'Revenue', 'Gross Profit'],
      rows: data.map(item => [
        item.product,
        item.sku || 'N/A',
        this.formatNumber(item.quantity),
        this.formatCurrency(item.revenue),
        item.profitAvailable ? this.formatCurrency(item.profit) : VERIFIED_COST_UNAVAILABLE
      ]),
      chart: this.buildChartData(data.slice(0, 8).map(item => ({ label: item.product, value: item.revenue }))),
      summary: {
        totalQuantity: this.sum(data, item => item.quantity),
        totalRevenue: this.sum(data, item => item.revenue),
        totalGrossProfit: data.every(item => item.profitAvailable) ? this.sum(data, item => item.profit) : null
      },
      notices: data.some(item => !item.profitAvailable)
        ? [this.getMissingHistoricalCostNotice()]
        : []
    };
  }

  generateSalesByCustomer(context, start, end) {
    const grouped = new Map();
    context.sales.forEach(sale => {
      const key = String(sale.customer_id || sale.customerId || sale.customer_name || 'Walk-in Customer');
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: sale.customer_name || this.getCustomerName(context.customerMap.get(String(sale.customer_id || sale.customerId))) || 'Walk-in Customer',
          transactions: 0,
          revenue: 0,
          tax: 0,
          lastPurchase: ''
        });
      }

      const entry = grouped.get(key);
      entry.transactions += 1;
      entry.revenue += this.getSaleTotal(sale);
      entry.tax += this.toNumber(sale.tax_amount || sale.taxAmount);
      entry.lastPurchase = this.formatDate(this.getDateValue(sale, ['created_at', 'sale_date', 'invoice_date']));
    });

    const data = [...grouped.values()].sort((a, b) => b.revenue - a.revenue);
    return {
      title: 'Sales by Customer Report',
      period: this.formatPeriod(start, end),
      headers: ['Customer', 'Transactions', 'Revenue', window.AppFormatters?.taxLabel || 'Tax', 'Last Purchase'],
      rows: data.map(item => [item.name, item.transactions, this.formatCurrency(item.revenue), this.formatCurrency(item.tax), item.lastPurchase || 'N/A']),
      chart: this.buildChartData(data.slice(0, 8).map(item => ({ label: item.name, value: item.revenue }))),
      summary: {
        totalCustomers: data.length,
        totalRevenue: this.sum(data, item => item.revenue),
        averageRevenue: data.length ? this.sum(data, item => item.revenue) / data.length : 0
      }
    };
  }

  generateSalesByCategory(context, start, end) {
    const grouped = new Map();
    this.getSaleItems(context.sales).forEach(({ item }) => {
      const product = context.productMap.get(String(item.product_id || item.productId)) || {};
      const category = product.category_name || product.category || item.category_name || 'Uncategorized';
      const quantity = this.toNumber(item.quantity);
      const revenue = this.toNumber(item.total_price || item.totalPrice) || quantity * this.toNumber(item.unit_price || item.unitPrice);

      if (!grouped.has(category)) {
        grouped.set(category, { category, items: 0, quantity: 0, revenue: 0 });
      }

      const entry = grouped.get(category);
      entry.items += 1;
      entry.quantity += quantity;
      entry.revenue += revenue;
    });

    const data = [...grouped.values()].sort((a, b) => b.revenue - a.revenue);
    return {
      title: 'Sales by Category Report',
      period: this.formatPeriod(start, end),
      headers: ['Category', 'Line Items', 'Quantity Sold', 'Revenue'],
      rows: data.map(item => [item.category, item.items, this.formatNumber(item.quantity), this.formatCurrency(item.revenue)]),
      chart: this.buildChartData(data.map(item => ({ label: item.category, value: item.revenue }))),
      summary: {
        totalCategories: data.length,
        totalRevenue: this.sum(data, item => item.revenue),
        totalQuantity: this.sum(data, item => item.quantity)
      }
    };
  }

  generateStockStatus(context) {
    const inventory = this.getInventoryRows(context);
    const rows = inventory.map(item => {
      const onHand = this.toNumber(item.quantity_on_hand || item.stock || item.quantity);
      const reserved = this.toNumber(item.quantity_reserved || item.reserved);
      const available = onHand - reserved;
      const reorder = this.toNumber(item.reorder_level || item.reorderLevel);
      return [
        item.name || item.product_name || 'Unknown Product',
        item.sku || 'N/A',
        item.location_code || item.location || 'Main',
        this.formatNumber(onHand),
        this.formatNumber(reserved),
        this.formatNumber(available),
        this.formatNumber(reorder),
        this.getStockStatus(available, reorder)
      ];
    });

    return {
      title: 'Stock Status Report',
      headers: ['Product', 'SKU', 'Location', 'On Hand', 'Reserved', 'Available', 'Reorder', 'Status'],
      rows,
      chart: this.buildChartData(inventory.slice(0, 8).map(item => ({
        label: item.name || item.product_name || 'Product',
        value: this.toNumber(item.quantity_on_hand || item.stock || item.quantity)
      }))),
      summary: {
        productsTracked: inventory.length,
        lowStockItems: inventory.filter(item => this.getStockStatus(this.toNumber(item.quantity_on_hand) - this.toNumber(item.quantity_reserved), this.toNumber(item.reorder_level)) !== 'In Stock').length,
        totalOnHand: this.sum(inventory, item => this.toNumber(item.quantity_on_hand || item.stock || item.quantity))
      }
    };
  }

  async generateStockMovement(context, start, end) {
    const rows = [];
    const products = this.getInventoryRows(context).slice(0, 50);

    if (window.electronAPI && typeof window.electronAPI.getStockTransactions === 'function') {
      const transactionGroups = await Promise.all(products.map(product => this.safeApiCall('getStockTransactions', product.id, { limit: 50 })));
      transactionGroups.flat().forEach(transaction => {
        const product = context.productMap.get(String(transaction.product_id)) || {};
        const transactionDate = this.getDateValue(transaction, ['created_at']);
        if (transactionDate && (transactionDate < start || transactionDate > end)) return;
        rows.push([
          this.formatDate(transactionDate),
          product.name || transaction.product_name || 'Product',
          this.titleCase(transaction.transaction_type || 'movement'),
          this.formatNumber(this.toNumber(transaction.quantity)),
          this.formatNumber(this.toNumber(transaction.quantity_before)),
          this.formatNumber(this.toNumber(transaction.quantity_after)),
          transaction.reference_type || 'N/A'
        ]);
      });
    }

    if (rows.length === 0) {
      this.getSaleItems(context.sales).forEach(({ sale, item }) => {
        rows.push([
          this.formatDate(this.getDateValue(sale, ['created_at', 'sale_date', 'invoice_date'])),
          item.product_name || item.productName || item.sku || 'Product',
          'Sale',
          `-${this.formatNumber(this.toNumber(item.quantity))}`,
          'N/A',
          'N/A',
          sale.invoice_number || sale.invoiceNumber || `Sale #${sale.id || ''}`
        ]);
      });
    }

    return {
      title: 'Stock Movement Report',
      period: this.formatPeriod(start, end),
      headers: ['Date', 'Product', 'Type', 'Quantity', 'Before', 'After', 'Reference'],
      rows,
      summary: {
        movements: rows.length,
        productsReviewed: products.length
      }
    };
  }

  generateInventoryValuation(context) {
    const inventory = this.getInventoryRows(context);
    const rows = inventory.map(item => {
      const onHand = this.toNumber(item.quantity_on_hand || item.stock || item.quantity);
      const cost = this.getVerifiedCost(item.cost_price ?? item.costPrice);
      const retail = this.toNumber(item.unit_price || item.price);
      return [
        item.name || item.product_name || 'Unknown Product',
        item.sku || 'N/A',
        item.category_name || item.category || 'Uncategorized',
        this.formatNumber(onHand),
        cost === null ? VERIFIED_COST_UNAVAILABLE : this.formatCurrency(cost),
        cost === null ? VERIFIED_COST_UNAVAILABLE : this.formatCurrency(onHand * cost),
        this.formatCurrency(onHand * retail)
      ];
    });

    const costValues = inventory.map(item => {
      const onHand = this.toNumber(item.quantity_on_hand || item.stock || item.quantity);
      const cost = this.getVerifiedCost(item.cost_price ?? item.costPrice);
      return onHand > 0 && cost === null ? null : onHand * (cost || 0);
    });
    const totalCostValue = costValues.some(value => value === null)
      ? null
      : this.sum(costValues, value => value);
    const totalRetailValue = this.sum(inventory, item => this.toNumber(item.quantity_on_hand || item.stock || item.quantity) * this.toNumber(item.unit_price || item.price));
    const missingCostItems = costValues.filter(value => value === null).length;

    return {
      title: 'Inventory Valuation Report',
      headers: ['Product', 'SKU', 'Category', 'On Hand', 'Cost', 'Cost Value', 'Retail Value'],
      rows,
      chart: totalCostValue === null
        ? []
        : this.buildChartData(inventory.slice(0, 8).map(item => ({
            label: item.name || item.product_name || 'Product',
            value: this.toNumber(item.quantity_on_hand || item.stock || item.quantity)
              * this.getVerifiedCost(item.cost_price ?? item.costPrice)
          }))),
      summary: {
        totalCostValue,
        totalRetailValue,
        retailLessRecordedCost: totalCostValue === null ? null : totalRetailValue - totalCostValue,
        missingCostItems
      },
      notices: missingCostItems > 0
        ? [
            `${VERIFIED_COST_UNAVAILABLE}. ${missingCostItems} stocked product${missingCostItems === 1 ? '' : 's'} excluded from cost totals.`,
            'Retail value is shown separately and is never substituted for product cost.'
          ]
        : []
    };
  }

  generateLowStockReport(context) {
    const source = context.lowStock.length ? context.lowStock : this.getInventoryRows(context).filter(item => {
      const available = this.toNumber(item.available_stock || item.quantity_on_hand) - this.toNumber(item.quantity_reserved);
      return available <= this.toNumber(item.reorder_level || item.reorderLevel);
    });

    return {
      title: 'Low Stock Report',
      headers: ['Product', 'SKU', 'Available', 'Reorder Point', 'Shortage', 'Status'],
      rows: source.map(item => {
        const available = this.toNumber(item.available_stock || item.quantity_on_hand || item.stock || item.quantity);
        const reorder = this.toNumber(item.reorder_level || item.reorderLevel);
        return [
          item.name || item.product_name || 'Unknown Product',
          item.sku || 'N/A',
          this.formatNumber(available),
          this.formatNumber(reorder),
          this.formatNumber(Math.max(reorder - available, 0)),
          available <= 0 ? 'Out of Stock' : 'Low Stock'
        ];
      }),
      summary: {
        lowStockItems: source.length,
        outOfStockItems: source.filter(item => this.toNumber(item.available_stock || item.quantity_on_hand || item.stock || item.quantity) <= 0).length
      }
    };
  }

  generateProfitLoss(context, start, end) {
    const totalRevenue = this.sum(context.sales, sale => this.getSaleNetRevenue(sale));
    const totalTax = this.sum(context.sales, sale => this.toNumber(sale.tax_amount || sale.taxAmount));
    const discounts = this.sum(context.sales, sale => this.toNumber(sale.discount_amount || sale.discountAmount));
    const cogs = this.sumAvailable(context.sales, sale => this.getSaleCost(sale));
    const grossProfit = cogs === null ? null : totalRevenue - cogs;
    const grossMargin = grossProfit === null
      ? null
      : (totalRevenue ? `${((grossProfit / totalRevenue) * 100).toFixed(1)}%` : '0.0%');

    return {
      title: 'Profit & Loss Report',
      period: this.formatPeriod(start, end),
      headers: ['Account', 'Amount'],
      rows: [
        ['Net Sales Revenue', this.formatCurrency(totalRevenue)],
        ['Cost of Goods Sold', cogs === null ? VERIFIED_COST_UNAVAILABLE : this.formatCurrency(cogs)],
        ['Gross Profit', grossProfit === null ? VERIFIED_COST_UNAVAILABLE : this.formatCurrency(grossProfit)],
        ['Discounts', this.formatCurrency(discounts)],
        [`${window.AppFormatters?.taxLabel || 'Tax'} Collected`, this.formatCurrency(totalTax)],
        ['Operating Expenses', EXPENSE_DATA_UNAVAILABLE],
        ['Net Profit', EXPENSE_DATA_UNAVAILABLE]
      ],
      summary: {
        totalRevenue,
        costOfGoodsSold: cogs,
        grossProfit,
        grossMargin,
        netProfit: null
      },
      notices: [
        ...(cogs === null ? [this.getMissingHistoricalCostNotice()] : []),
        'Net profit is unavailable because operating expense data is not recorded by this system.'
      ]
    };
  }

  generateTaxSummary(context, start, end) {
    const salesRows = context.sales.map(sale => [
      'POS Sale',
      sale.invoice_number || sale.invoiceNumber || `Sale #${sale.id || ''}`,
      this.formatDate(this.getDateValue(sale, ['created_at', 'sale_date', 'invoice_date'])),
      sale.customer_name || 'Walk-in Customer',
      this.formatCurrency(this.toNumber(sale.subtotal)),
      this.formatCurrency(this.toNumber(sale.tax_amount || sale.taxAmount))
    ]);

    const invoiceRows = context.invoices.map(invoice => [
      'Invoice',
      invoice.invoice_number || invoice.invoiceNumber || `Invoice #${invoice.id || ''}`,
      this.formatDate(this.getDateValue(invoice, ['invoice_date', 'created_at'])),
      invoice.customer_name || 'Walk-in Customer',
      this.formatCurrency(this.toNumber(invoice.subtotal)),
      this.formatCurrency(this.toNumber(invoice.tax_amount || invoice.taxAmount))
    ]);

    const rows = [...salesRows, ...invoiceRows];
    return {
      title: 'Tax Summary Report',
      period: this.formatPeriod(start, end),
      headers: ['Source', 'Document', 'Date', 'Customer', 'Taxable Amount', `${window.AppFormatters?.taxLabel || 'Tax'} Collected`],
      rows,
      summary: {
        documents: rows.length,
        taxableAmount: this.sum([...context.sales, ...context.invoices], item => this.toNumber(item.subtotal)),
        totalTax: this.sum([...context.sales, ...context.invoices], item => this.toNumber(item.tax_amount || item.taxAmount))
      }
    };
  }

  generateAccountsReceivable(context) {
    const openInvoices = context.invoices.filter(invoice => {
      const due = this.getInvoiceDue(invoice);
      const status = String(invoice.status || '').toLowerCase();
      return due > 0 || ['issued', 'sent', 'partial', 'overdue', 'unpaid'].includes(status);
    });

    return {
      title: 'Accounts Receivable Report',
      headers: ['Customer', 'Invoice', 'Total', 'Paid', 'Outstanding', 'Status'],
      rows: openInvoices.map(invoice => [
        invoice.customer_name || 'Walk-in Customer',
        invoice.invoice_number || invoice.invoiceNumber || `Invoice #${invoice.id || ''}`,
        this.formatCurrency(this.toNumber(invoice.total_amount || invoice.totalAmount)),
        this.formatCurrency(this.toNumber(invoice.amount_paid || invoice.amountPaid)),
        this.formatCurrency(this.getInvoiceDue(invoice)),
        this.titleCase(invoice.status || 'issued')
      ]),
      summary: {
        openInvoices: openInvoices.length,
        totalOutstanding: this.sum(openInvoices, invoice => this.getInvoiceDue(invoice)),
        overdueInvoices: openInvoices.filter(invoice => this.getAgeInDays(invoice.due_date || invoice.dueDate || invoice.invoice_date || invoice.created_at) > 0).length
      }
    };
  }

  generateQuotationSummary(context, start, end) {
    return {
      title: 'Quotation Summary Report',
      period: this.formatPeriod(start, end),
      headers: ['Quote Number', 'Customer', 'Status', 'Subtotal', window.AppFormatters?.taxLabel || 'Tax', 'Total'],
      rows: context.quotations.map(quote => [
        quote.quote_number || quote.quoteNumber || `Quote #${quote.id || ''}`,
        quote.customer_name || 'Walk-in Customer',
        this.titleCase(quote.status || 'draft'),
        this.formatCurrency(this.toNumber(quote.subtotal)),
        this.formatCurrency(this.toNumber(quote.tax_amount || quote.taxAmount)),
        this.formatCurrency(this.toNumber(quote.total_amount || quote.totalAmount))
      ]),
      chart: this.buildStatusChart(context.quotations),
      summary: {
        quotations: context.quotations.length,
        accepted: context.quotations.filter(item => String(item.status).toLowerCase() === 'accepted').length,
        converted: context.quotations.filter(item => String(item.status).toLowerCase() === 'converted').length,
        totalValue: this.sum(context.quotations, item => this.toNumber(item.total_amount || item.totalAmount))
      }
    };
  }

  generateInvoiceSummary(context, start, end) {
    return {
      title: 'Invoice Summary Report',
      period: this.formatPeriod(start, end),
      headers: ['Invoice Number', 'Customer', 'Status', 'Subtotal', window.AppFormatters?.taxLabel || 'Tax', 'Paid', 'Due', 'Total'],
      rows: context.invoices.map(invoice => [
        invoice.invoice_number || invoice.invoiceNumber || `Invoice #${invoice.id || ''}`,
        invoice.customer_name || 'Walk-in Customer',
        this.titleCase(invoice.status || 'issued'),
        this.formatCurrency(this.toNumber(invoice.subtotal)),
        this.formatCurrency(this.toNumber(invoice.tax_amount || invoice.taxAmount)),
        this.formatCurrency(this.toNumber(invoice.amount_paid || invoice.amountPaid)),
        this.formatCurrency(this.getInvoiceDue(invoice)),
        this.formatCurrency(this.toNumber(invoice.total_amount || invoice.totalAmount))
      ]),
      chart: this.buildStatusChart(context.invoices),
      summary: {
        invoices: context.invoices.length,
        totalInvoiced: this.sum(context.invoices, item => this.toNumber(item.total_amount || item.totalAmount)),
        totalPaid: this.sum(context.invoices, item => this.toNumber(item.amount_paid || item.amountPaid)),
        totalDue: this.sum(context.invoices, item => this.getInvoiceDue(item))
      }
    };
  }

  generateCustomerStatements(context) {
    const invoicesByCustomer = new Map();
    context.invoices.forEach(invoice => {
      const key = String(invoice.customer_id || invoice.customerId || invoice.customer_name || 'Walk-in Customer');
      if (!invoicesByCustomer.has(key)) invoicesByCustomer.set(key, []);
      invoicesByCustomer.get(key).push(invoice);
    });

    return {
      title: 'Customer Statements Report',
      headers: ['Customer', 'Phone', 'Email', 'Balance', 'Credit Limit', 'Invoices'],
      rows: context.customers.map(customer => {
        const customerInvoices = invoicesByCustomer.get(String(customer.id || customer.customer_code)) || invoicesByCustomer.get(customer.name) || [];

        return [
          customer.name || 'Walk-in Customer',
          customer.phone || 'N/A',
          customer.email || 'N/A',
          this.formatCurrency(this.toNumber(customer.current_balance || customer.balance)),
          this.formatCurrency(this.toNumber(customer.credit_limit || customer.creditLimit)),
          customerInvoices.length
        ];
      }),
      summary: {
        customers: context.customers.length,
        totalBalances: this.sum(context.customers, item => this.toNumber(item.current_balance || item.balance)),
        totalCreditLimit: this.sum(context.customers, item => this.toNumber(item.credit_limit || item.creditLimit))
      }
    };
  }

  generateDailySummary(context, start, end) {
    return this.generateSalesSummary(context, start, end);
  }

  async generateAuditLog(context, start, end) {
    const rows = [];
    [...context.quotations, ...context.invoices].forEach(document => {
      (document.audit_logs || []).forEach(log => {
        rows.push([
          this.formatDate(this.getDateValue(log, ['created_at'])),
          this.titleCase(log.action || 'activity'),
          log.entity_type || log.entityType || 'Document',
          log.entity_id || log.entityId || document.id || '',
          log.user_name || log.created_by_name || 'System'
        ]);
      });
    });

    return {
      title: 'Audit Log Report',
      period: this.formatPeriod(start, end),
      headers: ['Date', 'Action', 'Entity', 'Entity ID', 'User'],
      rows,
      summary: { activities: rows.length }
    };
  }

  generateEmptyReport(reportType, start, end) {
    return {
      title: `${this.titleCase(reportType.replace(/-/g, ' '))} Report`,
      period: this.formatPeriod(start, end),
      headers: ['Item', 'Value'],
      rows: [],
      summary: { records: 0 }
    };
  }

  showReportError(reportType, error) {
    const modal = document.getElementById('report-preview-modal');
    const title = document.getElementById('report-preview-title');
    const content = document.getElementById('report-preview-content');
    if (!modal || !title || !content) return;

    const reportName = this.titleCase(String(reportType || 'report').replace(/-/g, ' '));
    title.textContent = `${reportName} unavailable`;
    content.innerHTML = `
      <div class="report-preview-header">
        <h2>Unable to generate ${this.escapeHtml(reportName)}</h2>
        <p>${this.escapeHtml(error?.message || 'A required data source could not be loaded.')}</p>
      </div>
      <div class="report-empty-cell">No report records were invented or substituted.</div>
    `;
    modal.style.display = 'flex';
  }

  showPreview() {
    const modal = document.getElementById('report-preview-modal');
    const title = document.getElementById('report-preview-title');
    const content = document.getElementById('report-preview-content');
    if (!modal || !title || !content || !this.reportData) return;

    title.textContent = this.reportData.title || 'Report Preview';
    content.innerHTML = this.buildReportContentHtml();
    modal.style.display = 'flex';
    this.refreshIcons();
  }

  buildReportContentHtml() {
    const includeReportExtras = this.includeSummary || this.includeCharts;
    let html = '';

    if (includeReportExtras) {
      html += `
        <div class="report-preview-header">
          <h2>${this.escapeHtml(this.reportData.title || 'Report')}</h2>
          ${this.reportData.period ? `<p>${this.escapeHtml(this.reportData.period)}</p>` : ''}
        </div>
      `;
    }

    if (this.includeSummary && this.reportData.summary) {
      html += this.renderSummary(this.reportData.summary);
    }

    if (includeReportExtras && Array.isArray(this.reportData.notices) && this.reportData.notices.length) {
      html += this.renderNotices(this.reportData.notices);
    }

    if (this.includeCharts && this.reportData.chart && this.reportData.chart.length) {
      html += this.renderChart(this.reportData.chart);
    }

    return html + this.renderReportTable();
  }

  renderReportTable() {
    const rows = this.reportData.rows || [];
    const headers = this.reportData.headers || [];
    const hasRows = rows.length > 0;
    const itemText = rows.length === 1 ? 'item' : 'items';
    const tableClass = this.isSalesReport() ? 'report-preview-table report-sales-table' : 'report-preview-table';

    let html = `
      <div class="report-table-card">
        <div class="report-table-toolbar">
          <span>Showing ${this.formatNumber(rows.length)} of ${this.formatNumber(rows.length)} ${itemText}</span>
        </div>
        <div class="report-table-wrap">
          <table class="${tableClass}">
            <thead>
              <tr>
                ${headers.map(header => `<th>${this.escapeHtml(header)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
    `;

    if (hasRows) {
      rows.forEach(row => {
        html += '<tr>';
        row.forEach((cell, index) => {
          const header = headers[index] || '';
          html += `<td class="${this.getReportCellClass(header)}">${this.renderReportCell(cell, header)}</td>`;
        });
        html += '</tr>';
      });
    } else {
      html += `<tr><td colspan="${headers.length || 1}" class="report-empty-cell">No records found for the selected date range.</td></tr>`;
    }

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    return html;
  }

  renderReportCell(value, header = '') {
    const text = this.escapeHtml(value);
    const normalizedHeader = String(header).toLowerCase();

    if (normalizedHeader === 'sale number') {
      return `<span class="report-sale-number">${text}</span>`;
    }

    if (normalizedHeader === 'category') {
      return String(value || '')
        .split(';')
        .map(category => category.trim())
        .filter(Boolean)
        .map(category => `<span class="report-category-pill">${this.escapeHtml(category)}</span>`)
        .join('') || '<span class="report-muted-value">Uncategorized</span>';
    }

    if (normalizedHeader === 'payment method') {
      return `<span class="report-payment-pill">${text || 'N/A'}</span>`;
    }

    if (normalizedHeader === 'status') {
      return `<span class="report-status-pill">${text || 'N/A'}</span>`;
    }

    return text;
  }

  renderSummary(summary) {
    let html = '<div class="report-preview-summary">';
    Object.entries(summary).forEach(([key, value]) => {
      html += `
        <div class="summary-item">
          <div class="label">${this.escapeHtml(this.labelize(key))}</div>
          <div class="value">${this.escapeHtml(this.formatSummaryValue(value, key))}</div>
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  renderNotices(notices) {
    return `
      <div class="report-integrity-notice" role="status">
        <strong>Data availability</strong>
        <ul>
          ${notices.map(notice => `<li>${this.escapeHtml(notice)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  renderChart(chartData) {
    const max = Math.max(...chartData.map(item => this.toNumber(item.value)), 1);
    return `
      <div class="report-chart-container">
        ${chartData.slice(0, 8).map(item => {
          const value = this.toNumber(item.value);
          return `
            <div class="report-chart-row">
              <span>${this.escapeHtml(item.label)}</span>
              <div class="report-chart-track"><div style="width:${Math.max((value / max) * 100, 4)}%"></div></div>
              <strong>${this.escapeHtml(this.formatCompactNumber(value))}</strong>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  closePreview() {
    const modal = document.getElementById('report-preview-modal');
    if (modal) modal.style.display = 'none';
  }

  async downloadReport() {
    if (!this.reportData) return;

    try {
      if (this.format === 'pdf') {
        await this.downloadPdfReport();
        return;
      }

      const content = this.buildCSV();
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.getReportFileBaseName()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      this.showNotification('Report downloaded successfully', 'success');
    } catch (error) {
      console.error('Report download failed:', error);
      this.showNotification(error.message || 'Report download failed', 'error');
    }
  }

  async downloadPdfReport() {
    const pdfExporter = window.electronAPI?.exportReportPdf || window.electronAPI?.exportDocumentPdf;
    if (typeof pdfExporter !== 'function') {
      throw new Error('PDF download is unavailable');
    }

    const result = await pdfExporter({
      documentNumber: this.getReportFileBaseName(),
      html: this.buildPdfReportHtml(),
      fullHtml: true,
      landscape: true
    });

    if (result?.canceled) return;
    if (!result || result.success === false) {
      throw new Error(result?.error || 'PDF download failed');
    }

    this.showNotification('PDF report downloaded successfully', 'success');
  }

  buildPdfReportHtml() {
    const title = this.escapeHtml(this.reportData?.title || 'Report');
    return `<!doctype html>
<html>
<head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { margin: 0; background: #ffffff; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
        .report-pdf-root { width: 100%; }
        .report-preview-header { padding: 0 0 14px; text-align: center; }
        .report-preview-header h2 { margin: 0; color: #0f172a; font-size: 18px; font-weight: 800; }
        .report-preview-header p { margin: 5px 0 0; color: #64748b; font-size: 10px; }
        .report-preview-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 12px; }
        .summary-item { padding: 9px; border: 1px solid #e2e8f0; border-radius: 6px; }
        .summary-item .label { margin-bottom: 5px; color: #64748b; font-size: 7px; font-weight: 800; text-transform: uppercase; }
        .summary-item .value { color: #0f172a; font-size: 12px; font-weight: 800; }
        .report-integrity-notice { margin-bottom: 12px; padding: 9px 10px; color: #7c2d12; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; font-size: 8px; }
        .report-chart-container { margin-bottom: 12px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; }
        .report-chart-row { display: grid; grid-template-columns: 115px 1fr 60px; gap: 8px; align-items: center; margin-bottom: 6px; color: #475569; font-size: 8px; }
        .report-chart-track { height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
        .report-chart-track > div { height: 100%; background: #2563eb; }
        .report-table-card { overflow: hidden; border: 1px solid #dbe2ea; border-radius: 7px; }
        .report-table-toolbar { padding: 8px 10px; color: #475569; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; }
        .report-table-wrap { overflow: visible; border: 0; }
        .report-preview-table { width: 100%; min-width: 0; border-collapse: collapse; table-layout: auto; }
        .report-preview-table th { padding: 7px 8px; color: #334155; text-align: left; white-space: nowrap; background: #f3f4f6; border-bottom: 1px solid #e2e8f0; font-size: 7px; font-weight: 800; text-transform: uppercase; }
        .report-preview-table td { padding: 7px 8px; color: #334155; border-bottom: 1px solid #edf2f7; font-size: 8px; vertical-align: top; }
        .report-preview-table tbody tr:nth-child(even) td { background: #fafafa; }
        .report-preview-table tbody tr:last-child td { border-bottom: 0; }
        .report-sale-number { color: #46658d; font-weight: 800; }
        .report-category-pill, .report-payment-pill, .report-status-pill { display: inline-block; margin: 0 3px 3px 0; padding: 3px 6px; border-radius: 6px; font-size: 7px; font-weight: 700; white-space: nowrap; }
        .report-category-pill { color: #46658d; background: #f1f5f9; }
        .report-payment-pill { color: #075985; background: #e0f2fe; }
        .report-status-pill { color: #047857; background: #d1fae5; }
        .report-empty-cell { padding: 22px !important; color: #94a3b8 !important; text-align: center !important; }
      </style>
</head>
<body>
      <section class="report-pdf-root">
        ${this.buildReportContentHtml()}
      </section>
    </body>
</html>
    `;
  }

  getReportFileBaseName() {
    const type = String(this.currentReportType || 'generated').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'generated';
    return `report-${type}-${new Date().toISOString().slice(0, 10)}`;
  }

  buildCSV() {
    const lines = [];
    const includeReportExtras = this.includeSummary || this.includeCharts;

    if (includeReportExtras) {
      lines.push([this.reportData.title || 'Report'].map(value => this.csvEscape(value)).join(','));
      if (this.reportData.period) lines.push(['Period', this.reportData.period].map(value => this.csvEscape(value)).join(','));
      lines.push([]);
    }

    if (includeReportExtras && Array.isArray(this.reportData.notices) && this.reportData.notices.length) {
      lines.push(['Data Availability'].map(value => this.csvEscape(value)).join(','));
      this.reportData.notices.forEach(notice => {
        lines.push(['Notice', notice].map(value => this.csvEscape(value)).join(','));
      });
      lines.push([]);
    }

    if (this.includeSummary && this.reportData.summary) {
      lines.push(['Summary', 'Value'].map(value => this.csvEscape(value)).join(','));
      Object.entries(this.reportData.summary).forEach(([key, value]) => {
        lines.push([this.labelize(key), this.formatSummaryValue(value, key)].map(item => this.csvEscape(item)).join(','));
      });
      lines.push([]);
    }

    lines.push((this.reportData.headers || []).map(value => this.csvEscape(value)).join(','));
    (this.reportData.rows || []).forEach(row => {
      lines.push(row.map(value => this.csvEscape(value)).join(','));
    });

    return lines.join('\n');
  }

  setReportLoading(card, isLoading) {
    if (!card) return;
    const buttonLabel = card.querySelector('.report-generate-btn');
    if (buttonLabel) buttonLabel.textContent = isLoading ? 'Generating...' : 'Generate';
    card.disabled = isLoading;
    card.classList.toggle('is-loading', isLoading);
  }

  isSalesReport() {
    return String(this.currentReportType || '').startsWith('sales-');
  }

  getReportCellClass(header = '') {
    const normalizedHeader = String(header).toLowerCase();
    const classes = [];
    const moneyTokens = [
      'subtotal',
      'discount',
      'tax',
      'vat',
      'total',
      'gross profit',
      'revenue',
      'paid',
      'due',
      'outstanding',
      'amount',
      'cost',
      'value',
      'balance',
      'credit'
    ];
    const numberTokens = ['quantity', 'line items', 'transactions'];

    if (['items', 'customer', 'user'].includes(normalizedHeader)) classes.push('report-text-cell');
    if (moneyTokens.some(token => normalizedHeader.includes(token))) {
      classes.push('report-money-cell');
    }
    if (numberTokens.some(token => normalizedHeader.includes(token))) classes.push('report-number-cell');

    return classes.join(' ');
  }

  getReportIconClass(type) {
    const colors = {
      'sales-summary': 'green',
      'sales-by-product': 'indigo',
      'sales-by-customer': 'blue',
      'sales-by-category': 'amber',
      'stock-status': 'green',
      'stock-movement': 'blue',
      'inventory-valuation': 'purple',
      'low-stock': 'red',
      'profit-loss': 'orange',
      'tax-summary': 'teal',
      'accounts-receivable': 'pink',
      'quotation-summary': 'blue',
      'invoice-summary': 'indigo',
      'customer-statements': 'purple'
    };

    return colors[type] || 'blue';
  }

  getSaleItems(sales) {
    return sales.flatMap(sale => (sale.items || []).map(item => ({ sale, item })));
  }

  getSaleTotal(sale) {
    return this.toNumber(sale.total_amount || sale.totalAmount || sale.total || 0);
  }

  getSaleQuantity(sale) {
    const recordedQuantity = sale.quantity_sold ?? sale.quantitySold;
    if (recordedQuantity !== null && recordedQuantity !== undefined && recordedQuantity !== '') {
      return this.toNumber(recordedQuantity);
    }
    return this.sum(sale.items || [], item => this.toNumber(item.quantity));
  }

  formatSaleItems(sale) {
    if (sale.item_summary || sale.itemSummary) return sale.item_summary || sale.itemSummary;
    const items = sale.items || [];
    if (!items.length) return 'N/A';

    return items.map(item => {
      const name = item.product_name || item.productName || item.name || item.sku || 'Item';
      return `${name} x${this.formatNumber(item.quantity)}`;
    }).join('; ');
  }

  formatSaleCategories(sale, productMap = new Map()) {
    const categories = (sale.items || []).map(item => {
      const product = productMap.get(String(item.product_id || item.productId)) || {};
      return item.category_name || item.categoryName || item.category || product.category_name || product.category;
    }).filter(Boolean);

    const uniqueCategories = [...new Set(categories.map(category => String(category).trim()).filter(Boolean))];
    return uniqueCategories.length ? uniqueCategories.join('; ') : 'Uncategorized';
  }

  formatSaleUserNames(sale) {
    const names = [
      ...this.toList(sale.user_names || sale.userNames || sale.processed_by_names || sale.processedByNames),
      sale.user_full_name,
      sale.userFullName,
      sale.processed_by_name,
      sale.processedByName,
      sale.cashier_name,
      sale.cashierName,
      sale.created_by_name,
      sale.createdByName
    ].filter(Boolean);
    const uniqueNames = [...new Set(names.map(name => String(name).trim()).filter(Boolean))];
    return uniqueNames.length ? uniqueNames.join('; ') : 'N/A';
  }

  toList(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(/[;,]/);
    return [];
  }

  formatPaymentMethod(method) {
    if (!method) return 'N/A';
    return this.titleCase(String(method).replace(/[-_]+/g, ' '));
  }

  getSaleCost(sale) {
    const items = sale.items || [];
    if (!items.length) return null;

    let total = 0;
    for (const item of items) {
      const quantity = this.toNumber(item.quantity);
      const cost = this.getItemUnitCost(item);
      if (cost === null) return null;
      total += quantity * cost;
    }
    return total;
  }

  getItemUnitCost(item) {
    return this.getVerifiedCost(item.unit_cost ?? item.unitCost);
  }

  getVerifiedCost(rawCost) {
    if (rawCost === null || rawCost === undefined || rawCost === '') return null;
    const cost = Number(rawCost);
    return Number.isFinite(cost) && cost >= 0 ? cost : null;
  }

  getSaleNetRevenue(sale) {
    const subtotal = this.toNumber(sale.subtotal);
    const discount = this.toNumber(sale.discount_amount || sale.discountAmount);
    const tax = this.toNumber(sale.tax_amount || sale.taxAmount);
    return Math.max((subtotal || this.getSaleTotal(sale) - tax) - discount, 0);
  }

  getSaleProfit(sale) {
    const cost = this.getSaleCost(sale);
    if (cost === null) return null;
    return this.getSaleNetRevenue(sale) - cost;
  }

  getMissingHistoricalCostNotice() {
    return 'Gross profit and cost of goods sold are unavailable for records without a transaction-time cost snapshot.';
  }

  getCostNotices(items, mapper) {
    return items.some(item => mapper(item) === null)
      ? [this.getMissingHistoricalCostNotice()]
      : [];
  }

  getInventoryRows(context) {
    return context.inventory;
  }

  getInvoiceDue(invoice) {
    return Math.max(this.toNumber(invoice.total_amount || invoice.totalAmount) - this.toNumber(invoice.amount_paid || invoice.amountPaid), 0);
  }

  getStockStatus(available, reorder) {
    if (available <= 0) return 'Out of Stock';
    if (available <= reorder) return 'Low Stock';
    return 'In Stock';
  }

  buildStatusChart(items) {
    const grouped = new Map();
    items.forEach(item => {
      const status = this.titleCase(item.status || 'unknown');
      grouped.set(status, (grouped.get(status) || 0) + 1);
    });
    return this.buildChartData([...grouped.entries()].map(([label, value]) => ({ label, value })));
  }

  buildChartData(items) {
    return items.filter(item => this.toNumber(item.value) > 0);
  }

  filterByDate(items, start, end, keys) {
    return items.filter(item => {
      const date = this.getDateValue(item, keys);
      if (!date) return true;
      return date >= start && date <= end;
    });
  }

  getDateValue(item, keys) {
    for (const key of keys) {
      if (item && item[key]) {
        const date = new Date(item[key]);
        if (!Number.isNaN(date.getTime())) return date;
      }
    }
    return null;
  }

  indexById(items) {
    const map = new Map();
    items.forEach(item => {
      if (item.id !== undefined && item.id !== null) map.set(String(item.id), item);
      if (item.customer_code) map.set(String(item.customer_code), item);
      if (item.sku) map.set(String(item.sku), item);
    });
    return map;
  }

  getCustomerName(customer) {
    return customer ? (customer.name || customer.full_name || customer.customer_name || 'Walk-in Customer') : '';
  }

  getAgeInDays(dateValue) {
    const date = dateValue ? new Date(dateValue) : null;
    if (!date || Number.isNaN(date.getTime())) return 0;
    return Math.max(Math.floor((Date.now() - date.getTime()) / 86400000), 0);
  }

  sum(items, mapper) {
    return items.reduce((total, item) => total + this.toNumber(mapper(item)), 0);
  }

  sumAvailable(items, mapper) {
    let total = 0;
    for (const item of items) {
      const value = mapper(item);
      if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
      total += Number(value);
    }
    return total;
  }

  toNumber(value) {
    const number = parseFloat(value);
    return Number.isFinite(number) ? number : 0;
  }

  toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDate(date) {
    if (!date) return 'N/A';
    if (window.AppFormatters?.formatDate) {
      return window.AppFormatters.formatDate(date);
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatPeriod(start, end) {
    return `${this.formatDate(start)} - ${this.formatDate(end)}`;
  }

  formatCurrency(amount) {
    if (window.AppFormatters && typeof window.AppFormatters.formatCurrency === 'function') {
      return window.AppFormatters.formatCurrency(this.toNumber(amount));
    }
    return this.toNumber(amount).toFixed(2);
  }

  formatNumber(value) {
    return this.toNumber(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  formatCompactNumber(value) {
    const number = this.toNumber(value);
    if (Math.abs(number) >= 1000) return this.formatCurrency(number);
    return this.formatNumber(number);
  }

  formatSummaryValue(value, key = '') {
    if (value === null || value === undefined) {
      const normalizedKey = String(key).toLowerCase();
      if (normalizedKey.includes('netprofit')) return EXPENSE_DATA_UNAVAILABLE;
      if (
        normalizedKey.includes('profit')
        || normalizedKey.includes('cost')
        || normalizedKey.includes('margin')
      ) {
        return VERIFIED_COST_UNAVAILABLE;
      }
      return 'N/A';
    }
    if (typeof value === 'number') {
      const currencyKeys = ['revenue', 'tax', 'profit', 'cost', 'value', 'margin', 'balance', 'credit', 'paid', 'due', 'outstanding', 'amount'];
      const isCurrency = currencyKeys.some(token => String(key).toLowerCase().includes(token));
      return isCurrency ? this.formatCurrency(value) : this.formatNumber(value);
    }
    return String(value);
  }

  csvEscape(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  }

  labelize(key) {
    return String(key).replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').replace(/^./, letter => letter.toUpperCase());
  }

  titleCase(value) {
    return String(value || '').replace(/[-_]+/g, ' ').replace(/\w\S*/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  showNotification(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  }
}

if (typeof window !== 'undefined') {
  window.ReportsView = ReportsView;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReportsView;
}
