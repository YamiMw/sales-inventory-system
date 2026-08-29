/**
 * Preload
 * Exposes a constrained renderer API and attaches authentication context to privileged IPC calls.
 */

const { contextBridge, ipcRenderer } = require('electron');

let activeToken = null;

function authEnvelope() {
  // The main process removes this envelope before forwarding business arguments.
  return {
    __authContext: true,
    token: activeToken
  };
}

async function publicInvoke(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if ((channel === 'auth:login' || channel === 'auth:validate') && result?.success) {
    activeToken = result.data?.token || args[0] || activeToken;
  }
  return result;
}

function secureInvoke(channel, ...args) {
  return ipcRenderer.invoke(channel, authEnvelope(), ...args);
}

function getDeviceName() {
  return '';
}

ipcRenderer.on('auth:session-ended', () => {
  activeToken = null;
  try {
    window.localStorage.removeItem('auth_token');
    window.sessionStorage.removeItem('auth_token');
    window.localStorage.removeItem('user');
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('app-session-ended'));
});

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => {
    // Generic invocation is intentionally limited to unauthenticated bootstrap channels.
    const validChannels = [
      'auth:login',
      'auth:validate',
      'auth:setup-status',
      'auth:setup-admin',
      'get-system-info',
    ];

    if (validChannels.includes(channel)) {
      return publicInvoke(channel, ...args);
    }

    throw new Error(`Invalid IPC channel: ${channel}`);
  },

  getSystemInfo: () => publicInvoke('get-system-info'),
  getDeviceName,
  setMenuBarVisible: (visible) => {
    ipcRenderer.send('window:set-menu-bar-visible', Boolean(visible));
  },
  setPosWindowMode: (enabled) => {
    ipcRenderer.send('window:set-pos-mode', Boolean(enabled));
  },
  
  login: (credentials) => publicInvoke('auth:login', credentials),
  getSetupStatus: () => publicInvoke('auth:setup-status'),
  setupAdmin: (data) => publicInvoke('auth:setup-admin', data),
  logout: async () => {
    const result = await secureInvoke('auth:logout', activeToken);
    activeToken = null;
    return result;
  },
  validateToken: (token) => publicInvoke('auth:validate', token),
  changePassword: (data) => secureInvoke('auth:change-password', data),

  getUsers: () => secureInvoke('get-users'),
  createUser: (user) => secureInvoke('create-user', user),
  updateUser: (id, user) => secureInvoke('update-user', id, user),
  deleteUser: (id) => secureInvoke('delete-user', id),
  clearStaffUsers: () => secureInvoke('clear-staff-users'),
  setUserStatus: (id, status) => secureInvoke('set-user-status', id, status),
  resetUserPassword: (id, password) => secureInvoke('reset-user-password', id, password),
  getUserActivity: (id) => secureInvoke('get-user-activity', id),
  getRolePermissions: () => secureInvoke('get-role-permissions'),
  saveRolePermissions: (permissions) => secureInvoke('save-role-permissions', permissions),
  getAuditLogs: (filters) => secureInvoke('audit:get', filters || {}),

  dbTest: () => secureInvoke('db-test'),
  getSettings: () => secureInvoke('system:get-settings'),
  updateSettings: (settings) => secureInvoke('system:update-settings', settings),
  getInstalledPrinters: () => secureInvoke('printer:get-installed'),
  testPrinter: (options = {}) => secureInvoke('printer:test-print', options),
  printReceipt: (payload = {}) => secureInvoke('printer:print-receipt', payload),
  backup: (options = {}) => secureInvoke('system:backup', options),
  getAutomaticBackupStatus: () => secureInvoke('system:backup-status'),
  restore: () => secureInvoke('system:restore'),
  
  getDashboardStats: () => secureInvoke('dashboard:get-stats'),
  getSalesChartData: (period) => secureInvoke('dashboard:get-chart-data', period),
  
  getProducts: (filters) => secureInvoke('get-products', filters || {}),
  getProduct: (id) => secureInvoke('get-product', id),
  createProduct: (product) => secureInvoke('create-product', product),
  updateProduct: (id, product) => secureInvoke('update-product', id, product),
  deleteProduct: (id) => secureInvoke('delete-product', id),
  searchProducts: (query) => secureInvoke('search-products', query),
  
  getCategories: () => secureInvoke('get-categories'),
  createCategory: (category) => secureInvoke('create-category', category),
  
  getCustomers: (filters) => secureInvoke('get-customers', filters || {}),
  getCustomer: (id) => secureInvoke('get-customer', id),
  createCustomer: (customer) => secureInvoke('create-customer', customer),
  updateCustomer: (id, customer) => secureInvoke('update-customer', id, customer),
  deleteCustomer: (id) => secureInvoke('delete-customer', id),
  searchCustomers: (query) => secureInvoke('search-customers', query),
  
  getInventory: (filters) => secureInvoke('get-inventory', filters || {}),
  adjustStock: (adjustment) => secureInvoke('adjust-stock', adjustment),
  getStockTransactions: (productId, filters) => secureInvoke('get-stock-transactions', productId, filters || {}),
  getLowStock: () => secureInvoke('get-low-stock'),
  
  createSale: (saleData) => secureInvoke('create-sale', saleData),
  getSales: (filters) => secureInvoke('get-sales', filters || {}),
  getSale: (id) => secureInvoke('get-sale', id),
  
  getQuotations: (filters) => secureInvoke('get-quotations', filters || {}),
  createQuotation: (quotation) => secureInvoke('create-quotation', quotation),
  updateQuotation: (id, quotation) => secureInvoke('update-quotation', id, quotation),
  deleteQuotation: (id, credentials) => secureInvoke('delete-quotation', id, {
    ...(credentials || {}),
    token: activeToken
  }),
  clearQuotations: (credentials) => secureInvoke('clear-quotations', {
    ...(credentials || {}),
    token: activeToken
  }),
  
  getInvoices: (filters) => secureInvoke('get-invoices', filters || {}),
  createInvoice: (invoice) => secureInvoke('create-invoice', invoice),
  updateInvoice: (id, invoice) => secureInvoke('update-invoice', id, invoice),
  submitDocumentForApproval: (type, id) => secureInvoke('submit-document-for-approval', type, id),
  approveDocumentWithCredentials: (type, id, credentials) => secureInvoke('approve-document-with-credentials', type, id, credentials || {}),
  voidInvoice: (id, reason) => secureInvoke('void-invoice', id, reason),
  recordInvoicePayment: (payment) => secureInvoke('record-invoice-payment', payment),
  clearInvoices: (credentials) => secureInvoke('clear-invoices', {
    ...(credentials || {}),
    token: activeToken
  }),
  exportDocumentPdf: (documentNumber) => secureInvoke('export-document-pdf', documentNumber),
  exportReportPdf: (report) => secureInvoke('export-document-pdf', {
    ...(report || {}),
    dialogTitle: 'Export Report PDF'
  })

});
