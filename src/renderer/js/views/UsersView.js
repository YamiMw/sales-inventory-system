/**
 * User Management View
 * Database-backed staff accounts, account controls, and permissions.
 */
class UsersView {
  constructor() {
    this.users = [];
    this.filteredUsers = [];
    this.currentView = 'users-list';
    this.currentPage = 1;
    this.perPage = 25;
    this.selectedRole = 'Manager';
    this.searchQuery = '';
    this.roleFilter = '';
    this.statusFilter = '';
    this.resetUserId = null;
    this.detailsUserId = null;
    this.editingOriginalStatus = null;
    this.rolePermissions = {
      Admin: ['void_invoice', 'override_price', 'view_audit_logs', 'export_reports', 'adjust_stock', 'view_users', 'create_user', 'edit_user', 'delete_user', 'manage_roles', 'manage_settings', 'backup_database', 'restore_database', 'delete_quotation', 'delete_invoice', 'allow_negative_stock'],
      Manager: ['void_invoice', 'override_price', 'export_reports', 'adjust_stock'],
      Cashier: ['override_price'],
      Inventory: ['adjust_stock'],
      Viewer: []
    };
    this.permissionsCatalog = [
      { key: 'void_invoice', label: 'Void Invoices', description: 'Cancel or void processed sales', category: 'Sales' },
      { key: 'override_price', label: 'Override Prices', description: 'Adjust prices at checkout', category: 'Sales' },
      { key: 'export_reports', label: 'Export Reports', description: 'Download reports and statements', category: 'Reports' },
      { key: 'adjust_stock', label: 'Manage Inventory', description: 'Update stock and reorder data', category: 'Inventory' },
      { key: 'allow_negative_stock', label: 'Allow Negative Stock', description: 'Permit stock reductions below zero when the system policy is enabled', category: 'Inventory' },
      { key: 'view_audit_logs', label: 'View Audit Logs', description: 'Access system activity records', category: 'System' },
      { key: 'view_users', label: 'View Users', description: 'Open staff account records', category: 'System' },
      { key: 'create_user', label: 'Create Users', description: 'Add new staff accounts', category: 'System' },
      { key: 'edit_user', label: 'Edit Users', description: 'Update staff account details and status', category: 'System' },
      { key: 'delete_user', label: 'Delete Users', description: 'Remove staff accounts', category: 'System' },
      { key: 'manage_roles', label: 'Manage Roles', description: 'Configure role permission sets', category: 'System' },
      { key: 'manage_settings', label: 'Manage Settings', description: 'Configure system preferences', category: 'System' },
      { key: 'backup_database', label: 'Backup Database', description: 'Generate database backups', category: 'System' },
      { key: 'restore_database', label: 'Restore Database', description: 'Restore a validated database backup', category: 'System' },
      { key: 'delete_quotation', label: 'Delete Quotations', description: 'Delete quotations or clear quotation history', category: 'Documents' },
      { key: 'delete_invoice', label: 'Delete Invoice History', description: 'Clear invoice history after authorization', category: 'Documents' }
    ];

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
    await Promise.all([this.loadUsers(), this.loadRolePermissions()]);
    this.renderUsersListLayout();
    this.ensureFeatureModals();
    this.renderAdditionalPermissions([]);
    this.updateRolePermissionsPreview();
    this.filterUsers();
    this.setupEventListeners();
    this.refreshIcons();
  }

  async render() {
    await Promise.all([this.loadUsers(), this.loadRolePermissions()]);
    this.filterUsers();
    if (this.currentView === 'roles-management') this.renderRolesPanel();
  }

  async loadUsers() {
    try {
      const result = await this.callApi('getUsers');
      this.users = (result.data || []).map((user) => this.normalizeUser(user));
    } catch (error) {
      console.error('Failed to load users:', error);
      this.users = [];
      this.showNotification(error.message || 'Could not load users from the database', 'error');
    }
  }

  async loadRolePermissions() {
    try {
      if (!window.electronAPI?.getRolePermissions) return;
      const result = await this.callApi('getRolePermissions');
      this.rolePermissions = { ...this.rolePermissions, ...(result.data || {}) };
    } catch (error) {
      console.error('Failed to load role permissions:', error);
    }
  }

  async callApi(method, ...args) {
    const api = window.electronAPI?.[method];
    if (typeof api !== 'function') throw new Error('Users database API is unavailable');
    const result = await api(...args);
    if (!result || result.success === false) throw new Error(result?.error || 'The operation failed');
    return result;
  }

  normalizeUser(user) {
    const statusValue = String(user.status || '').toLowerCase();
    let status = 'Active';
    if (statusValue === 'locked') status = 'Locked';
    if (statusValue === 'inactive' || user.is_active === false || Number(user.is_active) === 0) status = 'Inactive';

    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name || user.fullName || user.username,
      email: user.email || '',
      role: this.normalizeRole(user.role),
      status,
      lastLogin: user.last_login || user.lastLogin || 'Never',
      createdAt: user.created_at || user.createdAt || '',
      updatedAt: user.updated_at || user.updatedAt || '',
      permissions: Array.isArray(user.permissions) ? user.permissions : []
    };
  }

  normalizeRole(role) {
    const value = String(role || 'cashier').trim().toLowerCase();
    return {
      admin: 'Admin',
      manager: 'Manager',
      cashier: 'Cashier',
      inventory: 'Inventory',
      viewer: 'Viewer'
    }[value] || 'Cashier';
  }

  currentUserCanResetPasswords() {
    return String(window.app?.currentUser?.role || '').trim().toLowerCase() === 'admin';
  }

  renderUsersListLayout() {
    // The Users header, toolbar, filters, table shell, and modals are static in index.html.
    // JS only binds events and updates data-driven content.
    const panel = document.getElementById('users-list-panel');
    if (!panel) console.error('Missing #users-list-panel in index.html');
  }

  filterUsers() {
    const query = this.searchQuery.toLowerCase();
    this.filteredUsers = this.users.filter((user) => {
      const matchesSearch = !query ||
        user.username.toLowerCase().includes(query) ||
        user.fullName.toLowerCase().includes(query);
      return matchesSearch &&
        (!this.roleFilter || user.role === this.roleFilter) &&
        (!this.statusFilter || user.status === this.statusFilter);
    });
    this.currentPage = 1;
    this.renderTable();
    this.renderRoleSummary();
    this.updateUsersPagination();
    this.updateClearStaffButton();
  }

  renderTable() {
    const tbody = document.getElementById('users-tbody');
    const count = document.getElementById('users-count');
    if (!tbody) return;
    const total = this.filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(total / this.perPage));
    this.currentPage = Math.min(this.currentPage, totalPages);
    const start = (this.currentPage - 1) * this.perPage;
    const end = Math.min(start + this.perPage, total);
    const pageUsers = this.filteredUsers.slice(start, end);
    if (count) {
      count.textContent = total
        ? `Showing ${start + 1}-${end} of ${total} user${total === 1 ? '' : 's'}`
        : 'Showing 0-0 of 0 users';
    }

    if (!pageUsers.length) {
      window.TemplateRenderer?.appendEmptyRow(tbody, 6, 'No users found', 'Try another search or filter.', 'user-empty-row');
      return;
    }

    const fragment = document.createDocumentFragment();
    pageUsers.forEach((user) => {
      const id = String(user.id);
      const isAdmin = user.username.toLowerCase() === 'admin';
      const statusClass = user.status.toLowerCase();
      const row = window.TemplateRenderer?.clone('user-row-template') || document.createElement('tr');
      const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
      row.querySelector('[data-username]')?.replaceChildren(make('span', { className: 'user-username-pill', text: user.username }));
      const nameCell = make('div', { className: 'user-full-name-cell' });
      nameCell.appendChild(make('span', { text: user.fullName }));
      row.querySelector('[data-name]')?.replaceChildren(nameCell);
      const roleBadge = make('span', { className: `role-badge ${user.role.toLowerCase()}` });
      roleBadge.append(this.iconNode('staff_shield_icon.svg', 'custom-ui-icon inline-icon-img'), document.createTextNode(user.role));
      row.querySelector('[data-role]')?.replaceChildren(roleBadge);
      const statusBadge = make('span', { className: `user-status-badge ${statusClass}` });
      statusBadge.append(make('span', { className: `status-dot ${statusClass}` }), document.createTextNode(user.status));
      row.querySelector('[data-status]')?.replaceChildren(statusBadge);
      row.querySelector('[data-last-login]')?.replaceChildren(make('span', { className: 'user-last-login', text: this.formatDate(user.lastLogin) }));
      row.querySelector('[data-actions]')?.replaceChildren(this.createUserActions(user, id, isAdmin));
      fragment.appendChild(row);
    });
    tbody.replaceChildren(fragment);
  }

  updateUsersPagination() {
    const container = document.getElementById('users-pagination');
    if (!container) return;
    const totalPages = Math.ceil(this.filteredUsers.length / this.perPage);
    window.TemplateRenderer?.renderPagination(container, totalPages, this.currentPage, (page) => {
      const total = Math.max(1, Math.ceil(this.filteredUsers.length / this.perPage));
      if (page === 'prev') this.currentPage = Math.max(1, this.currentPage - 1);
      else if (page === 'next') this.currentPage = Math.min(total, this.currentPage + 1);
      else this.currentPage = parseInt(page, 10);
      this.renderTable();
      this.updateUsersPagination();
    });
  }

  iconNode(file, className = 'custom-ui-icon') {
    return window.TemplateRenderer?.icon?.(`assets/images/icons/custom/${file}`, className) || document.createTextNode('');
  }

  createUserActions(user, id, isAdmin) {
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    const wrapper = make('div', { className: 'user-actions-menu' });
    const trigger = make('button', { className: 'user-action-trigger', attrs: { type: 'button', 'aria-label': 'User actions', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: 'Actions' }, dataset: { userActions: id } });
    trigger.appendChild(this.iconNode('more_vertical_icon.svg', 'custom-ui-icon'));
    const dropdown = make('div', { className: 'user-actions-dropdown', attrs: { role: 'menu' } });
    dropdown.append(
      this.createUserMenuItem('view', id, 'eye_icon.svg', 'View Details'),
      this.createUserMenuItem('edit', id, 'edit_icon.svg', 'Edit User'),
      this.createUserMenuItem('reset-password', id, 'key_icon.svg', 'Reset Password'),
      this.createUserMenuItem('activity', id, 'activity_icon.svg', 'View Activity')
    );
    if (!isAdmin) {
      dropdown.appendChild(make('div', { className: 'user-menu-divider' }));
      dropdown.appendChild(user.status === 'Active'
        ? this.createUserMenuItem('lock', id, 'lock_icon.svg', 'Lock Account')
        : this.createUserMenuItem('activate', id, 'check_status_icon.png', 'Activate'));
      dropdown.appendChild(this.createUserMenuItem('delete', id, 'trash_icon.svg', 'Delete', true));
    }
    wrapper.append(trigger, dropdown);
    return wrapper;
  }

  createUserMenuItem(action, id, icon, label, danger = false) {
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    const button = make('button', { className: `user-menu-item${danger ? ' danger' : ''}`, attrs: { type: 'button', role: 'menuitem' }, dataset: { action, id } });
    button.append(this.iconNode(icon, 'custom-ui-icon inline-icon-img'), make('span', { text: label }));
    return button;
  }

  menuItem(action, id, icon, label, danger = false) {
    const fileMap = { eye: 'eye_icon.svg', edit: 'edit_icon.svg', key: 'key_icon.svg', activity: 'activity_icon.svg', lock: 'lock_icon.svg', check: 'check_status_icon.png', trash: 'trash_icon.svg' };
    const wrapper = document.createElement('div');
    wrapper.appendChild(this.createUserMenuItem(action, id, fileMap[icon] || 'check_status_icon.png', label, danger));
    return wrapper.innerHTML;
  }

  menuItem(action, id, icon, label, danger = false) {
    return `
      <button type="button" class="user-menu-item${danger ? ' danger' : ''}" data-action="${action}" data-id="${id}" role="menuitem">
        ${this.getIcon(icon, 14)}<span>${label}</span>
      </button>`;
  }

  renderRoleSummary() {
    const container = document.getElementById('role-summary');
    if (!container) return;
    const colors = { Admin: '#111827', Manager: '#4f46e5', Cashier: '#059669', Inventory: '#ea580c', Viewer: '#94a3b8' };
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    const fragment = document.createDocumentFragment();
    Object.keys(colors).forEach((role) => {
      const item = make('div', { className: 'user-role-summary-item' });
      item.append(
        make('span', { className: 'user-role-dot', attrs: { style: `background:${colors[role]}` } }),
        make('span', { className: 'user-role-name', text: `${role}:` }),
        make('strong', { text: this.users.filter((user) => user.role === role).length })
      );
      fragment.appendChild(item);
    });
    container.replaceChildren(fragment);
  }

  updateClearStaffButton() {
    const button = document.getElementById('clear-staff-btn');
    if (button) button.disabled = !this.users.some((user) => user.username.toLowerCase() !== 'admin');
  }

  openAddModal() {
    document.getElementById('user-form-title').textContent = 'Add New User';
    document.getElementById('user-edit-id').value = '';
    document.getElementById('user-username').value = '';
    document.getElementById('user-fullname').value = '';
    document.getElementById('user-email').value = '';
    document.getElementById('user-role').value = 'Cashier';
    document.getElementById('user-active').checked = true;
    this.editingOriginalStatus = null;
    this.setAdminFormRestrictions(false);
    this.resetUserPasswordField(true);
    this.renderAdditionalPermissions([]);
    this.updateRolePermissionsPreview();
    this.updateActiveToggle(true);
    document.getElementById('user-form-modal').style.display = 'flex';
  }

  editUser(id) {
    const user = this.findUser(id);
    if (!user) return;
    const isAdmin = user.username.toLowerCase() === 'admin';
    this.editingOriginalStatus = user.status;

    document.getElementById('user-form-title').textContent = 'Edit User';
    document.getElementById('user-edit-id').value = user.id;
    document.getElementById('user-username').value = user.username;
    document.getElementById('user-fullname').value = user.fullName;
    document.getElementById('user-email').value = user.email;
    document.getElementById('user-role').value = user.role;
    document.getElementById('user-active').checked = user.status === 'Active';
    this.setAdminFormRestrictions(isAdmin);
    this.resetUserPasswordField(false);
    this.renderAdditionalPermissions(user.permissions);
    this.updateRolePermissionsPreview();
    this.updateActiveToggle(user.status === 'Active');
    document.getElementById('user-form-modal').style.display = 'flex';
  }

  setAdminFormRestrictions(isAdmin) {
    const username = document.getElementById('user-username');
    const role = document.getElementById('user-role');
    const active = document.getElementById('user-active');
    if (username) username.disabled = isAdmin;
    if (role) role.disabled = isAdmin;
    if (active) active.disabled = isAdmin;
  }

  renderAdditionalPermissions(selectedPermissions = []) {
    const container = document.getElementById('additional-permissions');
    if (!container) return;
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    const fragment = document.createDocumentFragment();
    this.permissionsCatalog.forEach((permission) => {
      const label = make('label', { className: 'user-permission-override' });
      const input = make('input', { attrs: { type: 'checkbox', value: permission.key } });
      input.checked = selectedPermissions.includes(permission.key);
      const check = make('span', { className: 'user-permission-check' });
      check.appendChild(this.iconNode('check_status_icon.png', 'custom-ui-icon inline-icon-img'));
      label.append(input, check, make('span', { text: permission.label }));
      fragment.appendChild(label);
    });
    container.replaceChildren(fragment);
  }

  getSelectedPermissions() {
    return [...document.querySelectorAll('#additional-permissions input:checked')].map((input) => input.value);
  }

  isStrongPassword(password) {
    return typeof password === 'string' &&
      password.length >= 12 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
  }

  passwordRequirementMessage() {
    return 'Password must be at least 12 characters and include uppercase, lowercase, number, and symbol.';
  }

  updateRolePermissionsPreview() {
    const role = document.getElementById('user-role')?.value || 'Cashier';
    const container = document.getElementById('role-permissions-preview');
    if (!container) return;
    const permissions = this.rolePermissions[role] || [];
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    const title = make('strong', { text: 'Role Permissions' });
    const tags = make('div', { className: 'role-permission-tags' });
    if (permissions.length) {
      permissions.forEach((key) => tags.appendChild(make('span', { text: this.permissionLabel(key) })));
    } else {
      tags.appendChild(make('em', { text: 'No default permissions for this role' }));
    }
    container.replaceChildren(title, tags);
  }

  permissionLabel(key) {
    return this.permissionsCatalog.find((permission) => permission.key === key)?.label || key;
  }

  resetUserPasswordField(show) {
    const input = document.getElementById('user-password');
    const section = document.getElementById('user-password-section');
    const button = document.getElementById('toggle-user-password');
    if (input) {
      input.value = '';
      input.type = 'password';
    }
    if (section) section.style.display = show ? 'block' : 'none';
    if (button) {
      button.setAttribute('aria-label', 'Show password');
      button.setAttribute('title', 'Show password');
      button.replaceChildren(this.iconNode('eye_icon.svg', 'custom-ui-icon'));
    }
    this.refreshIcons();
  }

  updateActiveToggle(isActive) {
    const slider = document.getElementById('user-active-slider');
    const dot = document.getElementById('user-active-dot');
    if (!slider || !dot) return;
    slider.className = isActive ? '' : 'inactive-bg';
    dot.className = isActive ? '' : 'inactive-pos';
    slider.style.background = isActive ? '#10b981' : '';
    dot.style.left = isActive ? '22px' : '';
  }

  async saveUser() {
    const id = document.getElementById('user-edit-id').value;
    const password = document.getElementById('user-password').value;
    const userData = {
      username: document.getElementById('user-username').value.trim(),
      fullName: document.getElementById('user-fullname').value.trim(),
      email: document.getElementById('user-email').value.trim(),
      role: document.getElementById('user-role').value,
      status: document.getElementById('user-active').checked
        ? 'Active'
        : (id && this.editingOriginalStatus === 'Locked' ? 'Locked' : 'Inactive'),
      permissions: this.getSelectedPermissions()
    };

    if (!userData.username || !userData.fullName) {
      this.showNotification('Username and Full Name are required', 'error');
      return;
    }
    if (!id && !this.isStrongPassword(password)) {
      this.showNotification(this.passwordRequirementMessage(), 'error');
      document.getElementById('user-password').focus();
      return;
    }

    const button = document.getElementById('save-user-btn');
    this.setButtonBusy(button, true, id ? 'Saving...' : 'Creating...');
    try {
      if (id) {
        await this.callApi('updateUser', id, userData);
        this.showNotification('User updated successfully', 'success');
      } else {
        await this.callApi('createUser', { ...userData, password });
        this.showNotification('User created successfully', 'success');
      }
      await this.loadUsers();
      this.closeModal('user-form-modal');
      this.editingOriginalStatus = null;
      this.filterUsers();
    } catch (error) {
      this.showNotification(error.message, 'error');
    } finally {
      this.setButtonBusy(button, false);
    }
  }

  async deleteUser(id) {
    const user = this.findUser(id);
    if (!user) return;
    if (user.username.toLowerCase() === 'admin') {
      this.showNotification('Cannot delete the main administrator', 'warning');
      return;
    }
    const confirmed = await window.AppDialogs?.confirm(`Delete user "${user.username}"?`, {
      title: 'Delete User',
      eyebrow: 'System Administration',
      primaryLabel: 'Delete User',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      await this.callApi('deleteUser', id);
      await this.loadUsers();
      this.filterUsers();
      this.showNotification('User deleted', 'success');
    } catch (error) {
      this.showNotification(error.message, 'error');
    }
  }

  async clearStaff() {
    const staff = this.users.filter((user) => user.username.toLowerCase() !== 'admin');
    if (!staff.length) return;
    const confirmed = await window.AppDialogs?.confirm(
      `Delete ${staff.length} staff account${staff.length === 1 ? '' : 's'}? The main administrator will be preserved.`,
      {
        title: 'Clear Staff Accounts',
        eyebrow: 'System Administration',
        primaryLabel: 'Clear Staff',
        variant: 'danger'
      }
    );
    if (!confirmed) return;

    const button = document.getElementById('clear-staff-btn');
    this.setButtonBusy(button, true, 'Clearing...');
    try {
      const result = await this.callApi('clearStaffUsers');
      await this.loadUsers();
      this.filterUsers();
      this.showNotification(`${result.data?.deleted || staff.length} staff account${staff.length === 1 ? '' : 's'} removed`, 'success');
    } catch (error) {
      this.showNotification(error.message, 'error');
    } finally {
      this.setButtonBusy(button, false);
    }
  }

  async setUserStatus(id, status) {
    const user = this.findUser(id);
    if (!user) return;
    try {
      await this.callApi('setUserStatus', id, status);
      await this.loadUsers();
      this.filterUsers();
      this.showNotification(`${user.fullName} is now ${status.toLowerCase()}`, 'success');
    } catch (error) {
      this.showNotification(error.message, 'error');
    }
  }

  showUserDetails(id) {
    const user = this.findUser(id);
    if (!user) return;
    this.detailsUserId = id;
    const permissions = [...new Set([...(this.rolePermissions[user.role] || []), ...user.permissions])];
    document.getElementById('user-details-title').textContent = user.fullName;
    const resetButton = document.getElementById('user-details-reset-password');
    if (resetButton) {
      resetButton.dataset.userId = id;
      resetButton.hidden = !this.currentUserCanResetPasswords();
    }
    const body = document.getElementById('user-details-body');
    if (!body) return;
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    const dl = make('dl', { className: 'user-details-grid' });
    [
      ['Username', user.username],
      ['Email', user.email || 'Not provided'],
      ['Role', user.role],
      ['Status', user.status],
      ['Last Login', this.formatDate(user.lastLogin)],
      ['Created', this.formatDate(user.createdAt)]
    ].forEach(([label, value]) => {
      const item = make('div');
      item.append(make('dt', { text: label }), make('dd', { text: value }));
      dl.appendChild(item);
    });
    const permissionsBlock = make('div', { className: 'user-details-permissions' });
    permissionsBlock.appendChild(make('h4', { text: 'Effective Permissions' }));
    const tags = make('div', { className: 'role-permission-tags' });
    if (permissions.length) permissions.forEach((key) => tags.appendChild(make('span', { text: this.permissionLabel(key) })));
    else tags.appendChild(make('em', { text: 'No permissions assigned' }));
    permissionsBlock.appendChild(tags);
    body.replaceChildren(dl, permissionsBlock);
    this.openModal('user-details-modal');
  }

  openResetPassword(id) {
    const user = this.findUser(id);
    if (!user) return;
    this.resetUserId = id;
    document.getElementById('reset-user-name').textContent = user.fullName;
    document.getElementById('reset-user-password').value = '';
    document.getElementById('confirm-reset-user-password').value = '';
    this.openModal('reset-user-password-modal');
    setTimeout(() => document.getElementById('reset-user-password')?.focus(), 0);
  }

  async resetPassword() {
    const password = document.getElementById('reset-user-password').value;
    const confirmation = document.getElementById('confirm-reset-user-password').value;
    if (!this.isStrongPassword(password)) {
      this.showNotification(this.passwordRequirementMessage(), 'error');
      return;
    }
    if (password !== confirmation) {
      this.showNotification('Passwords do not match', 'error');
      return;
    }

    const button = document.getElementById('confirm-reset-password-btn');
    this.setButtonBusy(button, true, 'Updating...');
    try {
      await this.callApi('resetUserPassword', this.resetUserId, password);
      this.closeModal('reset-user-password-modal');
      this.showNotification('Password updated successfully', 'success');
    } catch (error) {
      this.showNotification(error.message, 'error');
    } finally {
      this.setButtonBusy(button, false);
    }
  }

  async showUserActivity(id) {
    const user = this.findUser(id);
    if (!user) return;
    document.getElementById('user-activity-title').textContent = `${user.fullName} Activity`;
    const body = document.getElementById('user-activity-body');
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    body.replaceChildren(make('div', { className: 'user-modal-loading', text: 'Loading activity...' }));
    this.openModal('user-activity-modal');

    try {
      const result = await this.callApi('getUserActivity', id);
      const records = result.data || [];
      if (!records.length) {
        body.replaceChildren(make('div', { className: 'user-modal-empty', text: 'No activity has been recorded for this user.' }));
        return;
      }
      const list = make('div', { className: 'user-activity-list' });
      records.forEach((record) => {
        const item = make('div', { className: 'user-activity-item' });
        const details = make('div');
        details.append(
          make('strong', { text: record.action }),
          make('p', { text: record.details || 'No additional details' }),
          make('time', { text: this.formatDate(record.created_at) })
        );
        item.append(make('span', { className: 'user-activity-dot' }), details);
        list.appendChild(item);
      });
      body.replaceChildren(list);
    } catch (error) {
      body.replaceChildren(make('div', { className: 'user-modal-empty', text: error.message }));
    }
  }

  renderRolesPanel() {
    this.renderRoleSidebar();
    this.renderPermissionsGrid();
  }

  renderRoleSidebar() {
    const container = document.getElementById('role-list-sidebar');
    if (!container) return;
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    const fragment = document.createDocumentFragment();
    ['Admin', 'Manager', 'Cashier', 'Inventory', 'Viewer'].forEach((role) => {
      const button = make('button', { className: `role-sidebar-btn ${this.selectedRole === role ? 'selected' : ''}`, attrs: { type: 'button' }, dataset: { role } });
      const info = make('div', { className: 'role-info' });
      info.append(make('h4', { text: role }), make('p', { text: `${(this.rolePermissions[role] || []).length} Active Permissions` }));
      button.appendChild(info);
      if (this.selectedRole === role) button.appendChild(make('span', { className: 'role-sidebar-dot' }));
      button.onclick = () => {
        this.selectedRole = role;
        this.renderRolesPanel();
      };
      fragment.appendChild(button);
    });
    container.replaceChildren(fragment);
  }

  renderPermissionsGrid() {
    const title = document.getElementById('permissions-role-title');
    const container = document.getElementById('permissions-list');
    if (!container) return;
    if (title) title.textContent = `Permissions: ${this.selectedRole}`;
    const current = this.rolePermissions[this.selectedRole] || [];
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    const fragment = document.createDocumentFragment();

    ['Sales', 'Inventory', 'Reports', 'Documents', 'System'].forEach((category) => {
      const categoryBlock = make('div', { className: 'permission-category' });
      categoryBlock.appendChild(make('h4', { text: `${category} Functions` }));
      const grid = make('div', { className: 'permission-category-grid' });
      this.permissionsCatalog.filter((permission) => permission.category === category).forEach((permission) => {
        const enabled = current.includes(permission.key);
        const card = make('button', { className: `permission-card ${enabled ? 'enabled' : ''}`, attrs: { type: 'button' }, dataset: { perm: permission.key } });
        const checkbox = make('span', { className: 'permission-checkbox' });
        if (enabled) checkbox.appendChild(this.iconNode('check_status_icon.png', 'custom-ui-icon inline-icon-img'));
        const text = make('span');
        text.append(make('span', { className: 'permission-name', text: permission.label }), make('span', { className: 'permission-desc', text: permission.description }));
        card.append(checkbox, text);
        card.onclick = () => {
          const key = permission.key;
          const permissions = this.rolePermissions[this.selectedRole] || [];
          this.rolePermissions[this.selectedRole] = permissions.includes(key)
            ? permissions.filter((item) => item !== key)
            : [...permissions, key];
          this.renderRolesPanel();
        };
        grid.appendChild(card);
      });
      categoryBlock.appendChild(grid);
      fragment.appendChild(categoryBlock);
    });
    container.replaceChildren(fragment);
  }

  async saveRolePermissions() {
    const button = document.getElementById('save-roles-btn');
    this.setButtonBusy(button, true, 'Saving...');
    try {
      await this.callApi('saveRolePermissions', this.rolePermissions);
      this.updateRolePermissionsPreview();
      this.showNotification('Role permissions updated', 'success');
    } catch (error) {
      this.showNotification(error.message, 'error');
    } finally {
      this.setButtonBusy(button, false);
    }
  }

  ensureFeatureModals() {
    ['user-details-modal', 'reset-user-password-modal', 'user-activity-modal'].forEach((id) => {
      if (!document.getElementById(id)) console.error(`Missing #${id} in index.html`);
    });
  }

  setupEventListeners() {
    document.querySelectorAll('.users-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.users-tab').forEach((item) => item.classList.remove('active'));
        document.querySelectorAll('.users-panel').forEach((panel) => panel.classList.remove('active'));
        tab.classList.add('active');
        this.currentView = tab.dataset.view;
        document.getElementById(`${this.currentView}-panel`)?.classList.add('active');
        if (this.currentView === 'roles-management') this.renderRolesPanel();
      });
    });

    document.getElementById('user-search')?.addEventListener('input', (event) => {
      this.searchQuery = event.target.value;
      this.filterUsers();
    });
    document.getElementById('user-role-filter')?.addEventListener('change', (event) => {
      this.roleFilter = event.target.value;
      this.filterUsers();
    });
    document.getElementById('user-status-filter')?.addEventListener('change', (event) => {
      this.statusFilter = event.target.value;
      this.filterUsers();
    });
    document.getElementById('user-per-page-select')?.addEventListener('change', (event) => {
      this.perPage = parseInt(event.target.value, 10) || 25;
      this.currentPage = 1;
      this.renderTable();
      this.updateUsersPagination();
    });
    document.getElementById('user-role')?.addEventListener('change', () => this.updateRolePermissionsPreview());
    document.getElementById('user-active')?.addEventListener('change', (event) => this.updateActiveToggle(event.target.checked));
    document.getElementById('add-user-btn')?.addEventListener('click', () => this.openAddModal());
    document.getElementById('clear-staff-btn')?.addEventListener('click', () => this.clearStaff());
    document.getElementById('save-user-btn')?.addEventListener('click', () => this.saveUser());
    document.getElementById('save-roles-btn')?.addEventListener('click', () => this.saveRolePermissions());
    document.getElementById('confirm-reset-password-btn')?.addEventListener('click', () => this.resetPassword());
    document.getElementById('user-details-reset-password')?.addEventListener('click', (event) => {
      const id = event.currentTarget?.dataset?.userId || this.detailsUserId;
      if (!id) return;
      this.closeModal('user-details-modal');
      this.openResetPassword(id);
    });
    document.getElementById('toggle-user-password')?.addEventListener('click', () => this.togglePasswordVisibility());

    document.getElementById('users-tbody')?.addEventListener('click', (event) => this.handleTableClick(event));
    document.querySelectorAll('[data-user-modal-close]').forEach((button) => {
      button.addEventListener('click', () => this.closeModal(button.dataset.userModalClose));
    });
    document.querySelectorAll('.user-feature-modal').forEach((modal) => {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) this.closeModal(modal.id);
      });
    });
    document.getElementById('user-form-modal')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) this.closeModal('user-form-modal');
    });
    document.addEventListener('click', () => this.closeUserActionMenus());
  }

  handleTableClick(event) {
    const trigger = event.target.closest('[data-user-actions]');
    if (trigger) {
      event.stopPropagation();
      const menu = trigger.closest('.user-actions-menu');
      const isOpen = menu.classList.contains('open');
      this.closeUserActionMenus();
      if (!isOpen) {
        menu.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
      return;
    }

    const item = event.target.closest('.user-menu-item');
    if (!item) return;
    event.stopPropagation();
    this.closeUserActionMenus();
    const { action, id } = item.dataset;
    if (action === 'view') this.showUserDetails(id);
    if (action === 'edit') this.editUser(id);
    if (action === 'reset-password') this.openResetPassword(id);
    if (action === 'activity') this.showUserActivity(id);
    if (action === 'activate') this.setUserStatus(id, 'Active');
    if (action === 'lock') this.setUserStatus(id, 'Locked');
    if (action === 'delete') this.deleteUser(id);
  }

  togglePasswordVisibility() {
    const input = document.getElementById('user-password');
    const button = document.getElementById('toggle-user-password');
    if (!input || !button) return;
    const isVisible = input.type === 'text';
    input.type = isVisible ? 'password' : 'text';
    button.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
    button.setAttribute('title', isVisible ? 'Show password' : 'Hide password');
    button.replaceChildren(this.iconNode('check_status_icon.png', 'custom-ui-icon'));
    this.refreshIcons();
  }

  findUser(id) {
    return this.users.find((user) => String(user.id) === String(id));
  }

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
  }

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
    if (id === 'reset-user-password-modal') this.resetUserId = null;
    if (id === 'user-details-modal') this.detailsUserId = null;
  }

  closeUserActionMenus() {
    document.querySelectorAll('.user-actions-menu.open').forEach((menu) => {
      menu.classList.remove('open');
      menu.querySelector('[data-user-actions]')?.setAttribute('aria-expanded', 'false');
    });
  }

  setButtonBusy(button, busy, label = '') {
    if (!button) return;
    if (busy) {
      button.dataset.originalLabel = button.innerHTML;
      button.disabled = true;
      button.textContent = label;
    } else {
      button.disabled = false;
      if (button.dataset.originalLabel) {
        button.innerHTML = button.dataset.originalLabel;
        delete button.dataset.originalLabel;
      }
    }
  }

  formatDate(value) {
    if (!value || value === 'Never') return 'Never';
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return String(value);
    return window.AppFormatters?.formatDateTime(date) || date.toLocaleString();
  }

  getIcon(name, size = 16) {
    const attrs = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
    const icons = {
      shield: `<svg ${attrs}><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-4"/></svg>`,
      moreVertical: `<svg ${attrs}><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>`,
      eye: `<svg ${attrs}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`,
      edit: `<svg ${attrs}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
      key: `<svg ${attrs}><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15 7 2 2"/><path d="m18 4 2 2"/></svg>`,
      activity: `<svg ${attrs}><path d="M3 3v18h18"/><path d="m7 16 4-5 3 3 5-7"/></svg>`,
      check: `<svg ${attrs}><path d="m20 6-11 11-5-5"/></svg>`,
      lock: `<svg ${attrs}><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
      trash: `<svg ${attrs}><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>`,
      users: `<svg ${attrs}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>`,
      userPlus: `<svg ${attrs}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`
    };
    return icons[name] || '';
  }

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  refreshIcons() {
    if (window.lucide?.createIcons) window.lucide.createIcons();
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

window.UsersView = UsersView;
