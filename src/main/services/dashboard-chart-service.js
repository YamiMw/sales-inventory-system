/**
 * Dashboard Chart Service
 * Builds settings-timezone sales buckets and loads trusted totals for the line chart.
 */

'use strict';

const DEFAULT_TIMEZONE = 'Africa/Blantyre';
const CATEGORY_PALETTE = [
  '#2563eb',
  '#f59e0b',
  '#e11d48',
  '#6b8e23',
  '#f97316',
  '#94a3b8'
];
const STATUS_PALETTE = [
  '#16a34a',
  '#2563eb',
  '#f59e0b',
  '#dc2626',
  '#64748b'
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeTimezone(timezone) {
  const candidate = String(timezone || '').trim() || DEFAULT_TIMEZONE;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format();
    return candidate;
  } catch (_error) {
    return DEFAULT_TIMEZONE;
  }
}

function getZonedDateParts(value, timezone = DEFAULT_TIMEZONE) {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)])
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day
  };
}

// Calendar dates use UTC internally so host timezone changes cannot move chart labels.
function createCalendarDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toCalendarDateKey(date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate())
  ].join('-');
}

function toLocalDateKey(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-');
}

function toZonedDateKey(value, timezone = DEFAULT_TIMEZONE) {
  const parts = getZonedDateParts(value, timezone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function toCalendarMonthKey(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric'
  });
}

function formatWeekdayLabel(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric'
  }).formatToParts(date);
  const weekday = parts.find(part => part.type === 'weekday')?.value || '';
  const day = parts.find(part => part.type === 'day')?.value || '';
  return `${weekday} ${day}`.trim();
}

function formatMonthLabel(date) {
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    year: 'numeric'
  });
}

function formatMonthBucketLabel(date) {
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short'
  });
}

function formatRangeDate(date) {
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function buildChartPeriod(
  period = 'last7days',
  now = new Date(),
  timezone = DEFAULT_TIMEZONE
) {
  const currentParts = getZonedDateParts(now, timezone);
  const current = createCalendarDate(
    currentParts.year,
    currentParts.month,
    currentParts.day
  );
  const normalizedPeriod = ['month', 'year'].includes(period) ? period : 'last7days';

  if (normalizedPeriod === 'year') {
    const buckets = [];
    for (let month = 1; month <= 12; month += 1) {
      const date = createCalendarDate(currentParts.year, month, 1);
      buckets.push({
        key: toCalendarMonthKey(date),
        label: formatMonthBucketLabel(date)
      });
    }

    const startDate = createCalendarDate(currentParts.year, 1, 1);
    const endDate = createCalendarDate(currentParts.year, 12, 31);
    return {
      period: normalizedPeriod,
      grouping: 'month',
      start: startDate,
      end: endDate,
      dataEnd: current,
      startKey: toCalendarDateKey(startDate),
      endKey: toCalendarDateKey(endDate),
      dataEndKey: toCalendarDateKey(current),
      rangeLabel: String(currentParts.year),
      buckets
    };
  }

  let startDate;
  let endDate;

  if (normalizedPeriod === 'month') {
    startDate = createCalendarDate(currentParts.year, currentParts.month, 1);
    endDate = createCalendarDate(currentParts.year, currentParts.month + 1, 0);
  } else {
    const daysSinceMonday = (current.getUTCDay() + 6) % 7;
    startDate = addDays(current, -daysSinceMonday);
    endDate = addDays(startDate, 6);
  }

  const buckets = [];

  for (let date = new Date(startDate); date <= endDate; date = addDays(date, 1)) {
    buckets.push({
      key: toCalendarDateKey(date),
      label: normalizedPeriod === 'month'
        ? String(date.getUTCDate())
        : formatWeekdayLabel(date)
    });
  }

  return {
    period: normalizedPeriod,
    grouping: 'day',
    start: startDate,
    end: endDate,
    dataEnd: current,
    startKey: toCalendarDateKey(startDate),
    endKey: toCalendarDateKey(endDate),
    dataEndKey: toCalendarDateKey(current),
    rangeLabel: normalizedPeriod === 'month'
      ? formatMonthLabel(startDate)
      : `${formatRangeDate(startDate)} - ${formatRangeDate(endDate)}`,
    buckets
  };
}

async function loadConfiguredTimezone(db, requestedTimezone) {
  if (requestedTimezone) {
    return normalizeTimezone(requestedTimezone);
  }

  try {
    if (await db.schema.hasTable('settings')) {
      const setting = await db('settings').where({ key: 'timezone' }).first('value');
      if (setting?.value) {
        return normalizeTimezone(setting.value);
      }
    }
  } catch (_error) {
    // Settings may not exist yet during first-run setup.
  }

  return DEFAULT_TIMEZONE;
}

function parseStoredTimestamp(value) {
  if (value instanceof Date) {
    return value;
  }

  const timestamp = String(value || '').trim();
  if (!timestamp) {
    return null;
  }

  // SQLite CURRENT_TIMESTAMP is UTC even though it has no timezone suffix.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(timestamp)
    ? `${timestamp.replace(' ', 'T')}Z`
    : timestamp;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function hasCategorySalesSchema(db) {
  const requiredTables = ['sale_items', 'products', 'categories'];
  const results = await Promise.all(
    requiredTables.map(table => db.schema.hasTable(table))
  );
  return results.every(Boolean);
}

function summarizeCategorySales(rows, timezone, chartPeriod) {
  const sales = new Map();

  rows.forEach(row => {
    const timestamp = parseStoredTimestamp(row.created_at);
    if (!timestamp) {
      return;
    }

    const dateKey = toZonedDateKey(timestamp, timezone);
    if (dateKey < chartPeriod.startKey || dateKey > chartPeriod.dataEndKey) {
      return;
    }

    const saleId = String(row.sale_id);
    if (!sales.has(saleId)) {
      sales.set(saleId, {
        total: Number.parseFloat(row.total_amount) || 0,
        itemTotal: 0,
        categories: new Map()
      });
    }

    const sale = sales.get(saleId);
    const category = String(row.category_name || '').trim() || 'Uncategorized';
    const itemTotal = Math.max(Number.parseFloat(row.item_total) || 0, 0);
    sale.itemTotal += itemTotal;
    sale.categories.set(
      category,
      (sale.categories.get(category) || 0) + itemTotal
    );
  });

  const categoryTotals = new Map();
  sales.forEach(sale => {
    if (sale.itemTotal <= 0 || sale.total <= 0) {
      return;
    }

    sale.categories.forEach((itemTotal, category) => {
      const allocatedTotal = sale.total * itemTotal / sale.itemTotal;
      categoryTotals.set(
        category,
        (categoryTotals.get(category) || 0) + allocatedTotal
      );
    });
  });

  const ranked = [...categoryTotals.entries()]
    .map(([label, salesTotal]) => ({
      label,
      sales: Math.round(salesTotal * 100) / 100
    }))
    .sort((left, right) => right.sales - left.sales || left.label.localeCompare(right.label));
  const visible = ranked.slice(0, 5);

  if (ranked.length > 5) {
    visible.push({
      label: 'Other',
      sales: Math.round(
        ranked.slice(5).reduce((sum, category) => sum + category.sales, 0) * 100
      ) / 100
    });
  }

  const totalSales = visible.reduce((sum, category) => sum + category.sales, 0);
  return {
    labels: visible.map(category => category.label),
    sales: visible.map(category => category.sales),
    colors: visible.map((category, index) => (
      category.label === 'Other'
        ? CATEGORY_PALETTE.at(-1)
        : CATEGORY_PALETTE[index % (CATEGORY_PALETTE.length - 1)]
    )),
    totalSales: Math.round(totalSales * 100) / 100
  };
}

function formatStatusLabel(value) {
  const normalized = String(value || 'completed').trim().toLowerCase();
  if (!normalized) return 'Completed';
  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function summarizeStatusMix(rows, timezone, chartPeriod) {
  const counts = new Map();

  rows.forEach(row => {
    const timestamp = parseStoredTimestamp(row.created_at);
    if (!timestamp) return;

    const dateKey = toZonedDateKey(timestamp, timezone);
    if (dateKey < chartPeriod.startKey || dateKey > chartPeriod.dataEndKey) {
      return;
    }

    const label = formatStatusLabel(row.payment_status || row.status);
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  const ranked = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  const visible = ranked.slice(0, 4);

  if (ranked.length > 4) {
    visible.push({
      label: 'Other',
      count: ranked.slice(4).reduce((sum, item) => sum + item.count, 0)
    });
  }

  return {
    labels: visible.map(item => item.label),
    counts: visible.map(item => item.count),
    colors: visible.map((item, index) => (
      item.label === 'Other'
        ? STATUS_PALETTE.at(-1)
        : STATUS_PALETTE[index % (STATUS_PALETTE.length - 1)]
    )),
    total: visible.reduce((sum, item) => sum + item.count, 0)
  };
}

async function loadCategorySalesData(
  db,
  chartPeriod,
  timezone,
  queryStart,
  queryEnd
) {
  if (!await hasCategorySalesSchema(db)) {
    return {
      labels: [],
      sales: [],
      colors: [],
      totalSales: 0
    };
  }

  const rows = await db('sale_items')
    .join('sales', 'sale_items.sale_id', 'sales.id')
    .leftJoin('products', 'sale_items.product_id', 'products.id')
    .leftJoin('categories', 'products.category_id', 'categories.id')
    .select(
      'sales.id as sale_id',
      'sales.created_at',
      'sales.total_amount',
      'sale_items.total_price as item_total',
      'categories.name as category_name'
    )
    .whereRaw('date(sales.created_at) BETWEEN ? AND ?', [queryStart, queryEnd])
    .orderBy('sales.created_at');

  return summarizeCategorySales(rows, timezone, chartPeriod);
}

async function loadSalesChartData(
  db,
  period = 'last7days',
  now = new Date(),
  options = {}
) {
  const requestedTimezone = typeof options === 'string' ? options : options.timezone;
  const timezone = await loadConfiguredTimezone(db, requestedTimezone);
  const chartPeriod = buildChartPeriod(period, now, timezone);
  const queryStart = toCalendarDateKey(addDays(chartPeriod.start, -1));
  const queryEnd = toCalendarDateKey(addDays(chartPeriod.dataEnd, 1));

  // Query one extra UTC day at each edge, then place each sale in its configured timezone.
  const rows = await db('sales')
    .select('created_at', 'total_amount', 'payment_status', 'status')
    .whereRaw('date(created_at) BETWEEN ? AND ?', [queryStart, queryEnd])
    .orderBy('created_at');

  const salesByBucket = new Map(
    chartPeriod.buckets.map(bucket => [bucket.key, 0])
  );
  const transactionsByBucket = new Map(
    chartPeriod.buckets.map(bucket => [bucket.key, 0])
  );

  rows.forEach(row => {
    const timestamp = parseStoredTimestamp(row.created_at);
    if (!timestamp) {
      return;
    }

    const dateKey = toZonedDateKey(timestamp, timezone);
    const bucketKey = chartPeriod.grouping === 'month'
      ? dateKey.slice(0, 7)
      : dateKey;

    // Future positions stay visible as zero without accepting future-dated sales.
    if (dateKey > chartPeriod.dataEndKey || !salesByBucket.has(bucketKey)) {
      return;
    }

    salesByBucket.set(
      bucketKey,
      salesByBucket.get(bucketKey) + (Number.parseFloat(row.total_amount) || 0)
    );
    transactionsByBucket.set(
      bucketKey,
      transactionsByBucket.get(bucketKey) + 1
    );
  });

  const sales = chartPeriod.buckets.map(bucket => salesByBucket.get(bucket.key) || 0);
  const transactions = chartPeriod.buckets.map(bucket => transactionsByBucket.get(bucket.key) || 0);
  const totalSales = sales.reduce((total, value) => total + value, 0);
  const totalTransactions = transactions.reduce((total, value) => total + value, 0);
  const categorySales = await loadCategorySalesData(
    db,
    chartPeriod,
    timezone,
    queryStart,
    queryEnd
  );

  return {
    labels: chartPeriod.buckets.map(bucket => bucket.label),
    dates: chartPeriod.buckets.map(bucket => bucket.key),
    sales,
    transactions,
    totalSales,
    totalTransactions,
    average: sales.length ? totalSales / sales.length : 0,
    rangeLabel: chartPeriod.rangeLabel,
    chartType: 'line',
    categorySales,
    statusMix: summarizeStatusMix(rows, timezone, chartPeriod)
  };
}

module.exports = {
  CATEGORY_PALETTE,
  DEFAULT_TIMEZONE,
  buildChartPeriod,
  loadSalesChartData,
  summarizeStatusMix,
  summarizeCategorySales,
  toLocalDateKey,
  toZonedDateKey
};
