/**
 * Register Handlers
 * Builds the IPC dependency context and registers all live handler groups.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { BrowserWindow, dialog, ipcMain } = require('electron');
const logger = require('../utils/logger');
const { getDatabase } = require('../database/connection');
const {
  createDatabaseBackup,
  getBackupDirectory,
  restoreDatabaseBackup
} = require('../utils/backup');
const {
  configureAutomaticBackup,
  getAutomaticBackupStatus,
  initializeAutomaticBackup,
  recordBackupMetadata,
  stopAutomaticBackup
} = require('../utils/automatic-backup');
const authService = require('../auth/auth-service');
const passwordUtils = require('../auth/password-utils');
const { IPC_CHANNELS } = require('../../shared/constants/ipc-channels');
const { createDestructiveActionGuard } = require('../security/destructive-action-guard');
const { createAuthorizedIpc } = require('../security/authorized-ipc');
const { registerDestructiveDocumentHandlers } = require('./destructive-document-handlers');
const {
  createCustomerRecord,
  updateCustomerRecord
} = require('../database/customer-persistence');
const { createTrustedSale } = require('../services/trusted-sale-service');
const { applyStockDelta, setStockLevel } = require('../services/stock-protection');
const { resolveNegativeStockPolicy } = require('../security/negative-stock-policy');
const auditService = require('../services/audit-service');
const businessHelpers = require('./business-helpers');
const { registerSystemAuthHandlers } = require('./live/system-auth-handlers');
const { registerUserHandlers } = require('./live/user-handlers');
const { registerCatalogHandlers } = require('./live/catalog-handlers');
const { registerCommerceHandlers } = require('./live/commerce-handlers');

function registerIpcHandlers({ getMainWindow }) {
  logger.info('Setting up IPC handlers...');
  const secureIpc = createAuthorizedIpc({
    ipcMain,
    authService,
    getDatabase,
    auditService,
    logger
  });
  const authorizeDestructiveAction = createDestructiveActionGuard({
    authService,
    getDatabase
  });

  registerDestructiveDocumentHandlers({
    ipcMain: secureIpc,
    getDatabase,
    authorizeDestructiveAction,
    recordAuditLog: businessHelpers.recordAuditLog,
    logger
  });

  const context = {
    ...businessHelpers,
    secureIpc,
    logger,
    IPC_CHANNELS,
    getDatabase,
    authService,
    passwordUtils,
    auditService,
    createDatabaseBackup,
    recordBackupMetadata,
    configureAutomaticBackup,
    getAutomaticBackupStatus,
    getBackupDirectory,
    restoreDatabaseBackup,
    stopAutomaticBackup,
    initializeAutomaticBackup,
    dialog,
    BrowserWindow,
    getMainWindow,
    documentPdfCssPath: path.join(__dirname, '../../renderer/styles/views/document-pdf.css'),
    documentLogoPath: path.join(__dirname, '../../../resources/logo.png'),
    fs,
    createCustomerRecord,
    updateCustomerRecord,
    createTrustedSale,
    applyStockDelta,
    setStockLevel,
    resolveNegativeStockPolicy
  };

  registerSystemAuthHandlers(context);
  registerUserHandlers(context);
  registerCatalogHandlers(context);
  registerCommerceHandlers(context);
  logger.info('All IPC handlers set up successfully');
}

module.exports = { registerIpcHandlers };
