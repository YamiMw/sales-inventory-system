/**
 * Main Debug
 * Starts the Electron application with additional diagnostics for local troubleshooting.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Disable GPU
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

console.log('========================================');
console.log('Starting debug main process...');
console.log('Node version:', process.version);
console.log('Electron version:', process.versions.electron);
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('========================================');

let mainWindow;

app.whenReady().then(() => {
  console.log('App ready!');
  
  // Find login.html
  const possiblePaths = [
    path.join(__dirname, '../renderer/login.html'),
    path.join(process.cwd(), 'src/renderer/login.html'),
    path.join(process.cwd(), 'renderer/login.html')
  ];
  
  let loginPath = null;
  for (const p of possiblePaths) {
    console.log('Checking:', p);
    if (fs.existsSync(p)) {
      loginPath = p;
      console.log('✅ Found login at:', p);
      break;
    }
  }
  
  if (!loginPath) {
    console.error('❌ login.html not found!');
    console.log('Creating emergency window...');
    
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: true
    });
    
    mainWindow.loadURL(`data:text/html,
      <html>
        <body style="font-family: Arial; padding: 40px; background: #ffebee;">
          <h1 style="color: #c62828;">❌ Login file not found!</h1>
          <p>Checked paths:</p>
          <ul>
            ${possiblePaths.map(p => `<li>${p}</li>`).join('')}
          </ul>
          <p>Current directory: ${process.cwd()}</p>
        </body>
      </html>
    `);
    
    return;
  }
  
  console.log('Creating window...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: false,
    backgroundColor: '#f3f4f6'
  });
  
  console.log('Loading:', loginPath);
  
  mainWindow.loadFile(loginPath)
    .then(() => {
      console.log('✅ Page loaded successfully');
    })
    .catch((err) => {
      console.error('❌ Failed to load page:', err);
    });
  
  mainWindow.once('ready-to-show', () => {
    console.log('✅ Window ready to show!');
    mainWindow.show();
    mainWindow.focus();
  });
  
  mainWindow.on('closed', () => {
    console.log('Window closed');
    mainWindow = null;
  });
  
  // Force show after 3 seconds if not shown
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('⚠️ Window not visible, forcing show...');
      mainWindow.show();
      mainWindow.focus();
    }
  }, 3000);
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  app.quit();
});