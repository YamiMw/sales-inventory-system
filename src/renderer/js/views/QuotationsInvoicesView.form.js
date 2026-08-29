/**
 * Quotations and Invoices Form Methods
 * Extracted customer, product line, totals, and preview behavior.
 */

(function () {
  if (typeof window === 'undefined' || !window.QuotationsInvoicesView) return;
  const QuotationsInvoicesView = window.QuotationsInvoicesView;
  Object.assign(QuotationsInvoicesView.prototype, {
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
  },

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
  },

  getCustomerFormValues() {
    const customer = this.getSelectedCustomer();
    return customer ? {
      name: this.getCustomerName(customer),
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || ''
    } : { name: '', email: '', phone: '', address: '' };
  },

  hasCustomerForDocument() {
    return Boolean(document.getElementById('document-customer')?.value);
  },

  async resolveDocumentCustomerId() {
    const select = document.getElementById('document-customer');
    if (select?.value) return select.value;

    return null;
  },

  ensureNewCustomerModal() {
    if (this.customerModal) return this.customerModal;
    const modal = document.getElementById('document-customer-form-modal');
    if (!modal) {
      console.error('Missing #document-customer-form-modal in index.html');
      return null;
    }
    this.customerModal = modal;
    if (!modal.dataset.bound) {
      modal.dataset.bound = 'true';
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
    }
    return modal;
  },

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
  },

  closeNewCustomerModal() {
    if (this.customerModal) {
      this.customerModal.style.display = 'none';
    }
  },

  setNewCustomerType(type) {
    const modal = this.ensureNewCustomerModal();
    modal.querySelectorAll('[data-document-customer-type]').forEach(button => {
      const isActive = button.dataset.documentCustomerType === type;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  },

  updateNewCustomerSubmitState() {
    const modal = this.ensureNewCustomerModal();
    const saveButton = modal.querySelector('#document-save-customer-btn');
    const name = modal.querySelector('#document-new-customer-name')?.value.trim();
    if (saveButton) saveButton.disabled = !name;
  },

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
  },

  selectCustomer(customerId) {
    const select = document.getElementById('document-customer');
    if (select) select.value = customerId || '';
    this.syncCustomerSearch(customerId);
    this.updateProductSearchState();
    this.hideLookupResults();
    this.renderLines();
    this.refreshFormPreview();
  },

  getSelectedCustomer() {
    const selectedId = document.getElementById('document-customer')?.value;
    if (!selectedId) return null;
    return this.customers.find(item => String(item.id) === String(selectedId)) || null;
  },

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
      const empty = document.createElement('div');
      empty.className = 'documents-search-empty';
      empty.textContent = 'No matching customer profile found.';
      results.replaceChildren(empty);
      results.classList.add('show');
      return;
    }

    const fragment = document.createDocumentFragment();
    matches.forEach(customer => {
      const row = window.TemplateRenderer?.clone('document-lookup-row-template') || document.createElement('button');
      row.className = row.className || 'documents-lookup-row';
      row.type = 'button';
      row.dataset.customerId = customer.id;
      window.TemplateRenderer?.setText(row, '[data-title]', this.getCustomerName(customer));
      window.TemplateRenderer?.setText(row, '[data-meta]', this.getCustomerMeta(customer));
      const extra = row.querySelector('[data-extra]');
      if (extra && window.TemplateRenderer?.icon) extra.replaceChildren(window.TemplateRenderer.icon('assets/images/icons/custom/check_status_icon.png', 'custom-ui-icon'));
      fragment.appendChild(row);
    });
    results.replaceChildren(fragment);
    results.classList.add('show');
  },

  clearCustomerSelectionIfSearchChanged(searchText) {
    const select = document.getElementById('document-customer');
    if (!select?.value) return;

    const customer = this.customers.find(item => String(item.id) === String(select.value));
    if (!customer || this.getCustomerName(customer) === searchText) return;

    select.value = '';
    const preview = document.getElementById('document-customer-preview');
    if (preview) {
      preview.hidden = true;
      preview.replaceChildren();
    }
    this.syncCustomerButtonState(false);
    this.updateProductSearchState();
    this.renderLines();
    this.refreshFormPreview();
  },

  syncCustomerButtonState(hasCustomer = this.hasCustomerForDocument()) {
    const button = document.getElementById('document-add-customer-btn');
    if (!button) return;
    button.classList.toggle('has-customer', Boolean(hasCustomer));
  },

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
      const empty = document.createElement('div');
      empty.className = 'documents-search-empty';
      empty.textContent = 'No matching inventory item found.';
      results.replaceChildren(empty);
      results.classList.add('show');
      return;
    }

    const fragment = document.createDocumentFragment();
    matches.forEach(product => {
      const row = window.TemplateRenderer?.clone('document-lookup-row-template') || document.createElement('button');
      row.className = `${row.className || 'documents-lookup-row'} product`;
      row.type = 'button';
      row.dataset.productId = product.id;
      window.TemplateRenderer?.setText(row, '[data-title]', product.name || product.sku || 'Product');
      window.TemplateRenderer?.setText(row, '[data-meta]', this.getProductMeta(product));
      const extra = row.querySelector('[data-extra]');
      if (extra) {
        const price = document.createElement('b');
        price.textContent = this.formatCurrency(this.getProductPrice(product));
        extra.replaceChildren(price);
      }
      fragment.appendChild(row);
    });
    results.replaceChildren(fragment);
    results.classList.add('show');
  },

  hideLookupResults() {
    document.querySelectorAll('#document-create-modal .documents-search-results').forEach(panel => {
      panel.classList.remove('show');
    });
  },

  updateProductSearchState() {
    const productSearch = document.getElementById('document-product-search');
    if (!productSearch) return;

    const hasCustomer = this.hasCustomerForDocument();
    productSearch.disabled = !hasCustomer && !this.editingDocument;
    productSearch.placeholder = hasCustomer || this.editingDocument
      ? 'Search product inventory list to add...'
      : 'Add customer details before adding product items...';
  },

  addProductLine(productId) {
    if (!this.canEditDocumentLines()) {
      this.showNotification('Add customer details before adding product items', 'warning');
      return;
    }

    const product = this.products.find(item => String(item.id) === String(productId));
    if (!product) return;

    const existingIndex = this.findProductLineIndex(product.id);
    if (existingIndex !== -1) {
      this.incrementLineQuantity(existingIndex);
      this.clearProductSearch();
      this.hideLookupResults();
      this.renderLines();
      this.focusLineQuantity(existingIndex);
      return;
    }

    this.lines.push({
      productId: product.id,
      quantity: 1,
      unitPrice: this.getProductPrice(product),
      discountPercent: 0
    });

    this.clearProductSearch();
    this.hideLookupResults();
    this.renderLines();
  },

  clearProductSearch() {
    const productSearch = document.getElementById('document-product-search');
    if (productSearch) productSearch.value = '';
  },

  findProductLineIndex(productId, excludeIndex = -1) {
    const normalizedProductId = productId === null || productId === undefined ? '' : String(productId);
    if (!normalizedProductId) return -1;

    return this.lines.findIndex((line, index) => {
      const lineProductId = line.productId === null || line.productId === undefined ? '' : String(line.productId);
      return index !== excludeIndex && lineProductId === normalizedProductId;
    });
  },

  normalizeLineQuantity(value, fallback = 1) {
    const quantity = Number.parseFloat(value);
    if (!Number.isFinite(quantity) || quantity < 1) return fallback;
    return Math.max(1, Math.trunc(quantity));
  },

  incrementLineQuantity(index, amount = 1) {
    const line = this.lines[index];
    if (!line) return;

    line.quantity = this.normalizeLineQuantity(line.quantity) + this.normalizeLineQuantity(amount);
  },

  focusLineQuantity(index) {
    const focusQuantity = () => {
      const input = document.querySelector(`#document-lines [data-line-index="${index}"] [data-line-field="quantity"]`);
      input?.focus();
      input?.select?.();
    };

    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(focusQuantity);
    } else {
      setTimeout(focusQuantity, 0);
    }
  },

  renderLines() {
    const container = document.getElementById('document-lines');
    if (!container) return;

    const hasCustomer = this.hasCustomerForDocument();
    if (!hasCustomer && !this.editingDocument && !this.lines.some(line => line.productId)) {
      window.TemplateRenderer?.appendEmptyRow(container, 8, 'Add customer details above to enable product inputs.', '', 'documents-line-empty');
      this.renderLineTotals();
      return;
    }

    if (!this.lines.length) {
      window.TemplateRenderer?.appendEmptyRow(container, 8, 'Search the product inventory above to add invoice or quotation items.', '', 'documents-line-empty');
      this.renderLineTotals();
      return;
    }

    const fragment = document.createDocumentFragment();
    this.lines.forEach((line, index) => {
      fragment.appendChild(this.createDocumentLineRow(line, index));
    });
    container.replaceChildren(fragment);
    this.renderLineTotals();
    this.refreshFormPreview();
  },

  createDocumentLineRow(line, index) {
    const row = window.TemplateRenderer?.clone('document-line-row-template') || document.createElement('tr');
    row.className = 'document-line';
    row.dataset.lineIndex = String(index);
    const lineTotal = this.calculateLineTotal(line);
    const product = this.products.find(item => String(item.id) === String(line.productId));
    const description = product?.description || 'No description available';
    window.TemplateRenderer?.setText(row, '[data-index]', index + 1);
    const select = row.querySelector('[data-line-field="productId"]');
    if (select) {
      window.TemplateRenderer?.replaceSelectOptions(
        select,
        this.products.map(productOption => ({
          value: productOption.id,
          label: productOption.name || productOption.sku || 'Product',
          selected: String(line.productId) === String(productOption.id)
        })),
        'Select product'
      );
    }
    window.TemplateRenderer?.setText(row, '[data-meta]', product ? this.getProductMeta(product) : 'No product selected');
    window.TemplateRenderer?.setText(row, '[data-description]', description);
    const price = row.querySelector('[data-line-field="unitPrice"]');
    if (price) price.value = line.unitPrice;
    const qty = row.querySelector('[data-line-field="quantity"]');
    if (qty) qty.value = line.quantity;
    const discount = row.querySelector('[data-line-field="discountPercent"]');
    if (discount) discount.value = this.normalizeDiscountPercent(line.discountPercent || 0);
    window.TemplateRenderer?.setText(row, '[data-total]', this.formatCurrency(lineTotal));
    const remove = row.querySelector('[data-line-remove]');
    if (remove) remove.dataset.lineRemove = index;
    return row;
  },

  handleLineInput(event) {
    const lineElement = event.target.closest('[data-line-index]');
    if (!lineElement) return;

    const index = parseInt(lineElement.dataset.lineIndex, 10);
    const field = event.target.dataset.lineField;
    if (!field || !this.lines[index] || field === 'productId') return;

    let value = Number.parseFloat(event.target.value);
    if (!Number.isFinite(value)) value = 0;
    if (field === 'discountPercent') value = this.normalizeDiscountPercent(value);
    this.lines[index][field] = value;

    const lineTotal = lineElement.querySelector('.document-line-total');
    if (lineTotal) {
      lineTotal.textContent = this.formatCurrency(this.calculateLineTotal(this.lines[index]));
    }
    this.renderLineTotals();
  },

  handleLineChange(event) {
    const lineElement = event.target.closest('[data-line-index]');
    if (!lineElement) return;

    const index = parseInt(lineElement.dataset.lineIndex, 10);
    const field = event.target.dataset.lineField;
    if (!field || !this.lines[index]) return;

    if (field === 'productId') {
      const product = this.products.find(p => String(p.id) === String(event.target.value));
      const existingIndex = this.findProductLineIndex(event.target.value, index);
      if (product && existingIndex !== -1) {
        const quantityToAdd = this.normalizeLineQuantity(this.lines[index].quantity);
        this.incrementLineQuantity(existingIndex, quantityToAdd);
        this.lines.splice(index, 1);
        const mergedIndex = existingIndex > index ? existingIndex - 1 : existingIndex;
        this.renderLines();
        this.focusLineQuantity(mergedIndex);
        return;
      }

      this.lines[index].productId = event.target.value;
      if (product) {
        this.lines[index].unitPrice = this.getProductPrice(product);
      }
      this.renderLines();
      return;
    }

    let value = Number.parseFloat(event.target.value);
    if (!Number.isFinite(value)) value = 0;
    if (field === 'quantity') value = this.normalizeLineQuantity(value);
    if (field === 'unitPrice') value = Math.max(0, value);
    if (field === 'discountPercent') value = this.normalizeDiscountPercent(value);

    this.lines[index][field] = value;
    event.target.value = String(value);

    const lineTotal = lineElement.querySelector('.document-line-total');
    if (lineTotal) {
      lineTotal.textContent = this.formatCurrency(this.calculateLineTotal(this.lines[index]));
    }
    this.renderLineTotals();
  },

  addLine() {
    if (!this.canEditDocumentLines()) {
      this.showNotification('Add customer details before adding product items', 'warning');
      return;
    }

    this.lines.push({ productId: '', quantity: 1, unitPrice: 0, discountPercent: 0 });
    this.renderLines();
  },

  canEditDocumentLines() {
    return Boolean(this.hasCustomerForDocument() || this.editingDocument);
  },

  removeLine(index) {
    this.lines.splice(index, 1);
    this.renderLines();
  },

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
  },

  getConfiguredTaxSettings() {
    const rate = Math.max(parseFloat(this.getSettingValue(['default_tax_rate', 'tax.rate'], 'tax-rate', '17.5')) || 0, 0);
    const name = this.getSettingValue(['tax_name', 'tax.name'], 'tax-name', 'VAT') || 'VAT';
    return { rate, name };
  },

  getConfiguredDocumentDays(type = this.documentType) {
    const setting = type === 'quotation'
      ? this.getSettingValue(['doc_validity_days', 'quotation_validity_days', 'documents.validity_days'], 'doc-validity-days', '30')
      : this.getSettingValue(['doc_due_days', 'invoice_due_days', 'documents.due_days'], 'doc-due-days', '30');
    const days = Number.parseInt(setting, 10);
    return Number.isFinite(days) && days >= 0 ? days : 30;
  },

  syncDocumentTaxOptions(preferredRate = null, preferredName = '') {
    const select = document.getElementById('document-tax-rate');
    if (!select) return;

    const configured = this.getConfiguredTaxSettings();
    const selectedRate = preferredRate === null || preferredRate === undefined || preferredRate === ''
      ? configured.rate
      : Math.max(parseFloat(preferredRate) || 0, 0);
    const taxName = preferredName || configured.name;
    const options = [
      [String(configured.rate), configured.name + ' (' + this.formatPercent(configured.rate) + ') - Settings']
    ];
    if (selectedRate !== configured.rate && selectedRate > 0) {
      options.push([String(selectedRate), taxName + ' (' + this.formatPercent(selectedRate) + ')']);
    }
    options.push(['0', 'Tax Exempt (0%)']);
    select.innerHTML = options.map(([value, label]) => '<option value="' + this.escapeHtml(value) + '">' + this.escapeHtml(label) + '</option>').join('');
    select.value = String(selectedRate);
    if (!select.value) select.value = String(configured.rate);

    const fieldLabel = document.getElementById('document-tax-setting-label');
    const help = document.getElementById('document-tax-setting-help');
    if (fieldLabel) fieldLabel.textContent = configured.name + ' Setting';
    if (help) help.textContent = 'Default from Settings: ' + configured.name + ' ' + this.formatPercent(configured.rate) + '.';
  },

  formatPercent(value) {
    const number = Number(value) || 0;
    return number.toLocaleString('en-MW', { maximumFractionDigits: 2 }) + '%';
  },

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
  },

  normalizeDiscountPercent(value) {
    return Math.min(Math.max(parseFloat(value) || 0, 0), 100);
  },

  calculateLineTotal(line) {
    const quantity = parseFloat(line.quantity) || 0;
    const unitPrice = parseFloat(line.unitPrice) || 0;
    const discountPercent = this.normalizeDiscountPercent(line.discountPercent || 0);
    return quantity * unitPrice * (1 - discountPercent / 100);
  },

  calculateTotals() {
    const subtotal = this.lines.reduce((sum, line) => {
      return sum + this.calculateLineTotal(line);
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
  },

  getValidDocumentLines() {
    return this.lines
      .filter(line => line.productId && (parseFloat(line.quantity) || 0) > 0)
      .map(line => ({
        productId: parseInt(line.productId, 10),
        quantity: parseFloat(line.quantity) || 1,
        unitPrice: parseFloat(line.unitPrice) || 0,
        discountPercent: this.normalizeDiscountPercent(line.discountPercent || 0)
      }));
  },

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
          discountPercent: this.normalizeDiscountPercent(line.discountPercent || 0),
          totalPrice: this.calculateLineTotal(line)
        };
      }),
      payments: [],
      auditLogs: []
    };

    output.innerHTML = this.renderDocumentPrintSheet(previewDoc);
    if (window.lucide) window.lucide.createIcons();
  }
  });
  return QuotationsInvoicesView;
})();
