/**
 * Inventory View Module
 * Manages inventory tracking, stock adjustments, and inventory health monitoring
 */

class InventoryView {
  constructor() {
    this.items = [];
    this.filteredItems = [];
    this.categories = [];
    this.currentPage = 1;
    this.perPage = 25;
    this.searchQuery = '';
    this.stockFilter = '';
    this.categoryFilter = '';
    this.selectedProductId = null;
    this.loadError = '';
    
    this.init();
  }

  async init() {
    await this.loadInventory();
    this.render();
    this.setupEventListeners();
  }

  async loadInventory() {
    this.loadError = '';

    try {
      if (!window.electronAPI || typeof window.electronAPI.getInventory !== 'function') {
        throw new Error('Inventory service is unavailable');
      }

      const result = await window.electronAPI.getInventory();
      if (!result?.success || !Array.isArray(result.data)) {
        throw new Error(result?.error || 'Inventory data could not be loaded');
      }

      this.items = result.data.map(item => ({
        id: item.product_id ?? item.id,
        sku: item.sku || '',
        name: item.name || 'Unnamed product',
        description: item.product_description ?? item.description ?? 'No description provided.',
        category: item.category_name || item.category || 'Uncategorized',
        quantityOnHand: Number(item.quantity_on_hand ?? item.quantityOnHand ?? 0),
        quantityReserved: Number(item.quantity_reserved ?? item.quantityReserved ?? 0),
        reorderLevel: Number(item.reorder_level ?? item.reorderLevel ?? 10),
        reorderQuantity: Number(item.reorder_quantity ?? item.reorderQuantity ?? 50),
        unit: item.unit || 'piece',
        price: item.unit_price ?? item.price ?? 0,
        costPrice: item.cost_price ?? item.costPrice ?? 0,
        location: item.location_code || item.location || 'Main Warehouse'
      }));
      this.extractCategories();
      return true;
    } catch (error) {
      console.error('Failed to load inventory:', error);
      this.items = [];
      this.loadError = error.message || 'Inventory data could not be loaded';
      this.extractCategories();
      return false;
    }
  }

  extractCategories() {
    const unique = [...new Set(this.items.map(i => i.category))];
    this.categories = unique.sort();
  }

  filterItems() {
    this.filteredItems = this.items.filter(item => {
      const matchesSearch = !this.searchQuery ||
        item.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      const matchesCategory = !this.categoryFilter || item.category === this.categoryFilter;
      
      const available = item.quantityOnHand - item.quantityReserved;
      let matchesStock = true;
      if (this.stockFilter === 'in') matchesStock = available > item.reorderLevel;
      if (this.stockFilter === 'low') matchesStock = available > 0 && available <= item.reorderLevel;
      if (this.stockFilter === 'out') matchesStock = available <= 0;
      if (this.stockFilter === 'below') matchesStock = available <= item.reorderLevel;

      return matchesSearch && matchesCategory && matchesStock;
    });

    this.currentPage = 1;
    this.renderTable();
    this.updatePagination();
    this.updateCounts();
  }

  getStockStatus(available, reorderLevel) {
    if (available <= 0) return { class: 'out-of-stock', label: 'Out of Stock' };
    if (available <= reorderLevel) return { class: 'low-stock', label: 'Low Stock' };
    return { class: 'in-stock', label: 'In Stock' };
  }

  render() {
    this.renderCategoryFilter();
    this.updateSummaryCards();
    this.filterItems();
  }

  updateSummaryCards() {
    if (this.loadError) {
      ['inv-total-products', 'inv-in-stock', 'inv-low-stock', 'inv-out-of-stock', 'inv-total-value',
        'inv-total-items', 'inv-below-reorder', 'inv-categories'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = '--';
      });
      return;
    }

    const totalProducts = this.items.length;
    const inStock = this.items.filter(i => (i.quantityOnHand - i.quantityReserved) > i.reorderLevel).length;
    const lowStock = this.items.filter(i => {
      const avail = i.quantityOnHand - i.quantityReserved;
      return avail > 0 && avail <= i.reorderLevel;
    }).length;
    const outOfStock = this.items.filter(i => (i.quantityOnHand - i.quantityReserved) <= 0).length;
    const belowReorder = lowStock + outOfStock;
    
    const totalValue = this.items.reduce((sum, item) => sum + this.getInventoryItemValue(item), 0);
    const totalItems = this.items.reduce((sum, i) => sum + i.quantityOnHand, 0);

    document.getElementById('inv-total-products').textContent = totalProducts;
    document.getElementById('inv-in-stock').textContent = inStock;
    document.getElementById('inv-low-stock').textContent = lowStock;
    document.getElementById('inv-out-of-stock').textContent = outOfStock;
    document.getElementById('inv-total-value').textContent = this.formatWholeCurrency(totalValue);
    document.getElementById('inv-total-items').textContent = totalItems.toLocaleString();
    document.getElementById('inv-below-reorder').textContent = belowReorder;
    document.getElementById('inv-categories').textContent = this.categories.length;
  }

  renderCategoryFilter() {
    const select = document.getElementById('inventory-category-filter');
    if (!select) return;
    
    window.TemplateRenderer?.replaceSelectOptions(
      select,
      this.categories.map(cat => ({ value: cat, label: cat })),
      'All Categories'
    );
    select.value = this.categoryFilter;
  }

  renderTable() {
    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;

    if (this.loadError) {
      window.TemplateRenderer?.appendEmptyRow(tbody, 10, 'Unable to load inventory', this.loadError);
      return;
    }

    const start = (this.currentPage - 1) * this.perPage;
    const end = start + this.perPage;
    const pageItems = this.filteredItems.slice(start, end);

    if (pageItems.length === 0) {
      window.TemplateRenderer?.appendEmptyRow(tbody, 10, 'No inventory items found', '');
      return;
    }

    const fragment = document.createDocumentFragment();
    pageItems.forEach(item => {
      const available = item.quantityOnHand - item.quantityReserved;
      const status = this.getStockStatus(available, item.reorderLevel);
      const row = window.TemplateRenderer?.clone('inventory-table-row-template') || document.createElement('tr');
      const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));

      row.querySelector('[data-sku]')?.replaceChildren(make('span', { className: 'product-sku', text: item.sku }));
      row.querySelector('[data-product]')?.replaceChildren(make('span', { className: 'product-name', text: item.name }));
      const description = make('span', { className: 'product-description', text: item.description });
      description.title = item.description;
      row.querySelector('[data-description]')?.replaceChildren(description);
      row.querySelector('[data-category]')?.replaceChildren(make('span', { className: 'product-category', text: item.category }));
      row.querySelector('[data-on-hand]')?.replaceChildren(make('span', { className: 'stock-value positive', text: item.quantityOnHand }));
      row.querySelector('[data-reserved]')?.replaceChildren(make('span', { className: `stock-value ${item.quantityReserved > 0 ? 'negative' : 'zero'}`, text: item.quantityReserved }));
      row.querySelector('[data-available]')?.replaceChildren(make('span', { className: `stock-value ${available > 0 ? 'positive' : 'negative'}`, text: available }));
      row.querySelector('[data-reorder]')?.replaceChildren(make('span', { text: item.reorderLevel, attrs: { style: 'font-weight: 600;' } }));
      row.querySelector('[data-status]')?.replaceChildren(make('span', { className: `stock-level-badge ${status.class}`, text: status.label }));

      const actionCell = row.querySelector('[data-actions]');
      if (actionCell) {
        actionCell.className = 'inventory-actions-cell';
        actionCell.replaceChildren(this.createInventoryActions(item.id));
      }
      fragment.appendChild(row);
    });
    tbody.replaceChildren(fragment);

    this.attachTableEvents();
  }

  createInventoryActions(productId) {
    const make = window.TemplateRenderer?.make || ((tag, options = {}) => {
      const element = document.createElement(tag);
      if (options.className) element.className = options.className;
      if (options.text !== undefined) element.textContent = String(options.text);
      return element;
    });
    const wrapper = make('div', { className: 'inventory-actions' });
    const trigger = make('button', {
      className: 'inventory-action-trigger',
      attrs: { type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', title: 'Actions' },
      dataset: { actionMenu: productId }
    });
    trigger.appendChild(make('span', { text: '⋮', attrs: { 'aria-hidden': 'true' } }));
    const menu = make('div', { className: 'inventory-action-menu', attrs: { role: 'menu' } });
    const adjust = make('button', { text: 'Adjust Stock', attrs: { type: 'button', role: 'menuitem' }, dataset: { action: 'adjust', id: productId } });
    const history = make('button', { text: 'Stock History', attrs: { type: 'button', role: 'menuitem' }, dataset: { action: 'history', id: productId } });
    menu.append(adjust, history);
    wrapper.append(trigger, menu);
    return wrapper;
  }

  decorateActionMenus() {
    // Actions are now created from DOM nodes in renderTable().
  }

  attachTableEvents() {
    const closeMenus = () => {
      document.querySelectorAll('.inventory-actions.open').forEach(menu => {
        menu.classList.remove('open');
        menu.querySelector('.inventory-action-trigger')?.setAttribute('aria-expanded', 'false');
      });
    };

    document.querySelectorAll('[data-action-menu]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const wrapper = e.target.closest('.inventory-actions');
        const isOpen = wrapper?.classList.contains('open');
        closeMenus();
        if (wrapper && !isOpen) {
          const menu = wrapper.querySelector('.inventory-action-menu');
          const rect = btn.getBoundingClientRect();
          const menuWidth = 142;
          const menuHeight = 86;
          const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
          const top = rect.bottom + menuHeight + 8 > window.innerHeight
            ? Math.max(8, rect.top - menuHeight - 4)
            : rect.bottom + 4;

          if (menu) {
            menu.style.left = `${left}px`;
            menu.style.top = `${top}px`;
          }

          wrapper.classList.add('open');
          btn.setAttribute('aria-expanded', 'true');
          document.addEventListener('click', closeMenus, { once: true });
        }
      };
    });

    document.querySelectorAll('[data-action="adjust"]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        closeMenus();
        const id = e.target.closest('button').dataset.id;
        this.openAdjustModal(id);
      };
    });

    document.querySelectorAll('[data-action="history"]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        closeMenus();
        const id = e.target.closest('button').dataset.id;
        this.viewStockHistory(id);
      };
    });
  }

  openAdjustModal(productId) {
    const item = this.findInventoryItem(productId);
    if (!item) return;

    this.selectedProductId = productId;
    document.getElementById('stock-product-id').value = item.id;
    document.getElementById('stock-product-name').textContent = item.name;
    document.getElementById('stock-product-sku').textContent = `SKU: ${item.sku}`;
    document.getElementById('stock-current-qty').textContent = `Current Stock: ${item.quantityOnHand} ${item.unit}`;

    document.getElementById('stock-transaction-type').value = 'receipt';
    document.getElementById('stock-direction').value = 'increase';
    document.getElementById('stock-quantity').value = 1;
    document.getElementById('stock-notes').value = '';
    document.getElementById('stock-error').textContent = '';
    this.setStockAdjustmentSaving(false);
    this.updateStockAdjustmentFields();
    this.updateAdjustmentPreview();

    document.getElementById('stock-modal').style.display = 'flex';
    document.getElementById('stock-transaction-type').focus();
  }

  closeAdjustModal() {
    const modal = document.getElementById('stock-modal');
    if (modal) modal.style.display = 'none';
    document.getElementById('stock-error').textContent = '';
    this.setStockAdjustmentSaving(false);
  }

  getStockAdjustmentSettings(type) {
    const settings = {
      receipt: {
        quantityLabel: 'Quantity Received',
        quantityHelp: 'Enter the quantity received.'
      },
      return: {
        quantityLabel: 'Quantity Returned',
        quantityHelp: 'Enter the quantity returned by the customer.'
      },
      damage: {
        quantityLabel: 'Quantity Damaged',
        quantityHelp: 'Enter the damaged quantity to remove from stock.'
      },
      lost: {
        quantityLabel: 'Quantity Lost',
        quantityHelp: 'Enter the lost quantity to remove from stock.'
      },
      count: {
        quantityLabel: 'Counted Stock Level',
        quantityHelp: 'Enter the total quantity found during the physical count.'
      },
      adjustment: {
        quantityLabel: 'Correction Quantity',
        quantityHelp: 'Enter the quantity to increase or reduce.'
      }
    };

    return settings[type] || settings.receipt;
  }

  updateStockAdjustmentFields() {
    const type = document.getElementById('stock-transaction-type')?.value || 'receipt';
    const settings = this.getStockAdjustmentSettings(type);
    const directionGroup = document.getElementById('stock-direction-group');
    const quantityLabel = document.getElementById('stock-quantity-label');
    const quantityHelp = document.getElementById('stock-quantity-help');

    if (directionGroup) directionGroup.style.display = type === 'adjustment' ? 'block' : 'none';
    if (quantityLabel) quantityLabel.textContent = settings.quantityLabel;
    if (quantityHelp) quantityHelp.textContent = settings.quantityHelp;
  }

  getStockAdjustmentValues(item) {
    const type = document.getElementById('stock-transaction-type')?.value || 'receipt';
    const direction = document.getElementById('stock-direction')?.value || 'increase';
    const quantity = Number.parseInt(document.getElementById('stock-quantity')?.value, 10);
    const normalizedQuantity = Number.isSafeInteger(quantity) ? quantity : 0;
    let change = normalizedQuantity;

    if (type === 'damage' || type === 'lost') change = -normalizedQuantity;
    if (type === 'adjustment' && direction === 'decrease') change = -normalizedQuantity;
    if (type === 'count') change = normalizedQuantity - item.quantityOnHand;

    return {
      type,
      direction,
      quantity: normalizedQuantity,
      change,
      newQuantity: item.quantityOnHand + change
    };
  }

  updateAdjustmentPreview() {
    const item = this.findInventoryItem(this.selectedProductId);
    if (!item) return;

    const values = this.getStockAdjustmentValues(item);
    const currentStock = document.getElementById('preview-current-stock');
    const stockChange = document.getElementById('preview-stock-change');
    const newQuantity = document.getElementById('stock-new-qty');

    currentStock.textContent = `${item.quantityOnHand} ${item.unit}`;
    stockChange.textContent = `${values.change > 0 ? '+' : ''}${values.change} ${item.unit}`;
    newQuantity.textContent = `${values.newQuantity} ${item.unit}`;

    stockChange.classList.toggle('positive', values.change > 0);
    stockChange.classList.toggle('negative', values.change < 0);
    newQuantity.classList.toggle('negative', values.newQuantity < 0);
  }

  async saveStockAdjustment() {
    const item = this.findInventoryItem(this.selectedProductId);
    if (!item) return;

    const values = this.getStockAdjustmentValues(item);
    const notes = document.getElementById('stock-notes').value.trim();
    const errorElement = document.getElementById('stock-error');

    if (!Number.isSafeInteger(values.quantity) || values.quantity < 1) {
      errorElement.textContent = 'Quantity must be a whole number greater than zero.';
      return;
    }

    errorElement.textContent = '';
    this.setStockAdjustmentSaving(true);

    try {
      if (!window.electronAPI || typeof window.electronAPI.adjustStock !== 'function') {
        throw new Error('Stock adjustment service is unavailable');
      }

      const result = await window.electronAPI.adjustStock({
        productId: item.id,
        quantity: values.quantity,
        stockChange: values.change,
        type: values.type,
        direction: values.direction,
        notes,
        credentials: {
          token: localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
        }
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to adjust stock');
      }

      this.closeAdjustModal();
      await this.loadInventory();
      this.render();
      const appliedChange = Number(result.data?.change ?? values.change);
      this.showNotification(
        `Stock updated: ${item.name} ${appliedChange > 0 ? '+' : ''}${appliedChange}`,
        'success'
      );
    } catch (error) {
      console.error('Stock adjustment failed:', error);
      errorElement.textContent = error.message || 'Failed to update stock.';
      this.showNotification(error.message || 'Failed to adjust stock', 'error');
    } finally {
      this.setStockAdjustmentSaving(false);
    }
  }

  setStockAdjustmentSaving(isSaving) {
    const button = document.getElementById('save-stock-adjustment');
    if (!button) return;
    button.disabled = isSaving;
    button.textContent = isSaving ? 'Saving...' : 'Save Stock Update';
  }

  async viewStockHistory(productId) {
    const item = this.findInventoryItem(productId);
    if (!item) return;

    const modal = document.getElementById('stock-history-modal');
    const tbody = document.getElementById('stock-history-tbody');
    const productName = document.getElementById('stock-history-product-name');
    const productMeta = document.getElementById('stock-history-product-meta');

    if (!modal || !tbody || !productName || !productMeta) return;

    productName.textContent = item.name;
    productMeta.textContent = `SKU: ${item.sku} | Current: ${item.quantityOnHand} ${item.unit} | Location: ${item.location}`;
    window.TemplateRenderer?.appendEmptyRow(tbody, 6, 'Loading stock history...', '', 'stock-history-empty');
    modal.style.display = 'flex';

    try {
      if (!window.electronAPI || typeof window.electronAPI.getStockTransactions !== 'function') {
        throw new Error('Stock history service is unavailable');
      }

      const result = await window.electronAPI.getStockTransactions(item.id, { limit: 50 });
      if (!result?.success || !Array.isArray(result.data)) {
        throw new Error(result?.error || 'Failed to load stock history');
      }

      const history = result.data;
      this.renderStockHistoryRows(tbody, history);
    } catch (error) {
      console.error('Failed to load stock history:', error);
      window.TemplateRenderer?.appendEmptyRow(tbody, 6, error.message || 'Failed to load stock history', '', 'stock-history-empty');
      this.showNotification(error.message || 'Failed to load stock history', 'error');
    }
  }

  renderStockHistoryRows(tbody, history) {
    window.TemplateRenderer?.appendStockHistoryRows(tbody, history, {
      date: (transaction) => this.formatDateTime(transaction.created_at),
      type: (transaction) => this.formatTransactionType(transaction.transaction_type),
      quantity: (quantity) => this.formatQuantityChange(quantity),
      before: (transaction) => this.formatOptionalNumber(transaction.quantity_before),
      after: (transaction) => this.formatOptionalNumber(transaction.quantity_after),
      notes: (transaction) => [transaction.reference_text || this.formatReference(transaction), transaction.notes].filter(Boolean).join(' | ') || '-'
    });
  }

  findInventoryItem(productId) {
    return this.items.find(item => String(item.id) === String(productId));
  }

  formatDateTime(value) {
    if (!value) return 'N/A';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return window.AppFormatters?.formatDateTime(date) || date.toLocaleString();
  }

  formatTransactionType(type) {
    return String(type || 'adjustment')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  formatQuantityChange(quantity) {
    const numeric = Number(quantity) || 0;
    return `${numeric > 0 ? '+' : ''}${numeric}`;
  }

  formatOptionalNumber(value) {
    if (value === null || value === undefined || value === '') return '-';
    return Number(value).toLocaleString();
  }

  formatReference(transaction) {
    if (!transaction.reference_type && !transaction.reference_id) return '';
    return [transaction.reference_type, transaction.reference_id].filter(Boolean).join(' #');
  }

  updatePagination() {
    const totalPages = Math.ceil(this.filteredItems.length / this.perPage);
    const container = document.getElementById('inventory-pagination');
    if (!container) return;

    window.TemplateRenderer?.renderPagination(container, totalPages, this.currentPage, (page) => {
      this.currentPage = parseInt(page, 10);
      this.renderTable();
      this.updatePagination();
    });
  }

  updateCounts() {
    document.getElementById('inventory-count').textContent = 
      `Showing ${this.filteredItems.length} of ${this.items.length} items`;
  }

  exportInventory() {
    if (this.loadError) {
      this.showNotification('Inventory cannot be exported while its data is unavailable', 'error');
      return false;
    }

    let csv = 'SKU,Name,Description,Category,On Hand,Reserved,Available,Reorder Level,Status\n';
    this.filteredItems.forEach(item => {
      const available = item.quantityOnHand - item.quantityReserved;
      const status = this.getStockStatus(available, item.reorderLevel);
      csv += `"${this.escapeCsv(item.sku)}","${this.escapeCsv(item.name)}","${this.escapeCsv(item.description)}","${this.escapeCsv(item.category)}",${item.quantityOnHand},${item.quantityReserved},${available},${item.reorderLevel},"${this.escapeCsv(status.label)}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  setupEventListeners() {
    // Search
    document.getElementById('inventory-search')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.filterItems();
    });

    // Stock filter
    document.getElementById('inventory-stock-filter')?.addEventListener('change', (e) => {
      this.stockFilter = e.target.value;
      this.filterItems();
    });

    // Category filter
    document.getElementById('inventory-category-filter')?.addEventListener('change', (e) => {
      this.categoryFilter = e.target.value;
      this.filterItems();
    });

    document.getElementById('reset-inventory-filters')?.addEventListener('click', () => {
      this.resetFilters();
    });

    // Per page
    document.getElementById('inventory-per-page')?.addEventListener('change', (e) => {
      this.perPage = parseInt(e.target.value);
      this.currentPage = 1;
      this.renderTable();
      this.updatePagination();
    });

    // Refresh
    document.getElementById('refresh-inventory-btn')?.addEventListener('click', async () => {
      const loaded = await this.loadInventory();
      this.render();
      if (loaded) this.showNotification('Inventory refreshed', 'success');
    });

    document.getElementById('refresh-inventory')?.addEventListener('click', async () => {
      const loaded = await this.loadInventory();
      this.render();
      if (loaded) this.showNotification('Inventory refreshed', 'success');
    });

    // Export
    document.getElementById('export-inventory-btn')?.addEventListener('click', () => {
      if (this.exportInventory()) this.showNotification('Inventory exported', 'success');
    });

    // Stock adjust button
    document.getElementById('stock-adjust-btn')?.addEventListener('click', () => {
      if (this.items.length > 0) {
        this.openAdjustModal(this.items[0].id);
      }
    });

    document.getElementById('stock-transaction-type')?.addEventListener('change', () => {
      this.updateStockAdjustmentFields();
      this.updateAdjustmentPreview();
    });

    document.getElementById('stock-direction')?.addEventListener('change', () => {
      this.updateAdjustmentPreview();
    });

    // Adjustment quantity buttons
    document.getElementById('stock-qty-inc')?.addEventListener('click', () => {
      const input = document.getElementById('stock-quantity');
      input.value = Math.max(1, (parseInt(input.value, 10) || 0) + 1);
      this.updateAdjustmentPreview();
    });

    document.getElementById('stock-qty-dec')?.addEventListener('click', () => {
      const input = document.getElementById('stock-quantity');
      input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
      this.updateAdjustmentPreview();
    });

    document.getElementById('stock-quantity')?.addEventListener('input', () => {
      this.updateAdjustmentPreview();
    });

    document.getElementById('stock-adjustment-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.saveStockAdjustment();
    });

    document.getElementById('close-stock-modal')?.addEventListener('click', () => {
      this.closeAdjustModal();
    });

    document.getElementById('cancel-stock-update')?.addEventListener('click', () => {
      this.closeAdjustModal();
    });

    // Close modal on overlay click
    document.getElementById('stock-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeAdjustModal();
      }
    });

    document.getElementById('stock-history-close')?.addEventListener('click', () => {
      document.getElementById('stock-history-modal').style.display = 'none';
    });

    document.getElementById('stock-history-modal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        e.currentTarget.style.display = 'none';
      }
    });
  }

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  escapeCsv(value) {
    return String(value ?? '').replace(/"/g, '""');
  }

  resetFilters() {
    this.searchQuery = '';
    this.stockFilter = '';
    this.categoryFilter = '';

    const search = document.getElementById('inventory-search');
    const stockFilter = document.getElementById('inventory-stock-filter');
    const categoryFilter = document.getElementById('inventory-category-filter');

    if (search) search.value = '';
    if (stockFilter) stockFilter.value = '';
    if (categoryFilter) categoryFilter.value = '';

    this.filterItems();
  }

  formatCurrency(amount) {
    return window.AppFormatters.formatCurrency(amount);
  }

  formatWholeCurrency(amount) {
    return window.AppFormatters.formatCurrency(amount, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  getInventoryItemValue(item) {
    const quantity = Number(item.quantityOnHand) || 0;
    const costPrice = Number(item.costPrice) || 0;
    const unitPrice = Number(item.price) || 0;
    const valuationPrice = costPrice > 0 ? costPrice : unitPrice;
    return quantity * valuationPrice;
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

// Make globally available
window.InventoryView = InventoryView;
