/**
 * POS Sales History View
 * Displays completed point-of-sale transactions. Formal invoices and
 * quotations are managed by QuotationsInvoicesView.
 */
class SalesView {
  constructor() {
    this.sales = [];
    this.filteredSales = [];
    this.currentPage = 1;
    this.perPage = 25;
    this.searchQuery = '';
    this.paymentFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.isLoading = false;
    this.init();
  }

  async init() {
    this.renderShell();
    this.setupEventListeners();
    await this.loadData();
    this.render();
  }

  renderShell() {
    const root = document.getElementById('sales-view');
    if (!root) return;

    root.innerHTML = `
      <div class="view-header sales-view-toolbar">
        <div>
          <h1>POS Sales History</h1>
          <p class="view-subtitle">Review completed point-of-sale transactions and sold items.</p>
        </div>
        <div class="header-actions sales-toolbar-actions">
          <button type="button" id="open-documents-btn" class="btn-secondary">
            ${this.salesIcon('documents', 'sales-button-icon')}
            <span>Invoices &amp; Quotations</span>
          </button>
          <button type="button" id="export-sales-btn" class="btn-secondary">
            <svg class="sales-button-icon sales-export-icon" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
              aria-hidden="true">
              <path d="M14 3h7v7"></path>
              <path d="M10 14 21 3"></path>
              <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path>
            </svg>
            <span class="sales-action-label">Export</span>
          </button>
          <button type="button" id="new-pos-sale-btn" class="btn-primary">
            ${this.salesIcon('plus', 'sales-button-icon')}
            <span>New POS Sale</span>
          </button>
        </div>
      </div>

      <div id="invoices-tab" class="sales-tab-content active">
        <div class="stats-grid">
          ${this.summaryCardMarkup('wallet', 'TOTAL SALES', 'sales-total-value', this.formatCurrency(0))}
          ${this.summaryCardMarkup('receipt', 'TRANSACTIONS', 'sales-transaction-count', '0')}
          ${this.summaryCardMarkup('package', 'UNITS SOLD', 'sales-units-sold', '0')}
          ${this.summaryCardMarkup('calendar-check', 'THIS MONTH', 'sales-month-value', this.formatCurrency(0))}
        </div>

        <div class="products-filters">
          <div class="search-wrapper">
            ${this.salesIcon('search', 'search-icon sales-field-icon')}
            <input type="search" id="sales-search"
              placeholder="Search sale number, customer, product or SKU..." class="search-input">
          </div>
          <div class="filter-select">
            ${this.salesIcon('credit-card', 'filter-icon sales-field-icon')}
            <select id="sales-payment-filter">
              <option value="">Payment Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mobile">Mobile</option>
              <option value="bank">Bank Transfer</option>
              <option value="credit">Credit</option>
            </select>
          </div>
          <div class="sales-date-range-filter">
            <button type="button" id="sales-date-range-btn" class="sales-date-range-btn"
              aria-haspopup="dialog" aria-expanded="false">
              ${this.salesIcon('calendar', 'sales-button-icon')}
              <span id="sales-date-range-label">Date Range</span>
              ${this.salesIcon('chevron-down', 'sales-date-chevron')}
            </button>
            <div id="sales-date-range-panel" class="sales-date-range-panel" role="dialog"
              aria-label="Filter sales by date range" hidden>
              <div class="sales-date-range-fields">
                <label>
                  <span>Start Date</span>
                  <input type="date" id="sales-start-date">
                </label>
                <label>
                  <span>End Date</span>
                  <input type="date" id="sales-end-date">
                </label>
              </div>
              <div class="sales-date-range-actions">
                <button type="button" id="clear-sales-date-range" class="sales-date-clear">Clear</button>
                <button type="button" id="apply-sales-date-range" class="sales-date-apply">Apply</button>
              </div>
            </div>
          </div>
          <button type="button" id="reset-sales-filters" class="sales-reset-filters">Reset Filters</button>
          <button type="button" id="refresh-sales" class="btn-icon" title="Refresh POS sales history">
            ${this.salesIcon('refresh')}
          </button>
        </div>

        <div class="products-table-container sales-history-table-card">
          <div class="table-header">
            <span id="sales-history-count">Showing 0 POS sales</span>
            <label class="sales-per-page-selector" for="sales-per-page">
              <span>Per Page:</span>
              <select id="sales-per-page">
                <option value="10">10</option>
                <option value="25" selected>25</option>
                <option value="50">50</option>
              </select>
            </label>
          </div>
          <div class="table-wrapper">
            <table class="products-table">
              <thead>
                <tr>
                  <th>Sale #</th><th>Date</th><th>Customer</th><th>User</th><th>Items Sold</th>
                  <th>Units</th><th>Payment</th><th>Total</th><th>Actions</th>
                </tr>
              </thead>
              <tbody id="sales-history-tbody"></tbody>
            </table>
          </div>
          <div class="table-footer">
            <span>Formal invoices and quotations are managed in the Documents workspace.</span>
            <div class="pagination" id="sales-history-pagination"></div>
          </div>
        </div>
      </div>
    `;
  }

  summaryCardMarkup(icon, label, id, value) {
    return `
      <div class="stat-card">
        <div class="stat-icon">${this.salesIcon(icon, 'sales-stat-icon')}</div>
        <div class="stat-content">
          <h3>${label}</h3>
          <p class="stat-value" id="${id}">${value}</p>
        </div>
      </div>
    `;
  }

  salesIcon(name, className = '') {
    const classes = ['sales-ui-icon', className].filter(Boolean).join(' ');
    const icons = {
      'calendar': `
        <rect x="4" y="5" width="16" height="15" rx="3"></rect>
        <path d="M8 3.5v4"></path>
        <path d="M16 3.5v4"></path>
        <path d="M4 10h16"></path>
      `,
      'calendar-check': `
        <rect x="4" y="5" width="16" height="15" rx="3"></rect>
        <path d="M8 3.5v4"></path>
        <path d="M16 3.5v4"></path>
        <path d="M4 10h16"></path>
        <path d="m8.6 15.1 2.2 2.1 4.8-4.8"></path>
      `,
      'chevron-down': '<path d="m6 9 6 6 6-6"></path>',
      'credit-card': `
        <rect x="3" y="5.5" width="18" height="13" rx="3.2"></rect>
        <path d="M3 10.3h18"></path>
      `,
      'documents': `
        <path d="M7.5 4.5h8.2l3.8 3.8v11.2H7.5z"></path>
        <path d="M15.5 4.8v3.8h3.7"></path>
        <path d="M4.5 7.5v12.8h11"></path>
        <path d="M10.5 12h6"></path>
        <path d="M10.5 15.5h5"></path>
      `,
      'package': `
        <path d="M12 3.5 20 8v8.2l-8 4.3-8-4.3V8z"></path>
        <path d="m4.5 8.2 7.5 4.2 7.5-4.2"></path>
        <path d="M12 12.4v8"></path>
        <path d="m8.2 5.7 7.6 4.3"></path>
      `,
      'plus': `
        <path d="M12 5v14"></path>
        <path d="M5 12h14"></path>
      `,
      'receipt': `
        <path d="M6.2 3.5h11.6v17l-1.9-1.2-2 1.2-1.9-1.2-2 1.2-1.9-1.2-1.9 1.2z"></path>
        <path d="M9 8.2h6"></path>
        <path d="M9 11.5h6"></path>
        <path d="M9 14.8h4.8"></path>
      `,
      'refresh': `
        <path d="M19.2 7.2A7.4 7.4 0 1 0 20 15"></path>
        <path d="M19.3 3.7v3.8h-3.8"></path>
      `,
      'search': `
        <circle cx="10.8" cy="10.8" r="6.3"></circle>
        <path d="m15.5 15.5 4.5 4.5"></path>
      `,
      'wallet': `
        <path d="M5.5 8.2h12.3a2.8 2.8 0 0 1 2.8 2.8v6.2a2.8 2.8 0 0 1-2.8 2.8H5.5a2.8 2.8 0 0 1-2.8-2.8V11a2.8 2.8 0 0 1 2.8-2.8z"></path>
        <path d="M5.4 8.2V6.8a2.3 2.3 0 0 1 2.3-2.3h8.8a2.3 2.3 0 0 1 2.3 2.3v1.4"></path>
        <circle cx="16.6" cy="14.1" r="1.7"></circle>
      `
    };

    return `
      <svg class="${classes}" viewBox="0 0 24 24" aria-hidden="true">
        ${icons[name] || icons.search}
      </svg>
    `;
  }

  async loadData() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      if (!window.electronAPI?.getSales) {
        throw new Error('Sales history service is unavailable');
      }

      const result = await window.electronAPI.getSales({ limit: 1000 });
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to load POS sales history');
      }

      this.sales = Array.isArray(result.data)
        ? result.data.map(sale => this.normalizeSale(sale))
        : [];
    } catch (error) {
      console.error('Failed to load POS sales history:', error);
      this.sales = [];
      this.showNotification(error.message || 'Failed to load POS sales history', 'error');
    } finally {
      this.isLoading = false;
    }

    this.applyFilters();
  }

  normalizeSale(sale) {
    const items = Array.isArray(sale.items) ? sale.items : [];
    const total = Number.parseFloat(sale.total_amount);
    const subtotal = Number.parseFloat(sale.subtotal);
    const taxAmount = Number.parseFloat(sale.tax_amount);
    const discountAmount = Number.parseFloat(sale.discount_amount);

    return {
      id: sale.id,
      saleNumber: sale.invoice_number || `POS-${sale.id}`,
      date: sale.created_at,
      customer: sale.customer_name || 'Walk-in Customer',
      customerAddress: sale.customer_address || '',
      userFullName: this.getSaleUserFullName(sale),
      total: Number.isFinite(total) ? total : 0,
      subtotal: Number.isFinite(subtotal) ? subtotal : null,
      taxAmount: Number.isFinite(taxAmount) ? taxAmount : 0,
      discountAmount: Number.isFinite(discountAmount) ? discountAmount : 0,
      paymentMethod: this.normalizePaymentMethod(sale.payment_method),
      notes: sale.notes || '',
      items: items.map(item => ({
        name: item.product_name || item.name || item.sku || 'Item',
        sku: item.sku || '',
        quantity: Number.parseInt(item.quantity, 10) || 0,
        unitPrice: Number.parseFloat(item.unit_price) || 0,
        totalPrice: Number.parseFloat(item.total_price) || 0
      }))
    };
  }

  getSaleUserFullName(sale) {
    const names = [
      sale.user_full_name,
      sale.userFullName,
      sale.processed_by_name,
      sale.processedByName,
      sale.cashier_name,
      sale.cashierName,
      sale.created_by_name,
      sale.createdByName
    ].filter(Boolean)
      .map(name => String(name).trim())
      .filter(Boolean);
    return names.length ? [...new Set(names)].join('; ') : 'N/A';
  }

  applyFilters() {
    const search = this.searchQuery.trim().toLowerCase();

    this.filteredSales = this.sales.filter(sale => {
      const searchable = [
        sale.saleNumber,
        sale.customer,
        sale.userFullName,
        sale.paymentMethod,
        ...sale.items.flatMap(item => [item.name, item.sku])
      ].join(' ').toLowerCase();

      return (!search || searchable.includes(search)) &&
        (!this.paymentFilter || sale.paymentMethod === this.paymentFilter) &&
        this.isWithinDateRange(sale.date);
    });

    const maxPage = Math.max(1, Math.ceil(this.filteredSales.length / this.perPage));
    this.currentPage = Math.min(this.currentPage, maxPage);
  }

  isWithinDateRange(value) {
    if (!this.startDate && !this.endDate) return true;
    const date = this.parseDate(value);
    if (!date) return false;

    if (this.startDate && date < new Date(`${this.startDate}T00:00:00`)) return false;
    if (this.endDate && date > new Date(`${this.endDate}T23:59:59.999`)) return false;
    return true;
  }

  render() {
    this.renderPaymentFilter();
    this.renderSummary();
    this.renderTable();
    this.renderPagination();
    this.updateDateRangeButton();
    if (window.lucide) window.lucide.createIcons();
  }

  renderPaymentFilter() {
    const select = document.getElementById('sales-payment-filter');
    if (!select) return;

    const selected = this.paymentFilter;
    select.replaceChildren(new Option('Payment Methods', ''));
    [
      ['cash', 'Cash'],
      ['card', 'Card'],
      ['mobile', 'Mobile'],
      ['bank', 'Bank Transfer'],
      ['credit', 'Credit']
    ].forEach(([value, label]) => select.add(new Option(label, value)));
    select.value = selected;
  }

  renderSummary() {
    const totalSales = this.sales.reduce((sum, sale) => sum + sale.total, 0);
    const unitsSold = this.sales.reduce((sum, sale) => sum + this.getQuantitySold(sale), 0);
    const now = new Date();
    const monthSales = this.sales
      .filter(sale => {
        const date = this.parseDate(sale.date);
        return date &&
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth();
      })
      .reduce((sum, sale) => sum + sale.total, 0);

    this.setText('sales-total-value', this.formatCurrency(totalSales));
    this.setText('sales-transaction-count', this.sales.length.toLocaleString());
    this.setText('sales-units-sold', unitsSold.toLocaleString());
    this.setText('sales-month-value', this.formatCurrency(monthSales));
  }

  renderTable() {
    const tbody = document.getElementById('sales-history-tbody');
    const count = document.getElementById('sales-history-count');
    if (!tbody) return;

    const start = (this.currentPage - 1) * this.perPage;
    const pageItems = this.filteredSales.slice(start, start + this.perPage);

    if (count) {
      count.textContent = `Showing ${pageItems.length} of ${this.filteredSales.length} sales`;
    }

    if (!pageItems.length) {
      window.TemplateRenderer?.appendEmptyRow(
        tbody,
        9,
        'No POS sales found',
        this.sales.length ? 'Try changing the search or date filters.' : 'Completed POS transactions will appear here.',
        'sales-empty-state'
      );
      return;
    }

    const fragment = document.createDocumentFragment();
    pageItems.forEach(sale => {
      const row = window.TemplateRenderer?.clone('sales-row-template') || document.createElement('tr');
      window.TemplateRenderer?.setHtml(row, '[data-number]', `<span class="product-sku"></span>`);
      row.querySelector('[data-number] .product-sku').textContent = sale.saleNumber;
      window.TemplateRenderer?.setHtml(row, '[data-date]', `<span class="sales-history-date"></span>`);
      row.querySelector('[data-date] .sales-history-date').textContent = this.formatDate(sale.date);
      window.TemplateRenderer?.setHtml(row, '[data-customer]', `<span class="product-name"></span>`);
      row.querySelector('[data-customer] .product-name').textContent = sale.customer;
      window.TemplateRenderer?.setHtml(row, '[data-user]', `<span class="product-name"></span>`);
      row.querySelector('[data-user] .product-name').textContent = sale.userFullName;
      window.TemplateRenderer?.setHtml(row, '[data-items]', this.renderSoldItems(sale.items));
      window.TemplateRenderer?.setHtml(row, '[data-quantity]', `<span class="sales-quantity-total"></span>`);
      row.querySelector('[data-quantity] .sales-quantity-total').textContent = this.getQuantitySold(sale);
      window.TemplateRenderer?.setHtml(row, '[data-payment]', `<span class="sales-payment-method"></span>`);
      row.querySelector('[data-payment] .sales-payment-method').textContent = this.formatPaymentMethod(sale.paymentMethod);
      window.TemplateRenderer?.setHtml(row, '[data-total]', `<span class="product-price"></span>`);
      row.querySelector('[data-total] .product-price').textContent = this.formatCurrency(sale.total);
      const actionCell = row.querySelector('[data-actions]');
      if (actionCell) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sales-action-menu-btn';
        button.dataset.viewSale = sale.id;
        button.title = 'View POS sale';
        button.setAttribute('aria-label', `View ${sale.saleNumber}`);
        const span = document.createElement('span');
        span.setAttribute('aria-hidden', 'true');
        span.textContent = '⋮';
        button.appendChild(span);
        actionCell.replaceChildren(button);
      }
      fragment.appendChild(row);
    });
    tbody.replaceChildren(fragment);
  }

  renderSoldItems(items) {
    if (!items.length) return '<span class="sales-item-summary">No item details</span>';
    return `
      <div class="sales-sold-items">
        ${items.slice(0, 2).map(item => `
          <span class="sales-sold-item">
            <span class="sales-sold-name">${this.escapeHtml(item.name)}</span>
            <span class="sales-sold-qty">x${item.quantity}</span>
          </span>
        `).join('')}
        ${items.length > 2 ? `<span class="sales-more-items">+${items.length - 2} more</span>` : ''}
      </div>
    `;
  }

  renderPagination() {
    const container = document.getElementById('sales-history-pagination');
    if (!container) return;

    const totalPages = Math.ceil(this.filteredSales.length / this.perPage);
    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    const pages = [];
    for (let page = 1; page <= totalPages; page += 1) {
      if (page === 1 || page === totalPages || Math.abs(page - this.currentPage) <= 1) pages.push(page);
    }

    let previousPage = 0;
    const pageButtons = [...new Set(pages)].map(page => {
      const gap = previousPage && page - previousPage > 1
        ? '<span class="sales-pagination-gap">...</span>'
        : '';
      previousPage = page;
      return `${gap}<button type="button" class="pagination-btn${page === this.currentPage ? ' active' : ''}"
        data-sales-page="${page}">${page}</button>`;
    }).join('');

    container.innerHTML = `
      <button type="button" class="pagination-btn" data-sales-page="${this.currentPage - 1}"
        ${this.currentPage === 1 ? 'disabled' : ''} aria-label="Previous page">&lsaquo;</button>
      ${pageButtons}
      <button type="button" class="pagination-btn" data-sales-page="${this.currentPage + 1}"
        ${this.currentPage === totalPages ? 'disabled' : ''} aria-label="Next page">&rsaquo;</button>
    `;
  }

  viewSale(id) {
    const sale = this.sales.find(item => String(item.id) === String(id));
    const modal = document.getElementById('invoice-modal');
    const title = document.getElementById('invoice-modal-title');
    const body = document.getElementById('invoice-modal-body');
    const action = document.getElementById('invoice-modal-action');
    if (!sale || !modal || !title || !body) return;

    title.textContent = `POS Sale: ${sale.saleNumber}`;
    body.innerHTML = `
      <div class="invoice-detail-grid">
        ${this.detailItem('Sale Number', sale.saleNumber)}
        ${this.detailItem('Date', this.formatDateTime(sale.date))}
        ${this.detailItem('Customer', sale.customer)}
        ${this.detailItem('User', sale.userFullName)}
        ${this.detailItem('Payment Method', this.formatPaymentMethod(sale.paymentMethod))}
        ${this.detailItem('Units Sold', this.getQuantitySold(sale).toLocaleString())}
        ${this.detailItem('Total Amount', this.formatCurrency(sale.total))}
      </div>
      <div class="sales-detail-items">
        <h3>Items Sold</h3>
        ${sale.items.length ? `
          <div class="sales-detail-table-wrap">
            <table class="sales-detail-table">
              <thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
              <tbody>
                ${sale.items.map(item => `
                  <tr>
                    <td>${this.escapeHtml(item.name)}</td>
                    <td>${this.escapeHtml(item.sku || '-')}</td>
                    <td>${item.quantity}</td>
                    <td>${this.formatCurrency(item.unitPrice)}</td>
                    <td>${this.formatCurrency(item.totalPrice)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p class="sales-detail-empty">Item details are unavailable for this sale.</p>'}
      </div>
      ${sale.notes ? `<div class="sales-detail-notes"><strong>Notes</strong><p>${this.escapeHtml(sale.notes)}</p></div>` : ''}
    `;

    if (action) {
      action.hidden = false;
      action.textContent = 'Print';
      action.disabled = false;
      action.onclick = () => this.printSale(sale, action);
    }
    modal.style.display = 'flex';
  }

  async printSale(sale, button = null) {
    if (!sale || !window.ReceiptPrinter?.printReceipt) {
      this.showNotification('Receipt printing is unavailable. Restart the app and try again.', 'warning');
      return false;
    }

    const originalText = button?.textContent || 'Print';
    if (button) {
      button.disabled = true;
      button.textContent = 'Printing...';
    }

    try {
      const settings = await this.getReceiptSettings();
      const itemSubtotal = sale.items.reduce((sum, item) => {
        const lineTotal = Number.isFinite(item.totalPrice)
          ? item.totalPrice
          : Number(item.quantity || 0) * Number(item.unitPrice || 0);
        return sum + lineTotal;
      }, 0);
      const subtotal = Number.isFinite(Number(sale.subtotal))
        ? Number(sale.subtotal)
        : itemSubtotal || sale.total;

      await window.ReceiptPrinter.printReceipt({
        id: sale.id,
        invoiceNumber: sale.saleNumber,
        invoice_number: sale.saleNumber,
        createdAt: sale.date,
        customerName: sale.customer,
        customerAddress: sale.customerAddress,
        paymentMethod: sale.paymentMethod,
        subtotal,
        discount: sale.discountAmount || 0,
        tax: sale.taxAmount || 0,
        total: sale.total,
        amountPaid: sale.total,
        change: 0,
        notes: sale.notes,
        items: sale.items.map(item => ({
          name: item.name,
          productName: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          price: item.unitPrice,
          totalPrice: item.totalPrice
        }))
      }, settings);

      this.showNotification(`Receipt sent to ${settings.printer_device || 'the selected printer'}`, 'success');
      return true;
    } catch (error) {
      console.error('POS sale print failed:', error);
      this.showNotification(error.message || 'Unable to print this POS sale', 'warning');
      return false;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  async getReceiptSettings() {
    if (window.appSettings) return window.appSettings;
    if (!window.electronAPI?.getSettings) return {};

    try {
      const result = await window.electronAPI.getSettings();
      if (result?.success && result.data) {
        return result.data;
      }
    } catch (error) {
      console.warn('Unable to load receipt settings for POS sale print:', error);
    }

    return {};
  }

  detailItem(label, value) {
    return `
      <div class="invoice-detail-item">
        <div class="invoice-detail-label">${this.escapeHtml(label)}</div>
        <div class="invoice-detail-value">${this.escapeHtml(value)}</div>
      </div>
    `;
  }

  openDateRangeFilter() {
    const panel = document.getElementById('sales-date-range-panel');
    const button = document.getElementById('sales-date-range-btn');
    const startInput = document.getElementById('sales-start-date');
    const endInput = document.getElementById('sales-end-date');
    if (!panel || !button) return;

    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    button.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) {
      if (startInput) startInput.value = this.startDate;
      if (endInput) endInput.value = this.endDate;
      startInput?.focus();
    }
  }

  applyDateRangeFilter() {
    const nextStart = document.getElementById('sales-start-date')?.value || '';
    const nextEnd = document.getElementById('sales-end-date')?.value || '';
    if (!this.isValidDateInput(nextStart) || !this.isValidDateInput(nextEnd)) {
      this.showNotification('Select valid start and end dates', 'warning');
      return false;
    }
    if (nextStart && nextEnd && nextStart > nextEnd) {
      this.showNotification('Start date must be before the end date', 'warning');
      return false;
    }

    this.startDate = nextStart;
    this.endDate = nextEnd;
    this.currentPage = 1;
    this.applyFilters();
    this.render();
    this.closeDateRangeFilter();
    return true;
  }

  clearDateRangeFilter() {
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1;
    this.applyFilters();
    this.render();
    this.closeDateRangeFilter();
  }

  resetFilters() {
    this.searchQuery = '';
    this.paymentFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1;

    const search = document.getElementById('sales-search');
    const payment = document.getElementById('sales-payment-filter');
    if (search) search.value = '';
    if (payment) payment.value = '';

    this.applyFilters();
    this.render();
    this.closeDateRangeFilter();
  }

  closeDateRangeFilter() {
    const panel = document.getElementById('sales-date-range-panel');
    const button = document.getElementById('sales-date-range-btn');
    if (panel) panel.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
  }

  isValidDateInput(value) {
    if (!value) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
  }

  updateDateRangeButton() {
    const labelElement = document.getElementById('sales-date-range-label');
    const startInput = document.getElementById('sales-start-date');
    const endInput = document.getElementById('sales-end-date');
    if (!labelElement) return;
    const label = this.startDate || this.endDate
      ? `${this.formatFilterDate(this.startDate) || 'Any'} - ${this.formatFilterDate(this.endDate) || 'Any'}`
      : 'Date Range';
    labelElement.textContent = label;
    if (startInput) startInput.value = this.startDate;
    if (endInput) endInput.value = this.endDate;
  }

  setupEventListeners() {
    document.getElementById('sales-view')?.addEventListener('click', event => {
      const viewButton = event.target.closest('[data-view-sale]');
      if (viewButton) {
        this.viewSale(viewButton.dataset.viewSale);
        return;
      }

      const pageButton = event.target.closest('[data-sales-page]');
      if (pageButton && !pageButton.disabled) {
        this.currentPage = Number.parseInt(pageButton.dataset.salesPage, 10) || 1;
        this.renderTable();
        this.renderPagination();
        if (window.lucide) window.lucide.createIcons();
      }
    });

    document.getElementById('sales-search')?.addEventListener('input', event => {
      this.searchQuery = event.target.value;
      this.currentPage = 1;
      this.applyFilters();
      this.renderTable();
      this.renderPagination();
      if (window.lucide) window.lucide.createIcons();
    });

    document.getElementById('sales-payment-filter')?.addEventListener('change', event => {
      this.paymentFilter = event.target.value;
      this.currentPage = 1;
      this.applyFilters();
      this.renderTable();
      this.renderPagination();
      if (window.lucide) window.lucide.createIcons();
    });

    document.getElementById('sales-per-page')?.addEventListener('change', event => {
      this.perPage = Number.parseInt(event.target.value, 10) || 25;
      this.currentPage = 1;
      this.renderTable();
      this.renderPagination();
      if (window.lucide) window.lucide.createIcons();
    });

    document.getElementById('refresh-sales')?.addEventListener('click', async () => {
      await this.loadData();
      this.render();
      this.showNotification('POS sales history refreshed', 'success');
    });

    document.getElementById('sales-date-range-btn')?.addEventListener('click', () => this.openDateRangeFilter());
    document.getElementById('apply-sales-date-range')?.addEventListener('click', () => this.applyDateRangeFilter());
    document.getElementById('clear-sales-date-range')?.addEventListener('click', () => this.clearDateRangeFilter());
    document.getElementById('reset-sales-filters')?.addEventListener('click', () => this.resetFilters());
    document.getElementById('export-sales-btn')?.addEventListener('click', () => this.exportSales());
    document.getElementById('new-pos-sale-btn')?.addEventListener('click', () => window.app?.navigateTo?.('pos'));
    document.getElementById('open-documents-btn')?.addEventListener('click', () => window.app?.navigateTo?.('quotations-invoices'));

    document.getElementById('invoice-modal')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) event.currentTarget.style.display = 'none';
    });
  }

  exportSales() {
    if (!this.filteredSales.length) {
      this.showNotification('There are no POS sales to export', 'info');
      return;
    }

    const rows = [
      ['Sale Number', 'Date', 'Customer', 'User', 'Items', 'Units', 'Payment Method', 'Total'],
      ...this.filteredSales.map(sale => [
        sale.saleNumber,
        this.formatDateTime(sale.date),
        sale.customer,
        sale.userFullName,
        sale.items.map(item => `${item.name} x${item.quantity}`).join('; '),
        this.getQuantitySold(sale),
        this.formatPaymentMethod(sale.paymentMethod),
        sale.total
      ])
    ];
    const csv = rows.map(row => row.map(value => this.csvCell(value)).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const range = this.startDate || this.endDate
      ? `${this.startDate || 'any'}-to-${this.endDate || 'any'}`
      : new Date().toISOString().slice(0, 10);
    link.download = `pos-sales-${range}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    this.showNotification(`${this.filteredSales.length} POS sale${this.filteredSales.length === 1 ? '' : 's'} exported`, 'success');
  }

  csvCell(value) {
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  getQuantitySold(sale) {
    return sale.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  formatPaymentMethod(value) {
    const labels = {
      cash: 'Cash',
      card: 'Card',
      mobile: 'Mobile',
      bank: 'Bank Transfer',
      credit: 'Credit'
    };
    const normalized = this.normalizePaymentMethod(value);
    return labels[normalized] || String(value || 'Cash');
  }

  normalizePaymentMethod(value) {
    const normalized = String(value || 'cash').trim().toLowerCase().replace(/[_-]+/g, ' ');
    if (['mobile money', 'mobile payment'].includes(normalized)) return 'mobile';
    if (['bank transfer', 'bank payment'].includes(normalized)) return 'bank';
    return ['cash', 'card', 'mobile', 'bank', 'credit'].includes(normalized) ? normalized : normalized;
  }

  formatFilterDate(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  parseDate(value) {
    if (!value) return null;
    const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? value.replace(' ', 'T')
      : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  formatDate(value) {
    const date = this.parseDate(value);
    return date
      ? (window.AppFormatters?.formatDate(date) || date.toLocaleDateString())
      : 'N/A';
  }

  formatDateTime(value) {
    const date = this.parseDate(value);
    return date
      ? (window.AppFormatters?.formatDateTime(date) || date.toLocaleString())
      : 'N/A';
  }

  formatCurrency(value) {
    return window.AppFormatters.formatCurrency(value);
  }

  setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = String(value ?? '');
    return node.innerHTML;
  }

  showNotification(message, type = 'info') {
    if (window.showNotification) window.showNotification(message, type);
    else {
      window.AppDialogs?.alert(message, {
        title: type === 'error' ? 'Error' : 'Notice',
        variant: type,
        primaryLabel: 'OK'
      });
    }
  }
}

window.SalesView = SalesView;
