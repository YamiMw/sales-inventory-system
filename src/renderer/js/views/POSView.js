/**
 * POS View Module
 * Electron renderer view for the Point of Sale screen.
 */

class POSView {
  constructor() {
    this.products = [];
    this.customers = [];
    this.categories = [];
    this.cart = [];
    this.selectedCustomer = null;
    this.paymentMethod = 'cash';
    this.isTaxExempt = false;
    this.discountRate = 0;
    this.sessionTime = 0;
    this.sessionTimerId = null;
    this.defaultTaxRate = 0.10;
    this.taxInclusive = false;
    this.searchQuery = '';
    this.category = '';
    this.customerModal = null;
    this.paymentModal = null;
    this.paymentAmountReceived = 0;
    this.paymentProcessing = false;
    this.loadErrors = {
      products: '',
      categories: '',
      customers: ''
    };
    this.elements = this.cacheElements();
    this.init();
  }

  cacheElements() {
    const view = document.getElementById('pos-view');
    const customerSelectionArea = document.getElementById('customer-selection-area');
    const searchWrapper = customerSelectionArea ? customerSelectionArea.querySelector('.customer-search-wrapper') : null;

    return {
      view,
      backBtn: document.getElementById('pos-back-btn'),
      sessionTimer: document.getElementById('session-timer'),
      sessionLiveBtn: document.getElementById('session-live'),
      sessionHoldBtn: document.getElementById('session-hold'),
      customerSelectionArea,
      customerSearch: document.getElementById('pos-customer-search'),
      customerSearchResults: document.getElementById('pos-customer-search-results'),
      customerSearchWrapper: searchWrapper,
      newCustomerBtn: document.getElementById('new-customer-btn'),
      cartCount: document.getElementById('cart-count'),
      cartItemsList: document.getElementById('cart-items-list'),
      emptyCartMessage: document.getElementById('empty-cart-message'),
      cartSubtotal: document.getElementById('cart-subtotal'),
      cartDiscount: document.getElementById('cart-discount'),
      cartTax: document.getElementById('cart-tax'),
      cartTotal: document.getElementById('cart-total'),
      taxStatus: document.getElementById('tax-status'),
      taxLabel: document.getElementById('cart-tax-label'),
      taxExemptCheckbox: document.getElementById('tax-exempt'),
      discountSelect: document.getElementById('pos-discount-rate'),
      paymentMethodButtons: document.querySelectorAll('.payment-method'),
      clearCartBtn: document.getElementById('clear-cart-btn'),
      checkoutBtn: document.getElementById('checkout-btn'),
      productSearch: document.getElementById('pos-product-search'),
      barcodeInput: document.getElementById('barcode-input'),
      categoryFilter: document.getElementById('pos-category-filter'),
      productsContainer: view ? view.querySelector('.products-container') : null,
      productsGridContainer: view ? view.querySelector('.products-grid-container') : null,
      productsGrid: document.getElementById('pos-products-grid'),
      noProductsMessage: document.getElementById('no-products-message'),
      quickKeysGrid: document.getElementById('quick-keys-grid'),
      numpadButtons: document.querySelectorAll('.numpad-btn'),
    };
  }

  async init() {
    if (!this.elements.view) {
      console.warn('POS view container not found.');
      return;
    }

    this.appendSelectedCustomerContainer();
    this.ensureNewCustomerModal();
    this.ensurePaymentModal();
    this.setupSessionTimer();
    await this.loadData();
    this.renderCategoryOptions();
    this.renderQuickKeys();
    this.renderProducts();
    this.renderCart();
    this.syncPaymentMethod();
    this.attachEventListeners();
    window.setTimeout(() => (this.elements.productSearch || this.elements.barcodeInput)?.focus(), 0);
  }

  appendSelectedCustomerContainer() {
    if (!this.elements.customerSelectionArea) return;
    this.selectedCustomerContainer = document.createElement('div');
    this.selectedCustomerContainer.className = 'selected-customer-card';
    this.selectedCustomerContainer.style.display = 'none';
    this.elements.customerSelectionArea.appendChild(this.selectedCustomerContainer);
  }

  setupSessionTimer() {
    this.updateSessionTimer();
    this.sessionTimerId = window.setInterval(() => {
      if (this.elements.sessionTimer && this.elements.sessionLiveBtn?.classList.contains('active')) {
        this.sessionTime += 1;
        this.updateSessionTimer();
      }
    }, 1000);
  }

  updateSessionTimer() {
    if (this.elements.sessionTimer) {
      const hours = String(Math.floor(this.sessionTime / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((this.sessionTime % 3600) / 60)).padStart(2, '0');
      const seconds = String(this.sessionTime % 60).padStart(2, '0');
      this.elements.sessionTimer.textContent = `${hours}:${minutes}:${seconds}`;
    }
  }

  async loadData() {
    await Promise.all([
      this.loadProducts(),
      this.loadCategories(),
      this.loadCustomers(),
      this.loadSettings(),
    ]);

    const failedSources = Object.entries(this.loadErrors)
      .filter(([, message]) => Boolean(message))
      .map(([source]) => source);
    if (failedSources.length) {
      this.showNotification(`POS data unavailable: ${failedSources.join(', ')}`, 'error');
    }
  }

  async loadProducts() {
    this.loadErrors.products = '';

    try {
      if (!window.electronAPI || typeof window.electronAPI.getProducts !== 'function') {
        throw new Error('Product service is unavailable');
      }

      const result = await window.electronAPI.getProducts();
      if (!result?.success || !Array.isArray(result.data)) {
        throw new Error(result?.error || 'Products could not be loaded');
      }

      this.products = result.data.map(item => this.normalizeProduct(item)).filter(Boolean);
      return true;
    } catch (error) {
      console.error('POS loadProducts error:', error);
      this.products = [];
      this.loadErrors.products = error.message || 'Products could not be loaded';
      return false;
    }
  }

  async loadCategories() {
    this.loadErrors.categories = '';

    try {
      if (!window.electronAPI || typeof window.electronAPI.getCategories !== 'function') {
        throw new Error('Category service is unavailable');
      }

      const result = await window.electronAPI.getCategories();
      if (!result?.success || !Array.isArray(result.data)) {
        throw new Error(result?.error || 'Categories could not be loaded');
      }

      this.categories = result.data.map(category => ({
        id: category.id || category.category_id || category.name,
        name: category.name || category.category_name || category.id || category,
      })).filter(category => category.id && category.name);
      return true;
    } catch (error) {
      console.error('POS loadCategories error:', error);
      this.categories = [];
      this.loadErrors.categories = error.message || 'Categories could not be loaded';
      return false;
    }
  }

  async loadCustomers() {
    this.loadErrors.customers = '';

    try {
      if (!window.electronAPI || typeof window.electronAPI.getCustomers !== 'function') {
        throw new Error('Customer service is unavailable');
      }

      const result = await window.electronAPI.getCustomers();
      if (!result?.success || !Array.isArray(result.data)) {
        throw new Error(result?.error || 'Customers could not be loaded');
      }

      this.customers = result.data.map(customer => this.normalizeCustomer(customer)).filter(Boolean);
      return true;
    } catch (error) {
      console.error('POS loadCustomers error:', error);
      this.customers = [];
      this.loadErrors.customers = error.message || 'Customers could not be loaded';
      return false;
    }
  }

  async loadSettings() {
    try {
      if (!window.electronAPI || typeof window.electronAPI.getSettings !== 'function') {
        throw new Error('Settings service is unavailable');
      }

      const result = await window.electronAPI.getSettings();
      if (!result?.success || !result.data) {
        throw new Error(result?.error || 'Settings could not be loaded');
      }

      const taxRate = Number(result.data.default_tax_rate);
      this.defaultTaxRate = Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 100
        ? taxRate / 100
        : 0.10;
      this.taxInclusive = result.data.tax_inclusive === true
        || result.data.tax_inclusive === 'true'
        || result.data.tax_inclusive === 1;
      if (this.elements.taxLabel) {
        this.elements.taxLabel.textContent = result.data.tax_name || window.AppFormatters.taxLabel;
      }
      return true;
    } catch (error) {
      console.error('POS loadSettings error:', error);
      this.showNotification(error.message || 'Tax settings could not be loaded', 'error');
      return false;
    }
  }

  normalizeProduct(product) {
    const id = product.id ?? product.product_id;
    const name = String(product.name || '').trim();
    if (id === null || id === undefined || id === '' || !name) return null;

    return {
      id,
      name,
      sku: product.sku || product.barcode || '',
      description: product.description || product.short_description || '',
      category: product.category_name || product.category || 'Uncategorized',
      price: parseFloat(product.unit_price ?? product.price ?? 0) || 0,
      stock: this.getAvailableStock(product),
      stockOnHand: this.parseStockNumber(product.quantity_on_hand ?? product.stock ?? product.quantityOnHand ?? 0),
      stockReserved: this.parseStockNumber(product.quantity_reserved ?? product.quantityReserved ?? 0),
      reorderLevel: this.parseStockNumber(product.reorder_level ?? product.reorderLevel ?? 10),
      taxRate: parseFloat(product.tax_rate ?? product.taxRate ?? this.defaultTaxRate) || 0,
      status: product.is_active === false ? 'inactive' : 'active',
      barcode: product.barcode || product.sku || '',
    };
  }

  parseStockNumber(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  getAvailableStock(product) {
    const explicitAvailable = product.quantity_available ?? product.available_stock ?? product.availableStock;
    if (explicitAvailable !== undefined && explicitAvailable !== null && explicitAvailable !== '') {
      return Math.max(this.parseStockNumber(explicitAvailable), 0);
    }

    const onHand = this.parseStockNumber(product.quantity_on_hand ?? product.stock ?? product.quantityOnHand ?? 0);
    const reserved = this.parseStockNumber(product.quantity_reserved ?? product.quantityReserved ?? 0);
    return Math.max(onHand - reserved, 0);
  }

  normalizeCustomer(customer) {
    const id = customer.id ?? customer.customer_code;
    const name = String(customer.name || '').trim();
    if (id === null || id === undefined || id === '' || !name) return null;

    return {
      id,
      name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      balance: parseFloat(customer.current_balance || customer.balance || 0) || 0,
      type: customer.type || customer.customer_type || 'Individual',
      status: customer.status || 'Active',
      lastVisit: customer.last_purchase || customer.lastVisit || 'N/A',
      creditLimit: parseFloat(customer.credit_limit || customer.creditLimit || 0) || 0,
    };
  }

  renderCategoryOptions() {
    if (!this.elements.categoryFilter) return;

    if (this.loadErrors.categories) {
      window.TemplateRenderer?.replaceSelectOptions(this.elements.categoryFilter, [], 'Categories unavailable');
      this.elements.categoryFilter.disabled = true;
      this.elements.categoryFilter.title = this.loadErrors.categories;
      return;
    }

    this.elements.categoryFilter.disabled = false;
    this.elements.categoryFilter.title = '';
    window.TemplateRenderer?.replaceSelectOptions(
      this.elements.categoryFilter,
      this.categories.map(category => ({ value: category.name, label: category.name })),
      'All Categories'
    );
  }

  renderQuickKeys() {
    if (!this.elements.quickKeysGrid) return;
    const keys = [
      { label: 'F1', value: 'Cash', action: 'cash' },
      { label: 'F2', value: 'Card', action: 'card' },
      { label: 'F3', value: 'Mobile', action: 'mobile' },
      { label: 'F4', value: 'Clear Cart', action: 'clear' },
      { label: 'F5', value: 'Hold Sale', action: 'hold' },
      { label: 'F10', value: 'Checkout', action: 'checkout', tone: 'danger' }
    ];
    const fragment = document.createDocumentFragment();
    keys.forEach((key) => {
      const button = window.TemplateRenderer?.clone('quick-key-template') || document.createElement('button');
      button.type = 'button';
      button.className = button.className || 'quick-key-button';
      if (key.tone) button.classList.add(`quick-key-${key.tone}`);
      button.dataset.value = key.value;
      button.dataset.action = key.action;
      window.TemplateRenderer?.setText(button, '[data-label]', key.label);
      window.TemplateRenderer?.setText(button, '[data-key]', key.value);
      fragment.appendChild(button);
    });
    this.elements.quickKeysGrid.replaceChildren(fragment);
  }

  handleQuickKeyAction(action) {
    switch (action) {
      case 'cash':
      case 'card':
      case 'mobile':
        this.setPaymentMethod(action);
        break;
      case 'clear':
        this.clearCart();
        break;
      case 'hold':
        this.setSessionMode('hold');
        break;
      case 'checkout':
        if (this.cart.length) this.openPaymentModal();
        break;
      default:
        break;
    }
  }

  isActiveView() {
    return this.elements.view?.classList.contains('active') || window.app?.currentView === 'pos';
  }

  getFilteredProducts() {
    const query = (this.searchQuery || '').trim().toLowerCase();
    const category = this.category || '';

    return this.products.filter(product => {
      const searchable = [
        product.name,
        product.sku,
        product.barcode,
        product.category,
        product.description
      ];
      const matchesSearch = !query || searchable
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
      const matchesCategory = !category || String(product.category) === String(category);
      return matchesSearch && matchesCategory;
    });
  }

  renderProducts() {
    if (!this.elements.productsGrid) return;

    const hasSearchQuery = Boolean((this.searchQuery || '').trim());
    this.elements.productSearch?.classList.toggle('has-search', hasSearchQuery);
    this.elements.productsContainer?.classList.toggle('is-searching', hasSearchQuery);
    this.elements.productsContainer?.classList.toggle('awaiting-search', !hasSearchQuery);
    this.elements.productsGridContainer?.classList.toggle('is-searching', hasSearchQuery);
    this.elements.productsGridContainer?.classList.toggle('awaiting-search', !hasSearchQuery);
    if (this.elements.productsGridContainer) {
      this.elements.productsGridContainer.hidden = !hasSearchQuery;
    }
    this.elements.productsGrid.classList.toggle('is-searching', hasSearchQuery);
    this.elements.productsGrid.classList.remove('search-results-list');

    if (!hasSearchQuery) {
      this.elements.productsGrid.replaceChildren();
      if (this.elements.noProductsMessage) {
        this.elements.noProductsMessage.style.display = 'none';
        const message = this.elements.noProductsMessage.querySelector('p');
        if (message) message.textContent = 'No products found';
      }
      return;
    }

    if (this.loadErrors.products) {
      this.elements.productsGrid.replaceChildren();
      if (this.elements.noProductsMessage) {
        this.elements.noProductsMessage.style.display = 'flex';
        const message = this.elements.noProductsMessage.querySelector('p');
        if (message) message.textContent = `Unable to load products: ${this.loadErrors.products}`;
      }
      return;
    }

    const filtered = this.getFilteredProducts();

    if (this.elements.noProductsMessage) {
      this.elements.noProductsMessage.style.display = filtered.length ? 'none' : 'flex';
      const message = this.elements.noProductsMessage.querySelector('p');
      if (message) message.textContent = 'No products found';
    }

    if (!filtered.length) {
      this.elements.productsGrid.replaceChildren();
      return;
    }

    const table = document.createElement('table');
    table.className = 'pos-products-table';
    table.classList.toggle('is-searching', hasSearchQuery);
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    [
      ['col-product', 'Product'],
      ['col-description', 'Description'],
      ['col-category', 'Category'],
      ['col-stock', 'Stock'],
      ['col-price', 'Price'],
      ['col-action', 'Action']
    ].forEach(([className, label]) => {
      const th = document.createElement('th');
      th.className = className;
      th.textContent = label;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    const tbody = document.createElement('tbody');
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    filtered.forEach(product => {
      const availability = this.getProductAvailability(product);
      const row = window.TemplateRenderer?.clone('pos-product-row-template') || document.createElement('tr');
      row.classList.add('product-table-row');
      row.classList.toggle('search-match', hasSearchQuery);
      row.classList.toggle('product-inactive', availability.reason === 'inactive');
      row.classList.toggle('product-maxed', availability.reason === 'maxed');
      row.dataset.productId = product.id;
      row.title = availability.message || '';
      window.TemplateRenderer?.setText(row, '[data-name]', product.name);
      window.TemplateRenderer?.setText(row, '[data-description]', product.description || 'No description available.');
      row.querySelector('[data-category]')?.replaceChildren(
        make('span', { className: `product-category-badge ${this.getCategoryClass(product.category)}`, text: product.category })
      );
      row.querySelector('[data-stock]')?.replaceChildren(
        make('span', {
          className: 'product-stock-wrap',
          children: [
            make('span', { className: `stock-dot ${availability.stockClass}`, attrs: { 'aria-hidden': 'true' } }),
            make('span', { className: `product-stock ${availability.stockClass}`, text: availability.stockLabel })
          ]
        })
      );
      window.TemplateRenderer?.setText(row, '[data-price]', this.formatCurrency(product.price));
      const actionCell = row.querySelector('[data-action]');
      if (actionCell) {
        const button = make('button', {
          className: availability.canAdd ? 'product-add-btn' : 'product-waitlist-btn',
          html: availability.canAdd
            ? '<span aria-hidden="true" class="button-cart-icon">+</span><span>Add</span>'
            : `<span aria-hidden="true" class="button-bell-icon"></span><span>${availability.actionLabel}</span>`,
          attrs: { type: 'button', title: availability.message },
          dataset: { productId: product.id }
        });
        actionCell.replaceChildren(button);
      }
      tbody.appendChild(row);
    });
    table.append(thead, tbody);
    this.elements.productsGrid.replaceChildren(table);
  }

  renderCart() {
    if (!this.elements.cartItemsList || !this.elements.cartCount || !this.elements.emptyCartMessage || !this.elements.checkoutBtn) return;

    const totalQuantity = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    this.elements.cartCount.textContent = `${totalQuantity} ${totalQuantity === 1 ? 'Item' : 'Items'}`;
    this.elements.emptyCartMessage.style.display = this.cart.length ? 'none' : 'flex';

    const fragment = document.createDocumentFragment();
    this.cart.forEach(item => {
      const node = window.TemplateRenderer?.clone('pos-cart-item-template') || document.createElement('div');
      node.className = node.className || 'cart-item';
      window.TemplateRenderer?.setText(node, '[data-name]', item.name);
      window.TemplateRenderer?.setText(node, '[data-price]', `(${this.formatCurrency(item.price)})`);
      window.TemplateRenderer?.setText(node, '[data-total]', this.formatCurrency(item.quantity * item.price));

      const removeBtn = node.querySelector('[data-cart-remove]');
      if (removeBtn) {
        removeBtn.dataset.cartRemove = item.id;
        removeBtn.setAttribute('aria-label', `Remove ${item.name}`);
      }
      node.querySelectorAll('[data-quantity-change]').forEach(button => {
        button.dataset.quantityChange = item.id;
      });
      const quantityInput = node.querySelector('[data-cart-quantity]');
      if (quantityInput) {
        quantityInput.dataset.cartQuantity = item.id;
        quantityInput.max = item.stock;
        quantityInput.value = item.quantity;
        quantityInput.setAttribute('aria-label', `Quantity for ${item.name}`);
      }
      fragment.appendChild(node);
    });
    this.elements.cartItemsList.replaceChildren(fragment);

    this.updateTotals();
    this.elements.checkoutBtn.disabled = !this.cart.length;
    this.elements.clearCartBtn?.classList.toggle('active', Boolean(this.cart.length));
  }

  renderSaleState() {
    this.renderCart();
    this.renderProducts();
    this.updatePaymentModal();
  }

  renderCustomerSelection() {
    if (!this.elements.customerSearchWrapper || !this.selectedCustomerContainer) return;

    if (this.selectedCustomer) {
      this.elements.customerSearchWrapper.style.display = 'none';
      this.selectedCustomerContainer.style.display = 'block';
      const contact = this.selectedCustomer.phone || this.selectedCustomer.email || 'No contact info';
      const creditAvailable = this.formatCurrency(Math.max((this.selectedCustomer.creditLimit || 0) - (this.selectedCustomer.balance || 0), 0));
      const lastVisit = this.selectedCustomer.lastVisit || 'N/A';
      this.selectedCustomerContainer.replaceChildren(this.createSelectedCustomerCard(contact, creditAvailable, lastVisit));
      this.selectedCustomerContainer.querySelector('.customer-clear-btn')?.addEventListener('click', () => {
        this.selectedCustomer = null;
        this.renderCustomerSelection();
      });
    } else {
      this.selectedCustomerContainer.style.display = 'none';
      this.selectedCustomerContainer.replaceChildren();
      this.elements.customerSearchWrapper.style.display = 'block';
      this.renderCustomerSearchResults();
    }
  }

  createSelectedCustomerCard(contact, creditAvailable, lastVisit) {
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    const wrapper = make('div', { className: 'customer-selected' });
    const nameButton = make('button', { className: 'selected-customer-name', text: this.selectedCustomer.name, attrs: { type: 'button', 'aria-describedby': 'selected-customer-details' } });
    const clearButton = make('button', { className: 'customer-clear-btn', text: 'x', attrs: { type: 'button', 'aria-label': 'Clear selected customer' } });
    const popover = make('div', { className: 'selected-customer-popover', attrs: { id: 'selected-customer-details', role: 'tooltip' } });
    const contactEl = make('div', { className: 'selected-customer-contact', text: contact });
    const meta = make('div', { className: 'selected-customer-meta' });
    const credit = make('div');
    credit.append(make('span', { text: 'Credit Status' }), make('strong', { className: 'credit-value', text: `${creditAvailable} available` }));
    const visit = make('div');
    visit.append(make('span', { text: 'Last Visit' }), make('strong', { text: lastVisit }));
    meta.append(credit, visit);
    popover.append(contactEl, meta);
    wrapper.append(nameButton, clearButton, popover);
    return wrapper;
  }

  selectCustomer(customer) {
    this.selectedCustomer = customer;
    if (this.elements.customerSearch) this.elements.customerSearch.value = '';
    if (this.elements.customerSearchResults) {
      this.elements.customerSearchResults.replaceChildren();
      this.elements.customerSearchResults.style.display = 'none';
    }
    this.renderCustomerSelection();
  }

  renderCustomerSearchResults() {
    if (!this.elements.customerSearch || !this.elements.customerSearchResults) return;

    const query = this.elements.customerSearch.value.trim().toLowerCase();

    if (this.loadErrors.customers) {
      const block = document.createElement('div');
      block.className = 'customer-no-results';
      block.textContent = `Unable to load customers: ${this.loadErrors.customers}`;
      this.elements.customerSearchResults.replaceChildren(block);
      this.elements.customerSearchResults.style.display = query ? 'block' : 'none';
      this.elements.customerSearch.title = this.loadErrors.customers;
      return;
    }

    this.elements.customerSearch.title = '';
    if (!query) {
      this.elements.customerSearchResults.style.display = 'none';
      this.elements.customerSearchResults.replaceChildren();
      return;
    }

    const results = this.customers.filter(customer => {
      return [customer.name, customer.email, customer.phone, customer.id]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    }).slice(0, 8);

    if (!results.length) {
      const block = document.createElement('div');
      block.className = 'customer-no-results';
      block.textContent = 'No customers found';
      this.elements.customerSearchResults.replaceChildren(block);
      this.elements.customerSearchResults.style.display = 'block';
      return;
    }

    const fragment = document.createDocumentFragment();
    results.forEach(customer => {
      const button = window.TemplateRenderer?.clone('pos-customer-result-template') || document.createElement('button');
      button.className = button.className || 'customer-result';
      button.dataset.customerId = customer.id;
      window.TemplateRenderer?.setText(button, '[data-name]', customer.name);
      window.TemplateRenderer?.setText(button, '[data-contact]', customer.phone || customer.email || 'No contact');
      fragment.appendChild(button);
    });
    this.elements.customerSearchResults.replaceChildren(fragment);
    this.elements.customerSearchResults.style.display = 'block';
  }

  hideCustomerSearchResults() {
    if (!this.elements.customerSearchResults) return;
    this.elements.customerSearchResults.style.display = 'none';
  }

  findProductByCode(query) {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return null;

    return this.products.find(item => {
      return [item.sku, item.barcode, item.id]
        .filter(value => value !== null && value !== undefined && value !== '')
        .some(value => String(value).trim().toLowerCase() === normalized);
    }) || null;
  }

  handleProductSearchSubmit() {
    const query = this.elements.productSearch?.value.trim() || '';
    if (!query) return;

    const exactMatch = this.findProductByCode(query);
    const filtered = this.getFilteredProducts();
    const product = exactMatch || (filtered.length === 1 ? filtered[0] : null);

    if (!product) {
      this.showNotification('Scan an exact SKU/barcode or choose a product from the list', 'info');
      return;
    }

    if (this.addToCart(product)) {
      this.searchQuery = '';
      if (this.elements.productSearch) this.elements.productSearch.value = '';
      this.elements.productSearch?.focus();
      this.renderProducts();
    }
  }

  handleBarcodeAdd(queryValue = null) {
    if (!this.elements.barcodeInput && queryValue === null) return;
    const query = String(queryValue ?? this.elements.barcodeInput.value).trim();
    if (!query) return;

    const product = this.findProductByCode(query);
    if (!product) {
      this.showNotification(`No product found for barcode/SKU "${query}"`, 'error');
      return;
    }

    if (this.addToCart(product) && this.elements.barcodeInput) this.elements.barcodeInput.value = '';
  }

  addToCart(product) {
    const availability = this.getProductAvailability(product);
    if (!availability.canAdd) {
      this.showNotification(availability.message, 'warning');
      return false;
    }

    const existing = this.cart.find(item => String(item.id) === String(product.id));
    if (existing) {
      if (existing.quantity < product.stock) {
        existing.quantity += 1;
      } else {
        this.showNotification('Cannot add more than available stock', 'warning');
        return false;
      }
    } else {
      this.cart.push({ ...product, quantity: 1 });
    }
    this.renderSaleState();
    return true;
  }

  removeFromCart(productId) {
    this.cart = this.cart.filter(item => String(item.id) !== String(productId));
    this.renderSaleState();
  }

  changeQuantity(productId, delta) {
    const item = this.cart.find(entry => String(entry.id) === String(productId));
    if (!item) return;
    item.quantity = Math.max(1, Math.min(item.stock, item.quantity + delta));
    this.renderSaleState();
  }

  setCartQuantity(productId, value) {
    const item = this.cart.find(entry => String(entry.id) === String(productId));
    if (!item) return;
    const nextQuantity = parseInt(value, 10);
    item.quantity = Math.max(1, Math.min(item.stock, Number.isFinite(nextQuantity) ? nextQuantity : 1));
    this.renderSaleState();
  }

  async clearCart(confirmFirst = true) {
    if (!this.cart.length) return false;
    if (confirmFirst) {
      const confirmed = await window.AppDialogs?.confirm('Clear the current cart?', {
        title: 'Clear Cart',
        eyebrow: 'Point of Sale',
        primaryLabel: 'Clear Cart',
        variant: 'danger'
      });
      if (!confirmed) return false;
    }
    this.cart = [];
    this.renderSaleState();
    return true;
  }

  getCartQuantity(productId) {
    return this.cart
      .filter(item => String(item.id) === String(productId))
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  getProductAvailability(product) {
    if (!product) {
      return {
        canAdd: false,
        reason: 'missing',
        stockClass: 'stock-out',
        stockLabel: 'Unavailable',
        actionLabel: 'Unavailable',
        message: 'Product is unavailable'
      };
    }

    const stock = Math.max(Number(product.stock) || 0, 0);
    const inCart = this.getCartQuantity(product.id);
    const remaining = Math.max(stock - inCart, 0);
    const threshold = Math.max(Number(product.reorderLevel) || 10, 1);

    if (product.status !== 'active') {
      return {
        canAdd: false,
        reason: 'inactive',
        stockClass: 'stock-out',
        stockLabel: 'Inactive',
        actionLabel: 'Inactive',
        message: `${product.name} is inactive`
      };
    }

    if (stock <= 0) {
      return {
        canAdd: false,
        reason: 'out',
        stockClass: 'stock-out',
        stockLabel: 'Out of stock',
        actionLabel: 'No stock',
        message: `${product.name} is out of stock`
      };
    }

    if (remaining <= 0) {
      return {
        canAdd: false,
        reason: 'maxed',
        stockClass: 'stock-cart',
        stockLabel: `${stock} in cart`,
        actionLabel: 'Maxed',
        message: `All available stock for ${product.name} is already in the cart`
      };
    }

    const stockClass = remaining <= threshold ? 'stock-low' : 'stock-good';
    const stockLabel = inCart > 0
      ? `${remaining} left`
      : remaining <= threshold
        ? `${remaining} low`
        : `${remaining} available`;

    return {
      canAdd: true,
      reason: inCart > 0 ? 'partial' : 'available',
      stockClass,
      stockLabel,
      actionLabel: 'Add',
      message: inCart > 0 ? `${inCart} already in cart` : ''
    };
  }

  getCartTotals() {
    const discountBasisPoints = Math.round(this.discountRate * 10000);
    const lineAmounts = this.cart.map((item) => {
      const gross = Math.round(item.price * 100) * item.quantity;
      const discount = Math.round(gross * discountBasisPoints / 10000);
      return { gross, discount, net: gross - discount };
    });
    const subtotalCents = lineAmounts.reduce((sum, item) => sum + item.gross, 0);
    const discountCents = lineAmounts.reduce((sum, item) => sum + item.discount, 0);
    const taxableAmountCents = lineAmounts.reduce((sum, item) => sum + item.net, 0);
    const taxRateBasisPoints = Math.round(this.defaultTaxRate * 10000);
    const taxCents = this.isTaxExempt
      ? 0
      : this.taxInclusive
        ? Math.round(
            taxableAmountCents * taxRateBasisPoints / (10000 + taxRateBasisPoints)
          )
        : Math.round(taxableAmountCents * taxRateBasisPoints / 10000);
    const totalCents = taxableAmountCents;

    return {
      subtotal: subtotalCents / 100,
      discount: discountCents / 100,
      tax: taxCents / 100,
      total: totalCents / 100
    };
  }

  updateTotals() {
    const { subtotal, discount, tax, total } = this.getCartTotals();

    if (this.elements.cartSubtotal) this.elements.cartSubtotal.textContent = this.formatCurrency(subtotal);
    if (this.elements.cartDiscount) this.elements.cartDiscount.textContent = discount ? `-${this.formatCurrency(discount)}` : this.formatCurrency(0);
    if (this.elements.cartTax) this.elements.cartTax.textContent = this.formatCurrency(tax);
    if (this.elements.cartTotal) this.elements.cartTotal.textContent = this.formatCurrency(total);
    if (this.elements.taxStatus) this.elements.taxStatus.textContent = this.isTaxExempt ? '(Exempt)' : '';
    if (this.elements.checkoutBtn) {
      const checkoutLabel = this.elements.checkoutBtn.querySelector('.checkout-label');
      if (checkoutLabel) {
        checkoutLabel.textContent = 'Checkout';
      } else {
        this.elements.checkoutBtn.textContent = 'Checkout';
      }
    }
  }

  setSessionMode(mode) {
    const isLive = mode === 'live';
    this.elements.sessionLiveBtn?.classList.toggle('active', isLive);
    this.elements.sessionHoldBtn?.classList.toggle('active', !isLive);
    this.elements.sessionLiveBtn?.setAttribute('aria-pressed', String(isLive));
    this.elements.sessionHoldBtn?.setAttribute('aria-pressed', String(!isLive));
  }

  setPaymentMethod(method) {
    this.paymentMethod = method || 'cash';
    this.syncPaymentMethod();
    if (this.paymentModal?.style.display === 'flex' && this.paymentMethod !== 'cash') {
      this.setPaymentAmount(this.getCartTotals().total);
      return;
    }
    this.updatePaymentModal();
  }

  syncPaymentMethod() {
    if (!this.elements.paymentMethodButtons) return;
    this.elements.paymentMethodButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.method === this.paymentMethod);
    });
  }

  getPaymentMethods() {
    return [
      { key: 'cash', label: 'Cash' },
      { key: 'card', label: 'Card' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'bank', label: 'Bank' },
      { key: 'credit', label: 'Credit' }
    ];
  }

  formatCurrency(amount) {
    return window.AppFormatters.formatCurrency(amount);
  }

  getCategoryClass(category) {
    return `category-${String(category || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'other'}`;
  }

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  showNotification(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
    } else if (type === 'error') {
      window.AppDialogs?.alert(message, {
        title: 'Error',
        variant: 'error',
        primaryLabel: 'OK'
      });
    } else {
      window.AppDialogs?.alert(message, {
        title: 'Notice',
        variant: type,
        primaryLabel: 'OK'
      });
    }
  }
}

if (typeof window !== 'undefined') {
  window.POSView = POSView;
}
