/**
 * Dashboard View
 * Controls data loading and interactions for the dashboard screen.
 */

function Dashboard() {
  this.chart = null;
  this.categoryChart = null;
  this.init();
}

Dashboard.prototype.init = function() {
  this.updateHeader();
  this.setupListeners();
  this.headerTimer = setInterval(this.updateHeader.bind(this), 60000);
};

Dashboard.prototype.updateHeader = function() {
  var user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch(e) {}
  
  var nameEl = document.getElementById('dash-user-name');
  if (nameEl) nameEl.textContent = user.fullName || user.username || 'Admin';
  
  var dateEl = document.getElementById('dash-current-date');
  if (dateEl) {
    dateEl.textContent = window.AppFormatters && window.AppFormatters.formatDate
      ? window.AppFormatters.formatDate(new Date())
      : new Date().toLocaleDateString();
  }
};

Dashboard.prototype.loadDashboardData = function() { this.loadData(); };
Dashboard.prototype.loadChartData = function() { this.loadChart(); };

Dashboard.prototype.loadData = function() {
  var self = this;
  this.showStatsError('Loading dashboard statistics...');

  if (window.electronAPI && typeof window.electronAPI.getDashboardStats === 'function') {
    window.electronAPI.getDashboardStats().then(function(resp) {
      if (resp && resp.success && resp.data) {
        self.updateCards({
          today: { sales: resp.data.today.sales || 0, transactions: resp.data.today.transactions || 0 },
          month: { sales: resp.data.month.sales || 0, transactions: resp.data.month.transactions || 0 },
          lowStock: resp.data.lowStock || 0,
          totalProducts: resp.data.totalProducts || 0,
          inventoryValue: resp.data.inventoryValue,
          totalCustomers: resp.data.totalCustomers || 0,
          pendingOrders: resp.data.pendingQuotes || 0,
          staffCount: resp.data.staffCount || 0
        });
      } else {
        self.showStatsError((resp && resp.error) || 'Dashboard statistics are unavailable.');
      }

      self.renderRecentSold();
      self.renderLowStock();
      self.renderRecentTransactions();
      self.loadChart();
    }).catch(function(error) {
      console.error('Failed to load dashboard statistics:', error);
      self.showStatsError(error.message || 'Dashboard statistics are unavailable.');
      self.renderRecentSold();
      self.renderLowStock();
      self.renderRecentTransactions();
      self.loadChart();
    });
  } else {
    this.showStatsError('Dashboard service is unavailable.');
    this.renderRecentSold();
    this.renderLowStock();
    this.renderRecentTransactions();
    this.loadChart();
  }
};

Dashboard.prototype.updateCards = function(s) {
  function fmt(v) { return window.AppFormatters.formatCurrency(v); }
  function set(id, val) { var el = document.getElementById(id); if (el) el.textContent = String(val); }
  
  set('dash-today-sales', fmt(s.today.sales));
  set('dash-today-transactions', (s.today.transactions || 0) + ' transactions');
  set('dash-month-sales', fmt(s.month.sales));
  set('dash-month-transactions', (s.month.transactions || 0) + ' transactions');
  set('dash-low-stock', s.lowStock);
  set('dash-products', s.totalProducts);
  var inventoryValueElement = document.getElementById('dash-inventory-value');
  if (inventoryValueElement) {
    var inventoryValueAvailable = s.inventoryValue !== null && s.inventoryValue !== undefined;
    inventoryValueElement.textContent = inventoryValueAvailable ? fmt(s.inventoryValue) : 'Unavailable';
    inventoryValueElement.title = inventoryValueAvailable
      ? 'Verified inventory cost value'
      : 'Inventory value is unavailable because one or more stocked products have no verified cost price.';
  }
  set('dash-customers', s.totalCustomers);
  set('dash-pending-orders', s.pendingOrders);
  set('dash-staff', s.staffCount);
};

Dashboard.prototype.showStatsError = function(message) {
  [
    'dash-today-sales',
    'dash-month-sales',
    'dash-low-stock',
    'dash-products',
    'dash-inventory-value',
    'dash-customers',
    'dash-pending-orders',
    'dash-staff'
  ].forEach(function(id) {
    var element = document.getElementById(id);
    if (element) {
      element.textContent = '--';
      element.title = message;
    }
  });

  ['dash-today-transactions', 'dash-month-transactions'].forEach(function(id) {
    var element = document.getElementById(id);
    if (element) {
      element.textContent = message;
      element.title = message;
    }
  });
};

Dashboard.prototype.escapeHtml = function(text) {
  if (text === null || text === undefined) return '';
  var div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
};

Dashboard.prototype.formatCurrency = function(value) {
  return window.AppFormatters.formatCurrency(value || 0);
};

Dashboard.prototype.openView = function(view) {
  if (window.app && typeof window.app.navigateTo === 'function') {
    window.app.navigateTo(view);
    return;
  }

  var target = document.querySelector('[data-view="' + view + '"]');
  if (target) target.click();
};

Dashboard.prototype.getSaleItemSummary = function(sale) {
  if (sale.item_summary) return sale.item_summary;
  if (Array.isArray(sale.items) && sale.items.length) {
    return sale.items.map(function(item) {
      var name = item.product_name || item.name || item.sku || 'Item';
      var quantity = parseInt(item.quantity, 10) || 0;
      return name + ' x' + quantity;
    }).join(', ');
  }
  return (sale.item_count || 0) + ' items sold';
};

Dashboard.prototype.getSaleItemRows = function(sales) {
  var rows = [];
  (sales || []).forEach(function(sale) {
    (sale.items || []).forEach(function(item) {
      var quantity = parseInt(item.quantity, 10) || 0;
      var unitPrice = parseFloat(item.unit_price || item.price || 0) || 0;
      var lineTotal = parseFloat(item.total_price || 0) || (unitPrice * quantity);
      rows.push({
        saleId: sale.id,
        saleNumber: sale.invoice_number || sale.invoice || (sale.id ? String(sale.id) : '-'),
        productName: item.product_name || item.name || item.sku || 'Item',
        sku: item.sku || '',
        quantity: quantity,
        total: lineTotal
      });
    });
  });
  return rows;
};

Dashboard.prototype.renderRecentSold = function() {
  var listContainer = document.getElementById('recently-sold-list');
  if (!listContainer) return;

  var self = this;
  listContainer.innerHTML = '<div class="empty">Loading recent sales...</div>';

  if (window.electronAPI && typeof window.electronAPI.getSales === 'function') {
    window.electronAPI.getSales({ limit: 5, order: 'desc' }).then(function(res) {
      if (res && res.success && Array.isArray(res.data) && res.data.length) {
        var rows = self.getSaleItemRows(res.data).slice(0, 5);
        if (!rows.length) {
          listContainer.innerHTML = '<div class="empty">No sold products recorded yet.</div>';
          return;
        }

        listContainer.innerHTML = rows.map(function(row) {
          return '<button type="button" class="recent-sale-item" data-sale-id="' + self.escapeHtml(row.saleId) + '">' +
            '<span class="recent-sale-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg></span>' +
            '<span class="recent-sale-main" title="' + self.escapeHtml(row.productName) + '">' +
              '<strong>' + self.escapeHtml(row.productName) + '</strong>' +
              '<small>Qty ' + self.escapeHtml(row.quantity) + (row.sku ? ' - ' + self.escapeHtml(row.sku) : '') + '</small>' +
            '</span>' +
            '<strong class="recent-sale-total">' + self.formatCurrency(row.total) + '</strong>' +
          '</button>';
        }).join('');
      } else if (res && res.success && Array.isArray(res.data)) {
        listContainer.innerHTML = '<div class="empty">No sales recorded yet.</div>';
      } else {
        listContainer.innerHTML = '<div class="empty">Unable to load recent sales.</div>';
      }
    }).catch(function() {
      listContainer.innerHTML = '<div class="empty">Unable to load recent sales.</div>';
    });
  } else {
    listContainer.innerHTML = '<div class="empty">Sales service is unavailable.</div>';
  }
};

Dashboard.prototype.renderLowStock = function() {
  var listContainer = document.getElementById('low-stock-list');
  if (!listContainer) return;

  var self = this;
  listContainer.innerHTML = '<div class="empty">Loading low stock products...</div>';

  if (window.electronAPI && typeof window.electronAPI.getLowStock === 'function') {
    window.electronAPI.getLowStock().then(function(res) {
      if (res && res.success && Array.isArray(res.data) && res.data.length) {
        listContainer.innerHTML = res.data.slice(0, 5).map(function(item) {
          var available = parseInt(item.available_stock ?? item.availableStock ?? item.quantity_on_hand ?? 0, 10) || 0;
          var reorder = parseInt(item.reorder_level ?? item.reorderLevel ?? 0, 10) || 0;
          var shortage = Math.max(reorder - available, 0);
          var statusText = available <= 0 ? 'Out of stock' : 'Below reorder';

          return '<button type="button" class="low-stock-alert-item" data-product-id="' + self.escapeHtml(item.id) + '">' +
            '<span class="low-stock-alert-icon">' + (available <= 0 ? '!' : '-') + '</span>' +
            '<span class="low-stock-alert-main" title="' + self.escapeHtml(item.name || 'Unnamed product') + '">' +
              '<strong>' + self.escapeHtml(item.name || 'Unnamed product') + '</strong>' +
              '<small>' + self.escapeHtml(item.sku || 'No SKU') + ' - ' + statusText + '</small>' +
            '</span>' +
            '<span class="low-stock-alert-counts">' +
              '<strong>' + self.escapeHtml(available) + ' available</strong>' +
              '<small>Reorder ' + self.escapeHtml(reorder) + (shortage ? ' - Need ' + self.escapeHtml(shortage) : '') + '</small>' +
            '</span>' +
          '</button>';
        }).join('');
      } else if (res && res.success && Array.isArray(res.data)) {
        listContainer.innerHTML = '<div class="empty">All products are above reorder level.</div>';
      } else {
        listContainer.innerHTML = '<div class="empty">Unable to load low stock products.</div>';
      }
    }).catch(function() {
      listContainer.innerHTML = '<div class="empty">Unable to load low stock products.</div>';
    });
  } else {
    listContainer.innerHTML = '<div class="empty">Low stock service is unavailable.</div>';
  }
};

Dashboard.prototype.renderRecentTransactions = function() {
  var tbody = document.getElementById('transactions-table');
  if (!tbody) return;

  var self = this;
  tbody.innerHTML = '<tr><td colspan="6">Loading recent sales...</td></tr>';

  if (window.electronAPI && typeof window.electronAPI.getSales === 'function') {
    window.electronAPI.getSales({ limit: 8, order: 'desc' }).then(function(res) {
      if (res && res.success && Array.isArray(res.data)) {
        if (!res.data.length) {
          tbody.innerHTML = '<tr><td colspan="6">No sales recorded yet.</td></tr>';
          return;
        }

        tbody.innerHTML = res.data.map(function(sale) {
          var timestamp = sale.created_at || sale.createdAt;
          var time = timestamp
            ? (window.AppFormatters?.formatTime(timestamp)
              || new Date(timestamp).toLocaleTimeString())
            : '-';
          var saleNumber = self.escapeHtml(sale.invoice_number || sale.invoice || (sale.id ? String(sale.id) : '-'));
          var customer = self.escapeHtml(sale.customer || sale.customer_name || 'Walk-in Customer');
          var items = self.escapeHtml(self.getSaleItemSummary(sale));
          var total = self.formatCurrency(sale.total_amount || sale.total || 0);
          var status = self.escapeHtml((sale.payment_status || sale.status || 'completed').toUpperCase());

          return '<tr class="sales-link-row" data-sale-id="' + self.escapeHtml(sale.id) + '">' +
            '<td>' + time + '</td>' +
            '<td style="font-weight:800">' + saleNumber + '</td>' +
            '<td>' + customer + '</td>' +
            '<td>' + items + '</td>' +
            '<td style="font-weight:800">' + total + '</td>' +
            '<td><span class="status-pill">' + status + '</span></td>' +
          '</tr>';
        }).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="6">Unable to load recent sales.</td></tr>';
      }
    }).catch(function() {
      tbody.innerHTML = '<tr><td colspan="6">Unable to load recent sales.</td></tr>';
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="6">Sales service is unavailable.</td></tr>';
  }
};

Dashboard.prototype.loadChart = function() {
  var canvas = document.getElementById('dash-sales-chart');
  var categoryCanvas = document.getElementById('dash-category-chart');
  if (!canvas) return;

  // Determine period from the date-filter button (added menu) or fall back to last7days
  var dateFilterBtn = document.querySelector('.date-filter');
  var period = (dateFilterBtn && dateFilterBtn.dataset && dateFilterBtn.dataset.period) ? dateFilterBtn.dataset.period : 'last7days';

  var self = this;
  // Try to fetch chart data from electron main
  if (window.electronAPI && typeof window.electronAPI.getSalesChartData === 'function') {
    window.electronAPI.getSalesChartData(period).then(function(resp) {
      if (resp && resp.success && resp.data) {
        var labels = resp.data.labels || [];
        var data = resp.data.sales || [];
        var chartData = {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: 'Sales revenue',
              data: data
            }]
          }
        };

        if (!self.chart) {
          self.chart = new OfflineChart(canvas, chartData);
        } else {
          self.chart.data = chartData.data;
          self.chart.type = chartData.type;
          self.chart.draw();
        }

        var categorySales = resp.data.categorySales || {};
        var categoryLabels = categorySales.labels || [];
        var categoryValues = categorySales.sales || [];
        var categoryChartData = {
          type: 'pie',
          data: {
            labels: categoryLabels,
            datasets: [{
              label: 'Sales by category',
              data: categoryValues,
              backgroundColor: categorySales.colors || []
            }]
          }
        };
        if (categoryCanvas) {
          if (!self.categoryChart) {
            self.categoryChart = new OfflineChart(categoryCanvas, categoryChartData);
          } else {
            self.categoryChart.data = categoryChartData.data;
            self.categoryChart.type = categoryChartData.type;
            self.categoryChart.draw();
          }
        }

        self.updateChartTitle(period, resp.data.rangeLabel);
        self.showChartState(
          labels.length && data.some(function(value) { return Number(value) !== 0; }) ? '' : 'No sales data available',
          'Sales data will appear here once available.'
        );
        self.showCategoryChartState(
          categoryLabels.length && categoryValues.some(function(value) { return Number(value) > 0; })
            ? ''
            : 'No category sales',
          'Category shares will appear after products are sold.'
        );
      } else {
        self.clearChart(canvas);
        self.clearCategoryChart(categoryCanvas);
        self.showChartState('Unable to load sales chart', (resp && resp.error) || 'Chart data is unavailable.');
        self.showCategoryChartState(
          'Unable to load category sales',
          (resp && resp.error) || 'Category data is unavailable.'
        );
      }

      // ensure resize
      requestAnimationFrame(function() {
        if (self.chart && typeof self.chart.resize === 'function') self.chart.resize();
        if (self.categoryChart && typeof self.categoryChart.resize === 'function') self.categoryChart.resize();
      });
      setTimeout(function() {
        if (self.chart && typeof self.chart.resize === 'function') self.chart.resize();
        if (self.categoryChart && typeof self.categoryChart.resize === 'function') self.categoryChart.resize();
      }, 120);
    }).catch(function(err) {
      console.error('Error loading chart:', err);
      self.clearChart(canvas);
      self.clearCategoryChart(categoryCanvas);
      self.showChartState('Unable to load sales chart', err.message || 'Chart data is unavailable.');
      self.showCategoryChartState(
        'Unable to load category sales',
        err.message || 'Category data is unavailable.'
      );
    });
  } else {
    this.clearChart(canvas);
    this.clearCategoryChart(categoryCanvas);
    this.showChartState('Unable to load sales chart', 'Chart service is unavailable.');
    this.showCategoryChartState('Unable to load category sales', 'Chart service is unavailable.');
  }
};

Dashboard.prototype.clearChart = function(canvas) {
  var data = { labels: [], datasets: [{ data: [] }] };
  if (!this.chart) {
    this.chart = new OfflineChart(canvas, { type: 'line', data: data });
  } else {
    this.chart.data = data;
    this.chart.type = 'line';
    this.chart.draw();
  }
};

Dashboard.prototype.showChartState = function(title, message) {
  var state = document.getElementById('empty-chart');
  if (!state) return;

  var heading = state.querySelector('h4');
  var detail = state.querySelector('p');
  if (heading) heading.textContent = title || '';
  if (detail) detail.textContent = message || '';
  state.classList.toggle('show', Boolean(title));
};

Dashboard.prototype.clearCategoryChart = function(canvas) {
  if (!canvas) return;
  var data = { labels: [], datasets: [{ data: [], backgroundColor: [] }] };
  if (!this.categoryChart) {
    this.categoryChart = new OfflineChart(canvas, { type: 'pie', data: data });
  } else {
    this.categoryChart.data = data;
    this.categoryChart.type = 'pie';
    this.categoryChart.draw();
  }
};

Dashboard.prototype.showCategoryChartState = function(title, message) {
  var state = document.getElementById('empty-category-chart');
  if (!state) return;

  var heading = state.querySelector('h4');
  var detail = state.querySelector('p');
  if (heading) heading.textContent = title || '';
  if (detail) detail.textContent = message || '';
  state.classList.toggle('show', Boolean(title));
};

Dashboard.prototype.setupListeners = function() {
  var self = this;

  document.querySelectorAll('.chart-box').forEach(function(chartBox) {
    chartBox.addEventListener('click', function() {
      self.openView('sales');
    });
  });

  document.getElementById('recently-sold-list')?.addEventListener('click', function(event) {
    if (event.target.closest('.recent-sale-item')) {
      self.openView('sales');
    }
  });

  document.getElementById('low-stock-list')?.addEventListener('click', function(event) {
    if (event.target.closest('.low-stock-alert-item')) {
      self.openView('inventory');
    }
  });

  document.getElementById('transactions-table')?.addEventListener('click', function(event) {
    if (event.target.closest('.sales-link-row')) {
      self.openView('sales');
    }
  });

  var tabs = document.querySelectorAll('.dash-chart-tab');
  tabs.forEach(function(btn) {
    btn.addEventListener('click', function() {
      tabs.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      self.loadChart();
    });
  });

  // Date filter dropdown for chart (last7days/month/year)
  var dateFilterBtn = document.querySelector('.date-filter');
  if (dateFilterBtn) {
    // initialize default period if not present
    if (!dateFilterBtn.dataset.period) dateFilterBtn.dataset.period = 'last7days';
    var labelMap = { last7days: 'Weekly', month: 'Monthly', year: 'Yearly' };
    var arrowIcon = '<svg class="chart-filter-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>';
    dateFilterBtn.style.cssText = 'position:relative;min-width:124px;padding:8px 12px;background:#fff;border:1px solid #d1d5db;border-radius:8px;font-weight:400;color:#111827;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;transition:all 0.2s ease;font-size:13px;';
    dateFilterBtn.innerHTML = '<span>' + labelMap[dateFilterBtn.dataset.period] + '</span>' + arrowIcon;

    // build menu
    var menu = document.createElement('div');
    menu.className = 'chart-period-menu';
    menu.style.cssText = 'position:absolute;display:none;background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:4px;box-shadow:0 12px 32px rgba(15,23,42,0.15);z-index:200;top:100%;left:0;right:0;margin-top:6px;width:100%;';
    ['last7days','month','year'].forEach(function(p) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'chart-period-item';
      item.dataset.period = p;
      item.style.cssText = 'display:block;padding:10px 12px;width:100%;text-align:left;border:none;background:transparent;cursor:pointer;border-radius:6px;font-weight:400;color:#374151;font-size:13px;transition:all 0.15s ease;';
      item.textContent = labelMap[p];
      item.addEventListener('mouseenter', function() {
        this.style.background = '#f3f4f6';
      });
      item.addEventListener('mouseleave', function() {
        this.style.background = 'transparent';
      });
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        dateFilterBtn.dataset.period = item.dataset.period;
        dateFilterBtn.innerHTML = '<span>' + labelMap[item.dataset.period] + '</span>' + arrowIcon;
        dateFilterBtn.appendChild(menu);
        menu.style.display = 'none';
        self.updateChartTitle(item.dataset.period);
        self.loadChart();
      });
      menu.appendChild(item);
    });

    dateFilterBtn.style.position = 'relative';
    dateFilterBtn.appendChild(menu);

    // Add hover effects to button
    dateFilterBtn.addEventListener('mouseenter', function() {
      this.style.background = '#f9fafb';
      this.style.borderColor = '#9ca3af';
    });
    dateFilterBtn.addEventListener('mouseleave', function() {
      this.style.background = '#fff';
      this.style.borderColor = '#d1d5db';
    });

    dateFilterBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = menu.style.display === 'block';
      menu.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        dateFilterBtn.style.borderColor = '#3b82f6';
        dateFilterBtn.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
      } else {
        dateFilterBtn.style.borderColor = '#d1d5db';
        dateFilterBtn.style.boxShadow = 'none';
      }
    });

    // close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (menu && e.target !== dateFilterBtn && !menu.contains(e.target)) {
        menu.style.display = 'none';
        dateFilterBtn.style.borderColor = '#d1d5db';
        dateFilterBtn.style.boxShadow = 'none';
      }
    });
  }
};

Dashboard.prototype.updateChartTitle = function(period, rangeLabel) {
  var titleEl = document.getElementById('dash-sales-title');
  var subtitleEl = document.getElementById('dash-sales-subtitle');
  var categorySubtitleEl = document.getElementById('dash-category-subtitle');
  var titleMap = {
    last7days: 'Weekly sales',
    month: 'Monthly sales',
    year: 'Yearly sales'
  };
  if (titleEl) {
    titleEl.textContent = titleMap[period] || 'Sales trend';
  }
  if (subtitleEl) {
    subtitleEl.textContent = rangeLabel || 'Sales revenue by calendar period';
  }
  if (categorySubtitleEl) {
    categorySubtitleEl.textContent = rangeLabel
      ? `Revenue share - ${rangeLabel}`
      : 'Category share for the selected period';
  }
};

window.Dashboard = Dashboard;
