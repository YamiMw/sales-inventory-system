'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const nvmrcPath = path.join(root, '.nvmrc');
const requiredMajor = fs.existsSync(nvmrcPath)
  ? fs.readFileSync(nvmrcPath, 'utf8').trim().replace(/^v/i, '').split('.')[0]
  : '24';

const currentVersion = process.versions.node;
const currentMajor = currentVersion.split('.')[0];

if (currentMajor === requiredMajor) {
  process.exit(0);
}

const expectedAbi = {
  20: '115',
  22: '127',
  24: '137'
}[requiredMajor] || 'the matching';

console.error([
  `Node ${requiredMajor}.x is required for this project.`,
  `Current runtime: Node ${currentVersion} (ABI ${process.versions.modules}).`,
  `Expected Node ABI: ${expectedAbi}.`,
  '',
  `Install or switch to Node ${requiredMajor}, then rebuild native modules.`,
  '',
  'Windows options:',
  `  - Install Node.js ${requiredMajor} directly, or`,
  `  - Install nvm-windows, then run: nvm install ${requiredMajor} && nvm use ${requiredMajor}`,
  '',
  `After opening a new terminal with Node ${requiredMajor} active, run:`,
  '  node -v',
  '  npm run rebuild:node',
  '  npm test',
  '',
  'Before launching or packaging the Electron app, rebuild the native module for Electron:',
  '  npm run rebuild:electron',
  '  npm run verify:electron-native'
].join('\n'));

process.exit(1);
