const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function run(name, args) {
  console.log(`Running ${name}...`);
  const res = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status || 1);
}

function findTestFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return findTestFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.test.js') ? [fullPath] : [];
  });
}

function getTestTargets() {
  const requested = process.argv.slice(2);
  if (requested.length) return requested;

  return findTestFiles(path.join(root, 'tests'))
    .map((file) => path.relative(root, file))
    .sort();
}

run('syntax checks', ['scripts/check-syntax.js']);
run('lint checks', ['scripts/lint.js']);

const testTargets = getTestTargets();
if (!testTargets.length) {
  console.error('No test files found.');
  process.exit(1);
}

run(`unit tests (${testTargets.length} file${testTargets.length === 1 ? '' : 's'})`, ['--test', ...testTargets]);
console.log('Tests passed.');
