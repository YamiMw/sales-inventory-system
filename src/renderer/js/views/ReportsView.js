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
              <span class="report-card-icon ${this.getReportIconClass(type)}">${this.iconImage(cardIcon, 'custom-ui-icon report-card-icon-img')}</span>
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
      window.AppDialogs?.alert(message, {
        title: type === 'error' ? 'Error' : 'Notice',
        variant: type,
        primaryLabel: 'OK'
      });
    }
  }
}

if (typeof window !== 'undefined') {
  window.ReportsView = ReportsView;
}

if (typeof module !== 'undefined' && module.exports) {
  require('./ReportsView.output')(ReportsView);
  require('./ReportsView.generators')(ReportsView);
  module.exports = ReportsView;
}
