const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dirs = ['src/main', 'src/renderer/js', 'src/shared', 'scripts'];
const skip = new Set(['check-syntax.js']);
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js') && !skip.has(entry.name)) files.push(full);
  }
}
dirs.forEach(d => walk(path.join(root, d)));
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed++;
    console.error(`Syntax error: ${path.relative(root, file)}`);
    process.stderr.write(result.stderr || result.stdout || '');
  }
}
if (failed) process.exit(1);
console.log(`Syntax check passed (${files.length} JavaScript files).`);
