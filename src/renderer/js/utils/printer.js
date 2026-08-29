/**
 * Printer
 * Provides renderer printer helpers.
 */

(function(global) {
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function singleLine(value, separator = ' ') {
    return String(value ?? '')
      .split(/[\r\n]+/)
      .map(part => part.trim())
      .filter(Boolean)
      .join(separator)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function textValue(value) {
    if (value === null || value === undefined || typeof value === 'object') return '';
    return String(value).trim();
  }

  function firstText(...values) {
    for (const value of values) {
      const text = textValue(value);
      if (text) return text;
    }
    return '';
  }

  function firstNumber(...values) {
    for (const value of values) {
      if (value === null || value === undefined || value === '') continue;
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return null;
  }

  function moneyValue(...values) {
    return firstNumber(...values) ?? 0;
  }

  function formatQuantity(value) {
    const quantity = Number(value);
    if (!Number.isFinite(quantity)) return '0';
    return Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2);
  }

  function fullContactAddress(settings = {}) {
    return [
      settings.company_address,
      settings.company_city,
      settings.company_state,
      settings.company_zip
    ].map(value => singleLine(value))
      .filter(Boolean)
      .join(', ');
  }

  function lineItemDetails(item = {}) {
    const quantity = moneyValue(item.quantity, item.qty, 0);
    const unitPrice = moneyValue(item.unitPrice, item.unit_price, item.price, 0);
    const totalPrice = moneyValue(
      item.totalPrice,
      item.total_price,
      item.lineTotal,
      item.line_total,
      quantity * unitPrice
    );

    return {
      name: firstText(item.name, item.productName, item.product_name, item.sku, 'Item'),
      quantity,
      unitPrice,
      totalPrice
    };
  }

  function receiptHtml(sale = {}, settings = {}) {
    const formatter = global.AppFormatters;
    const currency = value => formatter?.formatCurrency(value) || Number(value || 0).toFixed(2);
    const dateTime = value => {
      const source = value || new Date();
      const formatted = formatter?.formatDateTime(source);
      if (formatted && formatted !== 'N/A') return formatted;
      const date = new Date(source);
      return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
    };
    const items = Array.isArray(sale.items) ? sale.items : [];
    const taxName = settings.tax_name || formatter?.taxLabel || 'Tax';
    const isNarrowPaper = String(settings.printer_paper_size || '80mm').toLowerCase().includes('58');
    const paperWidth = isNarrowPaper ? '54mm' : '72mm';
    const design = settings.receipt_design || 'classic';
    const showBusinessDetails = design !== 'minimal';
    const addressLine = fullContactAddress(settings);
    const phoneLine = singleLine(settings.company_phone, ' / ');
    const taxId = singleLine(settings.company_tax_id);
    const itemDetails = items.map(lineItemDetails);
    const rows = itemDetails.map(item => `
      <tr>
        <td class="item-name">${escapeHtml(item.name)}</td>
        <td class="item-price">${escapeHtml(currency(item.unitPrice))}</td>
        <td class="item-qty">${escapeHtml(formatQuantity(item.quantity))}</td>
        <td class="item-total">${escapeHtml(currency(item.totalPrice))}</td>
      </tr>
    `).join('');
    const itemSubtotal = itemDetails.reduce((sum, item) => sum + item.totalPrice, 0);
    const subtotal = moneyValue(sale.subtotal, sale.subtotalAmount, sale.subtotal_amount, itemSubtotal);
    const discount = moneyValue(sale.discount, sale.discountAmount, sale.discount_amount, 0);
    const tax = moneyValue(sale.tax, sale.taxAmount, sale.tax_amount, 0);
    const total = moneyValue(sale.total, sale.totalAmount, sale.total_amount, subtotal - discount);
    const amountPaidValue = firstNumber(
      sale.amountPaid,
      sale.amount_paid,
      sale.amountReceived,
      sale.amount_received,
      sale.paymentAmount,
      sale.payment_amount,
      sale.payment?.amount,
      sale.payments?.[0]?.amount
    );
    const amountPaid = amountPaidValue ?? total;
    const change = firstNumber(sale.change, sale.changeDue, sale.change_due) ?? Math.max(amountPaid - total, 0);
    const customerName = firstText(
      sale.customerName,
      sale.customer_name,
      sale.customer?.name,
      sale.customer,
      'Walk-in Customer'
    );
    const customerAddress = firstText(
      sale.customerAddress,
      sale.customer_address,
      sale.customer?.address,
      ''
    );
    const receiptNumber = firstText(sale.invoiceNumber, sale.invoice_number, sale.saleNumber, sale.id, '');
    const messageLines = [
      settings.printer_header,
      settings.printer_footer
    ].map(value => singleLine(value))
      .filter(Boolean);

    return `<!doctype html>
      <html><head><meta charset="utf-8"><title>Receipt</title>
      <style>
        @page{margin:0}
        *{box-sizing:border-box}
        body{
          width:${paperWidth};
          margin:0;
          padding:0;
          background:#fff;
          color:#111;
          font-family:"Times New Roman", Georgia, serif;
          font-size:${isNarrowPaper ? '9.5px' : '10.5px'};
          line-height:1.28;
        }
        .receipt{
          padding:9px ${isNarrowPaper ? '4px' : '6px'} 16px;
        }
        h1{
          margin:0 0 6px;
          text-align:center;
          font-size:${isNarrowPaper ? '18px' : '22px'};
          line-height:1.15;
          font-weight:700;
          letter-spacing:0.2px;
          font-family:"Times New Roman", Georgia, serif;
        }
        p{margin:0}
        .business-lines p,.footer p{text-align:center}
        .business-lines p{
          margin:0 0 2px;
          font-weight:700;
        }
        .meta,.customer,.summary,.payment-summary{margin-top:7px}
        .receipt-line{display:flex;gap:6px;align-items:flex-start;justify-content:space-between;padding:1px 0}
        .receipt-line .label{font-weight:700;white-space:nowrap}
        .receipt-line .value{text-align:right;overflow-wrap:anywhere}
        .customer .value{text-align:left;flex:1}
        .divider{border-top:1px dashed #111;margin:8px 0 5px}
        table{width:100%;border-collapse:collapse;table-layout:fixed}
        th,td{padding:3px 0;vertical-align:top}
        th{font-weight:700;border-bottom:1px dashed #111;text-align:left}
        .item-name{width:43%;padding-right:4px;overflow-wrap:anywhere}
        .item-price{
            width:24%;
            text-align:right;
            white-space:nowrap;
            padding-right:8px;
          }

        .item-qty{
            width:12%;
            text-align:center;
            white-space:nowrap;
            padding-left:4px;
          }

        .item-total{
            width:21%;
            text-align:right;
            white-space:nowrap;
          }
        .summary{border-top:1px dashed #111;padding-top:5px}
        .summary .value,.payment-summary .value{font-weight:700}
        .grand-total{margin-top:3px;padding-top:4px;border-top:1px dashed #111;font-size:1.12em;font-weight:700}
        .payment-summary{border-top:1px dashed #111;border-bottom:1px dashed #111;padding:5px 0}
        .footer{margin-top:9px}
        .footer p{margin:0 0 3px;font-weight:700}
        .receipt-bottom-space{height:16px}
      </style></head><body><main class="receipt">
      <h1>${escapeHtml(settings.company_name || 'Receipt')}</h1>
      ${showBusinessDetails ? `<div class="business-lines">
        ${addressLine ? `<p>Address: ${escapeHtml(addressLine)}</p>` : ''}
        ${phoneLine ? `<p>Phone Number: ${escapeHtml(phoneLine)}</p>` : ''}
        ${taxId ? `<p>TPIN: ${escapeHtml(taxId)}</p>` : ''}
      </div>` : ''}
      <div class="meta">
        ${receiptNumber ? `<div class="receipt-line"><span class="label">Receipt:</span><span class="value">${escapeHtml(receiptNumber)}</span></div>` : ''}
        <div class="receipt-line"><span class="label">Date:</span><span class="value">${escapeHtml(dateTime(sale.createdAt || sale.created_at || new Date()))}</span></div>
      </div>
      <div class="customer">
        <div class="receipt-line"><span class="label">Customer name:</span><span class="value">${escapeHtml(customerName)}</span></div>
        <div class="receipt-line"><span class="label">Customer address:</span><span class="value">${escapeHtml(customerAddress || '-')}</span></div>
      </div>
      <div class="divider"></div>
      <table class="item-table">
        <thead>
          <tr><th class="item-name">Product name</th><th class="item-price">Unit Price</th><th class="item-qty">Qty</th><th class="item-total">Total</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="4" class="item-name">No items</td></tr>'}
      </tbody></table>
      <div class="summary">
        <div class="receipt-line"><span class="label">Subtotal:</span><span class="value">${escapeHtml(currency(subtotal))}</span></div>
        ${discount > 0 ? `<div class="receipt-line"><span class="label">Discount:</span><span class="value">-${escapeHtml(currency(discount))}</span></div>` : ''}
        ${settings.tax_show_separate ? `<div class="receipt-line"><span class="label">${escapeHtml(taxName)}:</span><span class="value">${escapeHtml(currency(tax))}</span></div>` : ''}
        <div class="receipt-line grand-total"><span class="label">Grand Total:</span><span class="value">${escapeHtml(currency(total))}</span></div>
      </div>
      <div class="payment-summary">
        <div class="receipt-line"><span class="label">Amount Paid:</span><span class="value">${escapeHtml(currency(amountPaid))}</span></div>
        <div class="receipt-line"><span class="label">Change:</span><span class="value">${escapeHtml(currency(change))}</span></div>
      </div>
      <div class="footer">
        ${messageLines.length
          ? messageLines.map(line => `<p>${escapeHtml(line)}</p>`).join('')
          : '<p>Thank you for buying from us!</p>'}
      </div>
      <div class="receipt-bottom-space"></div>
      </main></body></html>`;
  }

  async function printReceipt(sale, settings = global.appSettings || {}) {
    const html = receiptHtml(sale, settings);
    if (global.electronAPI?.printReceipt) {
      const result = await global.electronAPI.printReceipt({ html, settings });
      if (!result?.success) {
        throw new Error(result?.error || 'Receipt printing failed');
      }
      return result.data;
    }

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.srcdoc = html;
    frame.onload = () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 1000);
    };
    document.body.appendChild(frame);
    return { printerName: 'Browser print dialog' };
  }

  global.ReceiptPrinter = Object.freeze({ receiptHtml, printReceipt });
})(typeof window !== 'undefined' ? window : globalThis);
