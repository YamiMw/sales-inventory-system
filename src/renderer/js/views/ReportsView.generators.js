/**
 * attachReportsViewGenerators
 * Extracted prototype methods for ReportsView.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory;
  } else if (root && root.ReportsView) {
    factory(root.ReportsView);
  }
})(typeof window !== 'undefined' ? window : globalThis, function attachReportsViewGenerators(ReportsView) {
  if (!ReportsView) return ReportsView;
  const VERIFIED_COST_UNAVAILABLE = 'Unavailable - missing verified cost data';
  const EXPENSE_DATA_UNAVAILABLE = 'Unavailable - expense data is not recorded';
  Object.assign(ReportsView.prototype, {
  generateSalesSummary(context, start, end) {
    const rows = context.sales.map(sale => {
      const saleProfit = this.getSaleProfit(sale);
      return [
        sale.invoice_number || sale.invoiceNumber || `Sale #${sale.id || ''}`,
        this.formatDate(this.getDateValue(sale, ['created_at', 'sale_date', 'invoice_date'])),
        sale.customer_name || sale.customerName || 'Walk-in Customer',
        this.formatSaleUserNames(sale),
        this.formatSaleCategories(sale, context.productMap),
        this.formatSaleItems(sale),
        this.formatNumber(this.getSaleQuantity(sale)),
        this.formatPaymentMethod(sale.payment_method || sale.paymentMethod),
        this.formatCurrency(this.toNumber(sale.subtotal)),
        this.formatCurrency(this.toNumber(sale.discount_amount || sale.discountAmount)),
        this.formatCurrency(this.toNumber(sale.tax_amount || sale.taxAmount)),
        this.formatCurrency(this.getSaleTotal(sale)),
        saleProfit === null ? VERIFIED_COST_UNAVAILABLE : this.formatCurrency(saleProfit)
      ];
    });

    return {
      title: 'Sales Summary Report',
      period: this.formatPeriod(start, end),
      headers: [
        'Sale Number',
        'Date',
        'Customer',
        'User',
        'Category',
        'Items',
        'Quantity',
        'Payment Method',
        'Subtotal',
        'Discount',
        window.AppFormatters?.taxLabel || 'Tax',
        'Total',
        'Gross Profit'
      ],
      rows,
      chart: this.buildChartData(context.sales.map(sale => ({
        label: sale.invoice_number || sale.invoiceNumber || `Sale #${sale.id || ''}`,
        value: this.getSaleNetRevenue(sale)
      }))),
      summary: {
        totalRevenue: this.sum(context.sales, sale => this.getSaleNetRevenue(sale)),
        totalTransactions: context.sales.length,
        totalQuantity: this.sum(context.sales, sale => this.getSaleQuantity(sale)),
        totalTax: this.sum(context.sales, sale => this.toNumber(sale.tax_amount || sale.taxAmount)),
        totalGrossProfit: this.sumAvailable(context.sales, sale => this.getSaleProfit(sale))
      },
      notices: this.getCostNotices(context.sales, sale => this.getSaleProfit(sale))
    };
  },

  generateSalesByProduct(context, start, end) {
    const grouped = new Map();
    this.getSaleItems(context.sales).forEach(({ sale, item }) => {
      const product = context.productMap.get(String(item.product_id || item.productId)) || {};
      const key = String(item.product_id || item.productId || item.sku || item.product_name || item.name);
      const quantity = this.toNumber(item.quantity);
      const revenue = this.toNumber(item.total_price || item.totalPrice) || quantity * this.toNumber(item.unit_price || item.unitPrice);
      const unitCost = this.getItemUnitCost(item);

      if (!grouped.has(key)) {
        grouped.set(key, {
          product: item.product_name || item.productName || product.name || item.name || 'Unknown Product',
          sku: item.sku || product.sku || '',
          quantity: 0,
          revenue: 0,
          profit: 0,
          profitAvailable: true
        });
      }

      const entry = grouped.get(key);
      entry.quantity += quantity;
      entry.revenue += revenue;
      if (unitCost === null) {
        entry.profitAvailable = false;
      } else {
        entry.profit += revenue - (quantity * unitCost);
      }
    });

    const data = [...grouped.values()].sort((a, b) => b.revenue - a.revenue);
    return {
      title: 'Sales by Product Report',
      period: this.formatPeriod(start, end),
      headers: ['Product', 'SKU', 'Quantity Sold', 'Revenue', 'Gross Profit'],
      rows: data.map(item => [
        item.product,
        item.sku || 'N/A',
        this.formatNumber(item.quantity),
        this.formatCurrency(item.revenue),
        item.profitAvailable ? this.formatCurrency(item.profit) : VERIFIED_COST_UNAVAILABLE
      ]),
      chart: this.buildChartData(data.slice(0, 8).map(item => ({ label: item.product, value: item.revenue }))),
      summary: {
        totalQuantity: this.sum(data, item => item.quantity),
        totalRevenue: this.sum(data, item => item.revenue),
        totalGrossProfit: data.every(item => item.profitAvailable) ? this.sum(data, item => item.profit) : null
      },
      notices: data.some(item => !item.profitAvailable)
        ? [this.getMissingHistoricalCostNotice()]
        : []
    };
  },

  generateSalesByCustomer(context, start, end) {
    const grouped = new Map();
    context.sales.forEach(sale => {
      const key = String(sale.customer_id || sale.customerId || sale.customer_name || 'Walk-in Customer');
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: sale.customer_name || this.getCustomerName(context.customerMap.get(String(sale.customer_id || sale.customerId))) || 'Walk-in Customer',
          transactions: 0,
          revenue: 0,
          tax: 0,
          lastPurchase: ''
        });
      }

      const entry = grouped.get(key);
      entry.transactions += 1;
      entry.revenue += this.getSaleTotal(sale);
      entry.tax += this.toNumber(sale.tax_amount || sale.taxAmount);
      entry.lastPurchase = this.formatDate(this.getDateValue(sale, ['created_at', 'sale_date', 'invoice_date']));
    });

    const data = [...grouped.values()].sort((a, b) => b.revenue - a.revenue);
    return {
      title: 'Sales by Customer Report',
      period: this.formatPeriod(start, end),
      headers: ['Customer', 'Transactions', 'Revenue', window.AppFormatters?.taxLabel || 'Tax', 'Last Purchase'],
      rows: data.map(item => [item.name, item.transactions, this.formatCurrency(item.revenue), this.formatCurrency(item.tax), item.lastPurchase || 'N/A']),
      chart: this.buildChartData(data.slice(0, 8).map(item => ({ label: item.name, value: item.revenue }))),
      summary: {
        totalCustomers: data.length,
        totalRevenue: this.sum(data, item => item.revenue),
        averageRevenue: data.length ? this.sum(data, item => item.revenue) / data.length : 0
      }
    };
  },

  generateSalesByCategory(context, start, end) {
    const grouped = new Map();
    this.getSaleItems(context.sales).forEach(({ item }) => {
      const product = context.productMap.get(String(item.product_id || item.productId)) || {};
      const category = product.category_name || product.category || item.category_name || 'Uncategorized';
      const quantity = this.toNumber(item.quantity);
      const revenue = this.toNumber(item.total_price || item.totalPrice) || quantity * this.toNumber(item.unit_price || item.unitPrice);

      if (!grouped.has(category)) {
        grouped.set(category, { category, items: 0, quantity: 0, revenue: 0 });
      }

      const entry = grouped.get(category);
      entry.items += 1;
      entry.quantity += quantity;
      entry.revenue += revenue;
    });

    const data = [...grouped.values()].sort((a, b) => b.revenue - a.revenue);
    return {
      title: 'Sales by Category Report',
      period: this.formatPeriod(start, end),
      headers: ['Category', 'Line Items', 'Quantity Sold', 'Revenue'],
      rows: data.map(item => [item.category, item.items, this.formatNumber(item.quantity), this.formatCurrency(item.revenue)]),
      chart: this.buildChartData(data.map(item => ({ label: item.category, value: item.revenue }))),
      summary: {
        totalCategories: data.length,
        totalRevenue: this.sum(data, item => item.revenue),
        totalQuantity: this.sum(data, item => item.quantity)
      }
    };
  },

  generateStockStatus(context) {
    const inventory = this.getInventoryRows(context);
    const rows = inventory.map(item => {
      const onHand = this.toNumber(item.quantity_on_hand || item.stock || item.quantity);
      const reserved = this.toNumber(item.quantity_reserved || item.reserved);
      const available = onHand - reserved;
      const reorder = this.toNumber(item.reorder_level || item.reorderLevel);
      return [
        item.name || item.product_name || 'Unknown Product',
        item.sku || 'N/A',
        item.location_code || item.location || 'Main',
        this.formatNumber(onHand),
        this.formatNumber(reserved),
        this.formatNumber(available),
        this.formatNumber(reorder),
        this.getStockStatus(available, reorder)
      ];
    });

    return {
      title: 'Stock Status Report',
      headers: ['Product', 'SKU', 'Location', 'On Hand', 'Reserved', 'Available', 'Reorder', 'Status'],
      rows,
      chart: this.buildChartData(inventory.slice(0, 8).map(item => ({
        label: item.name || item.product_name || 'Product',
        value: this.toNumber(item.quantity_on_hand || item.stock || item.quantity)
      }))),
      summary: {
        productsTracked: inventory.length,
        lowStockItems: inventory.filter(item => this.getStockStatus(this.toNumber(item.quantity_on_hand) - this.toNumber(item.quantity_reserved), this.toNumber(item.reorder_level)) !== 'In Stock').length,
        totalOnHand: this.sum(inventory, item => this.toNumber(item.quantity_on_hand || item.stock || item.quantity))
      }
    };
  },

  async generateStockMovement(context, start, end) {
    const rows = [];
    const products = this.getInventoryRows(context).slice(0, 50);

    if (window.electronAPI && typeof window.electronAPI.getStockTransactions === 'function') {
      const transactionGroups = await Promise.all(products.map(product => this.safeApiCall('getStockTransactions', product.id, { limit: 50 })));
      transactionGroups.flat().forEach(transaction => {
        const product = context.productMap.get(String(transaction.product_id)) || {};
        const transactionDate = this.getDateValue(transaction, ['created_at']);
        if (transactionDate && (transactionDate < start || transactionDate > end)) return;
        rows.push([
          this.formatDate(transactionDate),
          product.name || transaction.product_name || 'Product',
          this.titleCase(transaction.transaction_type || 'movement'),
          this.formatNumber(this.toNumber(transaction.quantity)),
          this.formatNumber(this.toNumber(transaction.quantity_before)),
          this.formatNumber(this.toNumber(transaction.quantity_after)),
          transaction.reference_type || 'N/A'
        ]);
      });
    }

    if (rows.length === 0) {
      this.getSaleItems(context.sales).forEach(({ sale, item }) => {
        rows.push([
          this.formatDate(this.getDateValue(sale, ['created_at', 'sale_date', 'invoice_date'])),
          item.product_name || item.productName || item.sku || 'Product',
          'Sale',
          `-${this.formatNumber(this.toNumber(item.quantity))}`,
          'N/A',
          'N/A',
          sale.invoice_number || sale.invoiceNumber || `Sale #${sale.id || ''}`
        ]);
      });
    }

    return {
      title: 'Stock Movement Report',
      period: this.formatPeriod(start, end),
      headers: ['Date', 'Product', 'Type', 'Quantity', 'Before', 'After', 'Reference'],
      rows,
      summary: {
        movements: rows.length,
        productsReviewed: products.length
      }
    };
  },

  generateInventoryValuation(context) {
    const inventory = this.getInventoryRows(context);
    const rows = inventory.map(item => {
      const onHand = this.toNumber(item.quantity_on_hand || item.stock || item.quantity);
      const cost = this.getVerifiedCost(item.cost_price ?? item.costPrice);
      const retail = this.toNumber(item.unit_price || item.price);
      return [
        item.name || item.product_name || 'Unknown Product',
        item.sku || 'N/A',
        item.category_name || item.category || 'Uncategorized',
        this.formatNumber(onHand),
        cost === null ? VERIFIED_COST_UNAVAILABLE : this.formatCurrency(cost),
        cost === null ? VERIFIED_COST_UNAVAILABLE : this.formatCurrency(onHand * cost),
        this.formatCurrency(onHand * retail)
      ];
    });

    const costValues = inventory.map(item => {
      const onHand = this.toNumber(item.quantity_on_hand || item.stock || item.quantity);
      const cost = this.getVerifiedCost(item.cost_price ?? item.costPrice);
      return onHand > 0 && cost === null ? null : onHand * (cost || 0);
    });
    const totalCostValue = costValues.some(value => value === null)
      ? null
      : this.sum(costValues, value => value);
    const totalRetailValue = this.sum(inventory, item => this.toNumber(item.quantity_on_hand || item.stock || item.quantity) * this.toNumber(item.unit_price || item.price));
    const missingCostItems = costValues.filter(value => value === null).length;

    return {
      title: 'Inventory Valuation Report',
      headers: ['Product', 'SKU', 'Category', 'On Hand', 'Cost', 'Cost Value', 'Retail Value'],
      rows,
      chart: totalCostValue === null
        ? []
        : this.buildChartData(inventory.slice(0, 8).map(item => ({
            label: item.name || item.product_name || 'Product',
            value: this.toNumber(item.quantity_on_hand || item.stock || item.quantity)
              * this.getVerifiedCost(item.cost_price ?? item.costPrice)
          }))),
      summary: {
        totalCostValue,
        totalRetailValue,
        retailLessRecordedCost: totalCostValue === null ? null : totalRetailValue - totalCostValue,
        missingCostItems
      },
      notices: missingCostItems > 0
        ? [
            `${VERIFIED_COST_UNAVAILABLE}. ${missingCostItems} stocked product${missingCostItems === 1 ? '' : 's'} excluded from cost totals.`,
            'Retail value is shown separately and is never substituted for product cost.'
          ]
        : []
    };
  },

  generateLowStockReport(context) {
    const source = context.lowStock.length ? context.lowStock : this.getInventoryRows(context).filter(item => {
      const available = this.toNumber(item.available_stock || item.quantity_on_hand) - this.toNumber(item.quantity_reserved);
      return available <= this.toNumber(item.reorder_level || item.reorderLevel);
    });

    return {
      title: 'Low Stock Report',
      headers: ['Product', 'SKU', 'Available', 'Reorder Point', 'Shortage', 'Status'],
      rows: source.map(item => {
        const available = this.toNumber(item.available_stock || item.quantity_on_hand || item.stock || item.quantity);
        const reorder = this.toNumber(item.reorder_level || item.reorderLevel);
        return [
          item.name || item.product_name || 'Unknown Product',
          item.sku || 'N/A',
          this.formatNumber(available),
          this.formatNumber(reorder),
          this.formatNumber(Math.max(reorder - available, 0)),
          available <= 0 ? 'Out of Stock' : 'Low Stock'
        ];
      }),
      summary: {
        lowStockItems: source.length,
        outOfStockItems: source.filter(item => this.toNumber(item.available_stock || item.quantity_on_hand || item.stock || item.quantity) <= 0).length
      }
    };
  },

  generateProfitLoss(context, start, end) {
    const totalRevenue = this.sum(context.sales, sale => this.getSaleNetRevenue(sale));
    const totalTax = this.sum(context.sales, sale => this.toNumber(sale.tax_amount || sale.taxAmount));
    const discounts = this.sum(context.sales, sale => this.toNumber(sale.discount_amount || sale.discountAmount));
    const cogs = this.sumAvailable(context.sales, sale => this.getSaleCost(sale));
    const grossProfit = cogs === null ? null : totalRevenue - cogs;
    const grossMargin = grossProfit === null
      ? null
      : (totalRevenue ? `${((grossProfit / totalRevenue) * 100).toFixed(1)}%` : '0.0%');

    return {
      title: 'Profit & Loss Report',
      period: this.formatPeriod(start, end),
      headers: ['Account', 'Amount'],
      rows: [
        ['Net Sales Revenue', this.formatCurrency(totalRevenue)],
        ['Cost of Goods Sold', cogs === null ? VERIFIED_COST_UNAVAILABLE : this.formatCurrency(cogs)],
        ['Gross Profit', grossProfit === null ? VERIFIED_COST_UNAVAILABLE : this.formatCurrency(grossProfit)],
        ['Discounts', this.formatCurrency(discounts)],
        [`${window.AppFormatters?.taxLabel || 'Tax'} Collected`, this.formatCurrency(totalTax)],
        ['Operating Expenses', EXPENSE_DATA_UNAVAILABLE],
        ['Net Profit', EXPENSE_DATA_UNAVAILABLE]
      ],
      summary: {
        totalRevenue,
        costOfGoodsSold: cogs,
        grossProfit,
        grossMargin,
        netProfit: null
      },
      notices: [
        ...(cogs === null ? [this.getMissingHistoricalCostNotice()] : []),
        'Net profit is unavailable because operating expense data is not recorded by this system.'
      ]
    };
  },

  generateTaxSummary(context, start, end) {
    const salesRows = context.sales.map(sale => [
      'POS Sale',
      sale.invoice_number || sale.invoiceNumber || `Sale #${sale.id || ''}`,
      this.formatDate(this.getDateValue(sale, ['created_at', 'sale_date', 'invoice_date'])),
      sale.customer_name || 'Walk-in Customer',
      this.formatCurrency(this.toNumber(sale.subtotal)),
      this.formatCurrency(this.toNumber(sale.tax_amount || sale.taxAmount))
    ]);

    const invoiceRows = context.invoices.map(invoice => [
      'Invoice',
      invoice.invoice_number || invoice.invoiceNumber || `Invoice #${invoice.id || ''}`,
      this.formatDate(this.getDateValue(invoice, ['invoice_date', 'created_at'])),
      invoice.customer_name || 'Walk-in Customer',
      this.formatCurrency(this.toNumber(invoice.subtotal)),
      this.formatCurrency(this.toNumber(invoice.tax_amount || invoice.taxAmount))
    ]);

    const rows = [...salesRows, ...invoiceRows];
    return {
      title: 'Tax Summary Report',
      period: this.formatPeriod(start, end),
      headers: ['Source', 'Document', 'Date', 'Customer', 'Taxable Amount', `${window.AppFormatters?.taxLabel || 'Tax'} Collected`],
      rows,
      summary: {
        documents: rows.length,
        taxableAmount: this.sum([...context.sales, ...context.invoices], item => this.toNumber(item.subtotal)),
        totalTax: this.sum([...context.sales, ...context.invoices], item => this.toNumber(item.tax_amount || item.taxAmount))
      }
    };
  },

  generateAccountsReceivable(context) {
    const openInvoices = context.invoices.filter(invoice => {
      const due = this.getInvoiceDue(invoice);
      const status = String(invoice.status || '').toLowerCase();
      return due > 0 || ['issued', 'sent', 'partial', 'overdue', 'unpaid'].includes(status);
    });

    return {
      title: 'Accounts Receivable Report',
      headers: ['Customer', 'Invoice', 'Total', 'Paid', 'Outstanding', 'Status'],
      rows: openInvoices.map(invoice => [
        invoice.customer_name || 'Walk-in Customer',
        invoice.invoice_number || invoice.invoiceNumber || `Invoice #${invoice.id || ''}`,
        this.formatCurrency(this.toNumber(invoice.total_amount || invoice.totalAmount)),
        this.formatCurrency(this.toNumber(invoice.amount_paid || invoice.amountPaid)),
        this.formatCurrency(this.getInvoiceDue(invoice)),
        this.titleCase(invoice.status || 'issued')
      ]),
      summary: {
        openInvoices: openInvoices.length,
        totalOutstanding: this.sum(openInvoices, invoice => this.getInvoiceDue(invoice)),
        overdueInvoices: openInvoices.filter(invoice => this.getAgeInDays(invoice.due_date || invoice.dueDate || invoice.invoice_date || invoice.created_at) > 0).length
      }
    };
  },

  generateQuotationSummary(context, start, end) {
    return {
      title: 'Quotation Summary Report',
      period: this.formatPeriod(start, end),
      headers: ['Quote Number', 'Customer', 'Status', 'Subtotal', window.AppFormatters?.taxLabel || 'Tax', 'Total'],
      rows: context.quotations.map(quote => [
        quote.quote_number || quote.quoteNumber || `Quote #${quote.id || ''}`,
        quote.customer_name || 'Walk-in Customer',
        this.titleCase(quote.status || 'draft'),
        this.formatCurrency(this.toNumber(quote.subtotal)),
        this.formatCurrency(this.toNumber(quote.tax_amount || quote.taxAmount)),
        this.formatCurrency(this.toNumber(quote.total_amount || quote.totalAmount))
      ]),
      chart: this.buildStatusChart(context.quotations),
      summary: {
        quotations: context.quotations.length,
        accepted: context.quotations.filter(item => String(item.status).toLowerCase() === 'accepted').length,
        converted: context.quotations.filter(item => String(item.status).toLowerCase() === 'converted').length,
        totalValue: this.sum(context.quotations, item => this.toNumber(item.total_amount || item.totalAmount))
      }
    };
  },

  generateInvoiceSummary(context, start, end) {
    return {
      title: 'Invoice Summary Report',
      period: this.formatPeriod(start, end),
      headers: ['Invoice Number', 'Customer', 'Status', 'Subtotal', window.AppFormatters?.taxLabel || 'Tax', 'Paid', 'Due', 'Total'],
      rows: context.invoices.map(invoice => [
        invoice.invoice_number || invoice.invoiceNumber || `Invoice #${invoice.id || ''}`,
        invoice.customer_name || 'Walk-in Customer',
        this.titleCase(invoice.status || 'issued'),
        this.formatCurrency(this.toNumber(invoice.subtotal)),
        this.formatCurrency(this.toNumber(invoice.tax_amount || invoice.taxAmount)),
        this.formatCurrency(this.toNumber(invoice.amount_paid || invoice.amountPaid)),
        this.formatCurrency(this.getInvoiceDue(invoice)),
        this.formatCurrency(this.toNumber(invoice.total_amount || invoice.totalAmount))
      ]),
      chart: this.buildStatusChart(context.invoices),
      summary: {
        invoices: context.invoices.length,
        totalInvoiced: this.sum(context.invoices, item => this.toNumber(item.total_amount || item.totalAmount)),
        totalPaid: this.sum(context.invoices, item => this.toNumber(item.amount_paid || item.amountPaid)),
        totalDue: this.sum(context.invoices, item => this.getInvoiceDue(item))
      }
    };
  },

  generateCustomerStatements(context) {
    const invoicesByCustomer = new Map();
    context.invoices.forEach(invoice => {
      const key = String(invoice.customer_id || invoice.customerId || invoice.customer_name || 'Walk-in Customer');
      if (!invoicesByCustomer.has(key)) invoicesByCustomer.set(key, []);
      invoicesByCustomer.get(key).push(invoice);
    });

    return {
      title: 'Customer Statements Report',
      headers: ['Customer', 'Phone', 'Email', 'Balance', 'Credit Limit', 'Invoices'],
      rows: context.customers.map(customer => {
        const customerInvoices = invoicesByCustomer.get(String(customer.id || customer.customer_code)) || invoicesByCustomer.get(customer.name) || [];

        return [
          customer.name || 'Walk-in Customer',
          customer.phone || 'N/A',
          customer.email || 'N/A',
          this.formatCurrency(this.toNumber(customer.current_balance || customer.balance)),
          this.formatCurrency(this.toNumber(customer.credit_limit || customer.creditLimit)),
          customerInvoices.length
        ];
      }),
      summary: {
        customers: context.customers.length,
        totalBalances: this.sum(context.customers, item => this.toNumber(item.current_balance || item.balance)),
        totalCreditLimit: this.sum(context.customers, item => this.toNumber(item.credit_limit || item.creditLimit))
      }
    };
  },

  generateDailySummary(context, start, end) {
    return this.generateSalesSummary(context, start, end);
  },

  async generateAuditLog(context, start, end) {
    const rows = [];
    [...context.quotations, ...context.invoices].forEach(document => {
      (document.audit_logs || []).forEach(log => {
        rows.push([
          this.formatDate(this.getDateValue(log, ['created_at'])),
          this.titleCase(log.action || 'activity'),
          log.entity_type || log.entityType || 'Document',
          log.entity_id || log.entityId || document.id || '',
          log.user_name || log.created_by_name || 'System'
        ]);
      });
    });

    return {
      title: 'Audit Log Report',
      period: this.formatPeriod(start, end),
      headers: ['Date', 'Action', 'Entity', 'Entity ID', 'User'],
      rows,
      summary: { activities: rows.length }
    };
  },

  generateEmptyReport(reportType, start, end) {
    return {
      title: `${this.titleCase(reportType.replace(/-/g, ' '))} Report`,
      period: this.formatPeriod(start, end),
      headers: ['Item', 'Value'],
      rows: [],
      summary: { records: 0 }
    };
  }
  });
  return ReportsView;
});
