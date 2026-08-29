/**
 * System Auth Handlers
 * Registers authenticated IPC handlers for system auth handlers operations.
 */

'use strict';

const os = require('os');

function registerSystemAuthHandlers(context) {
  const {
    secureIpc, logger, IPC_CHANNELS, getDatabase, authService, passwordUtils,
    auditService, createDatabaseBackup, recordBackupMetadata, configureAutomaticBackup,
    getAutomaticBackupStatus, getBackupDirectory, restoreDatabaseBackup,
    stopAutomaticBackup, initializeAutomaticBackup, dialog, getMainWindow, BrowserWindow, fs,
    createCustomerRecord, updateCustomerRecord, createTrustedSale, applyStockDelta,
    setStockLevel, resolveNegativeStockPolicy, parseStockQuantity, getStockValueInput,
    getCostPriceInput, recordStockTransaction, loadDocumentItems, loadInvoicePayments,
    loadAuditLogs, normalizeMoney, normalizeDocumentDate, generateDocumentNumber,
    normalizeDocumentItems, resolveInvoiceStatus, recordAuditLog, markExpiredQuotations,
    markOverdueInvoices
  } = context;

  const parseSettingValue = (value) => {
    const looksLikeJson =
      value === 'true' ||
      value === 'false' ||
      value === 'null' ||
      value?.startsWith('{') ||
      value?.startsWith('[') ||
      value?.startsWith('"');

    if (!looksLikeJson) return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  async function loadSettingsMap() {
    const rows = await getDatabase()('settings').select('key', 'value');
    return rows.reduce((settings, row) => {
      settings[row.key] = parseSettingValue(row.value);
      return settings;
    }, {});
  }

  async function getInstalledPrinters(webContents) {
    if (!webContents || typeof webContents.getPrintersAsync !== 'function') {
      return [];
    }

    const printers = await webContents.getPrintersAsync();
    return (Array.isArray(printers) ? printers : [])
      .map(printer => ({
        name: printer.name || printer.displayName || '',
        displayName: printer.displayName || printer.name || '',
        description: printer.description || '',
        status: printer.status,
        isDefault: Boolean(printer.isDefault),
        options: printer.options || {}
      }))
      .filter(printer => printer.name)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) ||
        a.displayName.localeCompare(b.displayName));
  }

  function normalizePaperSize(value) {
    const size = String(value || '80mm').toLowerCase();
    if (size.includes('58')) return { width: 58000, height: 1000000 };
    if (size.includes('a4')) return 'A4';
    return { width: 80000, height: 1000000 };
  }

  function printableReceiptHtml(html = '', settings = {}) {
    const paperWidth = String(settings.printer_paper_size || '80mm').toLowerCase().includes('58')
      ? '54mm'
      : '72mm';

    return String(html || '').replace(
      '</head>',
      `<style>
        @page { margin: 0; }
        html { margin: 0; padding: 0; background: #ffffff; }
        body { margin: 0; width: ${paperWidth}; background: #ffffff; }
      </style></head>`
    );
  }

  async function printHtmlSilently(event, html, options = {}) {
    const settings = {
      ...await loadSettingsMap(),
      ...(options.settings || {})
    };
    const printerName = String(
      options.printerName ||
      settings.printer_device ||
      ''
    ).trim();

    if (!printerName || printerName === 'None') {
      throw new Error('Select a receipt printer in Settings before printing.');
    }

    const installed = await getInstalledPrinters(event.sender);
    if (installed.length && !installed.some(printer =>
      printer.name === printerName || printer.displayName === printerName
    )) {
      throw new Error(`The selected printer is not installed on this computer: ${printerName}`);
    }

    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true
      }
    });

    try {
      const finalHtml = printableReceiptHtml(html, settings);
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(finalHtml)}`);
      await new Promise((resolve, reject) => {
        printWindow.webContents.print({
          silent: true,
          printBackground: true,
          deviceName: printerName,
          margins: { marginType: 'none' },
          pageSize: normalizePaperSize(settings.printer_paper_size)
        }, (success, failureReason) => {
          if (success) {
            resolve();
            return;
          }
          reject(new Error(failureReason || 'Printer rejected the receipt job.'));
        });
      });

      return {
        printerName,
        paperSize: settings.printer_paper_size || '80mm'
      };
    } finally {
      if (!printWindow.isDestroyed()) printWindow.destroy();
    }
  }

  function testReceiptHtml(settings = {}, type = 'receipt') {
    const title = type === 'label' ? 'Label Printer Test' : 'Receipt Printer Test';
    const width = type === 'label' ? '76mm' : '72mm';
    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            body { width: ${width}; margin: 10px; color: #111; font: 12px/1.35 monospace; }
            h1, p { margin: 0 0 8px; text-align: center; }
            .box { margin-top: 10px; padding: 8px 0; border-top: 1px dashed #111; border-bottom: 1px dashed #111; text-align: center; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p>${settings.company_name || 'Sales & Inventory System'}</p>
          <div class="box">Printer configured successfully</div>
          <p>${new Date().toLocaleString()}</p>
        </body>
      </html>`;
  }

  // ============ SYSTEM ============
  secureIpc.handle('get-system-info', async () => {
    try {
      const hostname = os.hostname();
      const computerName = process.env.COMPUTERNAME || hostname;
      return {
        success: true,
        data: {
          nodeVersion: process.version,
          electronVersion: process.versions.electron,
          chromeVersion: process.versions.chrome,
          platform: process.platform,
          arch: process.arch,
          deviceName: computerName,
          computerName,
          hostname
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle(IPC_CHANNELS.SYSTEM.BACKUP, async (event, options = {}) => {
    try {
      const data = await createDatabaseBackup({
        retentionDays: options.retentionDays
      });
      await recordBackupMetadata(data);
      return { success: true, data };
    } catch (error) {
      logger.error('Create database backup error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle(IPC_CHANNELS.SYSTEM.GET_SETTINGS, async () => {
    try {
      const rows = await getDatabase()('settings').select('key', 'value');
      const data = {};

      rows.forEach(row => {
        data[row.key] = parseSettingValue(row.value);
      });
      data.currency = 'MWK';
      data.currency_symbol = 'K';

      return { success: true, data };
    } catch (error) {
      logger.error('Get settings error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle(IPC_CHANNELS.SYSTEM.UPDATE_SETTINGS, async (event, settings = {}) => {
    try {
      const updatedAt = new Date().toISOString();
      const normalizedSettings = {
        ...settings,
        currency: 'MWK',
        currency_symbol: 'K'
      };
      const rows = Object.entries(normalizedSettings).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        updated_at: updatedAt
      }));

      if (rows.length) {
        await getDatabase()('settings')
          .insert(rows)
          .onConflict('key')
          .merge(['value', 'updated_at']);
      }

      const automaticBackup = await configureAutomaticBackup(settings);
      return { success: true, data: { automaticBackup } };
    } catch (error) {
      logger.error('Update settings error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle(IPC_CHANNELS.SYSTEM.BACKUP_STATUS, async () => {
    try {
      return { success: true, data: getAutomaticBackupStatus() };
    } catch (error) {
      logger.error('Get automatic backup status error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle(IPC_CHANNELS.SYSTEM.RESTORE, async () => {
    try {
      const selection = await dialog.showOpenDialog(getMainWindow(), {
        title: 'Restore Database Backup',
        defaultPath: getBackupDirectory(),
        properties: ['openFile'],
        filters: [
          { name: 'SQLite Database Backups', extensions: ['db', 'sqlite', 'sqlite3'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (selection.canceled || !selection.filePaths?.[0]) {
        return { success: false, canceled: true };
      }

      stopAutomaticBackup();
      const data = await restoreDatabaseBackup(selection.filePaths[0]);
      await initializeAutomaticBackup();
      return { success: true, data };
    } catch (error) {
      await initializeAutomaticBackup().catch(scheduleError => {
        logger.error('Failed to restart automatic backup after restore:', scheduleError.message);
      });
      logger.error('Restore database error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('printer:get-installed', async (event) => {
    try {
      return { success: true, data: await getInstalledPrinters(event.sender) };
    } catch (error) {
      logger.error('Get installed printers error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('printer:test-print', async (event, options = {}) => {
    try {
      const settings = {
        ...await loadSettingsMap(),
        ...(options.settings || {})
      };
      const type = options.type === 'label' ? 'label' : 'receipt';
      const printerName = type === 'label'
        ? settings.label_printer_device
        : settings.printer_device;
      const data = await printHtmlSilently(event, testReceiptHtml(settings, type), {
        settings,
        printerName
      });
      return { success: true, data };
    } catch (error) {
      logger.error('Test print error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('printer:print-receipt', async (event, payload = {}) => {
    try {
      const settings = {
        ...await loadSettingsMap(),
        ...(payload.settings || {})
      };
      const data = await printHtmlSilently(event, payload.html, {
        settings,
        printerName: settings.printer_device
      });
      return { success: true, data };
    } catch (error) {
      logger.error('Print receipt error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // ============ AUTH ============
  secureIpc.handle('auth:login', async (event, credentials) => {
    try {
      const { username, password } = credentials;
      logger.info(`Login attempt: ${username}`);
      
      if (!username || !password) {
        return { success: false, error: 'Username and password are required' };
      }
      
      const result = await authService.login(username, password);
      return { success: true, data: result };
    } catch (error) {
      logger.error('Login error:', error.message);
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('auth:setup-status', async () => {
    try {
      return { success: true, data: await authService.getSetupStatus() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('auth:setup-admin', async (event, data) => {
    try {
      return { success: true, data: await authService.setupAdministrator(data || {}) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('auth:logout', async (event, token) => {
    try {
      await authService.logout(token);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('auth:validate', async (event, token) => {
    try {
      const user = await authService.validateToken(token);
      if (!user) {
        return { success: false, error: 'Invalid or expired token' };
      }
      return { success: true, data: user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  secureIpc.handle('auth:change-password', async (event, data) => {
    try {
      const { currentPassword, newPassword } = data;
      if (!currentPassword || !newPassword) {
        return { success: false, error: 'Missing required fields' };
      }
      await authService.changePassword(event.auth.userId, currentPassword, newPassword);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerSystemAuthHandlers };
