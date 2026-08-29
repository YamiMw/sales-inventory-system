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

  getIcon(name, size = 16) {
    const attrs = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
    const icons = {
      mail: `<svg ${attrs}><path d="M4 4h16v16H4z"/><path d="m22 6-10 7L2 6"/></svg>`,
      phone: `<svg ${attrs}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.35 1.9.66 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.31 1.85.53 2.81.66A2 2 0 0 1 22 16.92z"/></svg>`,
      userCheck: `<svg ${attrs}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="m17 11 2 2 4-4"/></svg>`,
      userX: `<svg ${attrs}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="m18 8 4 4"/><path d="m22 8-4 4"/></svg>`,
      eye: `<svg ${attrs}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
      edit: `<svg ${attrs}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
      moreVertical: `<svg ${attrs}><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>`,
      users: `<svg ${attrs}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
    };
    return icons[name] || '';
  }

  renderEmptyState() {
    return `
      <tr class="customer-empty-row">
        <td colspan="6">
          <div class="customer-empty-state">
            <span class="customer-empty-icon">${this.getIcon('users', 34)}</span>
            <strong>No customers found</strong>
            <span>Try another search or reset the filters.</span>
          </div>
        </td>
      </tr>
    `;
  }

  renderCustomerRow(cust) {
    const id = String(cust.id || '');
    const type = cust.type || 'Individual';
    const status = cust.status || 'Inactive';
    const isActive = status === 'Active';
    const hasBalanceDue = cust.balance > 0;

    return `
      <tr>
        <td><span class="customer-id-pill">${this.escapeHtml(id)}</span></td>
        <td>
          <div class="customer-name-cell">
            <div class="customer-name-info">
              <h4>${this.escapeHtml(cust.name)}</h4>
              <span class="customer-type-badge">${this.escapeHtml(type)}</span>
            </div>
          </div>
        </td>
        <td>
          <div class="contact-info-cell">
            ${cust.email ? `<div class="contact-row email">${this.getIcon('mail', 14)}<span>${this.escapeHtml(cust.email)}</span></div>` : ''}
            ${cust.phone ? `<div class="contact-row phone">${this.getIcon('phone', 14)}<span>${this.escapeHtml(cust.phone)}</span></div>` : ''}
            ${!cust.email && !cust.phone ? '<span class="customer-muted">No contact details</span>' : ''}
          </div>
        </td>
        <td>
          <div class="balance-display">
            <span class="balance-amount ${hasBalanceDue ? 'positive' : 'zero'}">${this.formatCurrency(cust.balance)}</span>
            ${hasBalanceDue ? '<span class="balance-due-badge">Due</span>' : ''}
          </div>
        </td>
        <td>
          <span class="status-badge customer-status-badge ${isActive ? 'active paid' : 'inactive'}">
            ${this.getIcon(isActive ? 'userCheck' : 'userX', 13)}
            <span>${this.escapeHtml(status)}</span>
          </span>
        </td>
        <td>
          <div class="customer-actions-menu">
            <button class="customer-action-trigger" data-customer-actions="${this.escapeHtml(id)}" title="Actions" aria-label="Actions" aria-haspopup="menu" aria-expanded="false">
              ${this.getIcon('moreVertical', 18)}
            </button>
            <div class="customer-actions-dropdown" role="menu">
              <button type="button" class="customer-menu-item" data-action="view" data-id="${this.escapeHtml(id)}" role="menuitem">
                ${this.getIcon('eye', 15)}
                <span>View Profile</span>
              </button>
              <button type="button" class="customer-menu-item" data-action="edit" data-id="${this.escapeHtml(id)}" role="menuitem">
                ${this.getIcon('edit', 15)}
                <span>Edit Customer</span>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  renderTable() {
    const tbody = document.getElementById('customers-tbody');
    if (!tbody) return;

    if (this.loadError) {
      tbody.innerHTML = `
        <tr class="customer-empty-row">
          <td colspan="6">
            <div class="customer-empty-state">
              <span class="customer-empty-icon">${this.getIcon('users', 34)}</span>
              <strong>Unable to load customers</strong>
              <span>${this.escapeHtml(this.loadError)}</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const pageStart = (this.currentPage - 1) * this.perPage;
    const pageEnd = pageStart + this.perPage;
    const visibleCustomers = this.filteredCustomers.slice(pageStart, pageEnd);

    if (visibleCustomers.length === 0) {
      tbody.innerHTML = this.renderEmptyState();
      return;
    }

    tbody.innerHTML = visibleCustomers.map(cust => this.renderCustomerRow(cust)).join('');
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
    avatarEl.textContent = this.getInitials(cust.name);
    avatarEl.className = `customer-avatar ${cust.type === 'Corporate' ? 'corporate' : 'individual'}`;
    avatarEl.style.width = '48px';
    avatarEl.style.height = '48px';
    avatarEl.style.fontSize = '18px';

    document.getElementById('profile-name').textContent = cust.name;
    document.getElementById('profile-id').textContent = `Customer Profile • ${cust.id}`;

    // Contact info
    document.getElementById('profile-contact-info').innerHTML = `
      <div class="profile-info-row">
        <span class="profile-info-label">Name</span>
        <span class="profile-info-value">${this.escapeHtml(cust.name)}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Email</span>
        <span class="profile-info-value"><img src="assets/images/icons/custom/mail_icon.svg" alt="" class="custom-ui-icon inline-icon-img" aria-hidden="true"> ${this.escapeHtml(cust.email || 'N/A')}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Phone</span>
        <span class="profile-info-value"><img src="assets/images/icons/custom/phone_icon.svg" alt="" class="custom-ui-icon inline-icon-img" aria-hidden="true"> ${this.escapeHtml(cust.phone || 'N/A')}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Address</span>
        <span class="profile-info-value">${this.escapeHtml(cust.address || 'N/A')}</span>
      </div>
      <div class="profile-info-row">
        <span class="profile-info-label">Customer Since</span>
        <span class="profile-info-value">${this.escapeHtml(cust.customerSince || 'N/A')}</span>
      </div>
    `;

    // Account summary
    const availableCredit = (cust.creditLimit || 0) - cust.balance;
    document.getElementById('profile-account-summary').innerHTML = `
      <div class="balance-card">
        <div class="balance-card-label">Current Balance</div>
        <div class="balance-card-header">
          <span class="balance-card-value ${cust.balance > 0 ? 'due' : 'clear'}">${this.formatCurrency(cust.balance)}</span>
          <div style="text-align:right;">
            <div class="balance-card-label">Credit Limit</div>
            <div style="font-weight:700;color:#1e293b;">${this.formatCurrency(cust.creditLimit || 0)}</div>
          </div>
        </div>
      </div>
      <div class="available-credit">
        <span class="available-credit-label">Available Credit</span>
        <span class="available-credit-value">${this.formatCurrency(availableCredit)}</span>
      </div>
      <div class="stats-row">
        <div>
          <div class="stat-mini-label">Total Purchases</div>
          <div class="stat-mini-value">${this.formatCurrency(cust.totalPurchases || 0)} <small style="color:#94a3b8;">(Lifetime)</small></div>
        </div>
        <div style="text-align:right;">
          <div class="stat-mini-label">Last Purchase</div>
          <div class="stat-mini-value">${cust.lastVisit || 'N/A'}</div>
        </div>
      </div>
    `;

    // Purchase history
    const history = cust.history || [];
    document.getElementById('profile-purchase-history').innerHTML = history.length > 0 
      ? history.map(h => `
        <tr>
          <td style="font-size:12px;color:#64748b;">${h.date}</td>
          <td style="font-size:12px;font-weight:600;color:#1e293b;">${h.docNum}</td>
          <td><span style="font-size:10px;font-weight:700;padding:4px 8px;border-radius:4px;background:${h.type === 'Invoice' ? '#dbeafe' : '#fef3c7'};color:${h.type === 'Invoice' ? '#1e40af' : '#92400e'};">${h.type}</span></td>
          <td style="font-weight:700;">${this.formatCurrency(h.amount)}</td>
          <td><span style="font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px;background:${h.status.includes('Paid') || h.status.includes('Converted') ? '#d1fae5' : '#fee2e2'};color:${h.status.includes('Paid') || h.status.includes('Converted') ? '#065f46' : '#991b1b'};">${h.status}</span></td>
        </tr>
      `).join('')
      : '<tr><td colspan="5" style="text-align:center;padding:40px;color:#94a3b8;">No purchase history</td></tr>';

    document.getElementById('customer-profile-modal').style.display = 'flex';
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
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (file) this.importCustomersFromFile(file);
    };
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

  updatePagination() {
    const totalPages = Math.ceil(this.filteredCustomers.length / this.perPage);
    const container = document.getElementById('customers-pagination');
    if (!container) return;

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    const pages = new Set([1, totalPages, this.currentPage]);
    if (this.currentPage > 1) pages.add(this.currentPage - 1);
    if (this.currentPage < totalPages) pages.add(this.currentPage + 1);

    let previousPage = 0;
    let html = `
      <button class="pagination-btn pagination-arrow" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''} aria-label="Previous page">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
    `;

    [...pages].filter(page => page >= 1 && page <= totalPages).sort((a, b) => a - b).forEach(page => {
      if (previousPage && page - previousPage > 1) {
        html += '<span class="pagination-ellipsis">...</span>';
      }
      html += `<button class="pagination-btn ${page === this.currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`;
      previousPage = page;
    });

    html += `
      <button class="pagination-btn pagination-arrow" data-page="${this.currentPage + 1}" ${this.currentPage === totalPages ? 'disabled' : ''} aria-label="Next page">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    `;

    container.innerHTML = html;
    container.querySelectorAll('[data-page]:not(:disabled)').forEach(btn => {
      btn.onclick = () => {
        this.currentPage = parseInt(btn.dataset.page);
        this.renderTable();
        this.updatePagination();
      };
    });
  }

  updateCounts() {
    document.getElementById('customers-count').textContent = `Showing ${this.filteredCustomers.length} customers`;
    document.getElementById('customers-showing').textContent = `Showing ${this.filteredCustomers.length} of ${this.customers.length} customers`;
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

    document.getElementById('add-customer-btn')?.addEventListener('click', () => this.openAddModal());
    document.getElementById('add-customer-top-btn')?.addEventListener('click', () => this.openAddModal());
    document.getElementById('save-customer-btn')?.addEventListener('click', () => this.saveCustomer());
    document.getElementById('clear-customers-btn')?.addEventListener('click', () => this.clearAll());
    document.getElementById('import-customers-btn')?.addEventListener('click', () => this.openImportPicker());
    document.getElementById('import-customers-top-btn')?.addEventListener('click', () => this.openImportPicker());
    document.getElementById('export-customers-csv')?.addEventListener('click', () => this.exportCSV());

    // Modal close on overlay click
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

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatCurrency(amount) {
    return window.AppFormatters.formatCurrency(amount);
  }

  showNotification(message, type = 'info') {
    if (window.showNotification) window.showNotification(message, type);
    else console.log(`[${type}] ${message}`);
  }
}

window.CustomersView = CustomersView;
