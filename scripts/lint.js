const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const htmlFiles = ['src/renderer/index.html', 'src/renderer/login.html'];
const problems = [];
function lineOf(text, index) { return text.slice(0, index).split(/\r?\n/).length; }
for (const rel of htmlFiles) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const attrPattern = /(?:src|href)=["']([^"']+)["']/g;
  let match;
  while ((match = attrPattern.exec(text))) {
    const ref = match[1];
    if (/^(https?:|data:|mailto:|javascript:|#)/.test(ref)) continue;
    if (ref === '') continue;
    const target = path.resolve(path.dirname(file), ref);
    if (!fs.existsSync(target)) {
      problems.push(`${rel}:${lineOf(text, match.index)} missing ${ref}`);
    }
  }
}
const index = path.join(root, 'src/renderer/index.html');
if (fs.existsSync(index)) {
  const text = fs.readFileSync(index, 'utf8');
  const requiredIds = [
    'customers-tbody',
    'customer-search',
    'customer-type-filter',
    'customer-status-filter',
    'customer-profile-modal',
    'customer-form-modal',
    'customer-import-file-input'
  ];
  for (const id of requiredIds) {
    if (!new RegExp(`id=["']${id}["']`).test(text)) problems.push(`src/renderer/index.html missing id=${id}`);
  }
}
if (problems.length) {
  console.error('Lint failed:');
  problems.forEach(p => console.error(' - ' + p));
  process.exit(1);
}
console.log('Lint passed: local HTML paths and required Customers IDs are valid.');
