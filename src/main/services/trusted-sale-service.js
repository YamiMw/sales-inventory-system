/**
 * Trusted Sale Service
 * Calculates and persists sales from database-trusted prices inside one transaction.
 */

const ALLOWED_DISCOUNT_BASIS_POINTS = new Set([0, 200, 500, 1000]);
const ALLOWED_PAYMENT_METHODS = new Set(['cash', 'card', 'mobile', 'bank', 'credit']);
const DEFAULT_TAX_RATE_PERCENT = 10;
const { applyStockDelta } = require('./stock-protection');

// Money stays in integer minor units and rates in basis points until persistence.
function toMinorUnits(value, fieldName = 'amount') {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number`);
  }
  return Math.round(parsed * 100);
}

function fromMinorUnits(value) {
  return Number((value / 100).toFixed(2));
}

function toOptionalCostMinorUnits(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function parseBoolean(value, fallback = false) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function normalizeProductId(item) {
  const productId = Number(item?.productId ?? item?.product_id ?? item?.id);
  if (!Number.isSafeInteger(productId) || productId < 1) {
    throw new Error('Every sale line requires a valid product id');
  }
  return productId;
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error('Sale quantities must be positive whole numbers');
  }
  return quantity;
}

function normalizeDiscountBasisPoints(saleData) {
  let rate = saleData.discountRate;
  if (rate === undefined && saleData.discountPercent !== undefined) {
    rate = Number(saleData.discountPercent) / 100;
  }

  const parsedRate = rate === undefined ? 0 : Number(rate);
  if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 1) {
    throw new Error('Discount rate must be between 0 and 1');
  }

  const basisPoints = Math.round(parsedRate * 10000);
  if (!ALLOWED_DISCOUNT_BASIS_POINTS.has(basisPoints)) {
    throw new Error('POS discount must be one of 0%, 2%, 5%, or 10%');
  }
  return basisPoints;
}

function parseTaxRateBasisPoints(value) {
  const parsed = Number(value);
  const taxRate = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : DEFAULT_TAX_RATE_PERCENT;
  return Math.round(taxRate * 100);
}

async function loadSaleSettings(db) {
  const rows = await db('settings')
    .select('key', 'value')
    .whereIn('key', ['default_tax_rate', 'tax_inclusive']);
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    taxRateBasisPoints: parseTaxRateBasisPoints(settings.default_tax_rate),
    taxInclusive: parseBoolean(settings.tax_inclusive, false)
  };
}

function normalizeRequestedItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Sale requires at least one product line');
  }

  const quantities = new Map();
  for (const item of items) {
    const productId = normalizeProductId(item);
    const quantity = normalizeQuantity(item.quantity);
    // Merge duplicate product lines so stock and pricing are evaluated once per product.
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }

  return quantities;
}

function rendererPricingWasOverridden(saleData, requestedItems, totals) {
  // Renderer totals are diagnostic only; persisted values always come from trusted data.
  const submittedTotals = [
    ['subtotal', totals.subtotalCents],
    ['discountAmount', totals.discountAmountCents],
    ['taxAmount', totals.taxAmountCents],
    ['totalAmount', totals.totalAmountCents]
  ];

  const totalMismatch = submittedTotals.some(([field, trustedValue]) => {
    if (saleData[field] === undefined) return false;
    try {
      return toMinorUnits(saleData[field], field) !== trustedValue;
    } catch {
      return true;
    }
  });

  const submittedItems = Array.isArray(saleData.items) ? saleData.items : [];
  const priceMismatch = submittedItems.some((item) => {
    const submittedPrice = item.price ?? item.unitPrice ?? item.unit_price;
    if (submittedPrice === undefined) return false;
    const trustedItem = requestedItems.find(
      (candidate) => candidate.productId === normalizeProductId(item)
    );
    try {
      return !trustedItem
        || toMinorUnits(submittedPrice, 'item price') !== trustedItem.unitPriceCents;
    } catch {
      return true;
    }
  });

  return totalMismatch || priceMismatch;
}

async function calculateTrustedSale(db, saleData) {
  const requestedQuantities = normalizeRequestedItems(saleData.items);
  const productIds = [...requestedQuantities.keys()];
  // The renderer supplies product ids and quantities, never authoritative prices or costs.
  const products = await db('products')
    .select('id', 'name', 'sku', 'unit_price', 'cost_price', 'is_active')
    .whereIn('id', productIds)
    .where('is_active', true);

  const productMap = new Map(products.map((product) => [Number(product.id), product]));
  const missingProductIds = productIds.filter((productId) => !productMap.has(productId));
  if (missingProductIds.length > 0) {
    throw new Error(`Unknown or inactive product: ${missingProductIds.join(', ')}`);
  }

  const discountBasisPoints = normalizeDiscountBasisPoints(saleData);
  const { taxRateBasisPoints, taxInclusive } = await loadSaleSettings(db);
  const taxExempt = saleData.taxExempt === true;

  const items = productIds.map((productId) => {
    const product = productMap.get(productId);
    const quantity = requestedQuantities.get(productId);
    const unitPriceCents = toMinorUnits(product.unit_price, `price for ${product.name}`);
    const unitCostCents = toOptionalCostMinorUnits(product.cost_price);
    const grossAmountCents = unitPriceCents * quantity;
    const discountAmountCents = Math.round(
      grossAmountCents * discountBasisPoints / 10000
    );

    return {
      productId,
      productName: product.name,
      sku: product.sku,
      quantity,
      unitPriceCents,
      unitCostCents,
      grossAmountCents,
      discountAmountCents,
      totalPriceCents: grossAmountCents - discountAmountCents
    };
  });

  const subtotalCents = items.reduce((sum, item) => sum + item.grossAmountCents, 0);
  const discountAmountCents = items.reduce(
    (sum, item) => sum + item.discountAmountCents,
    0
  );
  const taxableAmountCents = items.reduce((sum, item) => sum + item.totalPriceCents, 0);
  let taxAmountCents = 0;

  if (!taxExempt && taxRateBasisPoints > 0) {
    // VAT is reported separately; the payable total remains the discounted taxable amount.
    taxAmountCents = taxInclusive
      ? Math.round(
          taxableAmountCents * taxRateBasisPoints / (10000 + taxRateBasisPoints)
        )
      : Math.round(taxableAmountCents * taxRateBasisPoints / 10000);
  }

  const totalAmountCents = taxableAmountCents;
  const totals = {
    subtotalCents,
    discountAmountCents,
    taxableAmountCents,
    taxAmountCents,
    totalAmountCents
  };

  return {
    items,
    discountBasisPoints,
    taxRateBasisPoints,
    taxInclusive,
    taxExempt,
    rendererPricingOverridden: rendererPricingWasOverridden(saleData, items, totals),
    ...totals
  };
}

function normalizePayment(saleData, totalAmountCents) {
  const payment = saleData.payments?.[0] || {};
  const method = String(payment.method || 'cash').toLowerCase();
  if (!ALLOWED_PAYMENT_METHODS.has(method)) {
    throw new Error(`Unsupported payment method: ${method}`);
  }

  const amountCents = toMinorUnits(payment.amount, 'Payment amount');
  if (amountCents < totalAmountCents) {
    throw new Error(
      `Payment amount is less than the trusted sale total of ${fromMinorUnits(totalAmountCents).toFixed(2)}`
    );
  }

  return { method, amountCents };
}

async function generateSaleNumber(db, now = new Date()) {
  const year = now.getFullYear();
  const base = `POS-${year}`;
  const rows = await db('sales')
    .select('invoice_number')
    .where('invoice_number', 'like', `${base}-%`);
  const maximum = rows.reduce((current, row) => {
    const match = String(row.invoice_number || '').match(
      new RegExp(`^${base}-(\\d+)$`)
    );
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);

  return `${base}-${String(maximum + 1).padStart(4, '0')}`;
}

async function createTrustedSale(db, saleData, options = {}) {
  const logger = options.logger || { info() {}, warn() {} };
  const allowNegativeStock = options.allowNegativeStock === true;
  const negativeStockActor = options.negativeStockActor || null;
  const now = options.clock?.now ? options.clock.now() : new Date();
  const createdAt = now.toISOString();

  // Sale rows, line items, stock changes, and audit records commit or roll back together.
  return await db.transaction(async (trx) => {
    const calculation = await calculateTrustedSale(trx, saleData);
    const payment = normalizePayment(saleData, calculation.totalAmountCents);

    const invoiceNumber = await generateSaleNumber(trx, now);
    const userId = saleData.userId || null;
    // Older databases may predate cost snapshots, so writes remain migration-compatible.
    const supportsCostSnapshots = await trx.schema.hasColumn('sale_items', 'unit_cost');
    const [saleId] = await trx('sales').insert({
      invoice_number: invoiceNumber,
      customer_id: saleData.customerId || null,
      subtotal: fromMinorUnits(calculation.subtotalCents),
      discount_rate: calculation.discountBasisPoints / 10000,
      discount_amount: fromMinorUnits(calculation.discountAmountCents),
      tax_rate: calculation.taxRateBasisPoints / 100,
      tax_inclusive: calculation.taxInclusive,
      tax_exempt: calculation.taxExempt,
      tax_amount: fromMinorUnits(calculation.taxAmountCents),
      total_amount: fromMinorUnits(calculation.totalAmountCents),
      payment_method: payment.method,
      payment_status: 'completed',
      notes: saleData.notes || null,
      created_by: userId,
      created_at: createdAt
    });

    for (const item of calculation.items) {
      const saleItem = {
        sale_id: saleId,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: fromMinorUnits(item.unitPriceCents),
        discount_percent: calculation.discountBasisPoints / 100,
        total_price: fromMinorUnits(item.totalPriceCents)
      };
      if (supportsCostSnapshots) {
        saleItem.unit_cost = item.unitCostCents === null
          ? null
          : fromMinorUnits(item.unitCostCents);
      }
      await trx('sale_items').insert(saleItem);

      const stockResult = await applyStockDelta(trx, {
        productId: item.productId,
        delta: -item.quantity,
        allowNegativeStock
      });

      await trx('stock_transactions').insert({
        product_id: item.productId,
        transaction_type: 'sale',
        quantity: -item.quantity,
        quantity_before: stockResult.beforeQuantity,
        quantity_after: stockResult.afterQuantity,
        reference_type: 'sale',
        reference_id: saleId,
        notes: stockResult.afterQuantity < 0
          ? `Sale ${invoiceNumber}; negative stock authorized by ${negativeStockActor?.username}`
          : `Sale ${invoiceNumber}`,
        created_by: userId,
        created_at: createdAt
      });
    }

    if (calculation.rendererPricingOverridden) {
      logger.warn(`Ignored renderer pricing for trusted sale ${invoiceNumber}`);
    }
    logger.info(`Sale created: ${invoiceNumber}`);

    return {
      saleId,
      invoiceNumber,
      subtotal: fromMinorUnits(calculation.subtotalCents),
      discountAmount: fromMinorUnits(calculation.discountAmountCents),
      taxAmount: fromMinorUnits(calculation.taxAmountCents),
      totalAmount: fromMinorUnits(calculation.totalAmountCents),
      createdAt,
      rendererPricingOverridden: calculation.rendererPricingOverridden
    };
  });
}

function reproducePersistedSaleTotals(sale, items) {
  // Historical reports use the sale's stored rates instead of today's settings.
  const subtotalCents = items.reduce(
    (sum, item) => sum + toMinorUnits(item.unit_price, 'unit price') * Number(item.quantity),
    0
  );
  const taxableAmountCents = items.reduce(
    (sum, item) => sum + toMinorUnits(item.total_price, 'line total'),
    0
  );
  const discountAmountCents = subtotalCents - taxableAmountCents;
  const taxRateBasisPoints = parseTaxRateBasisPoints(sale.tax_rate);
  const taxInclusive = parseBoolean(sale.tax_inclusive, false);
  const taxExempt = parseBoolean(sale.tax_exempt, false);
  const taxAmountCents = taxExempt
    ? 0
    : taxInclusive
      ? Math.round(
          taxableAmountCents * taxRateBasisPoints / (10000 + taxRateBasisPoints)
        )
      : Math.round(taxableAmountCents * taxRateBasisPoints / 10000);
  const totalAmountCents = taxableAmountCents;

  return {
    subtotal: fromMinorUnits(subtotalCents),
    discountAmount: fromMinorUnits(discountAmountCents),
    taxAmount: fromMinorUnits(taxAmountCents),
    totalAmount: fromMinorUnits(totalAmountCents)
  };
}

module.exports = {
  ALLOWED_DISCOUNT_BASIS_POINTS,
  calculateTrustedSale,
  createTrustedSale,
  reproducePersistedSaleTotals
};
