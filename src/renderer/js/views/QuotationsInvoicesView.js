/**
 * Quotations & Invoices View
 * Generates and manages customer quotations and invoices.
 */

class QuotationsInvoicesView {
  constructor() {
    this.activeTab = 'invoices';
    this.quotations = [];
    this.invoices = [];
    this.customers = [];
    this.products = [];
    this.search = '';
    this.statusFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1;
    this.perPage = 25;
    this.documentType = 'invoice';
    this.lines = [];
    this.actionMenu = null;
    this.editingDocument = null;
    this.documentStep = 'customer';
    this.customerModal = null;
    this.detailDocument = null;
    this.settings = {};

    this.ready = this.init();
  }

  getCurrentUser() {
    try {
      return JSON.parse(sessionStorage.getItem('aliko_user') || localStorage.getItem('aliko_user') || localStorage.getItem('user') || 'null');
    } catch (_) {
      return null;
    }
  }

  hasPermission(code) {
    const user = this.getCurrentUser();
    return user?.role_name === 'Admin' || (user?.permissions || []).includes(code);
  }

  canApproveDocuments() {
    return this.hasPermission('documents.approve');
  }

  getDisplayStatus(doc) {
    const approval = String(doc?.approvalStatus || 'draft').toLowerCase();
    if (approval === 'pending') return 'pending_approval';
    if (approval === 'rejected') return 'rejected';
    return this.normalizeStatus(doc?.status);
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

  async init() {
    await this.loadDocumentSettings();
    await this.loadData();
    this.setupEventListeners();
    this.render();
  }

  async loadDocumentSettings() {
    this.settings = {
      ...(window.settingsView?.settings || {}),
      ...(window.AlikoSystem?.state?.settings || {}),
      ...(window.appSettings || {}),
      ...this.settings
    };

    if (!window.electronAPI?.getSettings) return;

    try {
      const result = await window.electronAPI.getSettings();
      if (result?.success && result.data) {
        this.settings = { ...this.settings, ...result.data };
        if (window.app?.applyRuntimeSettings) {
          window.app.applyRuntimeSettings(result.data);
        } else {
          window.appSettings = Object.freeze({
            ...(window.appSettings || {}),
            ...result.data
          });
        }
      }
    } catch (error) {
      console.warn('Unable to load document settings:', error);
    }
  }

  async loadData() {
    await Promise.all([
      this.loadQuotations(),
      this.loadInvoices(),
      this.loadCustomers(),
      this.loadProducts()
    ]);
  }

  async loadQuotations() {
    try {
      const result = await window.electronAPI?.getQuotations?.({ limit: 300, includeItems: true });
      this.quotations = result?.success ? (result.data || []).map(q => ({
        type: 'quotation',
        id: q.id,
        number: q.quote_number,
        date: q.quote_date || q.created_at,
        dueDate: q.expiry_date,
        customerId: q.customer_id || null,
        customer: q.customer_name || 'Walk-in Customer',
        customerEmail: q.customer_email || '',
        customerPhone: q.customer_phone || '',
        customerAddress: q.customer_address || '',
        subtotal: parseFloat(q.subtotal) || 0,
        discountPercent: parseFloat(q.discount_percent) || 0,
        discount: parseFloat(q.discount_amount) || 0,
        taxRate: parseFloat(q.tax_rate) || 0,
        taxName: q.tax_name || this.getConfiguredTaxSettings().name,
        tax: parseFloat(q.tax_amount) || 0,
        total: parseFloat(q.total_amount) || 0,
        status: q.status || 'draft',
        approvalStatus: q.approval_status || 'draft',
        submittedBy: q.submitted_by || null,
        submittedAt: q.submitted_at || null,
        approvedBy: q.approved_by || null,
        approvedAt: q.approved_at || null,
        approvedName: q.approved_name || '',
        approvedSignature: q.approved_signature || '',
        notes: q.notes || '',
        items: this.mapDocumentItems(q.items || []),
        auditLogs: this.mapAuditLogs(q.audit_logs || [])
      })) : [];
    } catch (error) {
      console.error('Failed to load quotations:', error);
      this.quotations = [];
    }
  }

  async loadInvoices() {
    try {
      const result = await window.electronAPI?.getInvoices?.({ limit: 300, includeItems: true });
      this.invoices = result?.success ? (result.data || []).map(inv => {
        const total = parseFloat(inv.total_amount) || 0;
        const status = inv.status || 'draft';
        const paid = status === 'paid'
          ? total
          : (parseFloat(inv.amount_paid) || 0);

        return {
          type: 'invoice',
          id: inv.id,
          number: inv.invoice_number,
          date: inv.invoice_date || inv.created_at,
          dueDate: inv.due_date,
          customerId: inv.customer_id || null,
          customer: inv.customer_name || 'Walk-in Customer',
          customerEmail: inv.customer_email || '',
          customerPhone: inv.customer_phone || '',
          customerAddress: inv.customer_address || '',
          quotationId: inv.quotation_id || null,
          subtotal: parseFloat(inv.subtotal) || 0,
          discountPercent: parseFloat(inv.discount_percent) || 0,
          discount: parseFloat(inv.discount_amount) || 0,
          taxRate: parseFloat(inv.tax_rate) || 0,
          taxName: inv.tax_name || this.getConfiguredTaxSettings().name,
          tax: parseFloat(inv.tax_amount) || 0,
          total,
          paid,
          stockAdjusted: Boolean(inv.stock_adjusted),
          status,
          approvalStatus: inv.approval_status || 'draft',
          submittedBy: inv.submitted_by || null,
          submittedAt: inv.submitted_at || null,
          approvedBy: inv.approved_by || null,
          approvedAt: inv.approved_at || null,
          approvedName: inv.approved_name || '',
          approvedSignature: inv.approved_signature || '',
          notes: inv.notes || '',
          items: this.mapDocumentItems(inv.items || []),
          payments: this.mapPayments(inv.payments || []),
          auditLogs: this.mapAuditLogs(inv.audit_logs || [])
        };
      }) : [];
    } catch (error) {
      console.error('Failed to load invoices:', error);
      this.invoices = [];
    }
  }

  async loadCustomers() {
    try {
      const result = await window.electronAPI?.getCustomers?.({ limit: 500 });
      this.customers = result?.success ? (result.data || []) : [];
    } catch (error) {
      console.error('Failed to load customers:', error);
      this.customers = [];
    }
  }

  async loadProducts() {
    try {
      const result = await window.electronAPI?.getProducts?.({ limit: 500 });
      this.products = result?.success ? (result.data || []) : [];
    } catch (error) {
      console.error('Failed to load products:', error);
      this.products = [];
    }
  }

  render() {
    this.syncActiveTab();
    this.renderToolbar();
    this.renderSummary();
    this.renderStatusOptions();
    this.renderTable();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderToolbar() {
    const searchInput = document.getElementById('documents-search');
    const newButton = document.getElementById('new-document-btn');
    const isInvoices = this.activeTab === 'invoices';

    if (searchInput) {
      searchInput.placeholder = isInvoices
        ? 'Search invoices, customers, products...'
        : 'Search quotations, customers, products...';
    }

    if (newButton) {
      newButton.innerHTML = isInvoices
        ? '<img src="assets/images/icons/custom/add_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> New Invoice'
        : '<img src="assets/images/icons/custom/add_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> New Quote';
    }

    this.syncDateInputs();
  }

  renderSummary() {
    if (this.activeTab === 'invoices') {
      const totalValue = this.invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const totalPaid = this.invoices.reduce((sum, inv) => sum + this.getPaidAmount(inv), 0);
      const outstanding = this.invoices.reduce((sum, inv) => {
        return sum + Math.max((inv.total || 0) - this.getPaidAmount(inv), 0);
      }, 0);
      const countStatus = status => this.invoices.filter(inv => this.normalizeStatus(inv.status) === status).length;
      const customerCount = new Set(this.invoices.map(inv => inv.customerId || inv.customer).filter(Boolean)).size;

      this.setCard(1, 'INVOICE VALUE', this.formatCurrency(totalValue), 'bar-chart-3', 'indigo');
      this.setCard(2, 'COLLECTED', this.formatCurrency(totalPaid), 'banknote', 'green');
      this.setCard(3, 'OUTSTANDING', this.formatCurrency(outstanding), 'clipboard-list', 'purple');
      this.setCard(4, 'TOTAL INVOICES', this.invoices.length.toLocaleString(), 'file-text', 'blue');
      this.setCard(5, 'PAID', countStatus('paid').toLocaleString(), 'check-circle', 'green');
      this.setCard(6, 'PARTIAL', countStatus('partial').toLocaleString(), 'alert-circle', 'orange');
      this.setCard(7, 'OVERDUE', countStatus('overdue').toLocaleString(), 'x-circle', 'red', true);
      this.setCard(8, 'CUSTOMERS', customerCount.toLocaleString(), 'tags', 'pink');
      return;
    }

    const totalValue = this.quotations.reduce((sum, q) => sum + (q.total || 0), 0);
    const activeValue = this.quotations
      .filter(q => !['converted', 'declined', 'expired'].includes(q.status))
      .reduce((sum, q) => sum + (q.total || 0), 0);
    const countStatus = status => this.quotations.filter(q => this.normalizeStatus(q.status) === status).length;
    const customerCount = new Set(this.quotations.map(q => q.customerId || q.customer).filter(Boolean)).size;

    this.setCard(1, 'QUOTE VALUE', this.formatCurrency(totalValue), 'bar-chart-3', 'indigo');
    this.setCard(2, 'ACTIVE VALUE', this.formatCurrency(activeValue), 'banknote', 'green');
    this.setCard(3, 'TOTAL QUOTES', this.quotations.length.toLocaleString(), 'clipboard-list', 'purple');
    this.setCard(4, 'SENT', countStatus('sent').toLocaleString(), 'send', 'blue');
    this.setCard(5, 'ACCEPTED', countStatus('accepted').toLocaleString(), 'check-circle', 'green');
    this.setCard(6, 'CONVERTED', countStatus('converted').toLocaleString(), 'file-check', 'orange');
    this.setCard(7, 'EXPIRED', countStatus('expired').toLocaleString(), 'x-circle', 'red', true);
    this.setCard(8, 'CUSTOMERS', customerCount.toLocaleString(), 'tags', 'pink');
  }

  setCard(index, label, value, icon, tone, isWarning = false) {
    this.setText(`documents-card-${index}-label`, label);
    this.setText(`documents-card-${index}-value`, value);
    const iconWrap = document.getElementById(`documents-card-${index}-icon`);
    const card = iconWrap?.closest('.documents-card');
    if (card) {
      card.className = `documents-card${isWarning ? ' warning' : ''}`;
    }
    if (iconWrap) {
      if (!icon) {
        iconWrap.className = 'documents-card-icon empty';
        iconWrap.innerHTML = '';
        return;
      }
      iconWrap.className = `documents-card-icon ${tone}`;
      iconWrap.innerHTML = this.iconImage(icon, 'custom-ui-icon documents-card-icon-img');
    }
  }

  renderStatusOptions() {
    const select = document.getElementById('documents-status-filter');
    if (!select) return;

    const quoteStatuses = [
      ['', 'All Statuses'],
      ['draft', 'Drafts'],
      ['pending_approval', 'Pending Approval'],
      ['sent', 'Dispatched / Sent'],
      ['accepted', 'Accepted'],
      ['declined', 'Declined'],
      ['expired', 'Expired'],
      ['converted', 'Converted to Invoice']
    ];
    const invoiceStatuses = [
      ['', 'All Invoices'],
      ['draft', 'Drafts'],
      ['pending_approval', 'Pending Approval'],
      ['issued', 'Issued'],
      ['paid', 'Fully Paid'],
      ['partial', 'Partially Paid'],
      ['overdue', 'Overdue'],
      ['voided', 'Voided List']
    ];

    const options = this.activeTab === 'quotations' ? quoteStatuses : invoiceStatuses;
    select.innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
    select.value = this.statusFilter;
  }

  renderTable() {
    const header = document.getElementById('documents-thead-row');
    const tbody = document.getElementById('documents-tbody');
    if (!header || !tbody) return;

    const isInvoices = this.activeTab === 'invoices';
    header.replaceChildren(...['Code', 'Customer', 'Subtotal (K)', 'VAT 17.5% (K)', 'Total (K)', 'Status', 'Actions']
      .map((label, index) => {
        const th = document.createElement('th');
        th.textContent = label;
        if (index === 6) th.className = 'documents-actions-th';
        return th;
      }));

    const documents = this.getFilteredDocuments();
    this.updateDocumentCount(documents.length);
    this.updatePagination(documents.length);

    if (!documents.length) {
      window.TemplateRenderer?.appendEmptyRow(
        tbody,
        7,
        `No ${isInvoices ? 'matching invoices' : 'matching quotations'} found.`,
        '',
        'documents-empty'
      );
      return;
    }

    const start = (this.currentPage - 1) * this.perPage;
    const pageDocuments = documents.slice(start, start + this.perPage);
    const fragment = document.createDocumentFragment();
    pageDocuments.forEach(doc => fragment.appendChild(this.renderDocumentRow(doc)));
    tbody.replaceChildren(fragment);

    document.querySelectorAll('#documents-tbody [data-doc-action="menu"]').forEach(btn => {
      btn.onclick = (event) => {
        event.stopPropagation();
        this.toggleActionMenu(btn, btn.dataset.docType, btn.dataset.id);
      };
    });

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  renderDocumentRow(doc) {
    const row = window.TemplateRenderer?.clone('document-row-template') || document.createElement('tr');
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    row.querySelector('[data-code]')?.replaceChildren(make('span', { className: 'documents-code', text: doc.number || '' }));
    row.querySelector('[data-customer]')?.replaceChildren(make('div', { className: 'documents-customer', text: doc.customer || '' }));
    row.querySelector('[data-subtotal]')?.replaceChildren(make('span', { className: 'documents-money', text: this.formatDocumentAmount(doc.subtotal) }));
    window.TemplateRenderer?.setText(row, '[data-tax]', this.formatDocumentAmount(doc.tax));
    row.querySelector('[data-total]')?.replaceChildren(make('span', { className: 'documents-money', text: this.formatDocumentAmount(doc.total) }));
    row.querySelector('[data-status]')?.replaceChildren(this.createStatusText(this.getDisplayStatus(doc)));

    const actionCell = row.querySelector('[data-actions]');
    if (actionCell) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'documents-row-action';
      button.dataset.docAction = 'menu';
      button.dataset.docType = doc.type;
      button.dataset.id = doc.id;
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      button.title = 'Actions';
      if (window.TemplateRenderer?.icon) button.appendChild(window.TemplateRenderer.icon('assets/images/icons/custom/more_vertical_icon.svg', 'custom-ui-icon'));
      else button.textContent = 'â‹®';
      actionCell.replaceChildren(button);
    }
    return row;
  }

  createStatusText(status) {
    const normalized = this.normalizeStatus(status);
    const span = document.createElement('span');
    span.className = `documents-status-text ${normalized}`;
    span.textContent = this.formatStatusLabel(normalized);
    return span;
  }

  renderStatusBadge(status) {
    const wrapper = document.createElement('span');
    wrapper.appendChild(this.createStatusText(status));
    return wrapper.innerHTML;
  }

  getFilteredDocuments() {
    const source = this.activeTab === 'quotations' ? this.quotations : this.invoices;
    const searchText = this.search.trim().toLowerCase();

    return source.filter(doc => {
      const itemText = this.formatItemSummary(doc.items);
      const haystack = [doc.id, doc.number, doc.customer, doc.status, doc.total, itemText].join(' ').toLowerCase();
      const matchesSearch = !searchText || haystack.includes(searchText);
      const matchesStatus = !this.statusFilter || this.getDisplayStatus(doc) === this.statusFilter;
      const matchesDate = this.isWithinDateRange(doc.date);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }

  updateDocumentCount(filteredCount) {
    const total = this.activeTab === 'quotations' ? this.quotations.length : this.invoices.length;
    const typeLabel = this.activeTab === 'quotations' ? 'quotations' : 'invoices';
    const count = document.getElementById('documents-count');
    if (count) {
      count.textContent = `Showing ${filteredCount.toLocaleString()} of ${total.toLocaleString()} ${typeLabel}`;
    }

    const activeFilters = [];
    if (this.statusFilter) activeFilters.push(this.formatStatusLabel(this.statusFilter));
    if (this.startDate || this.endDate) {
      activeFilters.push(`${this.startDate || 'Any'} to ${this.endDate || 'Any'}`);
    }
    if (this.search.trim()) activeFilters.push('Search');

    const summary = document.getElementById('documents-active-filter-summary');
    if (summary) {
      summary.textContent = activeFilters.length ? activeFilters.join(' | ') : 'All records';
    }
  }

  updatePagination(totalItems) {
    const container = document.getElementById('documents-pagination');
    if (!container) return;

    const totalPages = Math.ceil(totalItems / this.perPage);
    if (totalPages <= 1) {
      this.currentPage = 1;
      container.replaceChildren();
      return;
    }

    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    window.TemplateRenderer?.renderPagination(container, totalPages, this.currentPage, (page) => {
      this.currentPage = parseInt(page, 10);
      this.renderTable();
    });
  }

  resetFilters() {
    this.search = '';
    this.statusFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1;

    const searchInput = document.getElementById('documents-search');
    const statusSelect = document.getElementById('documents-status-filter');
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = '';
    this.syncDateInputs();

    this.renderTable();
  }

  openDateRangePopup() {
    const panel = document.getElementById('documents-date-range-panel');
    const toggle = document.getElementById('documents-date-range-toggle');
    if (!panel || !toggle) return;

    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.classList.add('open');
    this.syncDateInputs();
  }

  closeDateRangePopup() {
    const panel = document.getElementById('documents-date-range-panel');
    const toggle = document.getElementById('documents-date-range-toggle');
    if (!panel || !toggle) return;

    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.classList.remove('open');
  }

  toggleDateRangePopup() {
    const panel = document.getElementById('documents-date-range-panel');
    if (!panel) return;
    if (panel.hidden) {
      this.openDateRangePopup();
    } else {
      this.closeDateRangePopup();
    }
  }

  applyDateRange() {
    const startDateInput = document.getElementById('documents-start-date');
    const endDateInput = document.getElementById('documents-end-date');
    this.startDate = startDateInput?.value || '';
    this.endDate = endDateInput?.value || '';
    this.currentPage = 1;
    this.closeDateRangePopup();
    this.renderTable();
  }

  clearDateRange() {
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1;
    this.syncDateInputs();
    this.closeDateRangePopup();
    this.renderTable();
  }

  syncDateInputs() {
    const startDateInput = document.getElementById('documents-start-date');
    const endDateInput = document.getElementById('documents-end-date');
    const label = document.getElementById('documents-date-range-label');
    if (startDateInput) startDateInput.value = this.startDate;
    if (endDateInput) endDateInput.value = this.endDate;
    if (label) {
      label.textContent = this.startDate || this.endDate
        ? `${this.startDate || 'Any'} to ${this.endDate || 'Any'}`
        : 'Date Range';
    }
  }

  openCreateForActiveTab() {
    this.openCreateModal(this.activeTab === 'quotations' ? 'quotation' : 'invoice');
  }

  openNewInvoice() {
    this.activeTab = 'invoices';
    window.app?.persistActiveView?.('invoices');
    this.render();
    this.openCreateModal('invoice');
  }

  openNewQuote() {
    this.activeTab = 'quotations';
    window.app?.persistActiveView?.('quotations');
    this.render();
    this.openCreateModal('quotation');
  }

  setActiveDocumentView(tab) {
    this.activeTab = tab === 'quotations' ? 'quotations' : 'invoices';
    window.app?.persistActiveView?.(this.activeTab);
    this.statusFilter = '';
    this.search = '';
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 1;

    const searchInput = document.getElementById('documents-search');
    const statusSelect = document.getElementById('documents-status-filter');
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = '';
    this.syncDateInputs();

    this.render();
  }

  openCreateModal(type, documentToEdit = null) {
    this.editingDocument = documentToEdit;
    this.setDocumentType(type);
    this.populateCustomerSelect(documentToEdit?.customerId || '');
    this.syncCustomerSearch(documentToEdit?.customerId || '');
    this.lines = documentToEdit?.items?.length
      ? documentToEdit.items.map(item => ({
          productId: item.productId || '',
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          discountPercent: this.normalizeDiscountPercent(item.discountPercent || 0)
        }))
      : [];

    const dueDate = this.formatDateInput(documentToEdit?.dueDate)
      || this.getDefaultDate(this.getConfiguredDocumentDays(type));
    const discountInput = document.getElementById('document-discount');
    const taxInput = document.getElementById('document-tax');
    const notesInput = document.getElementById('document-notes');
    const paymentMethod = document.getElementById('document-payment-method');
    const amountPaid = document.getElementById('document-amount-paid');
    const dueDateInput = document.getElementById('document-due-date');
    const quotationExpiry = document.getElementById('document-quotation-expiry');
    const productSearch = document.getElementById('document-product-search');
    const settleStatus = document.getElementById('document-settle-status');

    if (discountInput) discountInput.value = String(documentToEdit?.discountPercent || 0);
    if (taxInput) taxInput.value = String(documentToEdit?.tax || 0);
    if (notesInput) notesInput.value = documentToEdit?.notes || '';
    if (paymentMethod) paymentMethod.value = documentToEdit?.payments?.[0]?.method || 'cash';
    if (amountPaid) amountPaid.value = String(documentToEdit?.paid || 0);
    if (dueDateInput) dueDateInput.value = dueDate;
    if (quotationExpiry) quotationExpiry.value = dueDate;
    if (productSearch) productSearch.value = '';
    if (settleStatus) settleStatus.value = 'paid';
    this.syncDocumentTaxOptions(documentToEdit?.taxRate, documentToEdit?.taxName);
    this.setPaymentTermsFromDate(dueDate);
    this.renderLines();
    this.renderLineTotals();
    this.updateProductSearchState();
    this.hideLookupResults();
    const modal = document.getElementById('document-create-modal');
    if (modal) {
      modal.dataset.documentType = type;
      modal.style.display = 'flex';
    }
    this.setDocumentStep('customer');
    if (window.lucide) window.lucide.createIcons();
  }

  closeCreateModal() {
    const modal = document.getElementById('document-create-modal');
    if (modal) modal.style.display = 'none';
    this.editingDocument = null;
    this.documentStep = 'customer';
    this.closeCreateApprovalPanel();
    this.closeNewCustomerModal();
  }

  setDocumentType(type) {
    if (this.editingDocument?.type && type !== this.editingDocument.type) {
      return;
    }

    this.documentType = type;
    const isQuotation = type === 'quotation';
    const title = document.getElementById('document-modal-title');
    const subtitle = document.getElementById('document-modal-subtitle');
    const dateLabel = document.getElementById('document-date-label');
    const secondaryButton = document.getElementById('document-save-draft-btn');
    const primaryButton = document.getElementById('document-save-send-btn');
    const quotationActions = document.getElementById('document-quotation-actions');
    const clientTitle = document.getElementById('document-client-section-title');
    const detailsTitle = document.getElementById('document-details-section-title');
    const itemsTitle = document.getElementById('document-items-section-title');
    const notesLabel = document.getElementById('document-notes-label');
    const totalTitle = document.getElementById('document-total-section-title');
    const customerSearch = document.getElementById('document-customer-search');
    const notes = document.getElementById('document-notes');

    if (title) {
      title.textContent = this.editingDocument
        ? `Edit ${isQuotation ? 'Quotation' : 'TAX Invoice'}`
        : (isQuotation ? 'Compile Customer Quotation' : 'TAX Invoice');
    }
    if (subtitle) {
      subtitle.textContent = isQuotation ? 'Customer proposal generation log' : 'Sales registrar generation log';
    }
    if (dateLabel) dateLabel.textContent = 'Document Deadline';
    if (clientTitle) clientTitle.textContent = isQuotation ? 'Target Quotation Client Profile' : 'Target Invoice Purchaser Profile';
    if (detailsTitle) detailsTitle.textContent = isQuotation ? 'Quotation Details' : 'Invoice Details';
    if (itemsTitle) itemsTitle.textContent = isQuotation ? 'Compiled Quotation Product Items' : 'Compiled Invoice Product Items';
    if (notesLabel) notesLabel.textContent = isQuotation ? 'Special Terms or Proposal Instruction Remarks' : 'Special Terms or Delivery Instruction Remarks';
    if (totalTitle) totalTitle.textContent = 'GRAND TOTAL (K)';
    if (customerSearch) {
      customerSearch.placeholder = isQuotation
        ? 'Search existing client before preparing quotation...'
        : 'Search existing customer before preparing invoice...';
    }
    if (notes) {
      notes.placeholder = isQuotation
        ? 'Validity notes, proposal terms, or internal quotation references...'
        : 'Shipping schedules or internal invoice references shown on printable document sheets...';
    }
    if (secondaryButton) {
      secondaryButton.innerHTML = '<img src="assets/images/icons/custom/file_clock_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Save as Draft';
      secondaryButton.title = `Save this ${isQuotation ? 'quotation' : 'invoice'} without finalizing it`;
    }
    if (primaryButton) {
      primaryButton.innerHTML = isQuotation
        ? '<img src="assets/images/icons/custom/send_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Send Quotation'
        : '<img src="assets/images/icons/custom/check_status_icon.png" alt="" class="custom-ui-icon" aria-hidden="true"> Finalize & Settle Paid';
    }

    const paymentFields = document.getElementById('document-payment-fields');
    if (paymentFields) {
      paymentFields.style.display = isQuotation ? 'none' : 'grid';
    }
    if (quotationActions) {
      quotationActions.style.display = isQuotation ? 'grid' : 'none';
    }
    this.updateProductSearchState();
    if (window.lucide) window.lucide.createIcons();
  }

  getDocumentSteps() {
    // Quotations do not require payment information. They move directly
    // from product entry to the document preview.
    return this.documentType === 'quotation'
      ? ['customer', 'products', 'preview']
      : ['customer', 'products', 'payment', 'preview'];
  }

  goToNextDocumentStep() {
    const steps = this.getDocumentSteps();
    const currentIndex = steps.indexOf(this.documentStep);
    const nextStep = steps[Math.min(currentIndex + 1, steps.length - 1)];
    this.goToDocumentStep(nextStep);
  }

  goToPreviousDocumentStep() {
    const steps = this.getDocumentSteps();
    const currentIndex = steps.indexOf(this.documentStep);
    const previousStep = steps[Math.max(currentIndex - 1, 0)];
    this.setDocumentStep(previousStep);
  }

  goToDocumentStep(step) {
    const steps = this.getDocumentSteps();
    if (!steps.includes(step)) return;

    const currentIndex = steps.indexOf(this.documentStep);
    const targetIndex = steps.indexOf(step);
    if (targetIndex <= currentIndex) {
      this.setDocumentStep(step);
      return;
    }

    for (let index = 0; index < targetIndex; index += 1) {
      if (!this.validateDocumentStep(steps[index])) return;
    }
    this.setDocumentStep(step);
  }

  setDocumentStep(step) {
    const steps = this.getDocumentSteps();
    if (!steps.includes(step)) return;

    this.documentStep = step;
    const modal = document.getElementById('document-create-modal');
    if (modal) modal.dataset.documentStep = step;

    document.querySelectorAll('#document-create-modal [data-document-panel]').forEach(panel => {
      panel.hidden = panel.dataset.documentPanel !== step;
    });

    this.updateDocumentFooter();
    if (step === 'preview') this.refreshFormPreview(true);
    if (window.lucide) window.lucide.createIcons();
  }

  updateDocumentFooter() {
    const steps = this.getDocumentSteps();
    const currentIndex = steps.indexOf(this.documentStep);
    const isPreview = this.documentStep === 'preview';
    const backButton = document.getElementById('document-back-btn');
    const nextButton = document.getElementById('document-next-btn');
    const printButton = document.getElementById('document-preview-print-btn');
    const pdfButton = document.getElementById('document-preview-pdf-btn');
    const draftButton = document.getElementById('document-save-draft-btn');
    const saveButton = document.getElementById('document-save-send-btn');
    const managerApprovalButton = document.getElementById('document-manager-approval-btn');

    if (backButton) {
      backButton.style.display = currentIndex > 0 ? 'inline-flex' : 'none';
      backButton.innerHTML = isPreview
        ? '<img src="assets/images/icons/custom/arrow_left_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Back to Edit'
        : '<img src="assets/images/icons/custom/arrow_left_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Back';
    }
    if (nextButton) {
      nextButton.style.display = isPreview ? 'none' : 'inline-flex';
      const nextStep = steps[currentIndex + 1];
      const label = nextStep === 'products'
        ? 'Add Products'
        : nextStep === 'payment'
          ? 'Choose Payment'
          : 'Preview';
      nextButton.innerHTML = `${label} <img src="assets/images/icons/custom/arrow_right_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true">`;
    }
    if (printButton) printButton.style.display = isPreview ? 'inline-flex' : 'none';
    if (pdfButton) {
      pdfButton.style.display = isPreview ? 'inline-flex' : 'none';
      if (isPreview) pdfButton.innerHTML = '<img src="assets/images/icons/custom/download_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Download PDF';
    }
    if (draftButton) {
      draftButton.style.display = isPreview ? 'inline-flex' : 'none';
      if (isPreview) draftButton.innerHTML = '<img src="assets/images/icons/custom/file_clock_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Save as Draft';
    }
    if (saveButton) {
      const showPrimaryAction = isPreview
        && !window.electronAPI?.approveDocumentWithCredentials;
      saveButton.style.display = showPrimaryAction ? 'inline-flex' : 'none';
      if (showPrimaryAction) {
        saveButton.innerHTML = this.documentType === 'quotation'
          ? '<img src="assets/images/icons/custom/send_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Send Quotation'
          : '<img src="assets/images/icons/custom/check_status_icon.png" alt="" class="custom-ui-icon" aria-hidden="true"> Finalize & Settle Paid';
        saveButton.classList.add('documents-finalize-btn');
      }
    }
    if (managerApprovalButton) {
      const canApproveEditableDocument = isPreview && this.canApproveCurrentInvoicePreview();
      managerApprovalButton.style.display = canApproveEditableDocument ? 'inline-flex' : 'none';
      if (canApproveEditableDocument) {
        managerApprovalButton.innerHTML = '<img src="assets/images/icons/custom/check_status_icon.png" alt="" class="custom-ui-icon" aria-hidden="true"> Manager Approval';
      }
    }
  }

  validateDocumentStep(step) {
    if (step === 'customer' && !this.hasCustomerForDocument()) {
      this.showNotification('Add or register a customer before continuing', 'warning');
      return false;
    }

    if (step === 'products' && !this.getValidDocumentLines().length) {
      this.showNotification('Add at least one product with quantity before previewing', 'warning');
      return false;
    }

    if (step === 'payment' && this.documentType === 'invoice' && !document.getElementById('document-payment-method')?.value) {
      this.showNotification('Choose a payment method before previewing', 'warning');
      return false;
    }

    return true;
  }

}

window.QuotationsInvoicesView = QuotationsInvoicesView;

