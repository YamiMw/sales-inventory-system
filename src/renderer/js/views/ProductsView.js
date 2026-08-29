/**
 * Products View Module
 * Manages the product catalog interface including CRUD operations,
 * filtering, pagination, and bulk actions.
 */

class ProductsView {
  constructor() {
    this.products = [];
    this.filteredProducts = [];
    this.categories = [];
    this.categoryRecords = [];
    this.selectedIds = new Set();
    this.currentPage = 1;
    this.perPage = 25;
    this.activeDropdown = null;
    this.editingProduct = null;
    this.searchQuery = '';
    this.categoryFilter = '';
    this.stockFilter = '';
    this.statusFilter = '';
    this.sortBy = 'name';
    this.sortOrder = 'asc';
    this.isLoading = false;
    this.loadError = '';
    this.categoryLoadError = '';
    
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

  async init() {
    this.showLoading();
    await this.loadProducts();
    await this.loadCategories();
    this.filterProducts();
    this.setupEventListeners();
  }

  showLoading() {
    const tbody = document.getElementById('products-tbody');
    if (tbody) {
      tbody.innerHTML = `
        <tr class="loading-row">
          <td colspan="9">
            <div class="loading-state">
              <span class="loading-spinner"><img src="assets/images/icons/custom/refresh_icon.png" alt="" class="custom-ui-icon loading-icon-img" aria-hidden="true"></span>
              <span>Loading products...</span>
            </div>
          </td>
        </tr>
      `;
    }
  }

  async loadProducts() {
    this.loadError = '';

    try {
      if (!window.electronAPI || typeof window.electronAPI.getProducts !== 'function') {
        throw new Error('Product service is unavailable');
      }

      const result = await window.electronAPI.getProducts();
      if (!result?.success || !Array.isArray(result.data)) {
        throw new Error(result?.error || 'Product data could not be loaded');
      }

      this.products = result.data
        .map(product => this.normalizeProduct(product))
        .filter(product => product.id && product.name);
      return true;
    } catch (error) {
      console.error('Failed to load products:', error);
      this.products = [];
      this.loadError = error.message || 'Product data could not be loaded';
      return false;
    }
  }

  normalizeProduct(product) {
    const id = product.id ?? product.productId ?? product.product_id ?? '';
    const taxRate = parseFloat(product.taxRate ?? product.tax_rate ?? 0.10);

    return {
      id: String(id),
      productId: String(product.productId || product.product_id || id || ''),
      name: String(product.name || '').trim(),
      sku: product.sku || '',
      description: product.description || 'No description provided.',
      category: product.category || product.category_name || product.categoryName || 'Uncategorized',
      categoryId: product.categoryId || product.category_id || null,
      price: parseFloat(product.price ?? product.unit_price ?? product.unitPrice) || 0,
      costPrice: parseFloat(product.costPrice ?? product.cost_price ?? product.costPrice) || 0,
      stock: parseInt(product.stock ?? product.quantity_on_hand ?? product.initial_stock) || 0,
      reorderLevel: parseInt(product.reorderLevel ?? product.reorder_level) || 10,
      reorderQuantity: parseInt(product.reorderQuantity ?? product.reorder_quantity) || 50,
      status: product.status || (product.is_active === false ? 'inactive' : 'active'),
      taxRate: Number.isFinite(taxRate) ? (taxRate > 1 ? taxRate / 100 : taxRate) : 0,
      image: product.image || product.image_path || 'assets/images/product-placeholder.png',
      variations: product.variations || [],
      barcode: product.barcode || null,
      unit: product.unit || 'piece',
      location: product.location || product.location_code || 'Main Warehouse',
      supplier: product.supplier || null,
      createdAt: product.createdAt || product.created_at || null,
      updatedAt: product.updatedAt || product.updated_at || null
    };
  }

  async loadCategories() {
    this.categoryLoadError = '';

    try {
      if (!window.electronAPI || typeof window.electronAPI.getCategories !== 'function') {
        throw new Error('Category service is unavailable');
      }

      const result = await window.electronAPI.getCategories();
      if (!result?.success || !Array.isArray(result.data)) {
        throw new Error(result?.error || 'Categories could not be loaded');
      }

      this.categoryRecords = result.data.map(category => this.normalizeCategory(category));
      this.categories = this.categoryRecords.map(category => category.name).sort();
    } catch (error) {
      console.error('Failed to load categories:', error);
      this.categoryLoadError = error.message || 'Categories could not be loaded';
      this.extractCategoriesFromProducts();
      this.showNotification(this.categoryLoadError, 'error');
    }
    if (this.categoryRecords.length === 0) {
      this.extractCategoriesFromProducts();
    }

    this.renderCategoryFilter();
  }

  normalizeCategory(category) {
    if (typeof category === 'string') {
      return {
        id: category,
        name: category,
        description: this.getCategoryDescription(category)
      };
    }

    return {
      id: category.id || category.name,
      name: category.name || 'Uncategorized',
      description: category.description || this.getCategoryDescription(category.name || 'Uncategorized')
    };
  }

  getCategoryDescription(name) {
    const descriptions = {
      Masonry: 'Cement, lime, bricks, and mortar',
      Painting: 'Paints, primers, and finishing supplies',
      Flooring: 'Tiles, boards, carpets, and flooring stock',
      Structural: 'Steel beams, rebar, and framing',
      Plumbing: 'Pipes, taps, drainage, and fixtures',
      Drywall: 'Gypsum boards, partitions, and ceiling stock',
      Hardware: 'Handles, locks, fasteners, and fittings',
      Electrical: 'Breakers, wiring, lighting, and electrical parts',
      Safety: 'Protective equipment and site safety goods',
      'Power Tools': 'Powered tools and equipment',
      Uncategorized: 'Products awaiting classification'
    };

    return descriptions[name] || 'Custom product category';
  }

  extractCategoriesFromProducts() {
    const uniqueCategories = [...new Set(this.products.map(p => p.category))];
    this.categoryRecords = uniqueCategories
      .filter(c => c)
      .sort()
      .map(name => this.normalizeCategory(name));
    this.categories = this.categoryRecords.map(c => c.name);
  }

  filterProducts() {
    this.filteredProducts = this.products.filter(p => {
      const matchesSearch = !this.searchQuery || 
        p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(this.searchQuery.toLowerCase()));
      
      const matchesCategory = !this.categoryFilter || p.category === this.categoryFilter;
      
      const matchesStatus = !this.statusFilter || p.status === this.statusFilter;
      
      let matchesStock = true;
      if (this.stockFilter === 'in') matchesStock = p.stock > (p.reorderLevel || 10);
      if (this.stockFilter === 'low') matchesStock = p.stock > 0 && p.stock <= (p.reorderLevel || 10);
      if (this.stockFilter === 'out') matchesStock = p.stock === 0;
      
      return matchesSearch && matchesCategory && matchesStatus && matchesStock;
    });

    this.sortProducts();
    
    this.currentPage = 1;
    this.selectedIds.clear();
    this.renderTable();
    this.updatePagination();
    this.updateBulkActions();
    this.updateSortIndicators();
    this.updateProductsCount();
  }

  sortProducts() {
    const direction = this.sortOrder === 'asc' ? 1 : -1;

    this.filteredProducts.sort((a, b) => {
      const left = a[this.sortBy];
      const right = b[this.sortBy];

      if (typeof left === 'number' || typeof right === 'number') {
        return (((Number(left) || 0) - (Number(right) || 0)) * direction);
      }

      return String(left || '').localeCompare(String(right || ''), undefined, {
        numeric: true,
        sensitivity: 'base'
      }) * direction;
    });
  }

  updateSortIndicators() {
    document.querySelectorAll('#products-view .sort-btn').forEach(btn => {
      const isActive = btn.dataset.sort === this.sortBy;
      const indicator = btn.querySelector('.sort-indicator');

      btn.classList.toggle('active', isActive);
      if (indicator) {
        const direction = isActive ? this.sortOrder : 'both';
        indicator.dataset.direction = direction;
        indicator.innerHTML = this.getSortIndicatorIcon(direction);
      }
    });

    const sortFilter = document.getElementById('sort-filter');
    if (sortFilter) {
      sortFilter.value = `${this.sortBy}-${this.sortOrder}`;
    }
  }

  getSortIndicatorIcon(direction) {
    const attrs = 'class="sort-indicator-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"';
    if (direction === 'asc') {
      return `<svg ${attrs}><path d="M12 19V5"></path><path d="m7 10 5-5 5 5"></path></svg>`;
    }
    if (direction === 'desc') {
      return `<svg ${attrs}><path d="M12 5v14"></path><path d="m7 14 5 5 5-5"></path></svg>`;
    }
    return `<svg ${attrs}><path d="M8 20V4"></path><path d="m4.6 7.4 3.4-3.4 3.4 3.4"></path><path d="M16 4v16"></path><path d="m12.6 16.6 3.4 3.4 3.4-3.4"></path></svg>`;
  }

  setSort(sortBy) {
    if (this.sortBy === sortBy) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = sortBy;
      this.sortOrder = 'asc';
    }

    this.sortProducts();
    this.renderTable();
    this.updatePagination();
    this.updateBulkActions();
    this.updateSortIndicators();
    this.updateProductsCount();
  }

  getStockStatus(stock, reorderLevel = 10) {
    if (stock === 0) return { class: 'out-of-stock', label: 'Out of Stock', icon: this.iconImage('x-circle', 'inline-icon-img') };
    if (stock <= reorderLevel) return { class: 'low-stock', label: 'Low Stock', icon: this.iconImage('alert-triangle', 'inline-icon-img') };
    return { class: 'in-stock', label: 'In Stock', icon: this.iconImage('check-circle', 'inline-icon-img') };
  }

  renderCategoryFilter() {
    const select = document.getElementById('category-filter');
    if (!select) return;
    
    const currentValue = select.value;
    
    window.TemplateRenderer?.replaceSelectOptions(
      select,
      this.categories.map(cat => ({ value: cat, label: cat })),
      'All Categories'
    );
    
    if (currentValue) {
      select.value = currentValue;
    }
  }

  renderTable() {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;

    if (this.loadError) {
      window.TemplateRenderer?.appendEmptyRow(tbody, 9, 'Unable to load products', this.loadError, 'empty-row');
      return;
    }

    const start = (this.currentPage - 1) * this.perPage;
    const end = start + this.perPage;
    const pageProducts = this.filteredProducts.slice(start, end);

    if (this.isLoading) return;

    if (pageProducts.length === 0) {
      window.TemplateRenderer?.appendEmptyRow(tbody, 9, 'No products found', 'Use Add Product to create the first record.', 'empty-row');
      const state = tbody.querySelector('.app-empty-state');
      if (state) {
        const button = document.createElement('button');
        button.className = 'empty-state-btn';
        button.id = 'empty-add-product';
        button.textContent = 'Add Product';
        button.addEventListener('click', () => this.openAddModal());
        state.appendChild(button);
      }
      return;
    }

    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    const fragment = document.createDocumentFragment();
    pageProducts.forEach(product => {
      const stockStatus = this.getStockStatus(product.stock, product.reorderLevel || 10);
      const description = product.description || 'No description provided.';
      const row = window.TemplateRenderer?.clone('product-table-row-template') || document.createElement('tr');
      row.dataset.productId = product.productId || product.id;
      const idCell = row.querySelector('[data-product-id]');
      if (idCell) {
        idCell.classList.add('product-id');
        idCell.textContent = product.productId || product.id;
      }
      const skuSpan = make('span', { className: 'product-sku', text: product.sku, attrs: { title: product.sku } });
      row.querySelector('[data-sku]')?.replaceChildren(skuSpan);
      const nameContainer = make('div', { className: 'product-name-container' });
      nameContainer.appendChild(make('span', { className: 'product-name', text: product.name }));
      if (product.variations && product.variations.length > 0) {
        nameContainer.appendChild(make('span', { className: 'variant-badge', text: `${product.variations.length} Variants`, attrs: { title: `${product.variations.length} variations` } }));
      }
      row.querySelector('[data-name]')?.replaceChildren(nameContainer);
      row.querySelector('[data-description]')?.replaceChildren(make('span', { className: 'product-description', text: this.truncateText(description, 60), attrs: { title: description } }));
      const categoryCell = row.querySelector('[data-category]');
      categoryCell?.replaceChildren(make('span', { className: 'product-category', text: product.category }));
      if (product.supplier && categoryCell) categoryCell.append(document.createElement('br'), make('small', { className: 'product-supplier', text: product.supplier }));
      const priceCell = row.querySelector('[data-price]');
      priceCell?.replaceChildren(make('span', { className: 'product-price', text: this.formatCurrency(product.price) }));
      if (product.costPrice && priceCell) priceCell.append(document.createElement('br'), make('small', { className: 'product-cost', text: `Cost: ${this.formatCurrency(product.costPrice)}` }));
      row.querySelector('[data-stock]')?.replaceChildren(make('span', { className: `product-stock ${stockStatus.class}`, text: `${product.stock} ${product.unit || 'units'}`, attrs: { title: stockStatus.label } }));
      row.querySelector('[data-status]')?.replaceChildren(make('span', { className: `status-badge ${product.status}`, text: product.status === 'active' ? 'Active' : 'Inactive' }));
      const actions = row.querySelector('[data-actions]');
      if (actions) {
        actions.classList.add('actions-menu');
        actions.replaceChildren(this.createProductActions(product));
      }
      fragment.appendChild(row);
    });
    tbody.replaceChildren(fragment);

    this.attachTableEvents();
  }

  createProductActions(product) {
    const make = window.TemplateRenderer?.make || ((tag, options = {}) => {
      const element = document.createElement(tag);
      if (options.className) element.className = options.className;
      if (options.text !== undefined) element.textContent = String(options.text);
      if (options.dataset) Object.entries(options.dataset).forEach(([key, value]) => { element.dataset[key] = String(value); });
      return element;
    });
    const fragment = document.createDocumentFragment();
    const toggle = make('button', { className: 'action-toggle', text: '⋮', attrs: { title: 'Actions' }, dataset: { id: product.id } });
    const dropdown = make('div', { className: 'actions-dropdown', attrs: { id: `dropdown-${product.id}`, style: 'display: none;' } });
    const addItem = (action, label, iconSrc, className = '') => {
      const button = make('button', { className: `dropdown-item${className ? ` ${className}` : ''}`, dataset: { action, id: product.id } });
      const iconWrap = make('span', { className: 'dropdown-icon' });
      if (iconSrc && window.TemplateRenderer?.icon) iconWrap.appendChild(window.TemplateRenderer.icon(iconSrc, 'custom-ui-icon dropdown-icon-img'));
      button.append(iconWrap, document.createTextNode(` ${label}`));
      dropdown.appendChild(button);
    };
    addItem('view', 'View Details', 'assets/images/icons/custom/eye_icon.svg');
    addItem('edit', 'Edit', 'assets/images/icons/custom/edit_icon.svg');
    addItem('duplicate', 'Duplicate', 'assets/images/icons/custom/copy_icon.svg');
    addItem('stock', 'Stock History', 'assets/images/icons/custom/bar_chart_icon.png');
    dropdown.appendChild(make('div', { className: 'dropdown-divider' }));
    addItem('toggle-status', product.status === 'active' ? 'Deactivate' : 'Activate', product.status === 'active' ? 'assets/images/icons/custom/ban_icon.svg' : 'assets/images/icons/custom/check_status_icon.png', product.status === 'active' ? 'warning' : 'success');
    dropdown.appendChild(make('div', { className: 'dropdown-divider' }));
    addItem('delete', 'Delete', 'assets/images/icons/custom/trash_icon.svg', 'danger');
    fragment.append(toggle, dropdown);
    return fragment;
  }

  renderProductActions(product) {
    const wrapper = document.createElement('div');
    wrapper.appendChild(this.createProductActions(product));
    return wrapper.innerHTML;
  }

  attachTableEvents() {
    this.attachActionToggleEvents();
    this.attachDropdownItemEvents();
  }

  attachCheckboxEvents() {
    document.querySelectorAll('.checkbox-btn').forEach(btn => {
      btn.removeEventListener('click', this.handleCheckboxClick);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.toggleSelect(id);
      });
    });
  }

  attachActionToggleEvents() {
    document.querySelectorAll('.action-toggle').forEach(btn => {
      btn.removeEventListener('click', this.handleActionToggle);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.toggleDropdown(id);
      });
    });
  }

  attachDropdownItemEvents() {
    document.querySelectorAll('.dropdown-item').forEach(item => {
      item.removeEventListener('click', this.handleDropdownItem);
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        const id = item.dataset.id;
        this.handleAction(action, id);
      });
    });
  }

  toggleSelect(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.updateBulkActions();
    
    const btn = document.querySelector(`.checkbox-btn[data-id="${id}"]`);
    if (btn) {
      const isSelected = this.selectedIds.has(id);
      btn.classList.toggle('checked', isSelected);
      btn.replaceChildren();
      if (isSelected && window.TemplateRenderer?.icon) btn.appendChild(window.TemplateRenderer.icon('assets/images/icons/custom/check_status_icon.png', 'custom-ui-icon inline-icon-img')); 
    }
    
    this.updateSelectAllButton();
  }

  selectAll() {
    const pageProducts = this.getCurrentPageProducts();
    
    if (this.areAllPageProductsSelected()) {
      pageProducts.forEach(p => this.selectedIds.delete(p.id));
    } else {
      pageProducts.forEach(p => this.selectedIds.add(p.id));
    }
    
    this.updateBulkActions();
    this.renderTable();
  }

  getCurrentPageProducts() {
    const start = (this.currentPage - 1) * this.perPage;
    const end = start + this.perPage;
    return this.filteredProducts.slice(start, end);
  }

  areAllPageProductsSelected() {
    const pageProducts = this.getCurrentPageProducts();
    return pageProducts.length > 0 && pageProducts.every(p => this.selectedIds.has(p.id));
  }

  updateSelectAllButton() {
    const selectAllBtn = document.getElementById('select-all-products');
    if (selectAllBtn) {
      const allSelected = this.areAllPageProductsSelected();
      selectAllBtn.classList.toggle('checked', allSelected);
      selectAllBtn.replaceChildren();
      if (allSelected && window.TemplateRenderer?.icon) selectAllBtn.appendChild(window.TemplateRenderer.icon('assets/images/icons/custom/check_status_icon.png', 'custom-ui-icon inline-icon-img')); 
    }
  }

  updateBulkActions() {
    const hasSelected = this.selectedIds.size > 0;
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    const bulkUpdatePriceBtn = document.getElementById('bulk-update-price-btn');
    
    if (bulkDeleteBtn) bulkDeleteBtn.disabled = !hasSelected;
    if (bulkUpdatePriceBtn) bulkUpdatePriceBtn.disabled = !hasSelected;
    
    this.updateSelectAllButton();
  }

  updateProductsCount() {
    const countElement = document.getElementById('products-count');
    if (countElement) {
      if (this.filteredProducts.length === 0) {
        countElement.textContent = `Showing 0-0 of 0 products`;
        return;
      }

      const start = (this.currentPage - 1) * this.perPage + 1;
      const end = Math.min(this.currentPage * this.perPage, this.filteredProducts.length);
      const totalText = this.filteredProducts.length === this.products.length
        ? ''
        : ` (${this.products.length} total)`;
      countElement.textContent = `Showing ${start}-${end} of ${this.filteredProducts.length} products${totalText}`;
    }
  }

  toggleDropdown(id) {
    const allDropdowns = document.querySelectorAll('.actions-dropdown');
    allDropdowns.forEach(d => {
      if (d.id !== `dropdown-${id}`) {
        d.style.display = 'none';
      }
    });
    
    if (this.activeDropdown && this.activeDropdown !== id) {
      const prevDropdown = document.getElementById(`dropdown-${this.activeDropdown}`);
      if (prevDropdown) prevDropdown.style.display = 'none';
    }
    
    const dropdown = document.getElementById(`dropdown-${id}`);
    if (dropdown) {
      const isVisible = dropdown.style.display === 'block';
      dropdown.style.display = isVisible ? 'none' : 'block';
      this.activeDropdown = isVisible ? null : id;
    }
  }

  handleAction(action, id) {
    const product = this.products.find(p => p.id === id);
    if (!product) return;

    this.closeAllDropdowns();

    switch (action) {
      case 'view':
        this.viewProduct(product);
        break;
      case 'edit':
        this.editProduct(product);
        break;
      case 'duplicate':
        this.duplicateProduct(product);
        break;
      case 'stock':
        this.viewStockHistory(product);
        break;
      case 'toggle-status':
        this.toggleProductStatus(product);
        break;
      case 'delete':
        this.confirmDelete(product);
        break;
    }
  }

  closeAllDropdowns() {
    document.querySelectorAll('.actions-dropdown').forEach(d => d.style.display = 'none');
    this.activeDropdown = null;
  }

  async viewProduct(product) {
    let details = `📦 ${product.name}\n`;
    details += `${'═'.repeat(50)}\n\n`;
    details += `📋 BASIC INFORMATION\n`;
    details += `${'─'.repeat(50)}\n`;
    details += `SKU: ${product.sku}\n`;
    details += `Category: ${product.category}\n`;
    details += `Supplier: ${product.supplier || 'N/A'}\n`;
    details += `Location: ${product.location || 'N/A'}\n`;
    details += `Unit: ${product.unit || 'piece'}\n\n`;
    
    details += `💰 PRICING\n`;
    details += `${'─'.repeat(50)}\n`;
    details += `Selling Price: ${this.formatCurrency(product.price)}\n`;
    details += `Cost Price: ${this.formatCurrency(product.costPrice)}\n`;
    details += `Profit Margin: ${this.calculateMargin(product.price, product.costPrice)}%\n`;
    details += `Tax Rate: ${(product.taxRate * 100).toFixed(1)}%\n\n`;
    
    details += `📊 INVENTORY\n`;
    details += `${'─'.repeat(50)}\n`;
    details += `Current Stock: ${product.stock} ${product.unit || 'units'}\n`;
    details += `Reorder Level: ${product.reorderLevel} ${product.unit || 'units'}\n`;
    details += `Reorder Quantity: ${product.reorderQuantity} ${product.unit || 'units'}\n`;
    details += `Status: ${product.status}\n\n`;
    
    details += `📝 DESCRIPTION\n`;
    details += `${'─'.repeat(50)}\n`;
    details += `${product.description || 'No description provided.'}\n`;
    
    if (product.variations && product.variations.length > 0) {
      details += `\n🔄 VARIATIONS (${product.variations.length})\n`;
      details += `${'─'.repeat(50)}\n`;
      product.variations.forEach((v, i) => {
        details += `\n${i + 1}. ${v.attribute}: ${v.value}\n`;
        details += `   SKU: ${v.sku} | Price: ${this.formatCurrency(v.price)} | Stock: ${v.stock}\n`;
      });
    }
    
    await window.AppDialogs?.alert(details, {
      title: 'Product Details',
      eyebrow: product.name,
      primaryLabel: 'Close',
      preformatted: true
    });
  }

  calculateMargin(price, cost) {
    if (!price || !cost) return '0.0';
    return (((price - cost) / price) * 100).toFixed(1);
  }

  editProduct(product) {
    this.openAddModal(product);
  }

  async duplicateProduct(product) {
    try {
      if (!window.electronAPI || typeof window.electronAPI.createProduct !== 'function') {
        throw new Error('Product creation service is unavailable');
      }

      const duplicate = {
        ...product,
        name: `${product.name} (Copy)`,
        sku: '',
        barcode: null,
        stock: 0,
        status: 'active'
      };
      const result = await window.electronAPI.createProduct(this.toApiProduct(duplicate));
      if (!result?.success) {
        throw new Error(result?.error || 'Product duplication failed');
      }

      await this.loadProducts();
      this.extractCategoriesFromProducts();
      this.filterProducts();
      this.showNotification(`Product "${product.name}" duplicated successfully`, 'success');
    } catch (error) {
      console.error('Failed to duplicate product:', error);
      this.showNotification(error.message || 'Product duplication failed', 'error');
    }
  }

  async viewStockHistory(product) {
    const modal = document.getElementById('stock-history-modal');
    const tbody = document.getElementById('stock-history-tbody');
    const productName = document.getElementById('stock-history-product-name');
    const productMeta = document.getElementById('stock-history-product-meta');

    if (!modal || !tbody || !productName || !productMeta) return;

    productName.textContent = product.name;
    productMeta.textContent = `SKU: ${product.sku} | Current: ${product.stock} ${product.unit || 'units'} | Location: ${product.location || 'Main Warehouse'}`;
    window.TemplateRenderer?.appendEmptyRow(tbody, 6, 'Loading stock history...', '', 'stock-history-empty');
    modal.style.display = 'flex';

    try {
      if (!window.electronAPI || typeof window.electronAPI.getStockTransactions !== 'function') {
        throw new Error('Stock history service is unavailable');
      }

      const result = await window.electronAPI.getStockTransactions(product.id, { limit: 50 });
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
      notes: (transaction) => transaction.notes || this.formatReference(transaction) || '-'
    });
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

  async toggleProductStatus(product) {
    const newStatus = product.status === 'active' ? 'inactive' : 'active';

    try {
      if (!window.electronAPI || typeof window.electronAPI.updateProduct !== 'function') {
        throw new Error('Product update service is unavailable');
      }

      const result = await window.electronAPI.updateProduct(
        product.id,
        this.toApiProduct({ ...product, status: newStatus })
      );
      if (!result?.success) {
        throw new Error(result?.error || 'Product status update failed');
      }

      await this.loadProducts();
      this.extractCategoriesFromProducts();
      this.filterProducts();
      this.showNotification(`Product "${product.name}" ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
    } catch (error) {
      console.error('Failed to update product status:', error);
      this.showNotification(error.message || 'Product status update failed', 'error');
    }
  }

  async confirmDelete(product) {
    const confirmMessage = `⚠️ Are you sure you want to delete this product?\n\n` +
      `Product: ${product.name}\n` +
      `SKU: ${product.sku}\n` +
      `Current Stock: ${product.stock} ${product.unit || 'units'}\n\n` +
      `This action cannot be undone.`;
    
    const confirmed = await window.AppDialogs?.confirm(confirmMessage, {
      title: 'Delete Product',
      eyebrow: 'Product Catalog',
      primaryLabel: 'Delete Product',
      variant: 'danger'
    });
    if (confirmed) {
      await this.deleteProduct(product.id);
    }
  }

  async deleteProduct(id) {
    const product = this.products.find(p => p.id === id);

    try {
      if (!window.electronAPI || typeof window.electronAPI.deleteProduct !== 'function') {
        throw new Error('Product deletion service is unavailable');
      }

      const result = await window.electronAPI.deleteProduct(id);
      if (!result?.success) {
        throw new Error(result?.error || 'Product deletion failed');
      }

      await this.loadProducts();
      this.selectedIds.delete(id);
      this.extractCategoriesFromProducts();
      this.filterProducts();
      this.showNotification(`Product "${product?.name || 'Unknown'}" deleted`, 'success');
    } catch (error) {
      console.error('Failed to delete product:', error);
      this.showNotification(error.message || 'Product deletion failed', 'error');
    }
  }

  openAddModal(product = null) {
    this.editingProduct = product;
    this.ensureProductModal();
    this.populateProductForm(product);
    document.getElementById('product-form-modal')?.classList.add('show');
    setTimeout(() => document.getElementById('modal-product-name')?.focus(), 50);
  }

  ensureProductModal() {
    const modal = document.getElementById('product-form-modal');
    if (!modal) {
      console.error('Missing #product-form-modal in index.html');
      return;
    }
    if (!modal.dataset.bound) {
      modal.dataset.bound = 'true';
      document.getElementById('close-product-modal')?.addEventListener('click', () => this.closeProductModal());
      document.getElementById('cancel-product-form')?.addEventListener('click', () => this.closeProductModal());
      document.getElementById('product-form')?.addEventListener('submit', (event) => this.handleProductFormSubmit(event));
      modal.addEventListener('click', (event) => {
        if (event.target === modal) this.closeProductModal();
      });
    }
  }

  populateProductForm(product = null) {
    const categorySelect = document.getElementById('modal-product-category');
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">Uncategorized</option>';
      this.categoryRecords.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        categorySelect.appendChild(option);
      });
    }

    document.getElementById('product-form-title').textContent = product ? 'Edit Product' : 'Add New Product';
    document.getElementById('save-product-form').textContent = product ? 'Update Product' : 'Save Product';
    document.getElementById('modal-product-id').value = product?.id || '';
    document.getElementById('modal-product-public-id').value = product?.productId || '';
    document.getElementById('modal-product-name').value = product?.name || '';
    document.getElementById('modal-product-sku').value = product?.sku || '';
    document.getElementById('modal-product-category').value = product?.category || '';
    document.getElementById('modal-product-description').value = product?.description || '';
    document.getElementById('modal-product-price').value = product?.price ?? '';
    document.getElementById('modal-product-cost').value = product?.costPrice ?? '';
    document.getElementById('modal-product-stock').value = product?.stock ?? 0;
    document.getElementById('modal-product-reorder').value = product?.reorderLevel ?? 10;
    document.getElementById('modal-product-status').value = product?.status || 'active';
  }

  closeProductModal() {
    document.getElementById('product-form-modal')?.classList.remove('show');
    this.editingProduct = null;
  }

  async handleProductFormSubmit(event) {
    event.preventDefault();

    const productData = this.getProductFormData();
    if (!productData.name) {
      this.showNotification('Product name is required', 'error');
      return;
    }

    try {
      if (this.editingProduct) {
        await this.saveEditedProduct(productData);
      } else {
        await this.saveNewProduct(productData);
      }

      this.closeProductModal();
    } catch (error) {
      console.error('Failed to save product:', error);
      this.showNotification(error.message || 'Failed to save product', 'error');
    }
  }

  getProductFormData() {
    const categoryName = document.getElementById('modal-product-category')?.value || 'Uncategorized';
    const categoryRecord = this.categoryRecords.find(category => category.name === categoryName);

    return this.normalizeProduct({
      id: document.getElementById('modal-product-id')?.value || '',
      productId: document.getElementById('modal-product-public-id')?.value || '',
      name: document.getElementById('modal-product-name')?.value.trim(),
      sku: document.getElementById('modal-product-sku')?.value.trim(),
      category: categoryName,
      categoryId: categoryRecord?.id || null,
      description: document.getElementById('modal-product-description')?.value.trim(),
      price: document.getElementById('modal-product-price')?.value,
      costPrice: document.getElementById('modal-product-cost')?.value,
      stock: document.getElementById('modal-product-stock')?.value,
      reorderLevel: document.getElementById('modal-product-reorder')?.value,
      unit: this.editingProduct?.unit || 'piece',
      status: document.getElementById('modal-product-status')?.value || 'active'
    });
  }

  async saveNewProduct(productData) {
    if (!window.electronAPI || typeof window.electronAPI.createProduct !== 'function') {
      throw new Error('Product creation service is unavailable');
    }

    const result = await window.electronAPI.createProduct(this.toApiProduct(productData));
    if (!result?.success) {
      throw new Error(result?.error || 'Product creation failed');
    }

    await this.loadProducts();
    this.extractCategoriesFromProducts();
    this.filterProducts();
    this.showNotification(`Product "${productData.name}" added`, 'success');
  }

  async saveEditedProduct(productData) {
    const id = this.editingProduct.id;

    if (!window.electronAPI || typeof window.electronAPI.updateProduct !== 'function') {
      throw new Error('Product update service is unavailable');
    }

    const result = await window.electronAPI.updateProduct(id, this.toApiProduct(productData));
    if (!result?.success) {
      throw new Error(result?.error || 'Product update failed');
    }

    await this.loadProducts();
    this.extractCategoriesFromProducts();
    this.filterProducts();
    this.showNotification(`Product "${productData.name}" updated`, 'success');
  }

  toApiProduct(product) {
    return {
      name: product.name,
      sku: product.sku,
      description: product.description,
      categoryId: product.categoryId,
      categoryName: product.category,
      price: product.price,
      costPrice: product.costPrice,
      stock: product.stock,
      reorderLevel: product.reorderLevel,
      unit: product.unit,
      taxRate: product.taxRate * 100,
      isActive: product.status !== 'inactive',
      credentials: {
        token: localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
      }
    };
  }

  openCategoriesModal() {
    this.ensureCategoryModal();
    this.renderCategoriesModal();
    document.getElementById('category-modal')?.classList.add('show');
    setTimeout(() => document.getElementById('category-name-input')?.focus(), 50);
  }

  ensureCategoryModal() {
    const modal = document.getElementById('category-modal');
    if (!modal) {
      console.error('Missing #category-modal in index.html');
      return;
    }
    if (!modal.dataset.bound) {
      modal.dataset.bound = 'true';
      document.getElementById('close-category-modal')?.addEventListener('click', () => this.closeCategoriesModal());
      document.getElementById('close-category-footer')?.addEventListener('click', () => this.closeCategoriesModal());
      document.getElementById('category-form')?.addEventListener('submit', (event) => this.handleCategorySubmit(event));
      modal.addEventListener('click', (event) => {
        if (event.target === modal) this.closeCategoriesModal();
      });
    }
  }

  closeCategoriesModal() {
    document.getElementById('category-modal')?.classList.remove('show');
  }

  renderCategoriesModal() {
    const list = document.getElementById('category-list');
    const total = document.getElementById('category-total-count');
    if (!list || !total) return;

    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    total.textContent = `${this.categoryRecords.length} Total`;
    const fragment = document.createDocumentFragment();
    this.categoryRecords.forEach(category => {
      const count = this.products.filter(product => product.category === category.name).length;
      const article = make('article', { className: 'category-list-item' });
      const details = make('div');
      details.append(make('h3', { text: category.name }), make('p', { text: category.description || 'Custom product category' }));
      const countBox = make('div', { className: 'category-product-count' });
      countBox.append(make('strong', { text: count }), make('span', { text: 'Products' }));
      article.append(details, countBox);
      fragment.appendChild(article);
    });
    list.replaceChildren(fragment);
  }

  async handleCategorySubmit(event) {
    event.preventDefault();

    const nameInput = document.getElementById('category-name-input');
    const descriptionInput = document.getElementById('category-description-input');
    const name = nameInput?.value.trim();
    const description = descriptionInput?.value.trim() || 'Custom product category';

    if (!name) {
      this.showNotification('Category name is required', 'error');
      return;
    }

    if (this.categoryRecords.some(category => category.name.toLowerCase() === name.toLowerCase())) {
      this.showNotification('Category already exists', 'warning');
      return;
    }

    if (!window.electronAPI || typeof window.electronAPI.createCategory !== 'function') {
      this.showNotification('Category creation service is unavailable', 'error');
      return;
    }

    let newCategory;
    try {
      const result = await window.electronAPI.createCategory({ name, description });
      if (!result?.success) {
        throw new Error(result?.error || 'Category creation failed');
      }
      newCategory = this.normalizeCategory(result.data);
    } catch (error) {
      console.error('Failed to create category:', error);
      this.showNotification(error.message || 'Category creation failed', 'error');
      return;
    }

    this.categoryRecords.push(newCategory);
    this.categoryRecords.sort((a, b) => a.name.localeCompare(b.name));
    this.categories = this.categoryRecords.map(category => category.name);
    this.renderCategoryFilter();
    if (document.getElementById('product-form-modal')) {
      this.populateProductForm(this.editingProduct);
    }
    this.renderCategoriesModal();
    nameInput.value = '';
    descriptionInput.value = '';
    nameInput.focus();
    this.showNotification(`Category "${newCategory.name}" created`, 'success');
  }

  openQuickAddModal() {
    this.openAddModal();
  }

  setupEventListeners() {
    let searchTimeout;
    document.getElementById('product-search')?.addEventListener('input', (event) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.searchQuery = event.target.value;
        this.filterProducts();
      }, 300);
    });

    document.getElementById('category-filter')?.addEventListener('change', (event) => {
      this.categoryFilter = event.target.value;
      this.filterProducts();
    });

    document.getElementById('stock-filter')?.addEventListener('change', (event) => {
      this.stockFilter = event.target.value;
      this.filterProducts();
    });

    document.getElementById('status-filter')?.addEventListener('change', (event) => {
      this.statusFilter = event.target.value;
      this.filterProducts();
    });

    document.querySelectorAll('#products-view .sort-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.setSort(button.dataset.sort);
      });
    });

    document.getElementById('sort-filter')?.addEventListener('change', (event) => {
      const [sortBy, sortOrder] = event.target.value.split('-');
      this.sortBy = sortBy;
      this.sortOrder = sortOrder;
      this.sortProducts();
      this.renderTable();
      this.updatePagination();
      this.updateBulkActions();
      this.updateSortIndicators();
      this.updateProductsCount();
    });

    document.getElementById('categories-btn')?.addEventListener('click', () => {
      this.openCategoriesModal();
    });

    document.getElementById('export-products-btn')?.addEventListener('click', () => {
      this.exportProducts();
    });

    document.getElementById('add-product-btn')?.addEventListener('click', () => {
      this.openAddModal();
    });

    document.getElementById('clear-product-filters')?.addEventListener('click', () => {
      this.clearFilters();
    });

    document.getElementById('refresh-products')?.addEventListener('click', async () => {
      this.showLoading();
      const loaded = await this.loadProducts();
      await this.loadCategories();
      this.filterProducts();
      if (loaded) this.showNotification('Products refreshed', 'success');
    });

    document.getElementById('per-page-select')?.addEventListener('change', (event) => {
      this.perPage = parseInt(event.target.value, 10);
      this.currentPage = 1;
      this.renderTable();
      this.updatePagination();
      this.updateProductsCount();
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.actions-menu')) {
        this.closeAllDropdowns();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key === 'f') {
        event.preventDefault();
        document.getElementById('product-search')?.focus();
      }
      if (event.ctrlKey && event.key === 'n') {
        event.preventDefault();
        this.openAddModal();
      }
      if (event.key === 'Escape') {
        this.closeAllDropdowns();
        this.closeProductModal();
        this.closeCategoriesModal();
      }
    });
  }

  clearFilters() {
    this.searchQuery = '';
    this.categoryFilter = '';
    this.stockFilter = '';
    this.statusFilter = '';
    this.sortBy = 'name';
    this.sortOrder = 'asc';
    this.currentPage = 1;
    this.selectedIds.clear();

    const productSearch = document.getElementById('product-search');
    const categoryFilter = document.getElementById('category-filter');
    const stockFilter = document.getElementById('stock-filter');
    const statusFilter = document.getElementById('status-filter');
    const sortFilter = document.getElementById('sort-filter');

    if (productSearch) productSearch.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (stockFilter) stockFilter.value = '';
    if (statusFilter) statusFilter.value = '';
    if (sortFilter) sortFilter.value = 'name-asc';

    this.filterProducts();
  }

  updatePagination() {
    const totalPages = Math.ceil(this.filteredProducts.length / this.perPage);
    const container = document.getElementById('products-pagination');
    if (!container) return;

    window.TemplateRenderer?.renderPagination(container, totalPages, this.currentPage, (page) => {
      const total = Math.ceil(this.filteredProducts.length / this.perPage);
      if (page === 'prev') this.currentPage = Math.max(1, this.currentPage - 1);
      else if (page === 'next') this.currentPage = Math.min(total, this.currentPage + 1);
      else this.currentPage = parseInt(page, 10);
      this.renderTable();
      this.updatePagination();
      this.updateProductsCount();
    }, { arrows: true, maxVisible: 5 });
  }

  exportProducts() {
    if (this.loadError) {
      this.showNotification('Products cannot be exported while their data is unavailable', 'error');
      return;
    }

    const headers = ['Product ID', 'SKU', 'Name', 'Description', 'Category', 'Price', 'Cost', 'Stock', 'Status'];
    const rows = this.filteredProducts.map(p => [
      p.productId,
      p.sku,
      p.name,
      p.description,
      p.category,
      p.price,
      p.costPrice,
      p.stock,
      p.status
    ]);
    
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.showNotification(`${this.filteredProducts.length} products exported`, 'success');
  }

  async bulkDelete() {
    const count = this.selectedIds.size;
    if (count === 0) return;

    const confirmed = await window.AppDialogs?.confirm(
      `Delete ${count} selected products? This action cannot be undone.`,
      {
        title: 'Delete Selected Products',
        eyebrow: 'Bulk Action',
        primaryLabel: 'Delete Products',
        variant: 'danger'
      }
    );
    if (!confirmed) return;

    if (!window.electronAPI || typeof window.electronAPI.deleteProduct !== 'function') {
      this.showNotification('Product deletion service is unavailable', 'error');
      return;
    }

    let deletedCount = 0;
    try {
      for (const id of this.selectedIds) {
        const result = await window.electronAPI.deleteProduct(id);
        if (!result?.success) {
          throw new Error(result?.error || `Deletion stopped after ${deletedCount} products`);
        }
        deletedCount += 1;
      }

      await this.loadProducts();
      this.selectedIds.clear();
      this.extractCategoriesFromProducts();
      this.filterProducts();
      this.showNotification(`${count} products deleted`, 'success');
    } catch (error) {
      console.error('Bulk product deletion failed:', error);
      await this.loadProducts();
      this.selectedIds.clear();
      this.extractCategoriesFromProducts();
      this.filterProducts();
      this.showNotification(error.message || 'Bulk product deletion failed', 'error');
    }
  }

  async bulkUpdatePrice() {
    const count = this.selectedIds.size;
    if (count === 0) return;
    
    const percentage = await window.AppDialogs?.prompt(
      `Update price for ${count} products.\nEnter a percentage change using + for increase or - for decrease.`,
      {
        title: 'Bulk Price Update',
        eyebrow: 'Product Catalog',
        inputLabel: 'Percentage Change',
        defaultValue: '0',
        placeholder: 'Example: 5 or -10',
        primaryLabel: 'Update Prices'
      }
    );
    if (percentage === null) return;
    
    const percentChange = parseFloat(percentage);
    if (isNaN(percentChange)) {
      this.showNotification('Invalid percentage', 'error');
      return;
    }
    
    if (!window.electronAPI || typeof window.electronAPI.updateProduct !== 'function') {
      this.showNotification('Product update service is unavailable', 'error');
      return;
    }

    const multiplier = 1 + (percentChange / 100);
    const selectedProducts = this.products.filter(product => this.selectedIds.has(product.id));
    let updatedCount = 0;

    try {
      for (const product of selectedProducts) {
        const newPrice = parseFloat((product.price * multiplier).toFixed(2));
        const result = await window.electronAPI.updateProduct(
          product.id,
          this.toApiProduct({ ...product, price: newPrice })
        );
        if (!result?.success) {
          throw new Error(result?.error || `Price update stopped after ${updatedCount} products`);
        }
        updatedCount += 1;
      }

      await this.loadProducts();
      this.selectedIds.clear();
      this.extractCategoriesFromProducts();
      this.filterProducts();
      this.showNotification(`${count} products updated by ${percentChange > 0 ? '+' : ''}${percentChange}%`, 'success');
    } catch (error) {
      console.error('Bulk price update failed:', error);
      await this.loadProducts();
      this.selectedIds.clear();
      this.extractCategoriesFromProducts();
      this.filterProducts();
      this.showNotification(error.message || 'Bulk price update failed', 'error');
    }
  }

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  formatCurrency(amount) {
    return window.AppFormatters.formatCurrency(amount);
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

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductsView;
}
