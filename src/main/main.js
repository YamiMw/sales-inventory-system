/**
 * Main
 * Bootstraps Electron, initializes persistence, and manages the main application window.
 */

const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const projectPackage = require('../../package.json');
const { initializeDatabase } = require('./database/connection');
const { DEFAULT_DATABASE_DIRECTORY } = require('./database/path-resolver');
const authService = require('./auth/auth-service');
const {
  initializeAutomaticBackup,
  stopAutomaticBackup
} = require('./utils/automatic-backup');
const { registerIpcHandlers } = require('./ipc/register-handlers');

const APP_USER_MODEL_ID = 'com.alikobusinessenterprise.salesinventory';
const isPackagingSmokeTest = ['1', 'true', 'yes'].includes(
  String(process.env.SALES_INVENTORY_PACKAGING_SMOKE || '').toLowerCase()
);

function configureUserDataPath() {
  const candidates = [
    process.env.SALES_INVENTORY_USER_DATA_DIR,
    path.join(DEFAULT_DATABASE_DIRECTORY, 'profile'),
    path.join(app.getPath('temp'), 'SalesInventorySystem', 'profile')
  ].filter(Boolean);

  for (const directory of candidates) {
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.accessSync(directory, fs.constants.W_OK);
      app.commandLine.appendSwitch('user-data-dir', directory);
      app.setPath('userData', directory);
      return directory;
    } catch {
      // Try the next writable location.
    }
  }

  return app.getPath('userData');
}

configureUserDataPath();

// Keep Chromium's disposable cache out of protected or stale profile folders.
const chromiumCachePath = path.join(app.getPath('temp'), 'sales-inventory-system', 'chromium-cache');
try {
  fs.mkdirSync(chromiumCachePath, { recursive: true });
  app.commandLine.appendSwitch('disk-cache-dir', chromiumCachePath);
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
} catch (error) {
  console.warn(`Unable to configure Chromium cache at ${chromiumCachePath}: ${error.message}`);
}

// ============================================
// GPU DISABLING
// ============================================
if (app && typeof app.disableHardwareAcceleration === 'function') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
  app.commandLine.appendSwitch('disable-webgl');
  app.commandLine.appendSwitch('in-process-gpu');
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('use-gl', 'swiftshader');
}

// ============================================
// GPU ERROR SUPPRESSION
// ============================================
const originalConsoleError = console.error;
console.error = function(...args) {
  const errorString = args.join(' ');
  if (errorString.includes('GPU') || 
      errorString.includes('gpu_process_host') ||
      errorString.includes('exit_code=-1073740791')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

if (app && typeof app.on === 'function') {
  app.on('gpu-process-crashed', (event, killed) => {
    event.preventDefault();
  });
}

// ============================================
// ERROR HANDLERS
// ============================================
process.on('uncaughtException', (error) => {
  if (error.message && (
      error.message.includes('GPU') || 
      error.message.includes('gpu_process'))) {
    return;
  }
  logger.error('Uncaught Exception:', error.message, error.stack);
});

process.on('unhandledRejection', (reason) => {
  const reasonString = String(reason);
  if (reasonString.includes('GPU') || reasonString.includes('gpu_process')) {
    return;
  }
  logger.error('Unhandled Rejection:', reason);
});

// ============================================
// WINDOW VARIABLES
// ============================================
let mainWindow = null;
let isQuitting = false;
let isLoggingOutOnClose = false;
let isPosWindowModeActive = false;
let wasFullScreenBeforePosMode = false;
let wasKioskBeforePosMode = false;
let applicationMenu = null;
const hasSingleInstanceLock = (() => {
  if (isPackagingSmokeTest) return true;

  try {
    return app.requestSingleInstanceLock();
  } catch (error) {
    logger.warn('Unable to acquire single-instance lock:', error.message);
    return false;
  }
})();

if (!hasSingleInstanceLock) {
  logger.warn('Another instance is already running; exiting duplicate instance.');
  app.quit();
}

function getAppIconPath() {
  const candidates = [
    path.join(__dirname, '../../resources/icon.ico'),
    path.join(__dirname, '../../build/icons/icon.ico'),
    path.join(__dirname, '../../resources/logo.png'),
    path.join(__dirname, '../renderer/assets/images/logo.png')
  ];

  return candidates.find(candidate => fs.existsSync(candidate));
}

function loadAppIcon(iconPath) {
  if (!iconPath || !nativeImage) return null;
  const icon = nativeImage.createFromPath(iconPath);
  return icon && !icon.isEmpty() ? icon : null;
}

function shouldOpenDevToolsOnStartup() {
  return ['1', 'true', 'yes'].includes(String(process.env.SALES_INVENTORY_OPEN_DEVTOOLS || '').toLowerCase());
}

function buildApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut', accelerator: 'CommandOrControl+X' },
        { role: 'copy', accelerator: 'CommandOrControl+C' },
        { role: 'paste', accelerator: 'CommandOrControl+V' },
        { type: 'separator' },
        { role: 'selectAll', accelerator: 'CommandOrControl+A' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}

function setupApplicationMenu() {
  applicationMenu = applicationMenu || buildApplicationMenu();
  Menu.setApplicationMenu(applicationMenu);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setMenu(applicationMenu);
  }
}

function setMainWindowApplicationMenuVisible(visible) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (visible) {
    setupApplicationMenu();
    return;
  }

  mainWindow.setMenu(null);
  Menu.setApplicationMenu(null);
}

function setMainWindowMenuBarVisible(visible) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const shouldShowMenuBar = Boolean(visible);
  if (shouldShowMenuBar) {
    setMainWindowApplicationMenuVisible(true);
  }
  mainWindow.setAutoHideMenuBar(!shouldShowMenuBar);
  mainWindow.setMenuBarVisibility(shouldShowMenuBar);
}

function maximizeMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMaximized() || mainWindow.isFullScreen()) return;

  mainWindow.maximize();
}

function setMainWindowPosMode(enabled) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const shouldUsePosMode = Boolean(enabled);
  if (shouldUsePosMode && !isPosWindowModeActive) {
    wasFullScreenBeforePosMode = mainWindow.isFullScreen();
    wasKioskBeforePosMode = typeof mainWindow.isKiosk === 'function' && mainWindow.isKiosk();
  }

  setMainWindowApplicationMenuVisible(!shouldUsePosMode);
  setMainWindowMenuBarVisible(!shouldUsePosMode);

  if (shouldUsePosMode) {
    if (typeof mainWindow.setKiosk === 'function') {
      mainWindow.setKiosk(true);
    } else if (!mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(true);
    }
    isPosWindowModeActive = true;
    return;
  }

  if (isPosWindowModeActive && !wasKioskBeforePosMode &&
      typeof mainWindow.isKiosk === 'function' &&
      typeof mainWindow.setKiosk === 'function' &&
      mainWindow.isKiosk()) {
    mainWindow.setKiosk(false);
  }

  if (isPosWindowModeActive && !wasFullScreenBeforePosMode && mainWindow.isFullScreen()) {
    mainWindow.setFullScreen(false);
  }
  isPosWindowModeActive = false;
  wasFullScreenBeforePosMode = false;
  wasKioskBeforePosMode = false;
}

function setupWindowChromeHandlers() {
  ipcMain.on('window:set-menu-bar-visible', (event, visible) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (event.sender !== mainWindow.webContents) return;

    setMainWindowMenuBarVisible(visible);
  });

  ipcMain.on('window:set-pos-mode', (event, enabled) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (event.sender !== mainWindow.webContents) return;

    setMainWindowPosMode(enabled);
  });
}

function installEditShortcutFallback(targetWindow) {
  targetWindow.webContents.on('before-input-event', (event, input) => {
    if (!input || input.type !== 'keyDown' || input.alt || input.shift || (!input.control && !input.meta)) return;

    const key = String(input.key || '').toLowerCase();
    const actions = {
      c: 'copy',
      x: 'cut',
      v: 'paste'
    };
    const action = actions[key];
    if (!action || typeof targetWindow.webContents[action] !== 'function') return;

    event.preventDefault();
    targetWindow.webContents[action]();
  });
}

async function resetAuthenticationForWindowClose(targetWindow) {
  authService.invalidateAllSessions();

  if (!targetWindow || targetWindow.isDestroyed()) return;

  setMainWindowPosMode(false);
  targetWindow.webContents.send('auth:session-ended');

  try {
    await targetWindow.webContents.executeJavaScript(`
      (() => {
        try {
          localStorage.removeItem('auth_token');
          sessionStorage.removeItem('auth_token');
          localStorage.removeItem('user');
        } catch (_) {}

        if (!window.location.pathname.endsWith('/login.html')) {
          window.location.href = 'login.html';
        }
      })();
    `);
  } catch (error) {
    logger.warn('Unable to clear renderer authentication during window close:', error.message);
  }
}

// ============================================
// WINDOW CREATION
// ============================================
async function createWindow() {
  try {
    logger.info('Creating main window...');
    
    const loginPath = path.join(__dirname, '../renderer/login.html');
    const appIconPath = getAppIconPath();
    const appIcon = loadAppIcon(appIconPath);
    logger.info('Login path:', loginPath);
    if (appIconPath) logger.info('App icon path:', appIconPath);
    
    if (!fs.existsSync(loginPath)) {
      logger.error('Login file not found at:', loginPath);
      throw new Error(`Login file not found: ${loginPath}`);
    }
    
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 700,
      icon: path.join(__dirname, 'assets/assets/icon.ico') ,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webgl: false,
        experimentalFeatures: false,
        sandbox: true
      },
      show: false,
      backgroundColor: '#f3f4f6',
      autoHideMenuBar: false,
      frame: true,
      center: true,
      title: 'Aliko Business Enterprise',
      ...(appIcon ? { icon: appIcon } : (appIconPath ? { icon: appIconPath } : {}))
    });

    if (appIconPath && typeof mainWindow.setIcon === 'function') {
      mainWindow.setIcon(appIcon || appIconPath);
    }

    let devToolsOpened = false;
    function showMainWindow(reason) {
      if (!mainWindow || mainWindow.isDestroyed()) return;

      maximizeMainWindow();

      if (!mainWindow.isVisible()) {
        logger.info(`Showing main window (${reason})`);
        mainWindow.show();
      }
      mainWindow.focus();

      if (shouldOpenDevToolsOnStartup() && !devToolsOpened) {
        devToolsOpened = true;
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }

    mainWindow.once('ready-to-show', () => {
      logger.info('Window ready to show');
      showMainWindow('ready-to-show');
    });

    installEditShortcutFallback(mainWindow);

    await mainWindow.loadFile(loginPath);

    // Safety net for platforms that never emit ready-to-show.
    setTimeout(() => {
      if (mainWindow && !mainWindow.isVisible()) showMainWindow('startup fallback');
    }, 5000);

    mainWindow.on('close', async (e) => {
      if (!isQuitting) {
        e.preventDefault();
        if (isLoggingOutOnClose) return;

        isLoggingOutOnClose = true;
        try {
          await resetAuthenticationForWindowClose(mainWindow);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.hide();
          }
        } finally {
          isLoggingOutOnClose = false;
        }
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      logger.error('Page failed to load:', errorCode, errorDescription, validatedURL);
    });

    logger.info('Window created successfully');
    return mainWindow;
  } catch (error) {
    logger.error('Failed to create window:', error);
    throw error;
  }
}

// ============================================
// IPC HANDLERS
// ============================================

function setupIpcHandlers() {
  registerIpcHandlers({ getMainWindow: () => mainWindow });
}

// ============================================
// INITIALIZATION
// ============================================
function assertExpectedElectronRuntime() {
  if (app.isPackaged) return;

  const expectedVersion = String(
    projectPackage.devDependencies?.electron || ''
  ).replace(/^[^\d]*/, '');
  const actualVersion = process.versions.electron;

  if (expectedVersion && actualVersion !== expectedVersion) {
    throw new Error(
      `Electron runtime mismatch: expected ${expectedVersion}, received ${actualVersion}. ` +
      'Start the application with npm start from the project folder.'
    );
  }
}

function verifyNativeSqliteBinding() {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  try {
    return db.prepare('select sqlite_version() as version').get();
  } finally {
    db.close();
  }
}

async function createSmokeWindow() {
  const loginPath = path.join(__dirname, '../renderer/login.html');
  const appIconPath = getAppIconPath();
  const appIcon = loadAppIcon(appIconPath);

  const smokeWindow = new BrowserWindow({
    width: 900,
    height: 640,
    show: false,
    backgroundColor: '#f3f4f6',
    title: 'Aliko Business Enterprise',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webgl: false,
      experimentalFeatures: false,
      sandbox: true
    },
    ...(appIcon ? { icon: appIcon } : (appIconPath ? { icon: appIconPath } : {}))
  });

  try {
    await smokeWindow.loadFile(loginPath);
    return smokeWindow.webContents.getTitle();
  } finally {
    if (!smokeWindow.isDestroyed()) {
      smokeWindow.destroy();
    }
  }
}

async function runPackagingSmokeTest() {
  try {
    assertExpectedElectronRuntime();
    if (process.platform === 'win32' && typeof app.setAppUserModelId === 'function') {
      app.setAppUserModelId(APP_USER_MODEL_ID);
    }

    const sqlite = verifyNativeSqliteBinding();
    await initializeDatabase();
    setupIpcHandlers();
    const pageTitle = await createSmokeWindow();

    process.stdout.write(`PACKAGING_SMOKE_OK ${JSON.stringify({
      electron: process.versions.electron,
      abi: process.versions.modules,
      sqlite: sqlite.version,
      pageTitle
    })}\n`);
  } catch (error) {
    process.stderr.write(`PACKAGING_SMOKE_FAIL ${error.stack || error.message}\n`);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
}

async function initialize() {
  try {
    logger.info('========================================');
    logger.info('Starting Aliko Business Enterprise...');
    logger.info('Node version:', process.version);
    logger.info('Electron version:', process.versions.electron);
    logger.info('Platform:', process.platform);
    logger.info('========================================');

    assertExpectedElectronRuntime();
    if (process.platform === 'win32' && typeof app.setAppUserModelId === 'function') {
      app.setAppUserModelId(APP_USER_MODEL_ID);
    }
    await initializeDatabase();
    logger.info('Database initialized successfully');

    await initializeAutomaticBackup();

    setupApplicationMenu();
    setupWindowChromeHandlers();
    setupIpcHandlers();
    
    await createWindow();
    
    logger.info('Application initialized successfully!');
  } catch (error) {
    logger.error('Failed to initialize:', error);
    dialog.showErrorBox('Startup Error', `Failed to start: ${error.message}`);
    app.quit();
  }
}

// ============================================
// APP LIFECYCLE
// ============================================
if (hasSingleInstanceLock && app && typeof app.whenReady === 'function') {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    maximizeMainWindow();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    if (isPackagingSmokeTest) {
      return runPackagingSmokeTest();
    }

    logger.info('App is ready');
    initialize().catch((error) => {
      logger.error('Initialization failed:', error);
      dialog.showErrorBox('Startup Error', error.message);
      app.quit();
    });
  });

  app.on('before-quit', () => {
    logger.info('App quitting...');
    isQuitting = true;
    authService.invalidateAllSessions();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('auth:session-ended');
    }
    stopAutomaticBackup();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', async () => {
    try {
      if (mainWindow === null) {
        await createWindow();
      } else {
        maximizeMainWindow();
        mainWindow.show();
      }
    } catch (error) {
      logger.error('Failed to activate:', error);
    }
  });
}

