/**
 * Commerce Handlers
 * Coordinates focused authenticated IPC commerce handler registration.
 */

'use strict';

const {
  createCommerceDocumentHelpers
} = require('./commerce-document-helpers');
const { registerCommerceSalesHandlers } = require('./commerce-sales-handlers');
const { registerCommerceQuotationHandlers } = require('./commerce-quotation-handlers');
const { registerCommerceInvoiceHandlers } = require('./commerce-invoice-handlers');
const { registerCommerceApprovalHandlers } = require('./commerce-approval-handlers');
const { registerCommerceInvoiceActionHandlers } = require('./commerce-invoice-action-handlers');
const { registerCommerceExportHandlers } = require('./commerce-export-handlers');

function registerCommerceHandlers(context) {
  const helpers = createCommerceDocumentHelpers({
    normalizeMoney: context.normalizeMoney,
    parseStockQuantity: context.parseStockQuantity,
    passwordUtils: context.passwordUtils
  });

  registerCommerceSalesHandlers(context);
  registerCommerceQuotationHandlers(context, helpers);
  registerCommerceInvoiceHandlers(context, helpers);
  registerCommerceApprovalHandlers(context, helpers);
  registerCommerceInvoiceActionHandlers(context);
  registerCommerceExportHandlers(context);
}

module.exports = { registerCommerceHandlers };
