/**
 * Dashboard Chart Layout Test
 * Verifies the trend and category charts keep their expected structure and sizing.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.join(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

test('dashboard uses a three-quarter trend chart and one-quarter category pie', () => {
  const html = read('src/renderer/index.html');
  const css = read('src/renderer/styles/views/dashboard.css');
  const dashboard = read('src/renderer/js/views/dashboardView.js');
  const chart = read('src/renderer/js/components/chart.js');

  assert.match(html, /class="dashboard-charts-grid"/);
  assert.match(html, /id="dash-sales-chart"/);
  assert.match(html, /id="dash-category-chart"/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*3fr\)\s+minmax\(250px,\s*1fr\)/);
  assert.match(css, /\.dashboard-charts-grid \.chart-box\s*\{[\s\S]*?min-height:\s*430px;[\s\S]*?padding:\s*20px 34px 62px 24px;[\s\S]*?overflow:\s*visible;/);
  assert.match(css, /\.category-chart-box\s*\{[\s\S]*?min-height:\s*430px;[\s\S]*?overflow:\s*visible;/);
  assert.match(css, /\.dashboard-insight-grid \.chart-box\s*\{[\s\S]*?min-height:\s*340px;[\s\S]*?padding:\s*20px 34px 58px 24px;[\s\S]*?overflow:\s*visible;/);
  assert.match(css, /@media\s*\(max-width:\s*1100px\)[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(dashboard, /resp\.data\.categorySales/);
  assert.match(dashboard, /type:\s*'pie'/);
  assert.match(chart, /drawPie\(ctx,\s*w,\s*h\)/);
});

test('dashboard product lists show at most five readable rows', () => {
  const dashboard = read('src/renderer/js/views/dashboardView.js');
  const css = read('src/renderer/styles/views/dashboard.css');

  assert.match(dashboard, /getSales\(\{\s*limit:\s*5,\s*order:\s*'desc'\s*\}\)/);
  assert.match(dashboard, /getSaleItemRows\(res\.data\)\.slice\(0,\s*5\)/);
  assert.match(dashboard, /res\.data\.slice\(0,\s*5\)/);
  assert.match(css, /\.recent-sale-item,[\s\S]*?white-space:\s*normal;[\s\S]*?overflow:\s*visible;/);
  assert.match(css, /\.recent-sale-main,[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*baseline;/);
  assert.match(css, /\.low-stock-alert-counts\s*\{[\s\S]*?display:\s*flex;/);
});

test('bar chart value labels keep the chart formatter binding', () => {
  const chart = read('src/renderer/js/components/Chart.js');

  assert.match(chart, /var self = this;[\s\S]*?ctx\.fillText\(self\.formatCompactCurrency\(val\)/);
  assert.doesNotMatch(chart, /ctx\.fillText\(this\.formatCompactCurrency\(val\)/);
});

test('dashboard chart renderer keeps labels and details visible', () => {
  const chart = read('src/renderer/js/components/Chart.js');

  assert.match(chart, /positionTooltip\(x,\s*y\)\s*\{[\s\S]*?safeX[\s\S]*?safeY/);
  assert.match(chart, /wrapLabel\(ctx,\s*label,\s*maxWidth\)/);
  assert.match(chart, /this\.padding = \{ top:\s*28,\s*right:\s*54,\s*bottom:\s*74,\s*left:\s*52 \};/);
  assert.match(chart, /var barEndGap = count > 1 \? Math\.min\(34,\s*Math\.max\(22,\s*cw \* 0\.045\)\) : 0;/);
  assert.match(chart, /var barDrawableWidth = Math\.max\(cw - barEndGap,\s*1\);/);
  assert.match(chart, /var barCellWidth = barDrawableWidth \/ count;/);
  assert.match(chart, /var linePadding = \{ top:\s*36,\s*right:\s*54,\s*bottom:\s*90,\s*left:\s*52 \};/);
  assert.match(chart, /var endGap = count > 1 \? Math\.min\(34,\s*Math\.max\(22,\s*cw \* 0\.045\)\) : 0;/);
  assert.match(chart, /var drawableWidth = Math\.max\(cw - endGap,\s*1\);/);
  assert.match(chart, /var rotateLabels = count > 12 \|\| step < 54;/);
  assert.doesNotMatch(chart, /labelStride/);
  assert.match(chart, /ctx\.rotate\(-Math\.PI \/ 4\)/);
  assert.match(chart, /Math\.max\(p\.top \+ 10,\s*y - 6\)/);
  assert.match(chart, /var showPointValues = count <= 12 \|\| step >= 44;/);
  assert.match(chart, /var gapOffset = 20;/);
  assert.match(chart, /var percentageX = Math\.min\(w - 12,\s*32 \+ labelLineWidth \+ gapOffset\);/);
  assert.match(chart, /ctx\.fillText\(percentage \+ '%',\s*percentageX,/);
});
