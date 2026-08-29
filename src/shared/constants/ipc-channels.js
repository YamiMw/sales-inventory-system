/**
 * IPC Channels
 * Defines shared ipc channels constants used across processes.
 */

const IPC_CHANNELS = {
  SYSTEM: {
    GET_VERSION: 'system:get-version',
    GET_INFO: 'system:get-info',
    NOTIFICATION: 'system:notification',
    OPEN_DIALOG: 'system:open-dialog',
    SAVE_DIALOG: 'system:save-dialog',
    GET_SETTINGS: 'system:get-settings',
    UPDATE_SETTINGS: 'system:update-settings',
    BACKUP: 'system:backup',
    BACKUP_STATUS: 'system:backup-status',
    RESTORE: 'system:restore'
  },
  AUTH: {
    LOGIN: 'auth:login',
    LOGOUT: 'auth:logout',
    VALIDATE_TOKEN: 'auth:validate-token',
    CHANGE_PASSWORD: 'auth:change-password',
    RESET_PASSWORD: 'auth:reset-password'
  },
  PRODUCTS: {
    GET_ALL: 'products:get-all',
    GET: 'products:get',
    CREATE: 'products:create',
    UPDATE: 'products:update',
    DELETE: 'products:delete',
    SEARCH: 'products:search',
    GET_CATEGORIES: 'products:get-categories',
    CREATE_CATEGORY: 'products:create-category'
  },
  INVENTORY: {
    GET_ALL: 'inventory:get-all',
    GET: 'inventory:get',
    ADJUST: 'inventory:adjust',
    GET_TRANSACTIONS: 'inventory:get-transactions',
    GET_LOW_STOCK: 'inventory:get-low-stock',
    TRANSFER: 'inventory:transfer'
  },
  SALES: {
    CREATE: 'sales:create',
    GET_ALL: 'sales:get-all',
    GET: 'sales:get',
    REFUND: 'sales:refund',
    GET_RECEIPT: 'sales:get-receipt'
  },
  QUOTATIONS: {
    CREATE: 'quotations:create',
    GET_ALL: 'quotations:get-all',
    GET: 'quotations:get',
    UPDATE_STATUS: 'quotations:update-status',
    CONVERT_TO_INVOICE: 'quotations:convert-to-invoice',
    GENERATE_PDF: 'quotations:generate-pdf'
  },
  INVOICES: {
    CREATE: 'invoices:create',
    GET_ALL: 'invoices:get-all',
    GET: 'invoices:get',
    RECORD_PAYMENT: 'invoices:record-payment',
    VOID: 'invoices:void',
    GENERATE_PDF: 'invoices:generate-pdf'
  },
  CUSTOMERS: {
    GET_ALL: 'customers:get-all',
    GET: 'customers:get',
    CREATE: 'customers:create',
    UPDATE: 'customers:update',
    DELETE: 'customers:delete',
    SEARCH: 'customers:search',
    GET_HISTORY: 'customers:get-history'
  },
  DASHBOARD: {
    GET_STATS: 'dashboard:get-stats',
    GET_CHART_DATA: 'dashboard:get-chart-data',
    GET_TOP_PRODUCTS: 'dashboard:get-top-products',
    GET_LOW_STOCK: 'dashboard:get-low-stock',
    GET_RECENT_SALES: 'dashboard:get-recent-sales'
  },
  REPORTS: {
    GENERATE: 'reports:generate',
    EXPORT: 'reports:export'
  },
  USERS: {
    GET_ALL: 'users:get-all',
    GET: 'users:get',
    CREATE: 'users:create',
    UPDATE: 'users:update',
    DELETE: 'users:delete',
    GET_PROFILE: 'users:get-profile',
    UPDATE_PROFILE: 'users:update-profile'
  },
  EVENTS: {
    DATABASE_CHANGE: 'events:database-change',
    STOCK_ALERT: 'events:stock-alert',
    UPDATE_AVAILABLE: 'events:update-available'
  }
};

module.exports = { IPC_CHANNELS }; 
