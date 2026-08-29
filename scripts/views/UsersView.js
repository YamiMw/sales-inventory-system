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

  renderUsersListLayout() {
    const panel = document.getElementById('users-list-panel');
    if (!panel) return;

    document.querySelector('#users-view .header-actions')?.remove();
    document.querySelector('#users-view .user-management-toolbar')?.remove();

    panel.insertAdjacentHTML('beforebegin', `
      <div class="user-management-toolbar">
        <button type="button" id="clear-staff-btn" class="user-clear-button" title="Clear staff accounts">
          ${this.getIcon('trash', 16)}
          <span>Clear Staff</span>
        </button>
        <div class="users-tab-switcher" aria-label="User management view">
          <button type="button" class="users-tab active" data-view="users-list">USERS</button>
          <button type="button" class="users-tab" data-view="roles-management">ROLES</button>
        </div>
        <button type="button" id="add-user-btn" class="user-add-button">
          ${this.getIcon('userPlus', 18)}
          <span>Add User</span>
        </button>
      </div>
    `);

    panel.innerHTML = `
      <div class="user-management-filters">
        <label class="user-search-control" for="user-search">
          <img src="assets/images/icons/custom/search_icon.png" alt="" class="custom-ui-icon" aria-hidden="true">
          <input type="search" id="user-search" placeholder="Search by username or name..." autocomplete="off">
        </label>
        <label class="user-filter-control" for="user-role-filter">
          <img src="assets/images/icons/custom/staff_shield_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true">
          <select id="user-role-filter" aria-label="Filter users by role">
            <option value="">All Roles</option>
            <option>Admin</option><option>Manager</option><option>Cashier</option>
            <option>Inventory</option><option>Viewer</option>
          </select>
          <img src="assets/images/icons/custom/chevron_down_icon.svg" alt="" class="custom-ui-icon user-filter-chevron" aria-hidden="true">
        </label>
        <label class="user-filter-control" for="user-status-filter">
          <img src="assets/images/icons/custom/refresh_icon.png" alt="" class="custom-ui-icon" aria-hidden="true">
          <select id="user-status-filter" aria-label="Filter users by status">
            <option value="">All</option>
            <option>Active</option><option>Locked</option><option>Inactive</option>
          </select>
          <img src="assets/images/icons/custom/chevron_down_icon.svg" alt="" class="custom-ui-icon user-filter-chevron" aria-hidden="true">
        </label>
      </div>
      <div class="products-table-container user-management-table-card">
        <div class="table-header products-table-toolbar users-table-toolbar">
          <span id="users-count">Showing 0-0 of 0 users</span>
          <label class="per-page-selector" for="user-per-page-select">
            <span>Per Page:</span>
            <select id="user-per-page-select">
              <option value="10">10</option>
              <option value="25" selected>25</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>
        <div class="table-wrapper user-management-table-wrap">
          <table class="products-table users-table user-management-table">
            <thead>
              <tr>
                <th class="user-username-col">Username</th><th class="user-name-col">Full Name</th><th class="user-role-col">Role</th>
                <th class="user-status-col">Status</th><th class="user-last-login-col">Last Login</th><th class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody id="users-tbody"></tbody>
          </table>
        </div>
        <div class="table-footer users-table-footer">
          <div class="user-role-summary-footer">
            <div class="user-role-summary-title">
              ${this.getIcon('activity', 16)}
              <span>Role Summary</span>
            </div>
            <div id="role-summary" class="user-role-summary"></div>
          </div>
          <div class="pagination" id="users-pagination"></div>
        </div>
      </div>
    `;
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
      tbody.innerHTML = `
        <tr class="user-empty-row"><td colspan="6">
          <div class="user-empty-state">
            ${this.getIcon('users', 28)}
            <strong>No users found</strong>
            <span>Try another search or filter.</span>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = pageUsers.map((user) => {
      const id = this.escapeHtml(String(user.id));
      const isAdmin = user.username.toLowerCase() === 'admin';
      const statusClass = user.status.toLowerCase();
      return `
        <tr>
          <td><span class="user-username-pill">${this.escapeHtml(user.username)}</span></td>
          <td><div class="user-full-name-cell"><span>${this.escapeHtml(user.fullName)}</span></div></td>
          <td><span class="role-badge ${user.role.toLowerCase()}">${this.getIcon('shield', 12)}${this.escapeHtml(user.role)}</span></td>
          <td><span class="user-status-badge ${statusClass}"><span class="status-dot ${statusClass}"></span>${this.escapeHtml(user.status)}</span></td>
          <td><span class="user-last-login">${this.escapeHtml(this.formatDate(user.lastLogin))}</span></td>
          <td>
            <div class="user-actions-menu">
              <button type="button" class="user-action-trigger" data-user-actions="${id}"
                aria-label="User actions" aria-haspopup="menu" aria-expanded="false" title="Actions">
                ${this.getIcon('moreVertical', 18)}
              </button>
              <div class="user-actions-dropdown" role="menu">
                ${this.menuItem('view', id, 'eye', 'View Details')}
                ${this.menuItem('edit', id, 'edit', 'Edit User')}
                ${this.menuItem('reset-password', id, 'key', 'Reset Password')}
                ${this.menuItem('activity', id, 'activity', 'View Activity')}
                ${isAdmin ? '' : `
                  <div class="user-menu-divider"></div>
                  ${user.status === 'Active'
                    ? this.menuItem('lock', id, 'lock', 'Lock Account')
                    : this.menuItem('activate', id, 'check', 'Activate')}
                  ${this.menuItem('delete', id, 'trash', 'Delete', true)}
                `}
              </div>
            </div>
          </td>
        </tr>`;
    }).join('');
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
    container.innerHTML = Object.keys(colors).map((role) => `
      <div class="user-role-summary-item">
        <span class="user-role-dot" style="background:${colors[role]}"></span>
        <span class="user-role-name">${role}:</span>
        <strong>${this.users.filter((user) => user.role === role).length}</strong>
      </div>`).join('');
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
    container.innerHTML = this.permissionsCatalog.map((permission) => `
      <label class="user-permission-override">
        <input type="checkbox" value="${permission.key}" ${selectedPermissions.includes(permission.key) ? 'checked' : ''}>
        <span class="user-permission-check">${this.getIcon('check', 12)}</span>
        <span>${this.escapeHtml(permission.label)}</span>
      </label>`).join('');
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
    container.innerHTML = `
      <strong>Role Permissions</strong>
      <div class="role-permission-tags">
        ${permissions.length
          ? permissions.map((key) => `<span>${this.escapeHtml(this.permissionLabel(key))}</span>`).join('')
          : '<em>No default permissions for this role</em>'}
      </div>`;
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
      button.innerHTML = '<img src="assets/images/icons/custom/eye_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true">';
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
    if (!confirm(`Delete user "${user.username}"?`)) return;

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
    if (!confirm(`Delete ${staff.length} staff account${staff.length === 1 ? '' : 's'}? The main administrator will be preserved.`)) return;

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
    const permissions = [...new Set([...(this.rolePermissions[user.role] || []), ...user.permissions])];
    document.getElementById('user-details-title').textContent = user.fullName;
    document.getElementById('user-details-body').innerHTML = `
      <dl class="user-details-grid">
        <div><dt>Username</dt><dd>${this.escapeHtml(user.username)}</dd></div>
        <div><dt>Email</dt><dd>${this.escapeHtml(user.email || 'Not provided')}</dd></div>
        <div><dt>Role</dt><dd>${this.escapeHtml(user.role)}</dd></div>
        <div><dt>Status</dt><dd>${this.escapeHtml(user.status)}</dd></div>
        <div><dt>Last Login</dt><dd>${this.escapeHtml(this.formatDate(user.lastLogin))}</dd></div>
        <div><dt>Created</dt><dd>${this.escapeHtml(this.formatDate(user.createdAt))}</dd></div>
      </dl>
      <div class="user-details-permissions">
        <h4>Effective Permissions</h4>
        <div class="role-permission-tags">
          ${permissions.length
            ? permissions.map((key) => `<span>${this.escapeHtml(this.permissionLabel(key))}</span>`).join('')
            : '<em>No permissions assigned</em>'}
        </div>
      </div>`;
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
    body.innerHTML = '<div class="user-modal-loading">Loading activity...</div>';
    this.openModal('user-activity-modal');

    try {
      const result = await this.callApi('getUserActivity', id);
      const records = result.data || [];
      body.innerHTML = records.length ? `
        <div class="user-activity-list">
          ${records.map((record) => `
            <div class="user-activity-item">
              <span class="user-activity-dot"></span>
              <div>
                <strong>${this.escapeHtml(record.action)}</strong>
                <p>${this.escapeHtml(record.details || 'No additional details')}</p>
                <time>${this.escapeHtml(this.formatDate(record.created_at))}</time>
              </div>
            </div>`).join('')}
        </div>` : '<div class="user-modal-empty">No activity has been recorded for this user.</div>';
    } catch (error) {
      body.innerHTML = `<div class="user-modal-empty">${this.escapeHtml(error.message)}</div>`;
    }
  }

  renderRolesPanel() {
    this.renderRoleSidebar();
    this.renderPermissionsGrid();
  }

  renderRoleSidebar() {
    const container = document.getElementById('role-list-sidebar');
    if (!container) return;
    container.innerHTML = ['Admin', 'Manager', 'Cashier', 'Inventory', 'Viewer'].map((role) => `
      <button type="button" class="role-sidebar-btn ${this.selectedRole === role ? 'selected' : ''}" data-role="${role}">
        <div class="role-info">
          <h4>${role}</h4>
          <p>${(this.rolePermissions[role] || []).length} Active Permissions</p>
        </div>
        ${this.selectedRole === role ? '<span class="role-sidebar-dot"></span>' : ''}
      </button>`).join('');
    container.querySelectorAll('[data-role]').forEach((button) => {
      button.onclick = () => {
        this.selectedRole = button.dataset.role;
        this.renderRolesPanel();
      };
    });
  }

  renderPermissionsGrid() {
    const title = document.getElementById('permissions-role-title');
    const container = document.getElementById('permissions-list');
    if (!container) return;
    if (title) title.textContent = `Permissions: ${this.selectedRole}`;
    const current = this.rolePermissions[this.selectedRole] || [];

    container.innerHTML = ['Sales', 'Inventory', 'Reports', 'Documents', 'System'].map((category) => `
      <div class="permission-category">
        <h4>${category} Functions</h4>
        <div class="permission-category-grid">
          ${this.permissionsCatalog.filter((permission) => permission.category === category).map((permission) => {
            const enabled = current.includes(permission.key);
            return `
              <button type="button" class="permission-card ${enabled ? 'enabled' : ''}" data-perm="${permission.key}">
                <span class="permission-checkbox">${enabled ? this.getIcon('check', 12) : ''}</span>
                <span>
                  <span class="permission-name">${this.escapeHtml(permission.label)}</span>
                  <span class="permission-desc">${this.escapeHtml(permission.description)}</span>
                </span>
              </button>`;
          }).join('')}
        </div>
      </div>`).join('');

    container.querySelectorAll('[data-perm]').forEach((card) => {
      card.onclick = () => {
        const key = card.dataset.perm;
        const permissions = this.rolePermissions[this.selectedRole] || [];
        this.rolePermissions[this.selectedRole] = permissions.includes(key)
          ? permissions.filter((permission) => permission !== key)
          : [...permissions, key];
        this.renderRolesPanel();
      };
    });
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
    if (document.getElementById('user-details-modal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="user-details-modal" class="modal-overlay user-feature-modal" style="display:none">
        <div class="modal user-feature-dialog">
          <div class="modal-header">
            <div><span class="user-modal-eyebrow">User Profile</span><h2 id="user-details-title">User Details</h2></div>
            <button type="button" class="modal-close" data-user-modal-close="user-details-modal" aria-label="Close">&times;</button>
          </div>
          <div id="user-details-body" class="modal-body"></div>
          <div class="modal-footer"><button type="button" class="btn-secondary" data-user-modal-close="user-details-modal">Close</button></div>
        </div>
      </div>
      <div id="reset-user-password-modal" class="modal-overlay user-feature-modal" style="display:none">
        <div class="modal user-feature-dialog user-password-dialog">
          <div class="modal-header">
            <div><span class="user-modal-eyebrow">Account Security</span><h2>Reset Password</h2></div>
            <button type="button" class="modal-close" data-user-modal-close="reset-user-password-modal" aria-label="Close">&times;</button>
          </div>
          <div class="modal-body">
            <p class="user-modal-intro">Set a new password for <strong id="reset-user-name"></strong>.</p>
            <div class="form-group"><label for="reset-user-password">New Password *</label><input type="password" id="reset-user-password" autocomplete="new-password"></div>
            <div class="form-group"><label for="confirm-reset-user-password">Confirm Password *</label><input type="password" id="confirm-reset-user-password" autocomplete="new-password"></div>
            <span class="user-password-hint">${this.passwordRequirementMessage()} The password is stored as a secure hash.</span>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" data-user-modal-close="reset-user-password-modal">Cancel</button>
            <button type="button" class="btn-primary" id="confirm-reset-password-btn">Update Password</button>
          </div>
        </div>
      </div>
      <div id="user-activity-modal" class="modal-overlay user-feature-modal" style="display:none">
        <div class="modal user-feature-dialog user-activity-dialog">
          <div class="modal-header">
            <div><span class="user-modal-eyebrow">Audit History</span><h2 id="user-activity-title">User Activity</h2></div>
            <button type="button" class="modal-close" data-user-modal-close="user-activity-modal" aria-label="Close">&times;</button>
          </div>
          <div id="user-activity-body" class="modal-body"></div>
          <div class="modal-footer"><button type="button" class="btn-secondary" data-user-modal-close="user-activity-modal">Close</button></div>
        </div>
      </div>
    `);
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
    button.innerHTML = `<img src="assets/images/icons/custom/check_status_icon.png" alt="" class="custom-ui-icon" aria-hidden="true">`;
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
    else console.log(`[${type}] ${message}`);
  }
}

window.UsersView = UsersView;
