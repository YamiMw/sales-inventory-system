/**
 * Roles
 * Defines shared roles constants used across processes.
 */

const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  INVENTORY: 'inventory',
  VIEWER: 'viewer'
};

const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_SALES_STATS: 'view_sales_stats',
  VIEW_PROFIT_STATS: 'view_profit_stats',
  CREATE_SALE: 'create_sale',
  PROCESS_REFUND: 'process_refund',
  APPLY_DISCOUNT: 'apply_discount',
  OVERRIDE_PRICE: 'override_price',
  VIEW_PRODUCTS: 'view_products',
  CREATE_PRODUCT: 'create_product',
  EDIT_PRODUCT: 'edit_product',
  DELETE_PRODUCT: 'delete_product',
  VIEW_INVENTORY: 'view_inventory',
  ADJUST_STOCK: 'adjust_stock',
  ALLOW_NEGATIVE_STOCK: 'allow_negative_stock',
  TRANSFER_STOCK: 'transfer_stock',
  CREATE_PURCHASE_ORDER: 'create_purchase_order',
  VIEW_SALES: 'view_sales',
  VIEW_ALL_SALES: 'view_all_sales',
  CANCEL_SALE: 'cancel_sale',
  VIEW_CUSTOMERS: 'view_customers',
  CREATE_CUSTOMER: 'create_customer',
  EDIT_CUSTOMER: 'edit_customer',
  DELETE_CUSTOMER: 'delete_customer',
  CREATE_QUOTATION: 'create_quotation',
  VIEW_QUOTATIONS: 'view_quotations',
  DELETE_QUOTATION: 'delete_quotation',
  CONVERT_TO_INVOICE: 'convert_to_invoice',
  CREATE_INVOICE: 'create_invoice',
  VIEW_INVOICES: 'view_invoices',
  VOID_INVOICE: 'void_invoice',
  DELETE_INVOICE: 'delete_invoice',
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',
  VIEW_USERS: 'view_users',
  CREATE_USER: 'create_user',
  EDIT_USER: 'edit_user',
  DELETE_USER: 'delete_user',
  MANAGE_ROLES: 'manage_roles',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_SETTINGS: 'manage_settings',
  BACKUP_DATABASE: 'backup_database',
  RESTORE_DATABASE: 'restore_database'
};

const LEGACY_PERMISSION_ALIASES = Object.freeze({
  voidInvoices: PERMISSIONS.VOID_INVOICE,
  overridePrices: PERMISSIONS.OVERRIDE_PRICE,
  viewAuditLogs: PERMISSIONS.VIEW_AUDIT_LOGS,
  exportReports: PERMISSIONS.EXPORT_REPORTS,
  manageInventory: PERMISSIONS.ADJUST_STOCK,
  manageUsers: PERMISSIONS.MANAGE_ROLES,
  manageSettings: PERMISSIONS.MANAGE_SETTINGS,
  backupDatabase: PERMISSIONS.BACKUP_DATABASE,
  deleteQuotations: PERMISSIONS.DELETE_QUOTATION,
  deleteInvoices: PERMISSIONS.DELETE_INVOICE,
  clearDocumentHistory: PERMISSIONS.DELETE_QUOTATION,
  allowNegativeStock: PERMISSIONS.ALLOW_NEGATIVE_STOCK
});

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_SALES_STATS,
    PERMISSIONS.VIEW_PROFIT_STATS,
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.PROCESS_REFUND,
    PERMISSIONS.APPLY_DISCOUNT,
    PERMISSIONS.OVERRIDE_PRICE,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.CREATE_PRODUCT,
    PERMISSIONS.EDIT_PRODUCT,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.ADJUST_STOCK,
    PERMISSIONS.TRANSFER_STOCK,
    PERMISSIONS.CREATE_PURCHASE_ORDER,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.VIEW_ALL_SALES,
    PERMISSIONS.CANCEL_SALE,
    PERMISSIONS.VIEW_CUSTOMERS,
    PERMISSIONS.CREATE_CUSTOMER,
    PERMISSIONS.EDIT_CUSTOMER,
    PERMISSIONS.CREATE_QUOTATION,
    PERMISSIONS.VIEW_QUOTATIONS,
    PERMISSIONS.CONVERT_TO_INVOICE,
    PERMISSIONS.CREATE_INVOICE,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.VOID_INVOICE,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_AUDIT_LOGS
  ],
  [ROLES.CASHIER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_SALES_STATS,
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.PROCESS_REFUND,
    PERMISSIONS.APPLY_DISCOUNT,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.VIEW_CUSTOMERS,
    PERMISSIONS.CREATE_CUSTOMER,
    PERMISSIONS.CREATE_QUOTATION,
    PERMISSIONS.VIEW_QUOTATIONS,
    PERMISSIONS.CONVERT_TO_INVOICE,
    PERMISSIONS.CREATE_INVOICE,
    PERMISSIONS.VIEW_INVOICES
  ],
  [ROLES.INVENTORY]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.CREATE_PRODUCT,
    PERMISSIONS.EDIT_PRODUCT,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.ADJUST_STOCK,
    PERMISSIONS.TRANSFER_STOCK,
    PERMISSIONS.CREATE_PURCHASE_ORDER,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_SALES_STATS,
    PERMISSIONS.VIEW_PRODUCTS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.VIEW_CUSTOMERS,
    PERMISSIONS.VIEW_QUOTATIONS,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.VIEW_REPORTS
  ]
};

function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(normalizePermission(permission));
}

function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function normalizePermission(permission) {
  const value = String(permission || '').trim();
  return LEGACY_PERMISSION_ALIASES[value] || value;
}

function normalizePermissions(permissions) {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions.map(normalizePermission).filter(Boolean))];
}

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  LEGACY_PERMISSION_ALIASES,
  hasPermission,
  getRolePermissions,
  normalizePermission,
  normalizePermissions
};
