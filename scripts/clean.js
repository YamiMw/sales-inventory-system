const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
['dist', 'build', '.cache'].forEach(dir => {
  const target = path.join(root, dir);
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
});
console.log('Clean completed.');
