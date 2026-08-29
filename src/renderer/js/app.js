/**
 * Main Application Module
 * Handles navigation, authentication, and view initialization
 */

class SystemNotificationCenter {
  constructor() {
    this.storageKey = 'system_notification_center_v1';
    this.lowStockSignatureKey = 'system_notification_low_stock_signature';
    this.backupSuccessKey = 'system_notification_backup_success';
    this.backupErrorKey = 'system_notification_backup_error';
    this.items = this.loadItems();
    this.monitorTimer = null;
    this.audioContext = null;
    this.elements = {
      dropdown: document.getElementById('notificationDropdown'),
      button: document.getElementById('notificationBtn'),
      panel: document.getElementById('notificationPanel'),
      count: document.getElementById('notificationCount'),
      summary: document.getElementById('notificationSummary'),
      list: document.getElementById('notificationList'),
      markRead: document.getElementById('markNotificationsRead'),
      clear: document.getElementById('clearNotifications')
    };

    this.setupEvents();
    this.render();
  }

  loadItems() {
    try {
      const items = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      return Array.isArray(items) ? items.slice(0, 50) : [];
    } catch (error) {
      console.warn('Unable to load notification history:', error);
      return [];
    }
  }

  persist() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.items.slice(0, 50)));
  }

  add({
    type = 'info',
    title = 'System notification',
    message = '',
    source = 'System',
    actionView = null,
    read = false,
    dedupeKey = null,
    createdAt = new Date().toISOString()
  }) {
    const existingIndex = dedupeKey
      ? this.items.findIndex(item => item.dedupeKey === dedupeKey)
      : -1;
    const item = {
      id: existingIndex >= 0
        ? this.items[existingIndex].id
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      title,
      message,
      source,
      actionView,
      read,
      dedupeKey,
      createdAt
    };

    if (existingIndex >= 0) {
      this.items.splice(existingIndex, 1);
    }
    this.items.unshift(item);
    this.items = this.items.slice(0, 50);
    this.persist();
    this.render();
    if (!read) {
      this.playNotificationSound(type);
    }
    return item;
  }

  playNotificationSound(type = 'info') {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioContext = this.audioContext || new AudioContextClass();
      const context = this.audioContext;
      const play = () => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime;
        const frequencies = {
          success: [660, 880],
          warning: [520, 700],
          error: [360, 300],
          info: [620, 780]
        };
        const notes = frequencies[type] || frequencies.info;

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(notes[0], start);
        oscillator.frequency.setValueAtTime(notes[1], start + 0.09);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.055, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.22);
      };

      if (context.state === 'suspended') {
        context.resume().then(play).catch(() => {});
      } else {
        play();
      }
    } catch (_error) {
      // Notifications remain visible when sound is unavailable.
    }
  }

  showToast(message, type = 'info', title = '') {
    let container = document.getElementById('notification-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-container';
      container.className = 'notification-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `notification ${type}`;

    const icon = document.createElement('span');
    icon.className = 'notification-icon';
    icon.textContent = { success: 'OK', warning: '!', error: 'X', info: 'i' }[type] || 'i';

    const copy = document.createElement('div');
    copy.className = 'notification-content';
    if (title) {
      const heading = document.createElement('div');
      heading.className = 'notification-title';
      heading.textContent = title;
      copy.appendChild(heading);
    }
    const text = document.createElement('div');
    text.className = 'notification-message';
    text.textContent = message;
    copy.appendChild(text);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'notification-close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = 'x';

    toast.append(icon, copy, close);
    container.appendChild(toast);

    const remove = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(24px)';
      setTimeout(() => toast.remove(), 200);
    };
    close.addEventListener('click', remove);
    setTimeout(remove, 5000);
    return toast;
  }

  setupEvents() {
    const { dropdown, button, panel, markRead, clear, list } = this.elements;

    button?.addEventListener('click', event => {
      event.stopPropagation();
      const isOpen = panel?.classList.toggle('show');
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.getElementById('userDropdown')?.classList.remove('show');
      document.getElementById('userProfile')?.classList.remove('active');
    });

    panel?.addEventListener('click', event => event.stopPropagation());
    markRead?.addEventListener('click', () => this.markAllRead());
    clear?.addEventListener('click', () => this.clear());
    list?.addEventListener('click', event => {
      const itemButton = event.target.closest('[data-notification-id]');
      if (itemButton) this.openItem(itemButton.dataset.notificationId);
    });

    document.addEventListener('click', event => {
      if (dropdown?.contains(event.target)) return;
      panel?.classList.remove('show');
      button?.setAttribute('aria-expanded', 'false');
    });
  }

  openItem(id) {
    const item = this.items.find(candidate => candidate.id === id);
    if (!item) return;
    item.read = true;
    this.persist();
    this.render();
    this.elements.panel?.classList.remove('show');
    this.elements.button?.setAttribute('aria-expanded', 'false');
    if (item.actionView && window.app?.navigateTo) {
      window.app.navigateTo(item.actionView);
    }
  }

  markAllRead() {
    this.items.forEach(item => {
      item.read = true;
    });
    this.persist();
    this.render();
  }

  clear() {
    this.items = [];
    this.persist();
    this.render();
  }

  render() {
    const { count, summary, list, markRead, clear } = this.elements;
    const unread = this.items.filter(item => !item.read).length;

    if (count) {
      count.textContent = unread > 99 ? '99+' : String(unread);
      count.hidden = unread === 0;
    }
    if (this.elements.button) {
      this.elements.button.setAttribute(
        'aria-label',
        unread
          ? `Open notifications, ${unread} unread alert${unread === 1 ? '' : 's'}`
          : 'Open notifications'
      );
    }
    if (summary) {
      summary.textContent = unread
        ? 'Unread notifications'
        : 'No unread alerts';
    }
    if (markRead) markRead.disabled = unread === 0;
    if (clear) clear.disabled = this.items.length === 0;
    if (!list) return;

    if (!this.items.length) {
      list.innerHTML = '<div class="notification-list-empty">System alerts, backup results, and stock warnings will appear here.</div>';
      return;
    }

    list.innerHTML = this.items.map(item => `
      <button type="button" class="notification-center-item ${this.escapeHtml(item.type)}${item.read ? '' : ' unread'}"
        data-notification-id="${this.escapeHtml(item.id)}">
        <span class="notification-center-icon">${this.iconFor(item)}</span>
        <span class="notification-center-copy">
          <strong>${this.escapeHtml(item.title)}</strong>
          <p>${this.escapeHtml(item.message)}</p>
        </span>
        <span class="notification-center-meta">
          <span>${this.escapeHtml(this.formatTime(item.createdAt))}</span>
          ${item.read ? '' : '<span class="notification-unread-dot"></span>'}
        </span>
      </button>
    `).join('');
  }

  iconFor(item) {
    if (item.source === 'Inventory') return '#';
    if (item.source === 'Backup') return 'B';
    if (item.source === 'Restore') return 'R';
    return { success: 'OK', warning: '!', error: 'X', info: 'i' }[item.type] || 'i';
  }

  formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const elapsed = Date.now() - date.getTime();
    if (elapsed < 60 * 1000) return 'Now';
    if (elapsed < 60 * 60 * 1000) return `${Math.floor(elapsed / 60000)}m`;
    if (elapsed < 24 * 60 * 60 * 1000) return `${Math.floor(elapsed / 3600000)}h`;
    return window.AppFormatters?.formatDate(date) || date.toLocaleDateString();
  }

  escapeHtml(value) {
    const node = document.createElement('div');
    node.textContent = String(value ?? '');
    return node.innerHTML;
  }

  async refreshSystemSignals() {
    await Promise.allSettled([
      this.refreshLowStock(),
      this.refreshBackupStatus()
    ]);
  }

  async refreshLowStock() {
    if (!window.electronAPI?.getLowStock) return;
    const result = await window.electronAPI.getLowStock();
    if (!result?.success || !Array.isArray(result.data)) return;

    const products = result.data;
    const signature = products
      .map(product => `${product.id}:${product.available_stock}`)
      .sort()
      .join('|');
    const previousSignature = localStorage.getItem(this.lowStockSignatureKey) || '';

    if (signature && signature !== previousSignature) {
      const names = products.slice(0, 3).map(product => product.name).join(', ');
      const extra = products.length > 3 ? ` and ${products.length - 3} more` : '';
      this.add({
        type: 'warning',
        title: `${products.length} low-stock item${products.length === 1 ? '' : 's'}`,
        message: `${names}${extra} need attention.`,
        source: 'Inventory',
        actionView: 'inventory'
      });
      this.showToast(`${products.length} inventory item${products.length === 1 ? '' : 's'} need attention.`, 'warning', 'Low stock alert');
    } else if (!signature && previousSignature) {
      this.add({
        type: 'success',
        title: 'Low-stock alert cleared',
        message: 'All active products are now above their reorder levels.',
        source: 'Inventory',
        actionView: 'inventory'
      });
    }

    localStorage.setItem(this.lowStockSignatureKey, signature);
  }

  async refreshBackupStatus() {
    if (!window.electronAPI?.getAutomaticBackupStatus) return;
    const result = await window.electronAPI.getAutomaticBackupStatus();
    if (!result?.success || !result.data) return;

    const status = result.data;
    const nextBackup = status.nextBackupAt
      ? (window.AppFormatters?.formatDateTime(status.nextBackupAt)
        || new Date(status.nextBackupAt).toLocaleString())
      : 'No backup is scheduled';
    this.add({
      type: status.enabled ? 'info' : 'warning',
      title: status.enabled ? 'Automatic backup active' : 'Automatic backup disabled',
      message: status.enabled
        ? `${status.frequency} at ${status.time}. Next run: ${nextBackup}.`
        : 'Enable automatic backup in System Configuration.',
      source: 'Backup',
      actionView: 'settings',
      read: true,
      dedupeKey: 'backup-schedule'
    });

    const previousSuccess = localStorage.getItem(this.backupSuccessKey) || '';
    if (status.lastAutomaticAt && status.lastAutomaticAt !== previousSuccess) {
      this.add({
        type: 'success',
        title: 'Automatic backup completed',
        message: status.lastBackupPath || 'The database snapshot was created successfully.',
        source: 'Backup',
        actionView: 'settings',
        createdAt: status.lastAutomaticAt
      });
      localStorage.setItem(this.backupSuccessKey, status.lastAutomaticAt);
    }

    const previousError = localStorage.getItem(this.backupErrorKey) || '';
    if (status.lastError && status.lastError !== previousError) {
      this.add({
        type: 'error',
        title: 'Automatic backup failed',
        message: status.lastError,
        source: 'Backup',
        actionView: 'settings'
      });
      localStorage.setItem(this.backupErrorKey, status.lastError);
    } else if (!status.lastError && previousError) {
      localStorage.removeItem(this.backupErrorKey);
    }
  }

  startMonitoring() {
    this.stopMonitoring();
    this.refreshSystemSignals();
    this.monitorTimer = setInterval(() => this.refreshSystemSignals(), 30 * 1000);
  }

  stopMonitoring() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }
}

class Application {
  constructor() {
    this.activeViewStorageKey = 'sales_inventory_active_view';
    this.allowedViews = new Set([
      'dashboard',
      'pos',
      'products',
      'inventory',
      'sales',
      'quotations-invoices',
      'invoices',
      'quotations',
      'customers',
      'reports',
      'users',
      'settings'
    ]);
    this.currentView = this.getStoredActiveView();
    this.currentUser = null;
    this.views = {};
    this.notificationCenter = null;
    
    this.init();
  }

  async init() {
    if (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')) {
      this.applyInitialViewState(this.getStoredActiveView());
    }
    
    // Check authentication first
    if (!await this.checkAuth()) {
      return;
    }

    await this.loadRuntimeSettings();

    // Get user info
    this.currentUser = this.getUserInfo();
    this.updateUserDisplay();
    this.showAdminFeatures(this.currentUser?.role === 'admin');

    this.notificationCenter = new SystemNotificationCenter();
    window.notificationCenter = this.notificationCenter;
    window.showNotification = (message, type = 'info', options = {}) => {
      this.notificationCenter.showToast(message, type, options.title || '');
      if (options.persist) {
        this.notificationCenter.add({
          type,
          title: options.title || 'System notification',
          message,
          source: options.source || 'System',
          actionView: options.actionView || null
        });
      }
    };

    // Setup event listeners
    this.setupEventListeners();

    // Setup sidebar navigation
    this.setupNavigation();

    // Load the last active view after an app refresh.
    this.navigateTo(this.getInitialView());
    this.notificationCenter.startMonitoring();
  }

  getStoredActiveView() {
    try {
      const storedView = localStorage.getItem(this.activeViewStorageKey);
      return this.isKnownView(storedView) ? storedView : 'dashboard';
    } catch (_error) {
      return 'dashboard';
    }
  }

  persistActiveView(view) {
    try {
      localStorage.setItem(this.activeViewStorageKey, view);
    } catch (error) {
      console.warn('Unable to remember active view:', error);
    }
  }

  syncPosWindowMode(view) {
    try {
      if (window.electronAPI?.setPosWindowMode) {
        window.electronAPI.setPosWindowMode(view === 'pos');
        return;
      }
      window.electronAPI?.setMenuBarVisible?.(view !== 'pos');
    } catch (error) {
      console.warn('Unable to update POS window mode:', error);
    }
  }

  isKnownView(view) {
    return Boolean(view && this.allowedViews.has(view));
  }

  getViewElementId(view) {
    return ['invoices', 'quotations'].includes(view)
      ? 'quotations-invoices-view'
      : `${view}-view`;
  }

  getNavigationView(view) {
    return ['invoices', 'quotations'].includes(view) ? 'quotations-invoices' : view;
  }

  canAccessView(view, user = this.currentUser) {
    const navView = this.getNavigationView(view);
    const nav = document.querySelector(`.nav-item[data-view="${navView}"]`);
    const role = String(user?.role || '').toLowerCase();
    return !(nav?.classList.contains('admin-only') && role !== 'admin');
  }

  getInitialView() {
    const storedView = this.getStoredActiveView();
    if (!this.isKnownView(storedView)) return 'dashboard';
    if (!this.canAccessView(storedView)) return 'dashboard';
    return document.getElementById(this.getViewElementId(storedView)) ? storedView : 'dashboard';
  }

  getViewTitleData(view) {
    const titles = {
      dashboard: { title: 'Dashboard Overview', subtitle: "Here's what's happening with your business today." },
      pos: { title: 'Point of Sale', subtitle: 'Fast checkout and order management system.' },
      products: { title: 'Product Catalog', subtitle: 'Manage core product definitions, pricing, and classifications.' },
      inventory: { title: 'Inventory Management', subtitle: 'Track stock levels, manage adjustments, and monitor inventory health.' },
      quotations: { title: 'Quotations', subtitle: 'Create and manage customer quotations.' },
      invoices: { title: 'Invoices', subtitle: 'Manage invoices and track payments.' },
      'quotations-invoices': { title: 'Invoices & Quotations', subtitle: 'Generate and manage customer invoices and quotations.' },
      sales: { title: 'POS Sales History', subtitle: 'Review completed point-of-sale transactions and sold items.' },
      customers: { title: 'Customer Management', subtitle: 'Directory & CRM - Manage customer profiles, balances, and history.' },
      reports: { title: 'Reports', subtitle: 'Generate and export business reports for analysis and record-keeping.' },
      users: { title: 'System Administration', subtitle: 'Manage staff accounts and custom role permissions.' },
      settings: { title: 'System Settings', subtitle: 'Configure company information and application preferences.' }
    };

    return titles[view] || { title: view, subtitle: '' };
  }

  applyInitialViewState(view) {
    let initialView = view;
    const storedUser = this.getUserInfo();

    if (!this.isKnownView(initialView) || !this.canAccessView(initialView, storedUser)) {
      initialView = 'dashboard';
    }

    const viewElementId = this.getViewElementId(initialView);
    const viewElement = document.getElementById(viewElementId);
    if (!viewElement) return;

    document.querySelectorAll('.view').forEach(element => {
      element.classList.toggle('active', element.id === viewElementId);
    });

    const navigationView = this.getNavigationView(initialView);
    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.toggle('active', nav.dataset.view === navigationView);
    });

    const titleData = this.getViewTitleData(initialView);
    this.setPageTitle(titleData.title, titleData.subtitle);
    document.title = `${titleData.title} - Sales & Inventory System`;
    document.body.classList.toggle('pos-fullscreen', initialView === 'pos');
    document.body.classList.toggle('settings-mode', initialView === 'settings');
    this.syncPosWindowMode(initialView);
    this.currentView = initialView;
  }

  async loadRuntimeSettings() {
    if (!window.electronAPI?.getSettings) return;
    try {
      const result = await window.electronAPI.getSettings();
      if (result?.success && result.data) {
        this.applyRuntimeSettings(result.data);
      }
    } catch (error) {
      console.error('Unable to load system settings:', error);
    }
  }

  applyRuntimeSettings(settings = {}) {
    const formatterSettings = window.AppFormatters?.configure(settings) || {};
    window.appSettings = Object.freeze({
      ...settings,
      currency: formatterSettings.currency || settings.currency,
      currency_symbol: formatterSettings.currencySymbol || settings.currency_symbol
    });
    this.hydrateCurrencyPlaceholders();
  }

  hydrateCurrencyPlaceholders() {
    if (!window.AppFormatters?.formatCurrency) return;
    document.querySelectorAll('[data-currency-value]').forEach(element => {
      element.textContent = window.AppFormatters.formatCurrency(
        Number(element.dataset.currencyValue || 0)
      );
    });
  }

  async checkAuth() {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    
    if (!token) {
      window.location.href = 'login.html';
      return false;
    }
    
    if (!window.electronAPI?.validateToken) {
      this.clearAuth();
      return false;
    }

    try {
      const result = await window.electronAPI.validateToken(token);
      if (!result?.success || !result.data || result.data.mustChangePassword) {
        this.clearAuth();
        return false;
      }
      const storedUser = this.getUserInfo() || {};
      localStorage.setItem('user', JSON.stringify({
        ...storedUser,
        id: result.data.userId,
        username: result.data.username,
        fullName: result.data.fullName,
        role: result.data.role
      }));
    } catch (error) {
      console.error('Token validation error:', error);
      this.clearAuth();
      return false;
    }

    return true;
  }

  getUserInfo() {
    try {
      const userJson = localStorage.getItem('user');
      return userJson ? JSON.parse(userJson) : null;
    } catch (e) {
      console.error('Failed to parse user data:', e);
      return null;
    }
  }

  toTitleCase(value = '') {
    return String(value || '')
      .replace(/[-_]/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  updateUserDisplay() {
    const user = this.currentUser || {};
    const displayName = this.toTitleCase(user.fullName || user.username || 'System Administrator');
    const roleLabel = this.toTitleCase(user.role || 'admin');
    const initial = (displayName.trim().charAt(0) || 'A').toUpperCase();
    const email = user.email || 'admin@nexus-systems.com';
    const sessionDate = window.AppFormatters?.formatDate(new Date())
      || new Date().toLocaleDateString();

    const userNameElement = document.getElementById('current-user-name');
    if (userNameElement) userNameElement.textContent = displayName;

    const headerName = document.getElementById('userName');
    if (headerName) headerName.textContent = displayName;

    const headerRole = document.getElementById('userRole');
    if (headerRole) headerRole.textContent = roleLabel;

    const headerInitial = document.getElementById('userInitial');
    if (headerInitial) headerInitial.textContent = initial;

    const dropdownInitial = document.getElementById('dropdownUserInitial');
    if (dropdownInitial) dropdownInitial.textContent = initial;

    const dropdownName = document.getElementById('dropdownUserName');
    if (dropdownName) dropdownName.textContent = displayName;

    const dropdownRole = document.getElementById('dropdownUserRole');
    if (dropdownRole) dropdownRole.textContent = roleLabel;

    const dropdownEmail = document.getElementById('dropdownUserEmail');
    if (dropdownEmail) dropdownEmail.textContent = email;

    const dropdownSessionDate = document.getElementById('dropdownSessionDate');
    if (dropdownSessionDate) dropdownSessionDate.textContent = `Session: ${sessionDate}`;
  }

  isStrongPassword(password) {
    return typeof password === 'string' &&
      password.length >= 12 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
  }

  profilePasswordRequirementMessage() {
    return 'Password must be at least 12 characters and include uppercase, lowercase, number, and symbol';
  }

  setProfilePasswordError(message = '') {
    const error = document.getElementById('profile-password-error');
    if (!error) return;

    error.textContent = message;
    error.classList.toggle('visible', Boolean(message));
  }

  openProfilePasswordModal() {
    const modal = document.getElementById('profile-reset-password-modal');
    if (!modal) return;

    const displayName = this.currentUser?.fullName || this.currentUser?.username || 'your profile';
    const name = document.getElementById('profile-reset-password-name');
    if (name) name.textContent = displayName;

    ['profile-current-password', 'profile-new-password', 'profile-confirm-password'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });
    this.setProfilePasswordError('');
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('profile-current-password')?.focus(), 0);
  }

  closeProfilePasswordModal() {
    const modal = document.getElementById('profile-reset-password-modal');
    if (modal) modal.style.display = 'none';
    this.setProfilePasswordError('');
  }

  setProfilePasswordBusy(button, busy) {
    if (!button) return;

    if (busy) {
      button.dataset.originalLabel = button.textContent || 'Update Password';
      button.disabled = true;
      button.textContent = 'Updating...';
      return;
    }

    button.disabled = false;
    button.textContent = button.dataset.originalLabel || 'Update Password';
    delete button.dataset.originalLabel;
  }

  async handleProfilePasswordReset() {
    const currentPassword = document.getElementById('profile-current-password')?.value || '';
    const newPassword = document.getElementById('profile-new-password')?.value || '';
    const confirmation = document.getElementById('profile-confirm-password')?.value || '';

    if (!currentPassword || !newPassword || !confirmation) {
      this.setProfilePasswordError('Complete all password fields.');
      return;
    }

    if (!this.isStrongPassword(newPassword)) {
      this.setProfilePasswordError(this.profilePasswordRequirementMessage());
      document.getElementById('profile-new-password')?.focus();
      return;
    }

    if (newPassword !== confirmation) {
      this.setProfilePasswordError('New password and confirmation do not match.');
      document.getElementById('profile-confirm-password')?.focus();
      return;
    }

    if (currentPassword === newPassword) {
      this.setProfilePasswordError('New password must differ from the current password.');
      document.getElementById('profile-new-password')?.focus();
      return;
    }

    const button = document.getElementById('profile-reset-password-submit');
    this.setProfilePasswordBusy(button, true);
    this.setProfilePasswordError('');

    try {
      const result = await window.electronAPI.changePassword({ currentPassword, newPassword });
      if (!result?.success) {
        throw new Error(result?.error || 'Unable to update password');
      }

      this.closeProfilePasswordModal();
      window.showNotification?.('Password updated. Sign in again with your new password.', 'success');
      setTimeout(() => this.clearAuth(), 900);
    } catch (error) {
      this.setProfilePasswordError(error.message || 'Unable to update password.');
      window.showNotification?.(error.message || 'Unable to update password.', 'error');
    } finally {
      this.setProfilePasswordBusy(button, false);
    }
  }

  showAdminFeatures(isAdmin) {
    document.querySelectorAll('.admin-only').forEach(el => {
      if (isAdmin) {
        el.classList.add('visible');
        el.style.display = 'flex';
      } else {
        el.classList.remove('visible');
        el.style.display = 'none';
      }
    });
  }

  clearAuth() {
    this.syncPosWindowMode('dashboard');
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem(this.activeViewStorageKey);
    window.location.href = 'login.html';
  }

  setupEventListeners() {
    window.addEventListener('settings-updated', event => {
      this.applyRuntimeSettings(event.detail || {});
    });

    document.addEventListener('click', (event) => {
      const createButton = event.target?.closest?.('#new-invoice-btn, #new-document-btn');
      if (!createButton) return;
      event.preventDefault();
      if (createButton.id === 'new-document-btn') {
        this.openActiveDocumentModal();
      } else {
        this.openNewInvoiceDocument();
      }
    });

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.logout();
    });

    // Sidebar toggle
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.classList.toggle('collapsed');
      }
    });

    const profileButton = document.getElementById('userProfile');
    const profileDropdown = document.getElementById('userDropdown');
    const profileWrap = document.querySelector('.header-profile-wrap');

    profileButton?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = profileDropdown?.classList.toggle('show');
      profileButton.classList.toggle('active', !!isOpen);
      profileButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    profileDropdown?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
      if (!profileWrap || profileWrap.contains(e.target)) return;
      profileDropdown?.classList.remove('show');
      profileButton?.classList.remove('active');
      profileButton?.setAttribute('aria-expanded', 'false');
    });

    document.getElementById('profileResetPassword')?.addEventListener('click', () => {
      profileDropdown?.classList.remove('show');
      profileButton?.classList.remove('active');
      profileButton?.setAttribute('aria-expanded', 'false');
      this.openProfilePasswordModal();
    });

    document.getElementById('profile-reset-password-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleProfilePasswordReset();
    });

    document.querySelectorAll('[data-profile-password-close]').forEach((button) => {
      button.addEventListener('click', () => this.closeProfilePasswordModal());
    });

    document.getElementById('profile-reset-password-modal')?.addEventListener('click', (event) => {
      if (event.target?.id === 'profile-reset-password-modal') {
        this.closeProfilePasswordModal();
      }
    });

    document.getElementById('profileSignOut')?.addEventListener('click', () => {
      this.logout();
    });
  }

  setupNavigation() {
    // Sidebar navigation clicks
    document.querySelectorAll('.nav-item[data-view], .stat-card[data-view], .dash-card[data-view], .text-btn[data-view]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const view = el.dataset.view;
        this.navigateTo(view);
      });

      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        const view = el.dataset.view;
        this.navigateTo(view);
      });
    });

    // Stat card clicks on dashboard
    document.querySelectorAll('.dash-card[onclick]').forEach(card => {
      // These already have inline onclick handlers
    });
  }

  navigateTo(view) {
    if (!this.isKnownView(view)) {
      console.warn(`Unknown view ignored: ${view}`);
      return;
    }

    if (!this.canAccessView(view)) {
      view = 'dashboard';
    }
    
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Show selected view
    const viewElementId = this.getViewElementId(view);
    const viewElement = document.getElementById(viewElementId);
    if (viewElement) {
      viewElement.classList.add('active');
    } else {
      console.warn(`View element not found: ${viewElementId}`);
    }
    
    // Update active nav item
    const navigationView = this.getNavigationView(view);
    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.toggle('active', nav.dataset.view === navigationView);
    });
    
    // Update page title and subtitle in header
    const titleData = this.getViewTitleData(view);
    this.setPageTitle(titleData.title, titleData.subtitle);
    
    // Update document title
    document.title = `${titleData.title} - Sales & Inventory System`;
    
    this.currentView = view;
    this.persistActiveView(view);
    this.syncPosWindowMode(view);
    // Toggle fullscreen for POS view
    try {
      if (view === 'pos') {
        document.body.classList.add('pos-fullscreen');
      } else {
        document.body.classList.remove('pos-fullscreen');
      }
      document.body.classList.toggle('settings-mode', view === 'settings');
    } catch (e) {
      console.warn('Unable to toggle view layout class:', e);
    }
    
    // Initialize view-specific logic
    this.initView(view);
  }

  setPageTitle(title, subtitle = '') {
    const pageTitleEl = document.getElementById('pageTitle');
    const pageSubtitleEl = document.getElementById('pageSubtitle');
    
    if (pageTitleEl) {
      pageTitleEl.textContent = title;
    }
    if (pageSubtitleEl) {
      pageSubtitleEl.textContent = subtitle;
    }
  }

  initView(view) {
    switch (view) {
      case 'dashboard':
        this.initDashboardView();
        break;
        
      case 'products':
        this.initProductsView();
        break;
        
      case 'pos':
        this.initPOSView();
        break;
        
      case 'inventory':
        this.initInventoryView();
        break;
        
      case 'sales':
        this.initSalesView();
        break;
        
      case 'invoices':
      case 'quotations':
      case 'quotations-invoices':
        this.initQuotationsInvoicesView(view);
        break;
        
      case 'customers':
        this.initCustomersView();
        break;
        
      case 'reports':
        this.initReportsView();
        break;
        
      case 'users':
        this.initUsersView();
        break;
        
      case 'settings':
        this.initSettingsView();
        break;
        
      default:
        this.showPlaceholder(view);
    }
  }

  // ============ VIEW INITIALIZERS ============

  refreshProductsView() {
    const view = window.productsView;
    if (!view) return;
    Promise.resolve()
      .then(async () => {
        await view.loadProducts?.();
        await view.loadCategories?.();
        view.filterProducts?.();
      })
      .catch(error => console.error('Failed to refresh products view:', error));
  }

  refreshPOSView() {
    const view = window.posView;
    if (!view) return;
    Promise.resolve()
      .then(async () => {
        await view.loadData?.();
        view.renderCategoryOptions?.();
        view.renderQuickKeys?.();
        view.renderProducts?.();
        view.renderCart?.();
        view.syncPaymentMethod?.();
      })
      .catch(error => console.error('Failed to refresh POS view:', error));
  }

  refreshInventoryView() {
    const view = window.inventoryView;
    if (!view) return;
    Promise.resolve()
      .then(async () => {
        await view.loadInventory?.();
        view.render?.();
      })
      .catch(error => console.error('Failed to refresh inventory view:', error));
  }

  refreshCustomersView() {
    const view = window.customersView;
    if (!view) return;
    Promise.resolve()
      .then(async () => {
        await view.loadCustomers?.();
        view.filterCustomers?.();
      })
      .catch(error => console.error('Failed to refresh customers view:', error));
  }

  refreshSettingsView() {
    const view = window.settingsView;
    if (!view) return;
    Promise.resolve()
      .then(async () => {
        await Promise.all([
          view.loadSettings?.(),
          view.loadProducts?.()
        ]);
        view.render?.();
      })
      .catch(error => console.error('Failed to refresh settings view:', error));
  }

  initDashboardView() {
    if (typeof Dashboard !== 'undefined') {
      if (!window.dashboard) {
        window.dashboard = new Dashboard();
      }
      window.dashboard.loadDashboardData();
    } else {
      console.warn('Dashboard class not available');
    }
  }

  initProductsView() {
    if (typeof ProductsView !== 'undefined') {
      if (!window.productsView) {
        window.productsView = new ProductsView();
      } else {
        this.refreshProductsView();
      }
    } else {
      console.warn('ProductsView class not available');
    }
  }

  initPOSView() {
    if (typeof POSView !== 'undefined') {
      if (!window.posView) {
        window.posView = new POSView();
      } else {
        this.refreshPOSView();
      }
    } else {
      console.warn('POSView class not available');
    }
  }

  initInventoryView() {
    if (typeof InventoryView !== 'undefined') {
      if (!window.inventoryView) {
        window.inventoryView = new InventoryView();
      } else {
        this.refreshInventoryView();
      }
    } else {
      this.showPlaceholder('Inventory Management');
    }
  }

  initSalesView() {
    if (typeof SalesView !== 'undefined') {
      if (!window.salesView) {
        window.salesView = new SalesView();
      } else {
        window.salesView.loadData()
          .then(() => window.salesView.render())
          .catch(error => console.error('Failed to refresh sales view:', error));
      }
    } else {
      this.showPlaceholder('Sales');
    }
  }

  async getReadyDocumentsView(defaultView = 'invoices') {
    if (!window.quotationsInvoicesView) {
      this.navigateTo(defaultView);
      await new Promise(resolve => window.setTimeout(resolve, 0));
    }

    const documentsView = window.quotationsInvoicesView;
    if (!documentsView) return null;

    try {
      await documentsView.ready;
    } catch (error) {
      console.warn('Document workspace finished loading with warnings:', error);
    }

    return documentsView;
  }

  async openActiveDocumentModal() {
    const documentsView = await this.getReadyDocumentsView('invoices');
    documentsView?.openCreateForActiveTab?.();
  }

  async openNewInvoiceDocument() {
    this.navigateTo('invoices');
    const documentsView = await this.getReadyDocumentsView('invoices');
    documentsView?.openNewInvoice?.();
  }

  initQuotationsInvoicesView(view = 'invoices') {
    const activeTab = view === 'quotations' ? 'quotations' : 'invoices';

    if (typeof QuotationsInvoicesView !== 'undefined') {
      if (!window.quotationsInvoicesView) {
        window.quotationsInvoicesView = new QuotationsInvoicesView();
        window.quotationsInvoicesView.setActiveDocumentView(activeTab);
      } else {
        window.quotationsInvoicesView.setActiveDocumentView(activeTab);
        window.quotationsInvoicesView.loadData()
          .then(() => window.quotationsInvoicesView.render())
          .catch(error => console.error('Failed to refresh documents view:', error));
      }
    } else {
      this.showPlaceholder('Quotations & Invoices');
    }
  }

  initCustomersView() {
    if (typeof CustomersView !== 'undefined') {
      if (!window.customersView) {
        window.customersView = new CustomersView();
      } else {
        this.refreshCustomersView();
      }
    } else {
      this.showPlaceholder('Customer Management');
    }
  }

  initReportsView() {
    if (typeof ReportsView !== 'undefined') {
      if (!window.reportsView) {
        window.reportsView = new ReportsView();
      } else {
        window.reportsView.render?.();
      }
    } else {
      this.showPlaceholder('Reports');
    }
  }

  initUsersView() {
    if (typeof UsersView !== 'undefined') {
      if (!window.usersView) {
        window.usersView = new UsersView();
      } else {
        window.usersView.render()
          .catch(error => console.error('Failed to refresh users view:', error));
      }
    } else {
      this.showPlaceholder('User Management');
    }
  }

  initSettingsView() {
    if (typeof SettingsView !== 'undefined') {
      if (!window.settingsView) {
        window.settingsView = new SettingsView();
      } else {
        this.refreshSettingsView();
      }
    } else {
      this.showPlaceholder('Settings');
    }
  }

  showPlaceholder(title) {
    const viewElement = document.getElementById(`${this.currentView}-view`);
    if (!viewElement) return;
    
    // Check if placeholder already exists
    if (viewElement.querySelector('.placeholder-content')) return;
    
    viewElement.innerHTML = `
      <div class="view-header">
        <h1>${title}</h1>
      </div>
      <div class="placeholder-content" style="text-align:center;padding:80px 40px;background:white;border-radius:16px;border:1px solid #e5e7eb;">
        <span style="font-size:56px;">🚧</span>
        <h2 style="margin-top:16px;color:#1e293b;font-size:20px;">Coming Soon</h2>
        <p style="color:#64748b;margin-top:8px;">This feature is currently under development.</p>
      </div>
    `;
  }

  async logout() {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    
    if (token && window.electronAPI && window.electronAPI.logout) {
      try {
        await window.electronAPI.logout(token);
      } catch (e) {
        console.error('Logout error:', e);
      }
    }
    
    this.clearAuth();
  }
}

// ============ INITIALIZE APPLICATION ============
let app;

document.addEventListener('DOMContentLoaded', () => {
  app = new Application();
  window.app = app;
});
