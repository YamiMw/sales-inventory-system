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

    this.init();
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
    const viewKicker = document.getElementById('documents-view-kicker');
    const viewTitle = document.getElementById('documents-view-title');
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

    if (viewKicker) {
      viewKicker.textContent = isInvoices ? 'Invoice Workspace' : 'Quotation Workspace';
    }
    if (viewTitle) {
      viewTitle.textContent = isInvoices ? 'Invoices & Orders' : 'Quotations';
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
      iconWrap.innerHTML = `<img src="assets/images/icons/custom/check_status_icon.png" alt="" class="custom-ui-icon" aria-hidden="true">`;
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
    header.innerHTML = ['Code', 'Customer', 'Subtotal (K)', 'VAT 17.5% (K)', 'Total (K)', 'Status', 'Actions']
      .map((label, index) => `<th class="${index === 6 ? 'documents-actions-th' : ''}">${label}</th>`)
      .join('');

    const documents = this.getFilteredDocuments();
    this.updateDocumentCount(documents.length);
    this.updatePagination(documents.length);

    if (!documents.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="documents-empty">
            No ${isInvoices ? 'matching invoices' : 'matching quotations'} found.
          </td>
        </tr>
      `;
      return;
    }

    const start = (this.currentPage - 1) * this.perPage;
    const pageDocuments = documents.slice(start, start + this.perPage);
    tbody.innerHTML = pageDocuments.map(doc => this.renderDocumentRow(doc)).join('');

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
    return `
      <tr>
        <td>
          <span class="documents-code">${this.escapeHtml(doc.number)}</span>
        </td>
        <td>
          <div class="documents-customer">${this.escapeHtml(doc.customer)}</div>
        </td>
        <td><span class="documents-money">${this.formatDocumentAmount(doc.subtotal)}</span></td>
        <td>${this.formatDocumentAmount(doc.tax)}</td>
        <td><span class="documents-money">${this.formatDocumentAmount(doc.total)}</span></td>
        <td>${this.renderStatusBadge(this.getDisplayStatus(doc))}</td>
        <td>
          <button type="button" class="documents-row-action" data-doc-action="menu" data-doc-type="${doc.type}" data-id="${doc.id}" aria-haspopup="menu" aria-expanded="false" title="Actions">
            <img src="assets/images/icons/custom/more_vertical_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true">
          </button>
        </td>
      </tr>
    `;
  }

  renderStatusBadge(status) {
    const normalized = this.normalizeStatus(status);
    const icon = {
      paid: 'check-circle-2',
      accepted: 'check-circle-2',
      converted: 'file-check',
      partial: 'clock',
      overdue: 'alert-circle',
      expired: 'alert-circle',
      declined: 'ban',
      voided: 'ban',
      sent: 'send',
      issued: 'mail',
      pending_approval: 'clock-3',
      rejected: 'rotate-ccw',
      draft: 'file-text'
    }[normalized] || 'file-text';

    return `
      <span class="documents-status ${this.escapeHtml(normalized)}">
        <img src="assets/images/icons/custom/check_status_icon.png" alt="" class="custom-ui-icon" aria-hidden="true">
        ${this.escapeHtml(this.formatStatusLabel(normalized))}
      </span>
    `;
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
      container.innerHTML = '';
      return;
    }

    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    container.innerHTML = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      return `<button class="pagination-btn ${page === this.currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`;
    }).join('');

    container.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentPage = parseInt(btn.dataset.page, 10);
        this.renderTable();
      });
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

  setupEventListeners() {
    window.addEventListener('settings-updated', (event) => {
      this.settings = { ...this.settings, ...(event.detail || {}) };
      this.refreshFormPreview(true);
      if (this.detailDocument) {
        const body = document.getElementById('document-detail-body');
        if (body) body.innerHTML = this.renderDocumentPrintSheet(this.detailDocument);
      }
    });

    document.querySelectorAll('#quotations-invoices-view [data-doc-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setActiveDocumentView(btn.dataset.docTab);
      });
    });

    document.getElementById('documents-search')?.addEventListener('input', (event) => {
      this.search = event.target.value;
      this.currentPage = 1;
      this.renderTable();
    });

    document.getElementById('documents-status-filter')?.addEventListener('change', (event) => {
      this.statusFilter = event.target.value;
      this.currentPage = 1;
      this.renderTable();
    });

    document.querySelector('#quotations-invoices-view .documents-date-picker')?.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    document.getElementById('documents-date-range-toggle')?.addEventListener('click', () => {
      this.toggleDateRangePopup();
    });

    document.getElementById('documents-date-apply')?.addEventListener('click', () => {
      this.applyDateRange();
    });

    document.getElementById('documents-date-clear')?.addEventListener('click', () => {
      this.clearDateRange();
    });

    document.getElementById('documents-refresh-btn')?.addEventListener('click', async () => {
      await this.loadData();
      this.render();
      this.showNotification('Documents refreshed', 'success');
    });

    document.getElementById('documents-reset-filters')?.addEventListener('click', () => {
      this.resetFilters();
    });

    document.getElementById('documents-per-page')?.addEventListener('change', (event) => {
      this.perPage = parseInt(event.target.value, 10) || 25;
      this.currentPage = 1;
      this.renderTable();
    });

    document.getElementById('new-document-btn')?.addEventListener('click', () => {
      this.openCreateModal(this.activeTab === 'quotations' ? 'quotation' : 'invoice');
    });

    document.getElementById('document-modal-close')?.addEventListener('click', () => this.closeCreateModal());
    document.getElementById('document-cancel-btn')?.addEventListener('click', () => this.closeCreateModal());
    document.getElementById('document-back-btn')?.addEventListener('click', () => this.goToPreviousDocumentStep());
    document.getElementById('document-next-btn')?.addEventListener('click', () => this.goToNextDocumentStep());
    document.getElementById('document-preview-print-btn')?.addEventListener('click', () => this.printPreviewDocument());
    document.getElementById('document-preview-pdf-btn')?.addEventListener('click', () => this.downloadPreviewPdf());
    document.getElementById('document-save-draft-btn')?.addEventListener('click', () => this.handleSecondarySave());
    document.getElementById('document-save-send-btn')?.addEventListener('click', () => this.handlePrimarySave());
    document.getElementById('document-add-customer-btn')?.addEventListener('click', () => this.openNewCustomerModal());
    document.getElementById('document-add-line')?.addEventListener('click', () => this.addLine());
    document.getElementById('document-discount')?.addEventListener('input', () => this.renderLineTotals());
    document.getElementById('document-tax')?.addEventListener('input', () => this.renderLineTotals());
    document.getElementById('document-tax-rate')?.addEventListener('change', () => this.renderLineTotals());
    document.getElementById('document-payment-terms')?.addEventListener('change', () => {
      this.setDueDateFromPaymentTerms();
      this.refreshFormPreview();
    });
    document.getElementById('document-settle-status')?.addEventListener('change', () => {
      this.updateSettlementAmountPreview();
      this.refreshFormPreview();
    });
    document.getElementById('document-payment-method')?.addEventListener('change', () => this.refreshFormPreview());
    document.getElementById('document-due-date')?.addEventListener('change', () => this.refreshFormPreview());
    document.getElementById('document-notes')?.addEventListener('input', () => this.refreshFormPreview());
    document.getElementById('document-quotation-expiry')?.addEventListener('change', (event) => {
      const dateInput = document.getElementById('document-due-date');
      if (dateInput) dateInput.value = event.target.value;
      this.refreshFormPreview();
    });
    document.getElementById('document-detail-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'document-detail-modal') {
        this.closeDetailModal();
      }
    });
    document.getElementById('document-detail-close')?.addEventListener('click', () => this.closeDetailModal());
    document.getElementById('document-detail-cancel')?.addEventListener('click', () => this.closeDetailModal());
    document.getElementById('document-detail-edit-draft')?.addEventListener('click', () => {
      this.openDraftForEditing(this.detailDocument);
    });
    document.getElementById('document-detail-submit-approval')?.addEventListener('click', () => {
      if (this.detailDocument) this.submitDocumentForApproval(this.detailDocument);
    });
    document.getElementById('document-detail-approve')?.addEventListener('click', () => {
      if (this.detailDocument) this.openInlineApprovalPanel(this.detailDocument);
    });
    document.getElementById('document-detail-payment')?.addEventListener('click', () => {
      if (this.detailDocument) this.recordPayment(this.detailDocument);
    });
    document.getElementById('document-detail-void')?.addEventListener('click', () => {
      if (this.detailDocument) this.voidInvoice(this.detailDocument);
    });
    document.getElementById('document-approval-panel-close')?.addEventListener('click', () => this.closeInlineApprovalPanel());
    document.getElementById('document-approval-cancel')?.addEventListener('click', () => this.closeInlineApprovalPanel());
    document.getElementById('document-approval-confirm')?.addEventListener('click', () => {
      if (this.detailDocument) this.approveAndFinalizeDocument(this.detailDocument);
    });
    document.getElementById('document-detail-print')?.addEventListener('click', () => {
      if (!this.detailDocument) return;
      this.setDocumentPrintSource('detail');
      const cleanup = () => this.clearDocumentPrintSource();
      window.addEventListener('afterprint', cleanup, { once: true });
      window.print();
      window.setTimeout(cleanup, 2000);
    });
    document.getElementById('document-detail-pdf')?.addEventListener('click', () => {
      if (this.detailDocument) this.exportDocumentPdf(this.detailDocument);
    });

    document.getElementById('document-customer-search')?.addEventListener('input', (event) => {
      this.clearCustomerSelectionIfSearchChanged(event.target.value);
      this.renderCustomerResults(event.target.value);
    });
    document.getElementById('document-customer-search')?.addEventListener('focus', (event) => {
      this.renderCustomerResults(event.target.value);
    });
    document.getElementById('document-customer-results')?.addEventListener('click', (event) => {
      const result = event.target.closest('[data-customer-id]');
      if (result) {
        this.selectCustomer(result.dataset.customerId);
      }
    });

    document.getElementById('document-product-search')?.addEventListener('input', (event) => {
      this.renderProductResults(event.target.value);
    });
    document.getElementById('document-product-search')?.addEventListener('focus', (event) => {
      this.renderProductResults(event.target.value);
    });
    document.getElementById('document-product-results')?.addEventListener('click', (event) => {
      const result = event.target.closest('[data-product-id]');
      if (result) {
        this.addProductLine(result.dataset.productId);
      }
    });

    document.getElementById('document-lines')?.addEventListener('change', (event) => this.handleLineChange(event));
    document.getElementById('document-lines')?.addEventListener('input', (event) => this.handleLineInput(event));
    document.getElementById('document-lines')?.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-line-remove]');
      if (removeButton) {
        this.removeLine(parseInt(removeButton.dataset.lineRemove, 10));
      }
    });

    document.addEventListener('click', (event) => {
      this.closeActionMenu();
      if (!event.target.closest('#quotations-invoices-view .documents-date-picker')) {
        this.closeDateRangePopup();
      }
      if (!event.target.closest('.documents-search-card')) {
        this.hideLookupResults();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (this.customerModal?.style.display === 'flex') {
          this.closeNewCustomerModal();
          return;
        }
        this.closeActionMenu();
        this.closeDateRangePopup();
        this.closeDetailModal();
        this.closeCreateModal();
      }
    });
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
          unitPrice: item.unitPrice || 0
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
      saveButton.style.display = isPreview ? 'inline-flex' : 'none';
      if (isPreview) {
        saveButton.innerHTML = window.electronAPI?.submitDocumentForApproval
          ? '<img src="assets/images/icons/custom/send_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Submit for Approval'
          : this.documentType === 'quotation'
            ? '<img src="assets/images/icons/custom/send_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Send Quotation'
            : '<img src="assets/images/icons/custom/check_status_icon.png" alt="" class="custom-ui-icon" aria-hidden="true"> Finalize & Settle Paid';
        saveButton.classList.add('documents-finalize-btn');
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

  populateCustomerSelect(selectedId = '') {
    const select = document.getElementById('document-customer');
    if (!select) return;

    select.innerHTML = `
      <option value="">Select customer</option>
      ${this.customers.map(customer => {
        const name = customer.name || customer.full_name || 'Walk-in Customer';
        return `<option value="${customer.id}" ${String(selectedId) === String(customer.id) ? 'selected' : ''}>${this.escapeHtml(name)}</option>`;
      }).join('')}
    `;
  }

  syncCustomerSearch(selectedId = '') {
    const input = document.getElementById('document-customer-search');
    const preview = document.getElementById('document-customer-preview');
    const customer = this.customers.find(item => String(item.id) === String(selectedId));

    if (input) input.value = customer ? this.getCustomerName(customer) : '';
    if (preview) {
      preview.hidden = !customer;
      preview.innerHTML = customer ? `
        <strong>${this.escapeHtml(this.getCustomerName(customer))}</strong>
        <span>${this.escapeHtml(this.getCustomerMeta(customer))}</span>
      ` : '';
    }
    this.syncCustomerButtonState(Boolean(customer));
  }

  getCustomerFormValues() {
    const customer = this.getSelectedCustomer();
    return customer ? {
      name: this.getCustomerName(customer),
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || ''
    } : { name: '', email: '', phone: '', address: '' };
  }

  hasCustomerForDocument() {
    return Boolean(document.getElementById('document-customer')?.value);
  }

  async resolveDocumentCustomerId() {
    const select = document.getElementById('document-customer');
    if (select?.value) return select.value;

    return null;
  }

  ensureNewCustomerModal() {
    if (this.customerModal) return this.customerModal;

    const existing = document.getElementById('document-customer-form-modal');
    if (existing) {
      this.customerModal = existing;
      return existing;
    }

    const modal = document.createElement('div');
    modal.id = 'document-customer-form-modal';
    modal.className = 'modal-overlay documents-customer-modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal pos-customer-modal documents-customer-modal" role="dialog" aria-modal="true" aria-labelledby="document-customer-modal-title">
        <div class="modal-header">
          <div>
            <h2 id="document-customer-modal-title">Add New Customer</h2>
            <p>Register Customer Profile</p>
          </div>
          <button type="button" class="modal-close" data-document-customer-close aria-label="Close customer form">x</button>
        </div>
        <form id="document-customer-form" class="pos-customer-form">
          <div class="modal-body">
            <div class="pos-customer-type-toggle" role="group" aria-label="Customer type">
              <button type="button" class="pos-customer-type active" data-document-customer-type="Individual" aria-pressed="true">Individual</button>
              <button type="button" class="pos-customer-type" data-document-customer-type="Corporate" aria-pressed="false">Corporate</button>
            </div>
            <div class="pos-customer-form-grid">
              <div class="form-group pos-customer-field full">
                <label for="document-new-customer-name">Full Name</label>
                <input type="text" id="document-new-customer-name" required placeholder="e.g. John Doe / ABC Corp">
              </div>
              <div class="form-group pos-customer-field full">
                <label for="document-new-customer-phone">Phone Number</label>
                <input type="tel" id="document-new-customer-phone" placeholder="e.g. 555-0123">
              </div>
              <div class="form-group pos-customer-field full">
                <label for="document-new-customer-email">Email Address</label>
                <input type="email" id="document-new-customer-email" placeholder="e.g. name@email.com">
              </div>
              <div class="form-group pos-customer-field full">
                <label for="document-new-customer-address">Billing Address</label>
                <textarea id="document-new-customer-address" rows="3" placeholder="Billing address"></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="submit" class="btn-primary pos-customer-submit" id="document-save-customer-btn" disabled>Create & Select</button>
          </div>
        </form>
      </div>
    `;

    (document.getElementById('quotations-invoices-view') || document.body).appendChild(modal);
    this.customerModal = modal;

    modal.querySelectorAll('[data-document-customer-close]').forEach(button => {
      button.addEventListener('click', () => this.closeNewCustomerModal());
    });
    modal.addEventListener('click', (event) => {
      if (event.target === modal) this.closeNewCustomerModal();
    });
    modal.querySelector('#document-customer-form')?.addEventListener('submit', (event) => this.saveNewCustomerFromModal(event));
    modal.querySelector('#document-new-customer-name')?.addEventListener('input', () => this.updateNewCustomerSubmitState());
    modal.querySelectorAll('[data-document-customer-type]').forEach(button => {
      button.addEventListener('click', () => this.setNewCustomerType(button.dataset.documentCustomerType || 'Individual'));
    });

    return modal;
  }

  openNewCustomerModal() {
    const modal = this.ensureNewCustomerModal();
    modal.querySelector('#document-customer-form')?.reset();
    this.setNewCustomerType('Individual');

    const suggestedName = document.getElementById('document-customer-search')?.value.trim() || '';
    const nameInput = modal.querySelector('#document-new-customer-name');
    if (nameInput) nameInput.value = suggestedName;

    this.updateNewCustomerSubmitState();
    modal.style.display = 'flex';
    window.setTimeout(() => nameInput?.focus(), 50);
  }

  closeNewCustomerModal() {
    if (this.customerModal) {
      this.customerModal.style.display = 'none';
    }
  }

  setNewCustomerType(type) {
    const modal = this.ensureNewCustomerModal();
    modal.querySelectorAll('[data-document-customer-type]').forEach(button => {
      const isActive = button.dataset.documentCustomerType === type;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  updateNewCustomerSubmitState() {
    const modal = this.ensureNewCustomerModal();
    const saveButton = modal.querySelector('#document-save-customer-btn');
    const name = modal.querySelector('#document-new-customer-name')?.value.trim();
    if (saveButton) saveButton.disabled = !name;
  }

  async saveNewCustomerFromModal(event) {
    event.preventDefault();

    const modal = this.ensureNewCustomerModal();
    const saveButton = modal.querySelector('#document-save-customer-btn');
    const name = modal.querySelector('#document-new-customer-name')?.value.trim();
    const phone = modal.querySelector('#document-new-customer-phone')?.value.trim();
    const email = modal.querySelector('#document-new-customer-email')?.value.trim();
    const address = modal.querySelector('#document-new-customer-address')?.value.trim();
    const customerType = modal.querySelector('[data-document-customer-type].active')?.dataset.documentCustomerType || 'Individual';

    if (!name) {
      this.showNotification('Customer name is required', 'error');
      modal.querySelector('#document-new-customer-name')?.focus();
      return;
    }

    if (!window.electronAPI || typeof window.electronAPI.createCustomer !== 'function') {
      this.showNotification('Customer creation service is unavailable', 'error');
      return;
    }

    const customerData = {
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      customerType,
      type: customerType,
      creditLimit: 0,
      status: 'Active'
    };

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Creating...';
    }

    try {
      const result = await window.electronAPI.createCustomer(customerData);
      if (!result?.success) {
        throw new Error(result?.error || 'Customer could not be created');
      }

      const customer = {
        ...customerData,
        ...(result.data || {}),
        customer_type: customerType
      };
      if (!customer.id) {
        throw new Error('Customer was saved but the returned record was invalid');
      }

      this.customers.unshift(customer);
      if (window.customersView && Array.isArray(window.customersView.customers)) {
        window.customersView.customers.unshift(customer);
        window.customersView.filterCustomers?.();
      }

      this.populateCustomerSelect(customer.id);
      this.selectCustomer(customer.id);
      this.closeNewCustomerModal();
      this.showNotification(`Customer ${customer.name} created`, 'success');
    } catch (error) {
      console.error('Create customer failed:', error);
      this.showNotification(error.message || 'Failed to create customer', 'error');
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Create & Select';
        this.updateNewCustomerSubmitState();
      }
    }
  }

  selectCustomer(customerId) {
    const select = document.getElementById('document-customer');
    if (select) select.value = customerId || '';
    this.syncCustomerSearch(customerId);
    this.updateProductSearchState();
    this.hideLookupResults();
    this.renderLines();
    this.refreshFormPreview();
  }

  getSelectedCustomer() {
    const selectedId = document.getElementById('document-customer')?.value;
    if (!selectedId) return null;
    return this.customers.find(item => String(item.id) === String(selectedId)) || null;
  }

  renderCustomerResults(searchText = '') {
    const results = document.getElementById('document-customer-results');
    if (!results) return;

    const query = searchText.trim().toLowerCase();
    const matches = this.customers
      .filter(customer => {
        const haystack = [
          this.getCustomerName(customer),
          customer.email,
          customer.phone,
          customer.customer_code,
          customer.id
        ].join(' ').toLowerCase();
        return !query || haystack.includes(query);
      })
      .slice(0, 8);

    if (!matches.length) {
      results.innerHTML = '<div class="documents-search-empty">No matching customer profile found.</div>';
      results.classList.add('show');
      return;
    }

    results.innerHTML = matches.map(customer => `
      <button type="button" class="documents-lookup-row" data-customer-id="${this.escapeHtml(customer.id)}">
        <span>
          <strong>${this.escapeHtml(this.getCustomerName(customer))}</strong>
          <em>${this.escapeHtml(this.getCustomerMeta(customer))}</em>
        </span>
        <img src="assets/images/icons/custom/check_status_icon.png" alt="" class="custom-ui-icon" aria-hidden="true">
      </button>
    `).join('');
    results.classList.add('show');
    if (window.lucide) window.lucide.createIcons();
  }

  clearCustomerSelectionIfSearchChanged(searchText) {
    const select = document.getElementById('document-customer');
    if (!select?.value) return;

    const customer = this.customers.find(item => String(item.id) === String(select.value));
    if (!customer || this.getCustomerName(customer) === searchText) return;

    select.value = '';
    const preview = document.getElementById('document-customer-preview');
    if (preview) {
      preview.hidden = true;
      preview.innerHTML = '';
    }
    this.syncCustomerButtonState(false);
    this.updateProductSearchState();
    this.renderLines();
    this.refreshFormPreview();
  }

  syncCustomerButtonState(hasCustomer = this.hasCustomerForDocument()) {
    const button = document.getElementById('document-add-customer-btn');
    if (!button) return;
    button.classList.toggle('has-customer', Boolean(hasCustomer));
  }

  renderProductResults(searchText = '') {
    const results = document.getElementById('document-product-results');
    const productSearch = document.getElementById('document-product-search');
    if (!results || !productSearch || productSearch.disabled) return;

    const query = searchText.trim().toLowerCase();
    const matches = this.products
      .filter(product => {
        const haystack = [
          product.name,
          product.sku,
          product.barcode,
          product.category_name,
          product.description
        ].join(' ').toLowerCase();
        return !query || haystack.includes(query);
      })
      .slice(0, 8);

    if (!matches.length) {
      results.innerHTML = '<div class="documents-search-empty">No matching inventory item found.</div>';
      results.classList.add('show');
      return;
    }

    results.innerHTML = matches.map(product => `
      <button type="button" class="documents-lookup-row product" data-product-id="${this.escapeHtml(product.id)}">
        <span>
          <strong>${this.escapeHtml(product.name || product.sku || 'Product')}</strong>
          <em>${this.escapeHtml(this.getProductMeta(product))}</em>
        </span>
        <b>${this.formatCurrency(this.getProductPrice(product))}</b>
      </button>
    `).join('');
    results.classList.add('show');
  }

  hideLookupResults() {
    document.querySelectorAll('#document-create-modal .documents-search-results').forEach(panel => {
      panel.classList.remove('show');
    });
  }

  updateProductSearchState() {
    const productSearch = document.getElementById('document-product-search');
    if (!productSearch) return;

    const hasCustomer = this.hasCustomerForDocument();
    productSearch.disabled = !hasCustomer && !this.editingDocument;
    productSearch.placeholder = hasCustomer || this.editingDocument
      ? 'Search product inventory list to add...'
      : 'Add customer details before adding product items...';
  }

  addProductLine(productId) {
    if (!this.canEditDocumentLines()) {
      this.showNotification('Add customer details before adding product items', 'warning');
      return;
    }

    const product = this.products.find(item => String(item.id) === String(productId));
    if (!product) return;

    this.lines.push({
      productId: product.id,
      quantity: 1,
      unitPrice: this.getProductPrice(product)
    });

    const productSearch = document.getElementById('document-product-search');
    if (productSearch) productSearch.value = '';
    this.hideLookupResults();
    this.renderLines();
  }

  renderLines() {
    const container = document.getElementById('document-lines');
    if (!container) return;

    const hasCustomer = this.hasCustomerForDocument();
    if (!hasCustomer && !this.editingDocument && !this.lines.some(line => line.productId)) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="documents-line-empty">
            Add customer details above to enable product inputs.
          </td>
        </tr>
      `;
      this.renderLineTotals();
      return;
    }

    if (!this.lines.length) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="documents-line-empty">
            Search the product inventory above to add invoice or quotation items.
          </td>
        </tr>
      `;
      this.renderLineTotals();
      return;
    }

    container.innerHTML = this.lines.map((line, index) => {
      const lineTotal = this.calculateLineTotal(line);
      const product = this.products.find(item => String(item.id) === String(line.productId));
      const description = product?.description || 'No description available';
      return `
        <tr class="document-line" data-line-index="${index}">
          <td class="documents-line-index">${index + 1}</td>
          <td>
            <select data-line-field="productId" aria-label="Catalog product">
              <option value="">Select product</option>
              ${this.products.map(productOption => `
                <option value="${productOption.id}" ${String(line.productId) === String(productOption.id) ? 'selected' : ''}>
                  ${this.escapeHtml(productOption.name || productOption.sku || 'Product')}
                </option>
              `).join('')}
            </select>
            <span class="documents-line-meta">${this.escapeHtml(product ? this.getProductMeta(product) : 'No product selected')}</span>
          </td>
          <td class="documents-line-description">${this.escapeHtml(description)}</td>
          <td><input type="number" min="0" step="0.01" value="${line.unitPrice}" data-line-field="unitPrice" aria-label="Unit price"></td>
          <td><input type="number" min="1" step="1" inputmode="numeric" value="${line.quantity}" data-line-field="quantity" class="documents-quantity-input" aria-label="Quantity"></td>
          <td class="document-line-total">${this.formatCurrency(lineTotal)}</td>
          <td>
            <button type="button" class="document-line-remove" data-line-remove="${index}" title="Remove line" aria-label="Remove line">
              <img src="assets/images/icons/custom/x_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true">
            </button>
          </td>
        </tr>
      `;
    }).join('');

    this.renderLineTotals();
    if (window.lucide) window.lucide.createIcons();
  }

  handleLineInput(event) {
    const lineElement = event.target.closest('[data-line-index]');
    if (!lineElement) return;

    const index = parseInt(lineElement.dataset.lineIndex, 10);
    const field = event.target.dataset.lineField;
    if (!field || !this.lines[index] || field === 'productId') return;

    const value = Number.parseFloat(event.target.value);
    this.lines[index][field] = Number.isFinite(value) ? value : 0;

    const lineTotal = lineElement.querySelector('.document-line-total');
    if (lineTotal) {
      lineTotal.textContent = this.formatCurrency(this.calculateLineTotal(this.lines[index]));
    }
    this.renderLineTotals();
  }

  handleLineChange(event) {
    const lineElement = event.target.closest('[data-line-index]');
    if (!lineElement) return;

    const index = parseInt(lineElement.dataset.lineIndex, 10);
    const field = event.target.dataset.lineField;
    if (!field || !this.lines[index]) return;

    if (field === 'productId') {
      this.lines[index].productId = event.target.value;
      const product = this.products.find(p => String(p.id) === String(event.target.value));
      if (product) {
        this.lines[index].unitPrice = this.getProductPrice(product);
      }
      this.renderLines();
      return;
    }

    let value = Number.parseFloat(event.target.value);
    if (!Number.isFinite(value)) value = 0;
    if (field === 'quantity') value = Math.max(1, Math.trunc(value));
    if (field === 'unitPrice') value = Math.max(0, value);

    this.lines[index][field] = value;
    event.target.value = String(value);

    const lineTotal = lineElement.querySelector('.document-line-total');
    if (lineTotal) {
      lineTotal.textContent = this.formatCurrency(this.calculateLineTotal(this.lines[index]));
    }
    this.renderLineTotals();
  }

  addLine() {
    if (!this.canEditDocumentLines()) {
      this.showNotification('Add customer details before adding product items', 'warning');
      return;
    }

    this.lines.push({ productId: '', quantity: 1, unitPrice: 0 });
    this.renderLines();
  }

  canEditDocumentLines() {
    return Boolean(this.hasCustomerForDocument() || this.editingDocument);
  }

  removeLine(index) {
    this.lines.splice(index, 1);
    this.renderLines();
  }

  getSettingValue(keys, inputId, fallback = '') {
    const candidates = Array.isArray(keys) ? keys : [keys];
    const sources = [
      this.settings,
      window.appSettings,
      window.settingsView?.settings,
      window.AlikoSystem?.state?.settings
    ].filter(Boolean);

    for (const source of sources) {
      for (const key of candidates) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
        const value = source[key];
        if (value !== undefined && value !== null) {
          return String(value).trim();
        }
      }
    }

    const input = inputId ? document.getElementById(inputId) : null;
    const inputValue = input?.value;
    if (inputValue !== undefined && inputValue !== null && String(inputValue).trim() !== '') {
      return String(inputValue).trim();
    }

    return fallback;
  }

  getConfiguredTaxSettings() {
    const rate = Math.max(parseFloat(this.getSettingValue(['default_tax_rate', 'tax.rate'], 'tax-rate', '17.5')) || 0, 0);
    const name = this.getSettingValue(['tax_name', 'tax.name'], 'tax-name', 'VAT') || 'VAT';
    return { rate, name };
  }

  getConfiguredDocumentDays(type = this.documentType) {
    const setting = type === 'quotation'
      ? this.getSettingValue(['doc_validity_days', 'quotation_validity_days', 'documents.validity_days'], 'doc-validity-days', '30')
      : this.getSettingValue(['doc_due_days', 'invoice_due_days', 'documents.due_days'], 'doc-due-days', '30');
    const days = Number.parseInt(setting, 10);
    return Number.isFinite(days) && days >= 0 ? days : 30;
  }

  syncDocumentTaxOptions(preferredRate = null, preferredName = '') {
    const select = document.getElementById('document-tax-rate');
    if (!select) return;

    const configured = this.getConfiguredTaxSettings();
    const selectedRate = preferredRate === null || preferredRate === undefined || preferredRate === ''
      ? configured.rate
      : Math.max(parseFloat(preferredRate) || 0, 0);
    const taxName = preferredName || configured.name;
    const options = [
      [String(configured.rate), `${configured.name} (${this.formatPercent(configured.rate)}) — Settings`]
    ];
    if (selectedRate !== configured.rate && selectedRate > 0) {
      options.push([String(selectedRate), `${taxName} (${this.formatPercent(selectedRate)})`]);
    }
    options.push(['0', 'Tax Exempt (0%)']);
    select.innerHTML = options.map(([value, label]) => `<option value="${this.escapeHtml(value)}">${this.escapeHtml(label)}</option>`).join('');
    select.value = String(selectedRate);
    if (!select.value) select.value = String(configured.rate);

    const fieldLabel = document.getElementById('document-tax-setting-label');
    const help = document.getElementById('document-tax-setting-help');
    if (fieldLabel) fieldLabel.textContent = `${configured.name} Setting`;
    if (help) help.textContent = `Default from Settings: ${configured.name} ${this.formatPercent(configured.rate)}.`;
  }

  formatPercent(value) {
    const number = Number(value) || 0;
    return `${number.toLocaleString('en-MW', { maximumFractionDigits: 2 })}%`;
  }

  renderLineTotals() {
    const totals = this.calculateTotals();
    this.setText('document-subtotal', this.formatDocumentAmount(totals.subtotal));
    this.setText('document-summary-discount', `-${this.formatDocumentAmount(totals.discount)}`);
    this.setText('document-summary-discount-rate', `@ ${this.formatPercent(totals.discountPercent)}`);
    this.setText('document-summary-tax-label', 'VAT 17.5%');
    this.setText('document-summary-tax', this.formatDocumentAmount(totals.tax));
    this.setText('document-total-section-title', 'GRAND TOTAL (K)');
    this.setText('document-total', this.formatDocumentAmount(totals.total));

    const taxInput = document.getElementById('document-tax');
    if (taxInput) taxInput.value = totals.tax.toFixed(2);
    if (this.documentStep === 'preview') this.refreshFormPreview();
  }

  calculateLineTotal(line) {
    const quantity = parseFloat(line.quantity) || 0;
    const unitPrice = parseFloat(line.unitPrice) || 0;
    return quantity * unitPrice;
  }

  calculateTotals() {
    const subtotal = this.lines.reduce((sum, line) => {
      return sum + ((parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0));
    }, 0);

    const discountInput = document.getElementById('document-discount');
    const discountPercent = Math.min(Math.max(parseFloat(discountInput?.value) || 0, 0), 100);
    if (discountInput && Number(discountInput.value) !== discountPercent) {
      discountInput.value = String(discountPercent);
    }

    const discount = subtotal * discountPercent / 100;
    const taxableAmount = Math.max(subtotal - discount, 0);
    const configured = this.getConfiguredTaxSettings();
    const taxRateElement = document.getElementById('document-tax-rate');
    const taxRate = taxRateElement && taxRateElement.value !== ''
      ? Math.max(parseFloat(taxRateElement.value) || 0, 0)
      : configured.rate;
    const taxName = configured.name;
    const tax = taxableAmount * taxRate / 100;
    const total = Math.max(taxableAmount, 0);

    return {
      subtotal,
      discountPercent,
      discount,
      taxableAmount,
      taxRate,
      taxName,
      tax,
      total
    };
  }

  getValidDocumentLines() {
    return this.lines
      .filter(line => line.productId && (parseFloat(line.quantity) || 0) > 0)
      .map(line => ({
        productId: parseInt(line.productId, 10),
        quantity: parseFloat(line.quantity) || 1,
        unitPrice: parseFloat(line.unitPrice) || 0,
        discountPercent: 0
      }));
  }

  refreshFormPreview(force = false) {
    const output = document.getElementById('document-preview-output');
    if (!output || (!force && this.documentStep !== 'preview')) return;

    const customer = this.getSelectedCustomer();
    const totals = this.calculateTotals();
    const dueDate = this.documentType === 'quotation'
      ? document.getElementById('document-quotation-expiry')?.value
      : document.getElementById('document-due-date')?.value;
    const paid = this.documentType === 'invoice'
      ? (parseFloat(document.getElementById('document-amount-paid')?.value) || 0)
      : 0;
    const status = this.documentType === 'quotation'
      ? 'draft'
      : (paid >= totals.total && totals.total > 0 ? 'paid' : paid > 0 ? 'partial' : 'issued');

    const previewDoc = {
      type: this.documentType,
      id: 'preview',
      number: this.editingDocument?.number || 'DRAFT',
      date: new Date().toISOString(),
      dueDate: dueDate || this.getDefaultDate(this.documentType === 'invoice' ? 30 : 30),
      customer: customer ? this.getCustomerName(customer) : 'Select Customer',
      customerEmail: customer?.email || '',
      customerPhone: customer?.phone || '',
      customerAddress: customer?.address || '',
      subtotal: totals.subtotal,
      discountPercent: totals.discountPercent,
      discount: totals.discount,
      taxRate: totals.taxRate,
      taxName: totals.taxName,
      tax: totals.tax,
      total: totals.total,
      paid,
      status: 'draft',
      approvalStatus: this.editingDocument?.approvalStatus || 'draft',
      approvedName: this.editingDocument?.approvedName || '',
      approvedSignature: this.editingDocument?.approvedSignature || '',
      approvedAt: this.editingDocument?.approvedAt || null,
      notes: document.getElementById('document-notes')?.value || '',
      items: this.getValidDocumentLines().map(line => {
        const product = this.products.find(item => String(item.id) === String(line.productId));
        return {
          productId: line.productId,
          productName: product?.name || product?.sku || 'Item',
          description: product?.description || '',
          sku: product?.sku || '',
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.quantity * line.unitPrice
        };
      }),
      payments: [],
      auditLogs: []
    };

    output.innerHTML = this.renderDocumentPrintSheet(previewDoc);
    if (window.lucide) window.lucide.createIcons();
  }

  getCompanyDetails() {
    const safeLogo = value => /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(String(value || '')) ? String(value) : '';
    const address = this.getSettingValue(['company_address', 'company.address'], 'company-address', '');
    const city = this.getSettingValue(['company_city', 'company.city'], 'company-city', '');
    const region = this.getSettingValue(['company_state', 'company.state'], 'company-state', '');
    const postalCode = this.getSettingValue(['company_zip', 'company.zip'], 'company-zip', '');
    const localityLine = [city, region, postalCode].filter(Boolean).join(', ');
    const addressLines = [address, localityLine].filter(Boolean);
    const name = this.getSettingValue(['company_name', 'company.name'], 'company-name', 'My Business');

    return {
      name,
      description: this.getSettingValue(
        ['company_description', 'company.description'],
        'company-description',
        ''
      ),
      address,
      city,
      region,
      postalCode,
      addressLines,
      phone: this.getSettingValue(['company_phone', 'company.phone'], 'company-phone', ''),
      email: this.getSettingValue(['company_email', 'company.email'], 'company-email', ''),
      website: this.getSettingValue(['company_website', 'company.website'], 'company-website', ''),
      taxId: this.getSettingValue(['company_tax_id', 'company.tax_id'], 'company-tax-id', ''),
      bankName: this.getSettingValue(['company_bank_name', 'company.bank_name'], 'company-bank-name', 'National Bank'),
      accountName: this.getSettingValue(['company_account_name', 'company.account_name'], 'company-account-name', name),
      accountNumber: this.getSettingValue(['company_account_number', 'company.account_number'], 'company-account-number', '1005706617'),
      bankBranch: this.getSettingValue(['company_bank_branch', 'company.bank_branch'], 'company-bank-branch', 'Chichiri'),
      uploadedLogo: safeLogo(this.getSettingValue(['company_logo', 'company.logo'], 'company-logo-data', '')),
      previewLogo: new URL('../../resources/logo.png', window.location.href).href,
      invoiceFooter: this.getSettingValue(['documents_invoice_footer', 'documents.invoice_footer'], 'doc-invoice-footer', 'Thank you for your business.'),
      quoteFooter: this.getSettingValue(['documents_quote_footer', 'documents.quote_footer'], 'doc-quote-footer', 'This quotation is valid for 30 days.')
    };
  }

  formatBillingAddress(address) {
    const rawAddress = String(address || '').trim();
    if (!rawAddress) return '';

    const parts = rawAddress
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);

    if (!parts.length) {
      return this.escapeHtml(rawAddress);
    }

    const lines = parts.length > 3
      ? [parts[0], parts[1], parts.slice(2).join(', ')]
      : parts;

    return lines
      .slice(0, 3)
      .map(line => this.escapeHtml(line))
      .join('<br>');
  }

  renderDocumentPrintSheet(doc) {
    const company = this.getCompanyDetails();
    const title = doc.type === 'quotation' ? 'QUOTATION' : 'INVOICE';
    const numberLabel = doc.type === 'quotation' ? 'Quotation #' : 'Invoice #';
    const logoSource = company.uploadedLogo || company.previewLogo;
    const logoMarkup = `<img class="documents-company-logo" src="${logoSource}" alt="${this.escapeHtml(company.name)} logo">`;
    const hasDiscount = (Number(doc.discount) || 0) > 0;
    const paid = doc.type === 'invoice' ? this.getPaidAmount(doc) : 0;
    const balance = Math.max((Number(doc.total) || 0) - paid, 0);
    const documentFooter = doc.type === 'quotation' ? company.quoteFooter : company.invoiceFooter;
    const isApproved = String(doc.approvalStatus || '').toLowerCase() === 'approved';

    return `
      <article class="documents-print-sheet documents-elegant-sheet">
        <header class="documents-elegant-header">
          <div class="documents-elegant-brand">
            ${logoMarkup}
            <div>
              <h2>${this.escapeHtml(company.name)}</h2>
              ${company.description ? `<p>${this.escapeHtml(company.description)}</p>` : ''}
            </div>
          </div>
          <div class="documents-elegant-title">
            <h1>${title}</h1>
            <dl>
              <div><dt>${numberLabel}:</dt><dd>${this.escapeHtml(doc.number)}</dd></div>
              <div><dt>Status:</dt><dd>${this.escapeHtml(this.formatStatusLabel(this.getDisplayStatus(doc)))}</dd></div>
            </dl>
          </div>
        </header>

        <section class="documents-elegant-parties">
          <div class="documents-elegant-company-contact">
            ${company.addressLines.length ? `<p><strong>Address:</strong> ${company.addressLines.map(line => this.escapeHtml(line)).join(', ')}</p>` : ''}
            ${company.phone ? `<p><strong>Phone:</strong> ${this.escapeHtml(company.phone)}</p>` : ''}
            ${company.email ? `<p><strong>Email:</strong> ${this.escapeHtml(company.email)}</p>` : ''}
            ${company.website ? `<p><strong>Website:</strong> ${this.escapeHtml(company.website)}</p>` : ''}
            ${company.taxId ? `<p><strong>Tax ID / VAT No.:</strong> ${this.escapeHtml(company.taxId)}</p>` : ''}
          </div>
          <div class="documents-elegant-billto${doc.type === 'quotation' ? ' documents-elegant-billto-vertical' : ''}">
            <h3>Bill to:</h3>
            <dl>
              <div><dt>Customer:</dt><dd>${this.escapeHtml(doc.customer)}</dd></div>
              ${doc.customerAddress ? `<div><dt>Address:</dt><dd class="documents-billing-address">${this.formatBillingAddress(doc.customerAddress)}</dd></div>` : ''}
              ${doc.customerPhone ? `<div><dt>Phone:</dt><dd>${this.escapeHtml(doc.customerPhone)}</dd></div>` : ''}
              ${doc.customerEmail ? `<div><dt>Email:</dt><dd>${this.escapeHtml(doc.customerEmail)}</dd></div>` : ''}
            </dl>
          </div>
        </section>

        <section class="documents-itemized documents-elegant-items">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Description</th>
                <th>Unit Price (K)</th>
                <th>Qty</th>
                <th>Amount (K)</th>
              </tr>
            </thead>
            <tbody>${this.renderDetailItems(doc.items)}</tbody>
          </table>
        </section>

        <section class="documents-elegant-summary-area">
          <div class="documents-payment-and-notes">
            <div class="documents-summary-left-text">Note: All amounts are in Malawi Kwacha (K).</div>
            ${doc.type === 'invoice' ? `
              <div class="documents-bank-details">
                <h4>PAY CASH/CHEQUE TO</h4>
                <dl>
                  <div><dt>Bank Name</dt><dd>: ${this.escapeHtml(company.bankName)}</dd></div>
                  <div><dt>Acc. Name</dt><dd>: ${this.escapeHtml(company.accountName)}</dd></div>
                  <div><dt>Acc. No.</dt><dd>: ${this.escapeHtml(company.accountNumber)}</dd></div>
                  <div><dt>Branch</dt><dd>: ${this.escapeHtml(company.bankBranch)}</dd></div>
                </dl>
              </div>
            ` : ''}
            ${doc.notes ? `<div class="documents-elegant-notes"><h4>Notes / Terms</h4><p>${this.escapeHtml(doc.notes)}</p></div>` : ''}
          </div>
          <div>
            <div class="documents-total-summary documents-elegant-totals">
              <div><span>SUB-TOTAL</span><strong>${this.formatDocumentAmount(doc.subtotal)}</strong></div>
              ${hasDiscount ? `<div><span>DISCOUNT @ ${this.formatPercent(doc.discountPercent || 0)}</span><strong>-${this.formatDocumentAmount(doc.discount)}</strong></div>` : ''}
              <div><span>VAT 17.5%</span><strong>${this.formatDocumentAmount(doc.tax)}</strong></div>
              <div class="total"><span>GRAND TOTAL (K)</span><strong>${this.formatDocumentAmount(doc.total)}</strong></div>
            </div>
            ${doc.type === 'invoice' && paid > 0 ? `
              <div class="documents-payment-balance">
                <div><span>Amount Paid</span><strong>${this.formatDocumentAmount(paid)}</strong></div>
                <div><span>Balance Due</span><strong>${this.formatDocumentAmount(balance)}</strong></div>
              </div>
            ` : ''}
          </div>
        </section>

        <section class="documents-approval-row" aria-label="Document approval">
          <div class="documents-approval-field">
            <span class="documents-approval-label">APPROVED BY:</span>
            <span class="documents-approval-line">
              <span class="documents-approval-name">${isApproved ? this.escapeHtml(doc.approvedName || '') : ''}</span>
            </span>
          </div>
          <div class="documents-approval-field documents-signature-field">
            <span class="documents-approval-label">SIGNATURE:</span>
            <span class="documents-approval-line documents-signature-line">
              ${isApproved && doc.approvedSignature ? `<img src="${doc.approvedSignature}" alt="Approver signature" class="documents-manager-signature">` : ''}
            </span>
          </div>
        </section>

        <footer class="documents-elegant-thankyou">${this.escapeHtml(documentFooter || 'Thank you for your business')}</footer>
      </article>
    `;
  }

  getDocumentHeading(doc) {
    return doc.type === 'quotation' ? 'Price Quotation' : 'TAX Invoice';
  }

  handleSecondarySave() {
    const amountPaid = document.getElementById('document-amount-paid');
    const settleStatus = document.getElementById('document-settle-status');
    if (amountPaid) amountPaid.value = '0';
    if (settleStatus) settleStatus.value = 'unpaid';
    this.saveDocument('draft');
  }

  handlePrimarySave() {
    if (this.documentType === 'invoice') this.updateSettlementAmountPreview();
    if (window.electronAPI?.submitDocumentForApproval) {
      this.saveDocument('draft', { submitForApproval: true });
      return;
    }

    this.saveDocument(this.documentType === 'quotation' ? 'sent' : 'issued');
  }

  setDocumentPrintSource(source) {
    document.body.classList.remove('documents-print-preview', 'documents-print-detail');
    document.body.classList.add(source === 'detail' ? 'documents-print-detail' : 'documents-print-preview');
  }

  clearDocumentPrintSource() {
    document.body.classList.remove('documents-print-preview', 'documents-print-detail');
  }

  async waitForDocumentImages(selector) {
    const images = [...document.querySelectorAll(`${selector} img`)];
    await Promise.all(images.map(image => {
      if (image.complete) return Promise.resolve();
      return new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
  }

  getPrintableDocumentHtml(source = 'preview') {
    const selector = source === 'detail'
      ? '#document-detail-body .documents-elegant-sheet'
      : '#document-preview-output .documents-elegant-sheet';
    const sheet = document.querySelector(selector);
    if (!sheet) throw new Error('The A4 document preview is not ready. Reopen Preview and try again.');

    const clone = sheet.cloneNode(true);
    clone.removeAttribute('style');
    clone.querySelectorAll('[contenteditable], [data-preview-control]').forEach(element => {
      element.removeAttribute('contenteditable');
      element.removeAttribute('data-preview-control');
    });
    return clone.outerHTML;
  }

  printPreviewDocument() {
    if (this.documentStep !== 'preview') return;
    this.refreshFormPreview(true);
    this.setDocumentPrintSource('preview');
    const cleanup = () => this.clearDocumentPrintSource();
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 2000);
  }

  async downloadPreviewPdf() {
    if (this.documentStep !== 'preview') return;
    this.refreshFormPreview(true);

    const documentNumber = this.editingDocument?.number
      || `${this.documentType === 'quotation' ? 'Quotation' : 'Invoice'}-Draft`;

    if (!window.electronAPI?.exportDocumentPdf) {
      this.showNotification('PDF download is available in the Electron desktop application', 'warning');
      window.print();
      return;
    }

    this.setDocumentPrintSource('preview');
    try {
      await this.waitForDocumentImages('#document-preview-output');
      const result = await window.electronAPI.exportDocumentPdf({
        documentNumber,
        documentType: this.documentType,
        source: 'preview',
        html: this.getPrintableDocumentHtml('preview')
      });
      if (result?.canceled) return;
      if (!result?.success) throw new Error(result?.error || 'Failed to create PDF');
      this.showNotification('A4 PDF downloaded successfully', 'success');
    } catch (error) {
      console.error('Failed to download preview PDF:', error);
      this.showNotification(error.message || 'Failed to download PDF', 'error');
    } finally {
      this.clearDocumentPrintSource();
    }
  }

  updateSettlementAmountPreview() {
    const settleStatus = document.getElementById('document-settle-status')?.value;
    const amountPaid = document.getElementById('document-amount-paid');
    if (!amountPaid) return;

    if (settleStatus === 'paid') {
      amountPaid.value = this.calculateTotals().total.toFixed(2);
    } else if (settleStatus === 'unpaid') {
      amountPaid.value = '0';
    }
  }

  setDueDateFromPaymentTerms() {
    const terms = parseInt(document.getElementById('document-payment-terms')?.value || '0', 10) || 0;
    const dateInput = document.getElementById('document-due-date');
    if (dateInput) dateInput.value = this.getDefaultDate(terms);
  }

  setPaymentTermsFromDate(dateValue) {
    const terms = document.getElementById('document-payment-terms');
    if (!terms || !dateValue) return;

    const due = new Date(dateValue);
    const today = new Date();
    if (Number.isNaN(due.getTime())) return;
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const days = Math.max(0, Math.round((due - today) / 86400000));
    const allowed = ['0', '7', '14', '30'];
    terms.value = allowed.includes(String(days)) ? String(days) : '30';
  }

  async saveDocument(status, options = {}) {
    const validLines = this.getValidDocumentLines();

    if (!validLines.length) {
      this.showNotification('Add at least one product line', 'warning');
      return;
    }

    const totals = this.calculateTotals();
    const shouldSubmitForApproval = Boolean(options.submitForApproval && window.electronAPI?.submitDocumentForApproval);
    this.setSavingState(true);

    try {
      const customerId = await this.resolveDocumentCustomerId();
      if (!customerId) {
        this.showNotification(`Add customer details before saving this ${this.documentType}`, 'warning');
        return;
      }

      const dateValue = this.documentType === 'quotation'
        ? document.getElementById('document-quotation-expiry')?.value
        : document.getElementById('document-due-date')?.value;
      const notes = document.getElementById('document-notes')?.value || null;
      const currentUser = this.getCurrentUser();
      const payload = {
        customerId,
        subtotal: totals.subtotal,
        discountPercent: totals.discountPercent,
        discountAmount: totals.discount,
        taxRate: totals.taxRate,
        taxName: totals.taxName,
        taxAmount: totals.tax,
        totalAmount: totals.total,
        notes,
        status: shouldSubmitForApproval ? 'draft' : status,
        items: validLines,
        userId: currentUser?.id || null,
        credentials: {
          token: localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
        }
      };

      if (this.documentType === 'quotation') {
        payload.expiryDate = dateValue || this.getDefaultDate(this.getConfiguredDocumentDays('quotation'));
      } else {
        payload.dueDate = dateValue || this.getDefaultDate(this.getConfiguredDocumentDays('invoice'));
        payload.adjustStock = !shouldSubmitForApproval && status !== 'draft';
        payload.amountPaid = parseFloat(document.getElementById('document-amount-paid')?.value) || 0;
        payload.paymentMethod = document.getElementById('document-payment-method')?.value || 'cash';
      }

      let result;
      if (this.editingDocument && this.documentType === 'quotation' && window.electronAPI?.updateQuotation) {
        result = await window.electronAPI.updateQuotation(this.editingDocument.id, payload);
      } else if (
        this.editingDocument
        && this.documentType === 'invoice'
        && this.normalizeStatus(this.editingDocument.status) === 'draft'
        && window.electronAPI?.updateInvoice
      ) {
        result = await window.electronAPI.updateInvoice(this.editingDocument.id, payload);
      } else {
        result = this.documentType === 'quotation'
          ? await window.electronAPI.createQuotation(payload)
          : await window.electronAPI.createInvoice(payload);
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to save document');
      }

      if (shouldSubmitForApproval) {
        const savedId = result.data?.id;
        if (!savedId) throw new Error('The saved document ID is missing.');
        const submitted = await window.electronAPI?.submitDocumentForApproval?.(this.documentType, savedId, this.getCurrentUser()?.id);
        if (!submitted?.success) throw new Error(submitted?.error || 'Failed to submit document for approval');
        this.showNotification(`${this.documentType === 'quotation' ? 'Quotation' : 'Invoice'} submitted for approval`, 'success');
      } else {
        const action = status === 'draft'
          ? 'saved as draft'
          : this.documentType === 'quotation'
            ? 'sent'
            : 'saved';
        this.showNotification(`${this.documentType === 'quotation' ? 'Quotation' : 'Invoice'} ${action}`, 'success');
      }
      this.closeCreateModal();
      await this.loadData();
      this.activeTab = this.documentType === 'quotation' ? 'quotations' : 'invoices';
      this.statusFilter = '';
      this.render();
    } catch (error) {
      console.error('Failed to save document:', error);
      this.showNotification(error.message || 'Failed to save document', 'error');
    } finally {
      this.setSavingState(false);
    }
  }

  setSavingState(isSaving) {
    ['document-save-draft-btn', 'document-save-send-btn', 'document-detail-submit-approval', 'document-detail-approve', 'document-approval-confirm'].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = isSaving;
    });
  }

  syncActiveTab() {
    document.querySelectorAll('#quotations-invoices-view [data-doc-tab]').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.docTab === this.activeTab);
    });
  }

  isIssuedInvoice(doc) {
    if (!doc || doc.type !== 'invoice') return false;
    return ['issued', 'partial', 'overdue'].includes(this.normalizeStatus(doc.status));
  }

  canEditDocumentDraft(doc) {
    return Boolean(doc && ['draft', 'rejected'].includes(doc.approvalStatus) && this.normalizeStatus(doc.status) === 'draft');
  }

  canSubmitDocumentForApproval(doc) {
    return Boolean(window.electronAPI?.submitDocumentForApproval && this.canEditDocumentDraft(doc));
  }

  canApproveDocument(doc) {
    return Boolean(
      window.electronAPI?.approveDocumentWithCredentials
      && doc
      && doc.approvalStatus === 'pending'
      && this.normalizeStatus(doc.status) === 'draft'
      && this.canApproveDocuments()
    );
  }

  canRecordInvoicePayment(doc) {
    if (!doc || doc.type !== 'invoice') return false;
    return ['issued', 'partial', 'overdue'].includes(this.normalizeStatus(doc.status));
  }

  canVoidIssuedInvoice(doc) {
    if (!doc || doc.type !== 'invoice') return false;
    return ['issued', 'partial', 'overdue'].includes(this.normalizeStatus(doc.status));
  }

  toggleActionMenu(button, type, id) {
    const wasOpen = button.getAttribute('aria-expanded') === 'true';
    this.closeActionMenu();
    if (wasOpen) return;

    const doc = this.findDocument(type, id);
    if (!doc) return;

    const isQuotation = type === 'quotation';
    const menu = document.createElement('div');
    menu.className = 'documents-action-menu';
    menu.innerHTML = `
      <button type="button" data-menu-action="view"><img src="assets/images/icons/custom/eye_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> View Details</button>
      <button type="button" data-menu-action="print"><img src="assets/images/icons/custom/printer_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Print</button>
      <button type="button" data-menu-action="pdf"><img src="assets/images/icons/custom/download_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Export PDF</button>
      <button type="button" data-menu-action="copy"><img src="assets/images/icons/custom/copy_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Copy Code</button>
      ${this.canRecordInvoicePayment(doc) ? '<button type="button" data-menu-action="payment"><img src="assets/images/icons/custom/credit_card_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Record Payment</button>' : ''}
      ${isQuotation && doc.status !== 'converted' && (doc.approvalStatus === 'approved' || !window.electronAPI?.submitDocumentForApproval) ? '<button type="button" data-menu-action="convert"><img src="assets/images/icons/custom/file_check_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Convert to Invoice</button>' : ''}
      ${this.canEditDocumentDraft(doc)
        ? '<button type="button" data-menu-action="edit"><img src="assets/images/icons/custom/edit_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Edit Draft</button>'
        : ''}
      ${this.canSubmitDocumentForApproval(doc)
        ? '<button type="button" data-menu-action="submit"><img src="assets/images/icons/custom/send_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Submit for Approval</button>'
        : ''}
      ${this.canApproveDocument(doc)
        ? '<button type="button" class="finalize" data-menu-action="approve"><img src="assets/images/icons/custom/badge_check_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Approve & Finalize</button>'
        : ''}
      ${isQuotation ? '<button type="button" data-menu-action="delete" class="danger"><img src="assets/images/icons/custom/trash_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Delete Quote</button>' : ''}
      ${this.canVoidIssuedInvoice(doc) ? '<button type="button" data-menu-action="void" class="danger"><img src="assets/images/icons/custom/ban_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"> Void Invoice</button>' : ''}
    `;
    document.body.appendChild(menu);
    this.actionMenu = menu;
    button.setAttribute('aria-expanded', 'true');

    const buttonRect = button.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(12, Math.min(buttonRect.right - menuRect.width, window.innerWidth - menuRect.width - 12))}px`;
    menu.style.top = `${Math.min(buttonRect.bottom + 8, window.innerHeight - menuRect.height - 12)}px`;

    menu.querySelectorAll('[data-menu-action]').forEach(item => {
      item.onclick = (event) => {
        event.stopPropagation();
        this.handleDocumentAction(item.dataset.menuAction, type, id);
      };
    });

    if (window.lucide) window.lucide.createIcons();
  }

  closeActionMenu() {
    document.querySelectorAll('#documents-tbody [data-doc-action="menu"]').forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
    });
    if (this.actionMenu) {
      this.actionMenu.remove();
      this.actionMenu = null;
    }
  }

  async handleDocumentAction(action, type, id) {
    this.closeActionMenu();
    const doc = this.findDocument(type, id);
    if (!doc) return;

    if (action === 'view') {
      this.openDetailModal(doc);
      return;
    }

    if (action === 'print') {
      this.openDetailModal(doc);
      setTimeout(() => {
        this.setDocumentPrintSource('detail');
        const cleanup = () => this.clearDocumentPrintSource();
        window.addEventListener('afterprint', cleanup, { once: true });
        window.print();
        window.setTimeout(cleanup, 2000);
      }, 150);
      return;
    }

    if (action === 'pdf') {
      this.openDetailModal(doc);
      setTimeout(() => this.exportDocumentPdf(doc), 200);
      return;
    }

    if (action === 'copy') {
      await this.copyText(doc.number);
      this.showNotification('Document code copied', 'success');
      return;
    }

    if (action === 'submit') {
      await this.submitDocumentForApproval(doc);
      return;
    }

    if (action === 'approve') {
      await this.approveAndFinalizeDocument(doc);
      return;
    }

    if (action === 'convert') {
      await this.convertQuotationToInvoice(doc);
      return;
    }

    if (action === 'payment') {
      await this.recordPayment(doc);
      return;
    }

    if (action === 'edit') {
      if (this.normalizeStatus(doc.status) === 'draft' && ['draft', 'rejected'].includes(doc.approvalStatus)) {
        this.openDraftForEditing(doc);
        return;
      }
      this.showNotification('Only editable drafts can be changed; pending or approved documents are locked', 'warning');
      return;
    }

    if (action === 'delete') {
      await this.deleteQuotation(doc);
      return;
    }

    if (action === 'void') {
      await this.voidInvoice(doc);
    }
  }


  async submitDocumentForApproval(doc) {
    if (!doc || !['draft', 'rejected'].includes(doc.approvalStatus) || this.normalizeStatus(doc.status) !== 'draft') {
      this.showNotification('Only an editable draft can be submitted for approval', 'warning');
      return;
    }
    try {
      const result = await window.electronAPI?.submitDocumentForApproval?.(doc.type, doc.id, this.getCurrentUser()?.id);
      if (!result?.success) throw new Error(result?.error || 'Failed to submit document for approval');
      this.showNotification(`${doc.type === 'quotation' ? 'Quotation' : 'Invoice'} submitted for approval`, 'success');
      this.closeDetailModal();
      await this.loadData();
      this.render();
    } catch (error) {
      this.showNotification(error.message || 'Failed to submit document', 'error');
    }
  }

  openInlineApprovalPanel(doc) {
    if (!doc || doc.approvalStatus !== 'pending') {
      this.showNotification('This document is not pending approval', 'warning');
      return;
    }
    const panel = document.getElementById('document-detail-approval-panel');
    const errorBox = document.getElementById('document-approval-error');
    const username = document.getElementById('document-approval-username');
    const password = document.getElementById('document-approval-password');
    const note = document.getElementById('document-approval-note');
    if (!panel) return;
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }
    if (username) username.value = '';
    if (password) password.value = '';
    if (note) note.value = '';
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => username?.focus(), 50);
    if (window.lucide) window.lucide.createIcons();
  }

  closeInlineApprovalPanel() {
    const panel = document.getElementById('document-detail-approval-panel');
    const errorBox = document.getElementById('document-approval-error');
    const username = document.getElementById('document-approval-username');
    const password = document.getElementById('document-approval-password');
    const note = document.getElementById('document-approval-note');
    if (panel) panel.hidden = true;
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }
    if (username) username.value = '';
    if (password) password.value = '';
    if (note) note.value = '';
  }

  async approveAndFinalizeDocument(doc) {
    if (!doc || doc.approvalStatus !== 'pending') {
      this.showNotification('This document is not pending approval', 'warning');
      return;
    }

    const username = document.getElementById('document-approval-username')?.value?.trim() || '';
    const password = document.getElementById('document-approval-password')?.value || '';
    const note = document.getElementById('document-approval-note')?.value?.trim() || '';
    const errorBox = document.getElementById('document-approval-error');

    if (!username || !password) {
      const message = 'Enter the manager username and password to approve this document.';
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.hidden = false;
      }
      this.showNotification(message, 'warning');
      return;
    }

    this.setSavingState(true);
    try {
      const result = await window.electronAPI?.approveDocumentWithCredentials?.(doc.type, doc.id, {
        username,
        password,
        note
      });
      if (!result?.success) throw new Error(result?.error || 'Failed to approve document');
      this.showNotification(`${doc.type === 'quotation' ? 'Quotation' : 'Invoice'} approved and finalized`, 'success');
      this.closeInlineApprovalPanel();
      this.closeDetailModal();
      await this.loadData();
      this.render();
    } catch (error) {
      const message = error.message || 'Failed to approve document';
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.hidden = false;
      }
      this.showNotification(message, 'error');
    } finally {
      this.setSavingState(false);
    }
  }

  async convertQuotationToInvoice(quotation) {
    if (!quotation.items?.length) {
      this.showNotification('Quotation has no item lines to convert', 'warning');
      return;
    }

    try {
      const hasApprovalWorkflow = Boolean(window.electronAPI?.submitDocumentForApproval);
      const result = await window.electronAPI.createInvoice({
        quotationId: quotation.id,
        customerId: quotation.customerId,
        dueDate: this.getDefaultDate(30),
        subtotal: quotation.subtotal,
        discountPercent: quotation.discountPercent || 0,
        discountAmount: quotation.discount,
        taxRate: quotation.taxRate || this.getConfiguredTaxSettings().rate,
        taxName: quotation.taxName || this.getConfiguredTaxSettings().name,
        taxAmount: quotation.tax,
        totalAmount: quotation.total,
        notes: `Converted from quotation ${quotation.number}`,
        status: hasApprovalWorkflow ? 'draft' : 'issued',
        adjustStock: !hasApprovalWorkflow,
        credentials: {
          token: localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
        },
        items: quotation.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: 0
        }))
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to convert quotation');
      }

      this.showNotification(
        hasApprovalWorkflow
          ? 'Quotation converted to an invoice draft. Submit the invoice for approval'
          : 'Quotation converted to invoice',
        'success'
      );
      await this.loadData();
      this.activeTab = 'invoices';
      this.statusFilter = '';
      this.closeDetailModal();
      this.render();
    } catch (error) {
      console.error('Failed to convert quotation:', error);
      this.showNotification(error.message || 'Failed to convert quotation', 'error');
    }
  }

  async recordPayment(invoice) {
    const balanceDue = Math.max((invoice.total || 0) - this.getPaidAmount(invoice), 0);
    if (balanceDue <= 0) {
      this.showNotification('Invoice is already fully paid', 'info');
      return;
    }

    const amountText = prompt(`Payment amount for ${invoice.number}. Balance due: ${this.formatCurrency(balanceDue)}`, balanceDue.toFixed(2));
    if (amountText === null) return;

    const amount = parseFloat(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.showNotification('Enter a valid payment amount', 'warning');
      return;
    }

    const method = prompt('Payment method (cash, card, mobile, bank, credit)', 'cash');
    if (method === null) return;

    try {
      const result = await window.electronAPI?.recordInvoicePayment?.({
        invoiceId: invoice.id,
        amount,
        method: method.trim() || 'cash'
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to record payment');
      }

      this.showNotification('Payment recorded', 'success');
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Failed to record payment:', error);
      this.showNotification(error.message || 'Failed to record payment', 'error');
    }
  }

  async exportDocumentPdf(doc) {
    this.setDocumentPrintSource('detail');
    try {
      await this.waitForDocumentImages('#document-detail-body');
      const result = await window.electronAPI?.exportDocumentPdf?.({
        documentNumber: doc.number,
        documentType: doc.type,
        source: 'detail',
        html: this.getPrintableDocumentHtml('detail')
      });
      if (result?.canceled) return;
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to export PDF');
      }
      this.showNotification('A4 PDF downloaded successfully', 'success');
    } catch (error) {
      console.error('Failed to export PDF:', error);
      this.showNotification(error.message || 'Failed to export PDF', 'error');
    } finally {
      this.clearDocumentPrintSource();
    }
  }

  async deleteQuotation(quotation) {
    if (!window.confirm(`Delete quotation ${quotation.number}? This cannot be undone.`)) return;
    const reason = window.prompt('Enter the reason for deleting this quotation:');
    if (!reason?.trim()) return;

    try {
      const result = await window.electronAPI?.deleteQuotation?.(
        quotation.id,
        this.destructiveCredentials(reason)
      );
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to delete quotation');
      }

      this.showNotification('Quotation deleted', 'success');
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Failed to delete quotation:', error);
      this.showNotification(error.message || 'Failed to delete quotation', 'error');
    }
  }

  async voidInvoice(invoice) {
    if (!window.confirm(`Void invoice ${invoice.number}?`)) return;

    try {
      const result = await window.electronAPI?.voidInvoice?.(invoice.id, 'Voided from Quotations & Invoices view');
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to void invoice');
      }

      this.showNotification('Invoice voided', 'success');
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Failed to void invoice:', error);
      this.showNotification(error.message || 'Failed to void invoice', 'error');
    }
  }

  async clearCurrentHistory() {
    const isInvoices = this.activeTab === 'invoices';
    const count = isInvoices ? this.invoices.length : this.quotations.length;
    if (!count) {
      this.showNotification(`No ${isInvoices ? 'invoices' : 'quotations'} to clear`, 'info');
      return;
    }

    if (!window.confirm(`Delete all ${count} ${isInvoices ? 'invoices' : 'quotations'}? This cannot be undone.`)) {
      return;
    }
    const reason = window.prompt(
      `Enter the reason for clearing all ${isInvoices ? 'invoice' : 'quotation'} history:`
    );
    if (!reason?.trim()) return;

    try {
      const result = isInvoices
        ? await window.electronAPI?.clearInvoices?.(this.destructiveCredentials(reason))
        : await window.electronAPI?.clearQuotations?.(this.destructiveCredentials(reason));
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to clear history');
      }

      this.showNotification(`${isInvoices ? 'Invoice' : 'Quotation'} history cleared`, 'success');
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Failed to clear history:', error);
      this.showNotification(error.message || 'Failed to clear history', 'error');
    }
  }

  destructiveCredentials(reason) {
    return {
      token: localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '',
      reason: String(reason || '').trim()
    };
  }

  openDraftForEditing(doc) {
    if (!doc || this.normalizeStatus(doc.status) !== 'draft' || !['draft', 'rejected'].includes(doc.approvalStatus)) {
      this.showNotification('Only drafts that are not pending approval can be edited', 'warning');
      return;
    }

    this.closeDetailModal();
    this.openCreateModal(doc.type, doc);
  }

  openDetailModal(doc) {
    const body = document.getElementById('document-detail-body');
    const modal = document.getElementById('document-detail-modal');
    if (!body || !modal) return;

    this.detailDocument = doc;
    body.innerHTML = this.renderDocumentPrintSheet(doc);
    body.scrollTop = 0;

    const title = document.getElementById('document-detail-title');
    const subtitle = document.getElementById('document-detail-subtitle');
    const editButton = document.getElementById('document-detail-edit-draft');
    const submitButton = document.getElementById('document-detail-submit-approval');
    const approveButton = document.getElementById('document-detail-approve');
    const paymentButton = document.getElementById('document-detail-payment');
    const voidButton = document.getElementById('document-detail-void');
    if (title) title.textContent = `${doc.type === 'quotation' ? 'Quotation' : 'Invoice'} Preview`;
    if (subtitle) subtitle.textContent = `${doc.number} - ${this.formatStatusLabel(this.getDisplayStatus(doc))}`;
    if (editButton) editButton.hidden = !this.canEditDocumentDraft(doc);
    if (submitButton) submitButton.hidden = !this.canSubmitDocumentForApproval(doc);
    if (approveButton) approveButton.hidden = !this.canApproveDocument(doc);
    if (paymentButton) paymentButton.hidden = !this.canRecordInvoicePayment(doc);
    if (voidButton) voidButton.hidden = !this.canVoidIssuedInvoice(doc);
    this.closeInlineApprovalPanel();

    modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
  }

  renderDetailItems(items = []) {
    if (!items.length) {
      return '<tr><td colspan="6" class="documents-empty">No product lines recorded.</td></tr>';
    }

    return items.map((item, index) => `
      <tr>
        <td class="documents-item-number">${index + 1}</td>
        <td class="documents-item-product">
          <strong>${this.escapeHtml(item.productName)}</strong>
        </td>
        <td class="documents-item-description">${this.escapeHtml(item.description || '')}</td>
        <td>${this.formatDocumentAmount(item.unitPrice)}</td>
        <td>${this.escapeHtml(item.quantity)}</td>
        <td>${this.formatDocumentAmount(item.totalPrice)}</td>
      </tr>
    `).join('');
  }

  renderAuditTrail(logs = []) {
    if (!logs.length) {
      return `
        <div class="documents-history-panel">
          <h4>Audit Trail</h4>
          <p>No audit entries recorded yet.</p>
        </div>
      `;
    }

    return `
      <div class="documents-history-panel">
        <h4>Audit Trail</h4>
        <div class="documents-history-list">
          ${logs.slice(0, 8).map(log => `
            <div class="documents-history-row">
              <span>${this.formatDate(log.createdAt)}</span>
              <strong>${this.escapeHtml(this.formatAuditAction(log.action))}</strong>
              <em>${this.escapeHtml(log.summary || '')}</em>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  closeDetailModal() {
    this.closeInlineApprovalPanel();
    const modal = document.getElementById('document-detail-modal');
    if (modal) modal.style.display = 'none';
    this.detailDocument = null;
  }

  findDocument(type, id) {
    const source = type === 'quotation' ? this.quotations : this.invoices;
    return source.find(doc => String(doc.id) === String(id));
  }

  isWithinDateRange(dateValue) {
    if (!this.startDate && !this.endDate) return true;
    if (!dateValue) return false;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    if (this.startDate) {
      const start = new Date(this.startDate);
      start.setHours(0, 0, 0, 0);
      if (date < start) return false;
    }
    if (this.endDate) {
      const end = new Date(this.endDate);
      end.setHours(23, 59, 59, 999);
      if (date > end) return false;
    }
    return true;
  }

  mapDocumentItems(items = []) {
    return items.map(item => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unit_price || item.unitPrice || item.price) || 0;
      const totalPrice = parseFloat(item.total_price || item.totalPrice) || (quantity * unitPrice);

      return {
        productId: item.product_id || item.productId || item.id,
        productName: item.product_name || item.name || item.sku || 'Item',
        description: item.product_description || item.description || '',
        sku: item.sku || '',
        quantity,
        unitPrice,
        discountPercent: 0,
        totalPrice
      };
    });
  }

  mapPayments(payments = []) {
    return payments.map(payment => ({
      id: payment.id,
      amount: parseFloat(payment.amount) || 0,
      method: payment.payment_method || payment.method || 'cash',
      reference: payment.reference || '',
      notes: payment.notes || '',
      createdAt: payment.created_at || payment.createdAt
    }));
  }

  mapAuditLogs(logs = []) {
    return logs.map(log => {
      const parsed = this.safeParseJson(log.new_values || log.newValues);
      return {
        id: log.id,
        action: log.action || '',
        createdAt: log.created_at || log.createdAt,
        summary: this.summarizeAudit(log.action, parsed)
      };
    });
  }

  summarizeAudit(action, values) {
    if (!values) return '';
    if (action === 'payment') return values.paymentAmount ? `${this.formatCurrency(values.paymentAmount)} paid` : '';
    if (action === 'void') return values.reason || 'Invoice voided';
    if (action === 'convert') return values.invoiceNumber ? `Converted to ${values.invoiceNumber}` : 'Converted';
    if (action === 'clear') return `${values.clearedCount || 0} records cleared`;
    if (values.status) return `Status: ${values.status}`;
    if (values.totalAmount !== undefined) return `Total: ${this.formatCurrency(values.totalAmount)}`;
    return '';
  }

  formatAuditAction(action) {
    const labels = {
      create: 'Created',
      create_draft: 'Draft Created',
      send: 'Sent',
      submit_for_approval: 'Submitted for Approval',
      approve_finalize: 'Approved & Finalized',
      update: 'Updated',
      delete: 'Deleted',
      clear: 'Cleared',
      convert: 'Converted',
      payment: 'Payment',
      void: 'Voided'
    };
    return labels[action] || action;
  }

  safeParseJson(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  formatItemSummary(items = []) {
    if (!items.length) return '0 items';
    const summary = items.slice(0, 2).map(item => `${item.productName} x${item.quantity}`).join(', ');
    return items.length > 2 ? `${summary} +${items.length - 2} more` : summary;
  }

  getProductPrice(product) {
    return parseFloat(product.unit_price || product.selling_price || product.price || product.cost_price) || 0;
  }

  getProductMeta(product) {
    const sku = product.sku || 'No SKU';
    const unit = product.unit || 'unit';
    const available = this.getProductAvailableStock(product);
    return `${sku} | ${available} ${unit} available`;
  }

  getProductAvailableStock(product) {
    const onHand = parseFloat(product.quantity_on_hand ?? product.quantityOnHand ?? product.stock ?? 0) || 0;
    const reserved = parseFloat(product.quantity_reserved ?? product.quantityReserved ?? 0) || 0;
    const explicit = product.quantity_available ?? product.available_stock ?? product.availableStock;
    if (explicit !== undefined && explicit !== null) {
      return parseFloat(explicit) || 0;
    }
    return Math.max(onHand - reserved, 0);
  }

  getCustomerName(customer) {
    return customer.name || customer.full_name || customer.customer_name || 'Walk-in Customer';
  }

  getCustomerMeta(customer) {
    return [customer.phone, customer.email, customer.customer_code || customer.id]
      .filter(Boolean)
      .join(' | ') || 'Customer profile';
  }

  getPaidAmount(invoice) {
    const status = this.normalizeStatus(invoice.status);
    if (status === 'paid') return invoice.total || 0;
    return parseFloat(invoice.paid) || 0;
  }

  normalizeStatus(status) {
    const value = String(status || '').toLowerCase();
    const aliases = {
      completed: 'paid',
      pending: 'issued'
    };
    return aliases[value] || value || 'draft';
  }

  formatStatusLabel(status) {
    const labels = {
      paid: 'Paid',
      issued: 'Issued',
      partial: 'Partial',
      overdue: 'Overdue',
      voided: 'Voided',
      draft: 'Draft',
      pending_approval: 'Pending Approval',
      rejected: 'Returned for Correction',
      sent: 'Sent',
      accepted: 'Accepted',
      declined: 'Declined',
      expired: 'Expired',
      converted: 'Converted to Invoice'
    };
    return labels[status] || status;
  }

  getDefaultDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  formatDateInput(dateValue) {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  setInputValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value || '';
  }

  formatCurrency(amount) {
    return window.AppFormatters?.formatCurrency
      ? window.AppFormatters.formatCurrency(amount)
      : Number(amount || 0).toFixed(2);
  }

  formatDocumentAmount(amount) {
    return this.formatCurrency(amount)
      .replace(/^\s*-?\s*K\s*/i, match => match.includes('-') ? '-' : '')
      .trim();
  }

  formatDate(dateValue) {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return window.AppFormatters?.formatDate(date) || date.toLocaleDateString();
  }

  async copyText(value) {
    try {
      await navigator.clipboard?.writeText?.(value);
    } catch (error) {
      console.warn('Clipboard copy failed:', error);
    }
  }

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value === null || value === undefined ? '' : String(value);
    return div.innerHTML;
  }

  showNotification(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      console.log(`[${type}] ${message}`);
    }
  }
}

window.QuotationsInvoicesView = QuotationsInvoicesView;
