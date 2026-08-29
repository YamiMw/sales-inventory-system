/**
 * Sales & Inventory System - Diagnostic Tool
 * Checks project structure, file integrity, database status, and configuration
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('='.repeat(70));
console.log('  SALES & INVENTORY SYSTEM - DIAGNOSTIC REPORT');
console.log('='.repeat(70));
console.log(`  Date: ${new Date().toISOString()}`);
console.log(`  OS: ${os.platform()} ${os.release()}`);
console.log(`  Node: ${process.version}`);
console.log(`  User: ${os.userInfo().username}`);
console.log('='.repeat(70));
console.log('');

// ============ PROJECT ROOT ============
const projectRoot = process.cwd();
console.log(`📁 PROJECT ROOT: ${projectRoot}`);
console.log('');

// ============ CHECK PACKAGE.JSON ============
console.log('─'.repeat(70));
console.log('📦 PACKAGE.JSON');
console.log('─'.repeat(70));

const packageJsonPath = path.join(projectRoot, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log(`  ✅ package.json exists`);
    console.log(`     Name: ${pkg.name}`);
    console.log(`     Version: ${pkg.version}`);
    console.log(`     Main: ${pkg.main}`);
    console.log(`     Scripts: ${Object.keys(pkg.scripts || {}).join(', ')}`);
    
    // Check dependencies
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    console.log(`     Dependencies:`);
    Object.keys(deps).forEach(dep => {
      const installed = fs.existsSync(path.join(projectRoot, 'node_modules', dep));
      console.log(`       ${installed ? '✅' : '❌'} ${dep}: ${deps[dep]}`);
    });
  } catch (e) {
    console.log(`  ❌ package.json is invalid: ${e.message}`);
  }
} else {
  console.log(`  ❌ package.json NOT FOUND`);
}

console.log('');

// ============ CHECK NODE MODULES ============
console.log('─'.repeat(70));
console.log('📚 NODE MODULES');
console.log('─'.repeat(70));

const nodeModulesPath = path.join(projectRoot, 'node_modules');
if (fs.existsSync(nodeModulesPath)) {
  console.log(`  ✅ node_modules/ exists`);
  
  // Check critical modules
  const criticalModules = ['electron', 'better-sqlite3', 'knex'];
  criticalModules.forEach(mod => {
    const modPath = path.join(nodeModulesPath, mod);
    console.log(`  ${fs.existsSync(modPath) ? '✅' : '❌'} ${mod}`);
  });
} else {
  console.log(`  ❌ node_modules/ NOT FOUND - Run: npm install`);
}

console.log('');

// ============ CHECK SOURCE FILES ============
console.log('─'.repeat(70));
console.log('📄 SOURCE FILES');
console.log('─'.repeat(70));

const requiredFiles = [
  // Main process
  'src/main/main.js',
  'src/main/preload.js',
  'src/main/utils/logger.js',
  'src/main/auth/auth-service.js',
  'src/main/auth/password-utils.js',
  'src/main/database/connection.js',
  'src/main/repositories/user-repository.js',
  // Renderer
  'src/renderer/login.html',
  'src/renderer/index.html',
  // Styles
  'src/renderer/styles/main.css',
  'src/renderer/styles/login.css',
  'src/renderer/styles/sidebar.css',
  'src/renderer/styles/dashboard.css',
  'src/renderer/styles/products.css',
  'src/renderer/styles/pos.css',
  // JavaScript
  'src/renderer/js/login.js',
  'src/renderer/js/app.js',
  'src/renderer/js/dashboard.js',
  'src/renderer/js/products.js',
  'src/renderer/js/pos.js',
];

const optionalFiles = [
  'src/renderer/styles/inventory.css',
  'src/renderer/styles/customers.css',
  'src/renderer/styles/reports.css',
  'src/renderer/styles/users.css',
  'src/renderer/styles/settings.css',
  'src/renderer/js/inventory.js',
  'src/renderer/js/customers.js',
  'src/renderer/js/reports.js',
  'src/renderer/js/users.js',
  'src/renderer/js/settings.js',
];

console.log('  REQUIRED FILES:');
let missingRequired = false;
requiredFiles.forEach(file => {
  const filePath = path.join(projectRoot, file);
  const exists = fs.existsSync(filePath);
  if (!exists) missingRequired = true;
  
  let size = '';
  if (exists) {
    const stats = fs.statSync(filePath);
    size = `(${(stats.size / 1024).toFixed(1)} KB)`;
  }
  
  console.log(`  ${exists ? '✅' : '❌'} ${file} ${size}`);
});

console.log('');
console.log('  OPTIONAL FILES:');
optionalFiles.forEach(file => {
  const filePath = path.join(projectRoot, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '⚠️'} ${file} ${exists ? '(present)' : '(not created yet)'}`);
});

console.log('');

// ============ CHECK DATABASE ============
console.log('─'.repeat(70));
console.log('🗄️  DATABASE');
console.log('─'.repeat(70));

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'sales-inventory-system', 'sales-inventory.db');
console.log(`  Path: ${dbPath}`);

if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log(`  ✅ Database exists (${(stats.size / 1024).toFixed(1)} KB)`);
  
  // Check database content
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const users = row?.count > 0
      ? db.prepare('SELECT username, full_name, role, is_active FROM users').all()
      : [];

    console.log(`  📊 Tables: ${tables.length}`);
    tables.forEach(t => console.log(`     - ${t.name}`));
    console.log(`  👤 Users: ${row?.count || 0}`);
    users.forEach(u => {
      console.log(`     - ${u.username} (${u.full_name}) Role: ${u.role} Active: ${u.is_active}`);
    });
    db.close();
  } catch (e) {
    console.log(`  ❌ Cannot open database: ${e.message}`);
    console.log(`     Make sure better-sqlite3 is installed: npm install better-sqlite3`);
  }
} else {
  console.log(`  ❌ Database does not exist`);
  console.log(`     Will be created automatically on first app launch`);
}

console.log('');

// ============ CHECK PRELOAD INTEGRITY ============
console.log('─'.repeat(70));
console.log('🔌 PRELOAD SCRIPT CHECK');
console.log('─'.repeat(70));

const preloadPath = path.join(projectRoot, 'src/main/preload.js');
if (fs.existsSync(preloadPath)) {
  const content = fs.readFileSync(preloadPath, 'utf8');
  
  const checks = [
    { name: 'contextBridge import', test: content.includes('contextBridge') },
    { name: 'ipcRenderer import', test: content.includes('ipcRenderer') },
    { name: 'exposeInMainWorld call', test: content.includes('exposeInMainWorld') },
    { name: 'electronAPI object', test: content.includes('electronAPI') },
    { name: 'auth:login channel', test: content.includes('auth:login') },
    { name: 'get-products channel', test: content.includes('get-products') },
    { name: 'getCategories method', test: content.includes('getCategories') },
    { name: 'getDashboardStats method', test: content.includes('getDashboardStats') },
    { name: 'login method', test: content.includes('login') },
    { name: 'createSale method', test: content.includes('createSale') },
  ];
  
  checks.forEach(check => {
    console.log(`  ${check.test ? '✅' : '❌'} ${check.name}`);
  });
} else {
  console.log(`  ❌ preload.js not found`);
}

console.log('');

// ============ CHECK INDEX.HTML INTEGRITY ============
console.log('─'.repeat(70));
console.log('🌐 INDEX.HTML CHECK');
console.log('─'.repeat(70));

const indexPath = path.join(projectRoot, 'src/renderer/index.html');
if (fs.existsSync(indexPath)) {
  const content = fs.readFileSync(indexPath, 'utf8');
  
  const checks = [
    { name: 'dashboard-view div', test: content.includes('dashboard-view') },
    { name: 'pos-view div', test: content.includes('pos-view') },
    { name: 'products-view div', test: content.includes('products-view') },
    { name: 'inventory-view div', test: content.includes('inventory-view') },
    { name: 'customers-view div', test: content.includes('customers-view') },
    { name: 'reports-view div', test: content.includes('reports-view') },
    { name: 'users-view div', test: content.includes('users-view') },
    { name: 'settings-view div', test: content.includes('settings-view') },
    { name: 'sidebar with data-view', test: content.includes('data-view="dashboard"') },
    { name: 'Chart.js loaded', test: content.includes('chart.js') || content.includes('Chart') },
    { name: 'pos.js loaded', test: content.includes('pos.js') },
    { name: 'products.js loaded', test: content.includes('products.js') },
    { name: 'dashboard.js loaded', test: content.includes('dashboard.js') },
    { name: 'app.js loaded', test: content.includes('app.js') },
    { name: 'login.js loaded', test: false }, // This should be in login.html
  ];
  
  checks.forEach(check => {
    console.log(`  ${check.test ? '✅' : '❌'} ${check.name}`);
  });
} else {
  console.log(`  ❌ index.html not found`);
}

console.log('');

// ============ CHECK LOGIN.HTML INTEGRITY ============
console.log('─'.repeat(70));
console.log('🔐 LOGIN.HTML CHECK');
console.log('─'.repeat(70));

const loginHtmlPath = path.join(projectRoot, 'src/renderer/login.html');
if (fs.existsSync(loginHtmlPath)) {
  const content = fs.readFileSync(loginHtmlPath, 'utf8');
  
  const checks = [
    { name: 'login-form exists', test: content.includes('login-form') },
    { name: 'username field', test: content.includes('id="username"') },
    { name: 'password field', test: content.includes('id="password"') },
    { name: 'login.css loaded', test: content.includes('login.css') },
    { name: 'login.js loaded', test: content.includes('login.js') },
  ];
  
  checks.forEach(check => {
    console.log(`  ${check.test ? '✅' : '❌'} ${check.name}`);
  });
} else {
  console.log(`  ❌ login.html not found`);
}

console.log('');

// ============ SUMMARY ============
console.log('='.repeat(70));
console.log('📋 SUMMARY');
console.log('='.repeat(70));

let issues = [];

if (!fs.existsSync(path.join(projectRoot, 'node_modules'))) {
  issues.push('❌ Run: npm install');
}

if (missingRequired) {
  issues.push('❌ Some required files are missing - check the list above');
}

if (!fs.existsSync(dbPath)) {
  issues.push('⚠️  Database will be created on first app launch');
}

// Check if main.js has GPU fixes
const mainPath = path.join(projectRoot, 'src/main/main.js');
if (fs.existsSync(mainPath)) {
  const mainContent = fs.readFileSync(mainPath, 'utf8');
  if (!mainContent.includes('disableHardwareAcceleration')) {
    issues.push('⚠️  main.js may need GPU disabling code');
  }
  if (!mainContent.includes('setupIpcHandlers') && !mainContent.includes('setupIPC')) {
    issues.push('❌ main.js missing IPC handler setup');
  }
} else {
  issues.push('❌ main.js not found');
}

if (issues.length === 0) {
  console.log('✅ All checks passed! The project structure looks good.');
  console.log('');
  console.log('To run the application:');
  console.log('  npm run dev');
  console.log('');
  console.log('A first-run administrator must be created before signing in.');
} else {
  console.log('Issues found:');
  issues.forEach(issue => console.log(`  ${issue}`));
}

console.log('='.repeat(70));
