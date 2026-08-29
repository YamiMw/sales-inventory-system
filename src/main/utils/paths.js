/**
 * Paths
 * Provides shared filesystem paths used by the main process.
 */

const fs = require('fs');
const path = require('path');

console.log('Current directory:', process.cwd());
console.log('__dirname would be:', __dirname);
console.log('');

const pathsToCheck = [
  'src/main/main.js',
  'src/main/preload.js',
  'src/renderer/login.html',
  'src/renderer/index.html',
  'src/renderer/styles/login.css',
  'src/renderer/js/login.js',
  'src/renderer/js/dashboard.js'
];

console.log('Checking file paths:');
pathsToCheck.forEach(p => {
  const fullPath = path.join(process.cwd(), p);
  const exists = fs.existsSync(fullPath);
  console.log(`  ${exists ? '✅' : '❌'} ${p}`);
  if (!exists) {
    console.log(`     (checked: ${fullPath})`);
  }
});