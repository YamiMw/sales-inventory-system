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
    
    select.innerHTML = '<option value="">All Categories</option>';
    this.categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
    });
    select.value = this.categoryFilter;
  }

  renderTable() {
    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;

    if (this.loadError) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 60px;">
            <p style="color: #b91c1c; margin: 0 0 8px;">Unable to load inventory</p>
            <p style="color: #64748b; margin: 0;">${this.escapeHtml(this.loadError)}</p>
          </td>
        </tr>
      `;
      return;
    }

    const start = (this.currentPage - 1) * this.perPage;
    const end = start + this.perPage;
    const pageItems = this.filteredItems.slice(start, end);

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 60px;">
            <span class="empty-inventory-icon"><img src="assets/images/icons/custom/clipboard_tasks_icon.png" alt="" class="custom-ui-icon empty-state-icon-img" aria-hidden="true"></span>
            <p style="color: #64748b; margin-top: 16px;">No inventory items found</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageItems.map(item => {
      const available = item.quantityOnHand - item.quantityReserved;
      const status = this.getStockStatus(available, item.reorderLevel);
      
      return `
        <tr>
          <td><span class="product-sku">${this.escapeHtml(item.sku)}</span></td>
          <td><span class="product-name">${this.escapeHtml(item.name)}</span></td>
          <td><span class="product-description" title="${this.escapeHtml(item.description)}">${this.escapeHtml(item.description)}</span></td>
          <td><span class="product-category">${this.escapeHtml(item.category)}</span></td>
          <td><span class="stock-value positive">${item.quantityOnHand}</span></td>
          <td><span class="stock-value ${item.quantityReserved > 0 ? 'negative' : 'zero'}">${item.quantityReserved}</span></td>
          <td><span class="stock-value ${available > 0 ? 'positive' : 'negative'}">${available}</span></td>
          <td><span style="font-weight: 600;">${item.reorderLevel}</span></td>
          <td><span class="stock-level-badge ${status.class}">${status.label}</span></td>
          <td>
            <button class="action-btn-inventory primary" data-action="adjust" data-id="${item.id}" title="Adjust Stock"><img src="assets/images/icons/custom/bar_chart_icon.png" alt="" class="custom-ui-icon action-icon-img" aria-hidden="true"></button>
            <button class="action-btn-inventory" data-action="history" data-id="${item.id}" title="Stock History"><img src="assets/images/icons/custom/clipboard_tasks_icon.png" alt="" class="custom-ui-icon action-icon-img" aria-hidden="true"></button>
          </td>
        </tr>
      `;
    }).join('');

    this.decorateActionMenus(tbody);
    this.attachTableEvents();
  }

  decorateActionMenus(tbody) {
    tbody.querySelectorAll('[data-action="adjust"]').forEach(adjustBtn => {
      const cell = adjustBtn.closest('td');
      const historyBtn = cell?.querySelector('[data-action="history"]');
      if (!cell || !historyBtn) return;

      const productId = this.escapeHtml(adjustBtn.dataset.id);
      cell.className = 'inventory-actions-cell';
      cell.innerHTML = `
        <div class="inventory-actions">
          <button type="button" class="inventory-action-trigger" data-action-menu="${productId}" aria-haspopup="true" aria-expanded="false" title="Actions">
            <span aria-hidden="true">&#8942;</span>
          </button>
          <div class="inventory-action-menu" role="menu">
            <button type="button" data-action="adjust" data-id="${productId}" role="menuitem">Adjust Stock</button>
            <button type="button" data-action="history" data-id="${productId}" role="menuitem">Stock History</button>
          </div>
        </div>
      `;
    });
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
    tbody.innerHTML = '<tr><td colspan="6" class="stock-history-empty">Loading stock history...</td></tr>';
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
      tbody.innerHTML = `<tr><td colspan="6" class="stock-history-empty">${this.escapeHtml(error.message || 'Failed to load stock history')}</td></tr>`;
      this.showNotification(error.message || 'Failed to load stock history', 'error');
    }
  }

  renderStockHistoryRows(tbody, history) {
    if (!history || history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="stock-history-empty">No stock movements yet</td></tr>';
      return;
    }

    tbody.innerHTML = history.map(transaction => {
      const quantity = Number(transaction.quantity) || 0;
      const changeClass = quantity >= 0 ? 'positive' : 'negative';
      const reference = transaction.reference_text || this.formatReference(transaction);
      const notes = [reference, transaction.notes].filter(Boolean).join(' | ') || '-';

      return `
        <tr>
          <td>${this.escapeHtml(this.formatDateTime(transaction.created_at))}</td>
          <td><span class="stock-history-type">${this.escapeHtml(this.formatTransactionType(transaction.transaction_type))}</span></td>
          <td><span class="stock-history-change ${changeClass}">${this.formatQuantityChange(quantity)}</span></td>
          <td>${this.formatOptionalNumber(transaction.quantity_before)}</td>
          <td>${this.formatOptionalNumber(transaction.quantity_after)}</td>
          <td class="stock-history-notes" title="${this.escapeHtml(notes)}">${this.escapeHtml(notes)}</td>
        </tr>
      `;
    }).join('');
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
    if (!container || totalPages <= 1) {
      if (container) container.innerHTML = '';
      return;
    }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    container.innerHTML = html;

    container.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentPage = parseInt(btn.dataset.page);
        this.renderTable();
        this.updatePagination();
      });
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
      console.log(`[${type}] ${message}`);
    }
  }
}

// Make globally available
window.InventoryView = InventoryView;
