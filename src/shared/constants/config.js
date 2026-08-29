/**
 * Config
 * Defines shared config constants used across processes.
 */

const path = require('path');
const { app } = require('electron');

const isDev = process.env.NODE_ENV === 'development';
const fixedDatabaseDir = 'C:\\SalesInventoryData';

module.exports = {
  isDev,
  debug: isDev,
  
  window: {
    defaultSize: { width: 1400, height: 900 },
    minWidth: 1200,
    minHeight: 700
  },
  
  paths: {
    userData: app ? app.getPath('userData') : '',
    database: path.join(fixedDatabaseDir, 'sales-inventory.db'),
    logs: app ? path.join(app.getPath('userData'), 'logs') : '',
    backups: app ? path.join(app.getPath('userData'), 'backups') : '',
    icon: path.join(__dirname, '../../resources/icon.ico')
  },
  
  session: {
    timeout: 8 * 60 * 60 * 1000,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000
  },
  
  defaults: {
    taxRate: 10.00,
    currency: 'K',
    lowStockThreshold: 10,
    quotationValidityDays: 30,
    invoiceDueDays: 30
  }
};
