/**
 * attachQuotationsInvoicesPrintingMethods
 * Extracted prototype methods for QuotationsInvoicesView.
 */

(function () {
  if (typeof window === 'undefined' || !window.QuotationsInvoicesView) return;
  const QuotationsInvoicesView = window.QuotationsInvoicesView;
  Object.assign(QuotationsInvoicesView.prototype, {
  getCompanyDetails() {
    const safeLogo = value => /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(String(value || '')) ? String(value) : '';
    const address = this.getSettingValue(['company_address', 'company.address'], 'company-address', '');
    const city = this.getSettingValue(['company_city', 'company.city'], 'company-city', '');
    const region = this.getSettingValue(['company_state', 'company.state'], 'company-state', '');
    const postalCode = this.getSettingValue(['company_zip', 'company.zip'], 'company-zip', '');
    const localityLine = [city, region, postalCode].filter(Boolean).join(', ');
    const addressLines = [address, localityLine].filter(Boolean);
    const name = this.getSettingValue(['company_name', 'company.name'], 'company-name', 'My Business');

    return {
      name,
      description: this.getSettingValue(
        ['company_description', 'company.description'],
        'company-description',
        ''
      ),
      address,
      city,
      region,
      postalCode,
      addressLines,
      phone: this.getSettingValue(['company_phone', 'company.phone'], 'company-phone', ''),
      email: this.getSettingValue(['company_email', 'company.email'], 'company-email', ''),
      website: this.getSettingValue(['company_website', 'company.website'], 'company-website', ''),
      taxId: this.getSettingValue(['company_tax_id', 'company.tax_id'], 'company-tax-id', ''),
      bankName: this.getSettingValue(['company_bank_name', 'company.bank_name'], 'company-bank-name', 'National Bank'),
      accountName: this.getSettingValue(['company_account_name', 'company.account_name'], 'company-account-name', name),
      accountNumber: this.getSettingValue(['company_account_number', 'company.account_number'], 'company-account-number', '1005706617'),
      bankBranch: this.getSettingValue(['company_bank_branch', 'company.bank_branch'], 'company-bank-branch', 'Chichiri'),
      uploadedLogo: safeLogo(this.getSettingValue(['company_logo', 'company.logo'], 'company-logo-data', '')),
      previewLogo: new URL('../../resources/logo.png', window.location.href).href,
      invoiceFooter: this.getSettingValue(['documents_invoice_footer', 'documents.invoice_footer'], 'doc-invoice-footer', 'Thank you for your business.'),
      quoteFooter: this.getSettingValue(['documents_quote_footer', 'documents.quote_footer'], 'doc-quote-footer', 'This quotation is valid for 30 days.')
    };
  },

  formatBillingAddress(address) {
    const rawAddress = String(address || '').trim();
    if (!rawAddress) return '';

    const parts = rawAddress
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);

    if (!parts.length) {
      return this.escapeHtml(rawAddress);
    }

    const lines = parts.length > 3
      ? [parts[0], parts[1], parts.slice(2).join(', ')]
      : parts;

    return lines
      .slice(0, 3)
      .map(line => this.escapeHtml(line))
      .join('<br>');
  },

  renderDocumentPrintSheet(doc) {
    const company = this.getCompanyDetails();
    const title = doc.type === 'quotation' ? 'QUOTATION' : 'INVOICE';
    const numberLabel = doc.type === 'quotation' ? 'Quotation #' : 'Invoice #';
    const dateLabel = doc.type === 'quotation' ? 'Quotation date' : 'Invoice date';
    const dueLabel = doc.type === 'quotation' ? 'Valid until' : 'Due date';
    const logoSource = company.uploadedLogo || company.previewLogo;
    const logoMarkup = `<img class="documents-company-logo" src="${logoSource}" alt="${this.escapeHtml(company.name)} logo">`;
    const hasDiscount = (Number(doc.discount) || 0) > 0;
    const paid = doc.type === 'invoice' ? this.getPaidAmount(doc) : 0;
    const balance = Math.max((Number(doc.total) || 0) - paid, 0);
    const documentFooter = doc.type === 'quotation' ? company.quoteFooter : company.invoiceFooter;
    const isApproved = String(doc.approvalStatus || '').toLowerCase() === 'approved';

    return `
      <article class="documents-print-sheet documents-elegant-sheet">
        <header class="documents-elegant-header">
          <div class="documents-elegant-brand">
            ${logoMarkup}
            <div>
              <h2>${this.escapeHtml(company.name)}</h2>
              ${company.description ? `<p>${this.escapeHtml(company.description)}</p>` : ''}
            </div>
          </div>
          <div class="documents-elegant-title">
            <h1>${title}</h1>
            <dl>
              <div><dt>${numberLabel}:</dt><dd>${this.escapeHtml(doc.number)}</dd></div>
              <div><dt>${dateLabel}:</dt><dd>${this.escapeHtml(this.formatDate(doc.date))}</dd></div>
              <div><dt>${dueLabel}:</dt><dd>${this.escapeHtml(this.formatDate(doc.dueDate))}</dd></div>
              <div><dt>Status:</dt><dd>${this.escapeHtml(this.formatStatusLabel(this.getDisplayStatus(doc)))}</dd></div>
            </dl>
          </div>
        </header>

        <section class="documents-elegant-parties">
          <div class="documents-elegant-company-contact">
            ${company.addressLines.length ? `<p><strong>Address:</strong> ${company.addressLines.map(line => this.escapeHtml(line)).join(', ')}</p>` : ''}
            ${company.phone ? `<p><strong>Phone:</strong> ${this.escapeHtml(company.phone)}</p>` : ''}
            ${company.email ? `<p><strong>Email:</strong> ${this.escapeHtml(company.email)}</p>` : ''}
            ${company.website ? `<p><strong>Website:</strong> ${this.escapeHtml(company.website)}</p>` : ''}
            ${company.taxId ? `<p><strong>TPIN:</strong> ${this.escapeHtml(company.taxId)}</p>` : ''}
          </div>
          <div class="documents-elegant-billto${doc.type === 'quotation' ? ' documents-elegant-billto-vertical' : ''}">
            <h3>Bill to:</h3>
            <dl>
              <div><dt>Customer:</dt><dd>${this.escapeHtml(doc.customer)}</dd></div>
              ${doc.customerAddress ? `<div><dt>Address:</dt><dd class="documents-billing-address">${this.formatBillingAddress(doc.customerAddress)}</dd></div>` : ''}
              ${doc.customerPhone ? `<div><dt>Phone:</dt><dd>${this.escapeHtml(doc.customerPhone)}</dd></div>` : ''}
              ${doc.customerEmail ? `<div><dt>Email:</dt><dd>${this.escapeHtml(doc.customerEmail)}</dd></div>` : ''}
            </dl>
          </div>
        </section>

        <section class="documents-itemized documents-elegant-items">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Description</th>
                <th>Unit Price (K)</th>
                <th>Qty</th>
                <th>Discount %</th>
                <th>Amount (K)</th>
              </tr>
            </thead>
            <tbody>${this.renderDetailItems(doc.items)}</tbody>
          </table>
        </section>

        <section class="documents-elegant-summary-area">
          <div class="documents-payment-and-notes">
            <div class="documents-summary-left-text">Note: All amounts are in Malawi Kwacha (K).</div>
            ${doc.type === 'invoice' ? `
              <div class="documents-bank-details">
                <h4>PAY CASH/CHEQUE TO</h4>
                <dl>
                  <div><dt>Bank Name</dt><dd>: ${this.escapeHtml(company.bankName)}</dd></div>
                  <div><dt>Acc. Name</dt><dd>: ${this.escapeHtml(company.accountName)}</dd></div>
                  <div><dt>Acc. No.</dt><dd>: ${this.escapeHtml(company.accountNumber)}</dd></div>
                  <div><dt>Branch</dt><dd>: ${this.escapeHtml(company.bankBranch)}</dd></div>
                </dl>
              </div>
            ` : ''}
            ${doc.notes ? `<div class="documents-elegant-notes"><h4>Notes / Terms</h4><p>${this.escapeHtml(doc.notes)}</p></div>` : ''}
          </div>
          <div>
            <div class="documents-total-summary documents-elegant-totals">
              <div><span>SUB-TOTAL</span><strong>${this.formatDocumentAmount(doc.subtotal)}</strong></div>
              ${hasDiscount ? `<div><span>DISCOUNT @ ${this.formatPercent(doc.discountPercent || 0)}</span><strong>-${this.formatDocumentAmount(doc.discount)}</strong></div>` : ''}
              <div><span>VAT 17.5%</span><strong>${this.formatDocumentAmount(doc.tax)}</strong></div>
              <div class="total"><span>GRAND TOTAL (K)</span><strong>${this.formatDocumentAmount(doc.total)}</strong></div>
            </div>
            ${doc.type === 'invoice' && paid > 0 ? `
              <div class="documents-payment-balance">
                <div><span>Amount Paid</span><strong>${this.formatDocumentAmount(paid)}</strong></div>
                <div><span>Balance Due</span><strong>${this.formatDocumentAmount(balance)}</strong></div>
              </div>
            ` : ''}
          </div>
        </section>

        <section class="documents-approval-row" aria-label="${title} approval">
            <div class="documents-approval-field">
              <span class="documents-approval-label">APPROVED BY:</span>
              <span class="documents-approval-line">
                <span class="documents-approval-name">${isApproved ? this.escapeHtml(doc.approvedName || '') : ''}</span>
              </span>
            </div>
            <div class="documents-approval-field documents-signature-field">
              <span class="documents-approval-label">SIGNATURE:</span>
              <span class="documents-approval-line documents-signature-line">
                ${isApproved && doc.approvedSignature ? `<img src="${doc.approvedSignature}" alt="Approver signature" class="documents-manager-signature">` : ''}
              </span>
            </div>
          </section>

        <footer class="documents-elegant-thankyou">${this.escapeHtml(documentFooter || 'Thank you for your business')}</footer>
      </article>
    `;
  },

  getDocumentHeading(doc) {
    return doc.type === 'quotation' ? 'Price Quotation' : 'TAX Invoice';
  },

  setDocumentPrintSource(source) {
    document.body.classList.remove('documents-print-preview', 'documents-print-detail');
    document.body.classList.add(source === 'detail' ? 'documents-print-detail' : 'documents-print-preview');
  },

  clearDocumentPrintSource() {
    document.body.classList.remove('documents-print-preview', 'documents-print-detail');
  },

  async waitForDocumentImages(selector) {
    const images = [...document.querySelectorAll(`${selector} img`)];
    await Promise.all(images.map(image => {
      if (image.complete) return Promise.resolve();
      return new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
  },

  getPrintableDocumentHtml(source = 'preview') {
    const selector = source === 'detail'
      ? '#document-detail-body .documents-elegant-sheet'
      : '#document-preview-output .documents-elegant-sheet';
    const sheet = document.querySelector(selector);
    if (!sheet) throw new Error('The A4 document preview is not ready. Reopen Preview and try again.');

    const clone = sheet.cloneNode(true);
    clone.removeAttribute('style');
    clone.querySelectorAll('[contenteditable], [data-preview-control]').forEach(element => {
      element.removeAttribute('contenteditable');
      element.removeAttribute('data-preview-control');
    });
    return clone.outerHTML;
  },

  printPreviewDocument() {
    if (this.documentStep !== 'preview') return;
    this.refreshFormPreview(true);
    this.setDocumentPrintSource('preview');
    const cleanup = () => this.clearDocumentPrintSource();
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 2000);
  },

  async downloadPreviewPdf() {
    if (this.documentStep !== 'preview') return;
    this.refreshFormPreview(true);

    const documentNumber = this.editingDocument?.number
      || `${this.documentType === 'quotation' ? 'Quotation' : 'Invoice'}-Draft`;

    if (!window.electronAPI?.exportDocumentPdf) {
      this.showNotification('PDF download is available in the Electron desktop application', 'warning');
      window.print();
      return;
    }

    this.setDocumentPrintSource('preview');
    try {
      await this.waitForDocumentImages('#document-preview-output');
      const result = await window.electronAPI.exportDocumentPdf({
        documentNumber,
        documentType: this.documentType,
        source: 'preview',
        html: this.getPrintableDocumentHtml('preview')
      });
      if (result?.canceled) return;
      if (!result?.success) throw new Error(result?.error || 'Failed to create PDF');
      this.showNotification('A4 PDF downloaded successfully', 'success');
    } catch (error) {
      console.error('Failed to download preview PDF:', error);
      this.showNotification(error.message || 'Failed to download PDF', 'error');
    } finally {
      this.clearDocumentPrintSource();
    }
  }
  });
  return QuotationsInvoicesView;
})();
