/**
 * Customers View Module
 * Manages customer profiles, balances, and purchase history
 */

class CustomersView {
  constructor() {
    this.customers = [];
    this.filteredCustomers = [];
    this.currentPage = 1;
    this.perPage = 25;
    this.searchQuery = '';
    this.typeFilter = '';
    this.statusFilter = '';
    this.loadError = '';
    
    this.init();
  }

  async init() {
    await this.loadCustomers();
    this.filterCustomers();
    this.setupEventListeners();
  }

  async loadCustomers() {
    this.loadError = '';

    try {
      if (!window.electronAPI || typeof window.electronAPI.getCustomers !== 'function') {
        throw new Error('Customer service is unavailable');
      }

      const result = await window.electronAPI.getCustomers();
      if (!result?.success || !Array.isArray(result.data)) {
        throw new Error(result?.error || 'Customer data could not be loaded');
      }

      this.customers = result.data.map(customer => this.normalizeCustomer(customer));
      return true;
    } catch (error) {
      console.error('Failed to load customers:', error);
      this.customers = [];
      this.loadError = error.message || 'Customer data could not be loaded';
      return false;
    }
  }

  normalizeCustomer(customer) {
    return {
      id: customer.id || customer.customer_code,
      name: customer.name || 'Unknown',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      balance: parseFloat(customer.current_balance || customer.balance || 0),
      type: this.normalizeCustomerType(customer.customer_type || customer.type),
      status: this.normalizeCustomerStatus(customer.status),
      lastVisit: customer.lastVisit || customer.last_purchase || 'N/A',
      customerSince: customer.created_at || customer.customerSince || 'N/A',
      creditLimit: parseFloat(customer.credit_limit || customer.creditLimit || 0),
      totalPurchases: parseFloat(customer.totalPurchases || 0),
      history: customer.history || []
    };
  }

  normalizeCustomerType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return ['corporate', 'business', 'company'].includes(normalized) ? 'Corporate' : 'Individual';
  }

  normalizeCustomerStatus(value) {
    if (value === false) return 'Inactive';
    const normalized = String(value || '').trim().toLowerCase();
    return ['inactive', 'disabled', 'archived', 'deleted'].includes(normalized) ? 'Inactive' : 'Active';
  }

  filterCustomers() {
    this.filteredCustomers = this.customers.filter(cust => {
      const matchesSearch = !this.searchQuery ||
        cust.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (cust.email || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (cust.phone || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        String(cust.id || '').toLowerCase().includes(this.searchQuery.toLowerCase());
      
      const matchesType = !this.typeFilter || cust.type === this.typeFilter;
      const matchesStatus = !this.statusFilter || cust.status === this.statusFilter;
      
      return matchesSearch && matchesType && matchesStatus;
    });

    this.currentPage = 1;
    this.renderTable();
    this.updatePagination();
    this.updateCounts();
  }

  getInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  getTemplate(id) {
    const template = document.getElementById(id);
    if (!template || !template.content) {
      console.warn(`Missing template: ${id}`);
      return null;
    }
    return template.content.firstElementChild.cloneNode(true);
  }

  renderEmptyState(title = 'No customers found', message = 'Try another search or reset the filters.') {
    const row = this.getTemplate('customer-empty-row-template');
    if (!row) return null;

    const titleElement = row.querySelector('[data-empty-title]');
    const messageElement = row.querySelector('[data-empty-message]');
    if (titleElement) titleElement.textContent = title;
    if (messageElement) messageElement.textContent = message;
    return row;
  }

  renderCustomerRow(cust) {
    const row = this.getTemplate('customer-row-template');
    if (!row) return null;

    const id = String(cust.id || '');
    const status = cust.status || 'Inactive';
    const isActive = status === 'Active';
    const hasBalanceDue = Number(cust.balance || 0) > 0;

    row.dataset.customerId = id;
    row.querySelector('[data-customer-id]').textContent = id;
    row.querySelector('[data-customer-name]').textContent = cust.name || 'Unknown';

    const emailRow = row.querySelector('[data-customer-email-row]');
    const addressRow = row.querySelector('[data-customer-address-row]');
    const mutedEmail = row.querySelector('[data-customer-email-empty]');
    const mutedAddress = row.querySelector('[data-customer-address-empty]');

    if (cust.email) {
      emailRow.hidden = false;
      row.querySelector('[data-customer-email]').textContent = cust.email;
      emailRow.title = cust.email;
    } else {
      emailRow.hidden = true;
    }

    if (cust.address) {
      addressRow.hidden = false;
      row.querySelector('[data-customer-address]').textContent = cust.address;
      addressRow.title = cust.address;
    } else {
      addressRow.hidden = true;
    }

    if (mutedEmail) mutedEmail.hidden = Boolean(cust.email);
    if (mutedAddress) mutedAddress.hidden = Boolean(cust.address);

    const balanceElement = row.querySelector('[data-customer-balance]');
    balanceElement.textContent = this.formatCurrency(cust.balance || 0);
    balanceElement.classList.toggle('positive', hasBalanceDue);
    balanceElement.classList.toggle('zero', !hasBalanceDue);

    const balanceDue = row.querySelector('[data-balance-due]');
    if (balanceDue) balanceDue.hidden = !hasBalanceDue;

    const statusBadge = row.querySelector('[data-customer-status-badge]');
    const statusText = row.querySelector('[data-customer-status]');
    if (statusBadge) {
      statusBadge.className = `status-badge customer-status-badge ${isActive ? 'active paid' : 'inactive'}`;
    }
    if (statusText) statusText.textContent = status;

    row.querySelector('[data-customer-actions]').dataset.customerActions = id;
    row.querySelectorAll('[data-action]').forEach(button => {
      button.dataset.id = id;
    });

    return row;
  }

  renderTable() {
    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;

    tbody.replaceChildren();

    if (this.loadError) {
      const errorRow = this.renderEmptyState('Unable to load customers', this.loadError);
      if (errorRow) tbody.appendChild(errorRow);
      return;
    }

    const pageStart = (this.currentPage - 1) * this.perPage;
    const pageEnd = pageStart + this.perPage;
    const visibleCustomers = this.filteredCustomers.slice(pageStart, pageEnd);

    if (visibleCustomers.length === 0) {
      const emptyRow = this.renderEmptyState();
      if (emptyRow) tbody.appendChild(emptyRow);
      return;
    }

    const fragment = document.createDocumentFragment();
    visibleCustomers.forEach(cust => {
      const row = this.renderCustomerRow(cust);
      if (row) fragment.appendChild(row);
    });
    tbody.appendChild(fragment);
    this.attachTableEvents();
  }

  attachTableEvents() {
    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;

    tbody.onclick = (event) => {
      const trigger = event.target.closest('[data-customer-actions]');
      if (trigger) {
        event.stopPropagation();
        const menu = trigger.closest('.customer-actions-menu');
        const isOpen = menu.classList.contains('open');

        this.closeCustomerActionMenus();

        if (!isOpen) {
          menu.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
        }
        return;
      }

      const menuItem = event.target.closest('.customer-menu-item');
      if (!menuItem) return;

      event.stopPropagation();
      this.closeCustomerActionMenus();

      if (menuItem.dataset.action === 'view') {
        this.viewProfile(menuItem.dataset.id);
      } else if (menuItem.dataset.action === 'edit') {
        this.editCustomer(menuItem.dataset.id);
      }
    };
  }

  closeCustomerActionMenus() {
    document.querySelectorAll('.customer-actions-menu.open').forEach(menu => {
      menu.classList.remove('open');
      menu.querySelector('[data-customer-actions]')?.setAttribute('aria-expanded', 'false');
    });
  }

  getCustomerById(id) {
    return this.customers.find(c => String(c.id) === String(id));
  }

  viewProfile(id) {
    const cust = this.getCustomerById(id);
    if (!cust) return;

    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) {
      avatarEl.textContent = this.getInitials(cust.name);
      avatarEl.className = `customer-avatar profile-avatar ${cust.type === 'Corporate' ? 'corporate' : 'individual'}`;
    }

    this.setText('profile-name', cust.name);
    this.setText('profile-id', `Customer Profile • ${cust.id}`);
    this.setText('profile-contact-name', cust.name || 'N/A');
    this.setText('profile-contact-email', cust.email || 'N/A');
    this.setText('profile-contact-phone', cust.phone || 'N/A');
    this.setText('profile-contact-address', cust.address || 'N/A');
    this.setText('profile-contact-since', cust.customerSince || 'N/A');

    const balance = Number(cust.balance || 0);
    const creditLimit = Number(cust.creditLimit || 0);
    const availableCredit = creditLimit - balance;

    const balanceEl = document.getElementById('profile-current-balance');
    if (balanceEl) {
      balanceEl.textContent = this.formatCurrency(balance);
      balanceEl.className = `balance-card-value ${balance > 0 ? 'due' : 'clear'}`;
    }

    this.setText('profile-credit-limit', this.formatCurrency(creditLimit));
    this.setText('profile-available-credit', this.formatCurrency(availableCredit));
    this.setText('profile-total-purchases', this.formatCurrency(cust.totalPurchases || 0));
    this.setText('profile-last-purchase', cust.lastVisit || 'N/A');

    this.renderPurchaseHistory(cust.history || []);

    const profileModal = document.getElementById('customer-profile-modal');
    if (profileModal) profileModal.style.display = 'flex';
  }

  renderPurchaseHistory(history = []) {
    const historyBody = document.getElementById('profile-purchase-history');
    if (!historyBody) return;

    historyBody.replaceChildren();

    if (!history.length) {
      const emptyRow = this.getTemplate('customer-history-empty-template');
      if (emptyRow) historyBody.appendChild(emptyRow);
      return;
    }

    const fragment = document.createDocumentFragment();
    history.forEach(historyItem => {
      const row = this.renderPurchaseHistoryRow(historyItem);
      if (row) fragment.appendChild(row);
    });
    historyBody.appendChild(fragment);
  }

  renderPurchaseHistoryRow(historyItem) {
    const row = this.getTemplate('customer-history-row-template');
    if (!row) return null;

    const type = String(historyItem.type || 'Document');
    const status = String(historyItem.status || 'N/A');
    const isInvoice = type === 'Invoice';
    const isComplete = status.includes('Paid') || status.includes('Converted');

    row.querySelector('[data-history-date]').textContent = historyItem.date || '';
    row.querySelector('[data-history-document]').textContent = historyItem.docNum || '';
    const typeElement = row.querySelector('[data-history-type]');
    typeElement.textContent = type;
    typeElement.className = `customer-history-type ${isInvoice ? 'invoice' : 'quotation'}`;
    row.querySelector('[data-history-amount]').textContent = this.formatCurrency(historyItem.amount || 0);
    const statusElement = row.querySelector('[data-history-status]');
    statusElement.textContent = status;
    statusElement.className = `customer-history-status ${isComplete ? 'complete' : 'pending'}`;

    return row;
  }

  setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  editCustomer(id) {
    const cust = this.getCustomerById(id);
    if (!cust) return;

    document.getElementById('customer-form-title').textContent = 'Edit Customer';
    document.getElementById('customer-edit-id').value = cust.id;
    document.getElementById('customer-name').value = cust.name;
    document.getElementById('customer-email').value = cust.email || '';
    document.getElementById('customer-phone').value = cust.phone || '';
    document.getElementById('customer-address').value = cust.address || '';
    document.getElementById('customer-type').value = this.normalizeCustomerType(cust.type);
    document.getElementById('customer-credit-limit').value = cust.creditLimit || 0;
    document.getElementById('customer-status').value = this.normalizeCustomerStatus(cust.status);

    document.getElementById('customer-form-modal').style.display = 'flex';
  }

  openAddModal() {
    document.getElementById('customer-form-title').textContent = 'Add Customer';
    document.getElementById('customer-edit-id').value = '';
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-email').value = '';
    document.getElementById('customer-phone').value = '';
    document.getElementById('customer-address').value = '';
    document.getElementById('customer-type').value = 'Individual';
    document.getElementById('customer-credit-limit').value = '0';
    document.getElementById('customer-status').value = 'Active';

    document.getElementById('customer-form-modal').style.display = 'flex';
  }

  async saveCustomer() {
    const id = document.getElementById('customer-edit-id').value;
    const customerData = {
      name: document.getElementById('customer-name').value.trim(),
      email: document.getElementById('customer-email').value.trim(),
      phone: document.getElementById('customer-phone').value.trim(),
      address: document.getElementById('customer-address').value.trim(),
      type: this.normalizeCustomerType(document.getElementById('customer-type').value),
      creditLimit: parseFloat(document.getElementById('customer-credit-limit').value) || 0,
      status: this.normalizeCustomerStatus(document.getElementById('customer-status').value)
    };

    if (!customerData.name) {
      this.showNotification('Customer name is required', 'error');
      return;
    }

    try {
      if (id) {
        const existingCustomer = this.getCustomerById(id);
        if (!existingCustomer) {
          this.showNotification('Customer not found', 'error');
          return;
        }

        const updatedCustomer = {
          ...existingCustomer,
          ...customerData,
          id: existingCustomer.id
        };

        if (!window.electronAPI || typeof window.electronAPI.updateCustomer !== 'function') {
          throw new Error('Customer update service is unavailable');
        }

        const result = await window.electronAPI.updateCustomer(id, this.getCustomerPersistencePayload(updatedCustomer));
        if (!result?.success) {
          throw new Error(result?.error || 'Customer update failed');
        }

        await this.loadCustomers();
        this.filterCustomers();
        const savedCustomer = this.getCustomerById(id);
        if (savedCustomer) this.syncCustomerReferences(savedCustomer);
        document.getElementById('customer-form-modal').style.display = 'none';
        this.showNotification('Customer updated successfully', 'success');
        return;
      } else {
        if (!window.electronAPI || typeof window.electronAPI.createCustomer !== 'function') {
          throw new Error('Customer creation service is unavailable');
        }

        const result = await window.electronAPI.createCustomer(this.getCustomerPersistencePayload(customerData));
        if (!result?.success) {
          throw new Error(result?.error || 'Customer creation failed');
        }

        await this.loadCustomers();
        this.filterCustomers();
        this.showNotification('Customer added successfully', 'success');
      }

      document.getElementById('customer-form-modal').style.display = 'none';
    } catch (error) {
      console.error('Failed to save customer:', error);
      this.showNotification(error.message || 'Failed to save customer', 'error');
    }
  }

  clearAll() {
    if (this.customers.length === 0) {
      this.showNotification('No customers to clear', 'info');
      return;
    }

    this.showNotification('Bulk customer deletion is unavailable. No customer records were changed.', 'error');
  }

  exportCSV() {
    if (this.loadError) {
      this.showNotification('Customers cannot be exported while their data is unavailable', 'error');
      return;
    }

    let csv = 'ID,Name,Email,Phone,Type,Status,Balance,Credit Limit\n';
    this.filteredCustomers.forEach(c => {
      csv += `"${c.id}","${c.name}","${c.email}","${c.phone}","${c.type}","${c.status}",${c.balance},${c.creditLimit}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showNotification('Customers exported', 'success');
  }

  getCustomerPersistencePayload(customer) {
    return {
      ...customer,
      customerType: customer.type,
      creditLimit: customer.creditLimit,
      status: this.normalizeCustomerStatus(customer.status)
    };
  }

  syncCustomerReferences(updatedCustomer) {
    [window.posView, window.quotationsInvoicesView].forEach(view => {
      if (!view || !Array.isArray(view.customers)) return;

      const index = view.customers.findIndex(customer => String(customer.id || customer.customer_code) === String(updatedCustomer.id));
      if (index >= 0) {
        view.customers.splice(index, 1, { ...view.customers[index], ...updatedCustomer });
      }

      if (view.selectedCustomer && String(view.selectedCustomer.id || view.selectedCustomer.customer_code) === String(updatedCustomer.id)) {
        view.selectedCustomer = { ...view.selectedCustomer, ...updatedCustomer };
        view.renderCustomerSelection?.();
      }
    });
  }

  openImportPicker() {
    const input = document.getElementById('customer-import-file-input');
    if (!input) {
      this.showNotification('Customer import file input is missing from index.html', 'error');
      return;
    }

    input.value = '';
    input.click();
  }

  importCustomersFromFile(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imported = this.parseCustomerCSV(String(reader.result || ''));
        if (imported.length === 0) {
          this.showNotification('No valid customers found in CSV', 'warning');
          return;
        }

        const existingIds = new Set(this.customers.map(customer =>
          String(customer.id || customer.email || customer.phone || customer.name).toLowerCase()
        ));
        const uniqueImported = imported.filter(customer => {
          const key = String(customer.id || customer.email || customer.phone || customer.name).toLowerCase();
          if (existingIds.has(key)) return false;
          existingIds.add(key);
          return true;
        });

        if (uniqueImported.length === 0) {
          this.showNotification('All imported customers already exist', 'info');
          return;
        }

        if (!window.electronAPI || typeof window.electronAPI.createCustomer !== 'function') {
          throw new Error('Customer import service is unavailable');
        }

        let importedCount = 0;
        for (const customer of uniqueImported) {
          const result = await window.electronAPI.createCustomer(this.getCustomerPersistencePayload(customer));
          if (!result?.success) {
            throw new Error(result?.error || `Import stopped after ${importedCount} customers`);
          }
          importedCount += 1;
        }

        await this.loadCustomers();
        this.filterCustomers();
        this.showNotification(`Imported ${importedCount} customer${importedCount === 1 ? '' : 's'}`, 'success');
      } catch (error) {
        console.error('Failed to import customers:', error);
        await this.loadCustomers();
        this.filterCustomers();
        this.showNotification(error.message || 'Failed to import CSV', 'error');
      }
    };
    reader.onerror = () => this.showNotification('Could not read CSV file', 'error');
    reader.readAsText(file);
  }

  parseCustomerCSV(csvText) {
    const rows = this.parseCSVRows(csvText);
    if (rows.length < 2) return [];

    const headers = rows[0].map(header => this.normalizeImportKey(header));
    return rows.slice(1).map(row => {
      const data = {};
      headers.forEach((header, columnIndex) => {
        data[header] = (row[columnIndex] || '').trim();
      });
      return this.mapImportedCustomer(data);
    }).filter(customer => customer.name);
  }

  parseCSVRows(csvText) {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(value);
        value = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        row.push(value);
        if (row.some(cell => cell.trim())) rows.push(row);
        row = [];
        value = '';
      } else {
        value += char;
      }
    }

    row.push(value);
    if (row.some(cell => cell.trim())) rows.push(row);
    return rows;
  }

  normalizeImportKey(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  mapImportedCustomer(data) {
    const id = data.id || data.customerid || data.customercode || data.code || '';
    const type = data.type || data.customertype || 'Individual';
    const status = data.status || data.accountstatus || 'Active';
    const creditLimit = parseFloat(data.creditlimit || data.credit || 0) || 0;

    return this.normalizeCustomer({
      id,
      name: data.name || data.customername || data.fullname || data.company || '',
      email: data.email || data.emailaddress || '',
      phone: data.phone || data.phonenumber || data.mobile || '',
      address: data.address || '',
      balance: parseFloat(data.balance || data.accountbalance || data.currentbalance || 0) || 0,
      type: type === 'Corporate' ? 'Corporate' : 'Individual',
      status: status === 'Inactive' ? 'Inactive' : 'Active',
      creditLimit,
      customerSince: data.customersince || 'N/A',
      totalPurchases: parseFloat(data.totalpurchases || 0) || 0,
      history: []
    });
  }

  createPaginationButton(page, label, options = {}) {
    const templateId = options.arrow ? 'customer-pagination-arrow-template' : 'customer-pagination-page-template';
    const button = this.getTemplate(templateId);
    if (!button) return null;

    button.dataset.page = String(page);
    button.disabled = Boolean(options.disabled);
    button.classList.toggle('active', Boolean(options.active));
    if (options.label) button.setAttribute('aria-label', options.label);

    const labelElement = button.querySelector('[data-pagination-label]');
    if (labelElement) labelElement.textContent = String(label);

    const icon = button.querySelector('[data-pagination-icon]');
    if (icon && options.direction) {
      icon.textContent = options.direction === 'previous' ? '‹' : '›';
    }

    return button;
  }

  updatePagination() {
    const totalPages = Math.ceil(this.filteredCustomers.length / this.perPage);
    const container = document.getElementById('customers-pagination');
    if (!container) return;

    container.replaceChildren();

    if (totalPages <= 1) return;

    const pages = new Set([1, totalPages, this.currentPage]);
    if (this.currentPage > 1) pages.add(this.currentPage - 1);
    if (this.currentPage < totalPages) pages.add(this.currentPage + 1);

    const previousButton = this.createPaginationButton(this.currentPage - 1, '', {
      arrow: true,
      direction: 'previous',
      disabled: this.currentPage === 1,
      label: 'Previous page'
    });
    if (previousButton) container.appendChild(previousButton);

    let previousPage = 0;
    [...pages].filter(page => page >= 1 && page <= totalPages).sort((a, b) => a - b).forEach(page => {
      if (previousPage && page - previousPage > 1) {
        const ellipsis = this.getTemplate('customer-pagination-ellipsis-template');
        if (ellipsis) container.appendChild(ellipsis);
      }

      const pageButton = this.createPaginationButton(page, page, {
        active: page === this.currentPage,
        label: `Page ${page}`
      });
      if (pageButton) container.appendChild(pageButton);
      previousPage = page;
    });

    const nextButton = this.createPaginationButton(this.currentPage + 1, '', {
      arrow: true,
      direction: 'next',
      disabled: this.currentPage === totalPages,
      label: 'Next page'
    });
    if (nextButton) container.appendChild(nextButton);

    container.querySelectorAll('[data-page]:not(:disabled)').forEach(btn => {
      btn.onclick = () => {
        this.currentPage = parseInt(btn.dataset.page, 10);
        this.renderTable();
        this.updatePagination();
        this.updateCounts();
      };
    });
  }

  updateCounts() {
    const total = this.filteredCustomers.length;
    const start = total ? ((this.currentPage - 1) * this.perPage) + 1 : 0;
    const end = total ? Math.min(start + this.perPage - 1, total) : 0;

    const countElement = document.getElementById('customers-count');
    if (countElement) {
      countElement.textContent = `Showing ${start}-${end} of ${total} customers`;
    }

    const showingElement = document.getElementById('customers-showing');
    if (showingElement) {
      showingElement.textContent = `Showing ${start}-${end} of ${total} customers`;
    }

    const perPageSelect = document.getElementById('customer-per-page');
    if (perPageSelect) {
      perPageSelect.value = String(this.perPage);
    }
  }

  setupEventListeners() {
    document.getElementById('customer-search')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.filterCustomers();
    });

    document.getElementById('customer-type-filter')?.addEventListener('change', (e) => {
      this.typeFilter = e.target.value;
      this.filterCustomers();
    });

    document.getElementById('customer-status-filter')?.addEventListener('change', (e) => {
      this.statusFilter = e.target.value;
      this.filterCustomers();
    });

    document.getElementById('reset-customer-filters')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.typeFilter = '';
      this.statusFilter = '';
      document.getElementById('customer-search').value = '';
      document.getElementById('customer-type-filter').value = '';
      document.getElementById('customer-status-filter').value = '';
      this.filterCustomers();
    });

    document.getElementById('customer-per-page')?.addEventListener('change', (event) => {
      const nextPerPage = parseInt(event.target.value, 10);
      this.perPage = Number.isFinite(nextPerPage) && nextPerPage > 0 ? nextPerPage : 25;
      this.currentPage = 1;
      this.renderTable();
      this.updatePagination();
      this.updateCounts();
    });

    document.getElementById('add-customer-btn')?.addEventListener('click', () => this.openAddModal());
    document.getElementById('add-customer-top-btn')?.addEventListener('click', () => this.openAddModal());
    document.getElementById('save-customer-btn')?.addEventListener('click', () => this.saveCustomer());
    document.getElementById('clear-customers-btn')?.addEventListener('click', () => this.clearAll());
    document.getElementById('import-customers-btn')?.addEventListener('click', () => this.openImportPicker());
    document.getElementById('import-customers-top-btn')?.addEventListener('click', () => this.openImportPicker());
    document.getElementById('export-customers-csv')?.addEventListener('click', () => this.exportCSV());
    document.getElementById('customer-import-file-input')?.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) this.importCustomersFromFile(file);
    });

    // Modal close buttons and overlay click are controlled by the static modal HTML in index.html.
    document.querySelectorAll('[data-customer-modal-close]').forEach(button => {
      button.addEventListener('click', () => {
        const modal = button.closest('.modal-overlay');
        if (modal) modal.style.display = 'none';
      });
    });

    document.getElementById('customer-profile-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
    });
    document.getElementById('customer-form-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
    });

    document.addEventListener('click', () => {
      this.closeCustomerActionMenus();
    });
  }


  formatCurrency(amount) {
    return window.AppFormatters.formatCurrency(amount);
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

window.CustomersView = CustomersView;
