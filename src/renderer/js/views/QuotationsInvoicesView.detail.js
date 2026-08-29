/**
 * attachQuotationsInvoicesDetailMethods
 * Extracted detail and utility methods for QuotationsInvoicesView.
 */

(function () {
  if (typeof window === 'undefined' || !window.QuotationsInvoicesView) return;
  const QuotationsInvoicesView = window.QuotationsInvoicesView;
  Object.assign(QuotationsInvoicesView.prototype, {
  openDraftForEditing(doc) {
    if (!doc || this.normalizeStatus(doc.status) !== 'draft' || !['draft', 'rejected'].includes(doc.approvalStatus)) {
      this.showNotification('Only drafts that are not pending approval can be edited', 'warning');
      return;
    }

    this.closeDetailModal();
    this.openCreateModal(doc.type, doc);
  },

  openDetailModal(doc) {
    const body = document.getElementById('document-detail-body');
    const modal = document.getElementById('document-detail-modal');
    if (!body || !modal) return;

    this.detailDocument = doc;
    body.innerHTML = this.renderDocumentPrintSheet(doc);
    body.scrollTop = 0;

    const title = document.getElementById('document-detail-title');
    const subtitle = document.getElementById('document-detail-subtitle');
    const editButton = document.getElementById('document-detail-edit-draft');
    const approveButton = document.getElementById('document-detail-approve');
    const paymentButton = document.getElementById('document-detail-payment');
    const voidButton = document.getElementById('document-detail-void');
    if (title) title.textContent = `${doc.type === 'quotation' ? 'Quotation' : 'Invoice'} Preview`;
    if (subtitle) subtitle.textContent = `${doc.number} - ${this.formatStatusLabel(this.getDisplayStatus(doc))}`;
    if (editButton) editButton.hidden = !this.canEditDocumentDraft(doc);
    if (approveButton) approveButton.hidden = !this.canApproveDocument(doc);
    if (paymentButton) paymentButton.hidden = !this.canRecordInvoicePayment(doc);
    if (voidButton) voidButton.hidden = !this.canVoidIssuedInvoice(doc);
    this.closeInlineApprovalPanel();
    this.closePaymentPanel();

    modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
  },

  renderDetailItems(items = []) {
    if (!items.length) {
      return '<tr><td colspan="7" class="documents-empty">No product lines recorded.</td></tr>';
    }

    return items.map((item, index) => `
      <tr>
        <td class="documents-item-number">${index + 1}</td>
        <td class="documents-item-product">
          <strong>${this.escapeHtml(item.productName)}</strong>
        </td>
        <td class="documents-item-description">${this.escapeHtml(item.description || '')}</td>
        <td>${this.formatDocumentAmount(item.unitPrice)}</td>
        <td>${this.escapeHtml(item.quantity)}</td>
        <td>${this.formatPercent(item.discountPercent || 0)}</td>
        <td>${this.formatDocumentAmount(item.totalPrice)}</td>
      </tr>
    `).join('');
  },

  renderAuditTrail(logs = []) {
    if (!logs.length) {
      return `
        <div class="documents-history-panel">
          <h4>Audit Trail</h4>
          <p>No audit entries recorded yet.</p>
        </div>
      `;
    }

    return `
      <div class="documents-history-panel">
        <h4>Audit Trail</h4>
        <div class="documents-history-list">
          ${logs.slice(0, 8).map(log => `
            <div class="documents-history-row">
              <span>${this.formatDate(log.createdAt)}</span>
              <strong>${this.escapeHtml(this.formatAuditAction(log.action))}</strong>
              <em>${this.escapeHtml(log.summary || '')}</em>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  closeDetailModal() {
    this.closeInlineApprovalPanel();
    this.closePaymentPanel();
    const modal = document.getElementById('document-detail-modal');
    if (modal) modal.style.display = 'none';
    this.detailDocument = null;
  },

  findDocument(type, id) {
    const source = type === 'quotation' ? this.quotations : this.invoices;
    return source.find(doc => String(doc.id) === String(id));
  },

  isWithinDateRange(dateValue) {
    if (!this.startDate && !this.endDate) return true;
    if (!dateValue) return false;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    if (this.startDate) {
      const start = new Date(this.startDate);
      start.setHours(0, 0, 0, 0);
      if (date < start) return false;
    }
    if (this.endDate) {
      const end = new Date(this.endDate);
      end.setHours(23, 59, 59, 999);
      if (date > end) return false;
    }
    return true;
  },

  mapDocumentItems(items = []) {
    return items.map(item => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unit_price || item.unitPrice || item.price) || 0;
      const discountPercent = this.normalizeDiscountPercent(item.discount_percent || item.discountPercent || 0);
      const totalPrice = parseFloat(item.total_price || item.totalPrice) || (quantity * unitPrice * (1 - discountPercent / 100));

      return {
        productId: item.product_id || item.productId || item.id,
        productName: item.product_name || item.name || item.sku || 'Item',
        description: item.product_description || item.description || '',
        sku: item.sku || '',
        quantity,
        unitPrice,
        discountPercent,
        totalPrice
      };
    });
  },

  mapPayments(payments = []) {
    return payments.map(payment => ({
      id: payment.id,
      amount: parseFloat(payment.amount) || 0,
      method: payment.payment_method || payment.method || 'cash',
      reference: payment.reference || '',
      notes: payment.notes || '',
      createdAt: payment.created_at || payment.createdAt
    }));
  },

  mapAuditLogs(logs = []) {
    return logs.map(log => {
      const parsed = this.safeParseJson(log.new_values || log.newValues);
      return {
        id: log.id,
        action: log.action || '',
        createdAt: log.created_at || log.createdAt,
        summary: this.summarizeAudit(log.action, parsed)
      };
    });
  },

  summarizeAudit(action, values) {
    if (!values) return '';
    if (action === 'payment') return values.paymentAmount ? `${this.formatCurrency(values.paymentAmount)} paid` : '';
    if (action === 'void') return values.reason || 'Invoice voided';
    if (action === 'convert') return values.invoiceNumber ? `Converted to ${values.invoiceNumber}` : 'Converted';
    if (action === 'clear') return `${values.clearedCount || 0} records cleared`;
    if (values.status) return `Status: ${values.status}`;
    if (values.totalAmount !== undefined) return `Total: ${this.formatCurrency(values.totalAmount)}`;
    return '';
  },

  formatAuditAction(action) {
    const labels = {
      create: 'Created',
      create_draft: 'Draft Created',
      send: 'Sent',
      submit_for_approval: 'Submitted for Approval',
      approve_finalize: 'Approved & Finalized',
      update: 'Updated',
      delete: 'Deleted',
      clear: 'Cleared',
      convert: 'Converted',
      payment: 'Payment',
      void: 'Voided'
    };
    return labels[action] || action;
  },

  safeParseJson(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  },

  formatItemSummary(items = []) {
    if (!items.length) return '0 items';
    const summary = items.slice(0, 2).map(item => `${item.productName} x${item.quantity}`).join(', ');
    return items.length > 2 ? `${summary} +${items.length - 2} more` : summary;
  },

  getProductPrice(product) {
    return parseFloat(product.unit_price || product.selling_price || product.price || product.cost_price) || 0;
  },

  getProductMeta(product) {
    const sku = product.sku || 'No SKU';
    const unit = product.unit || 'unit';
    const available = this.getProductAvailableStock(product);
    return `${sku} | ${available} ${unit} available`;
  },

  getProductAvailableStock(product) {
    const onHand = parseFloat(product.quantity_on_hand ?? product.quantityOnHand ?? product.stock ?? 0) || 0;
    const reserved = parseFloat(product.quantity_reserved ?? product.quantityReserved ?? 0) || 0;
    const explicit = product.quantity_available ?? product.available_stock ?? product.availableStock;
    if (explicit !== undefined && explicit !== null) {
      return parseFloat(explicit) || 0;
    }
    return Math.max(onHand - reserved, 0);
  },

  getCustomerName(customer) {
    return customer.name || customer.full_name || customer.customer_name || 'Walk-in Customer';
  },

  getCustomerMeta(customer) {
    return [customer.phone, customer.email, customer.customer_code || customer.id]
      .filter(Boolean)
      .join(' | ') || 'Customer profile';
  },

  getPaidAmount(invoice) {
    const status = this.normalizeStatus(invoice.status);
    if (status === 'paid') return invoice.total || 0;
    return parseFloat(invoice.paid) || 0;
  },

  normalizeStatus(status) {
    const value = String(status || '').toLowerCase();
    const aliases = {
      completed: 'paid',
      pending: 'issued'
    };
    return aliases[value] || value || 'draft';
  },

  formatStatusLabel(status) {
    const labels = {
      paid: 'Paid',
      issued: 'Issued',
      unpaid: 'Unpaid',
      partial: 'Partial',
      overdue: 'Overdue',
      voided: 'Voided',
      draft: 'Draft',
      pending_approval: 'Pending Approval',
      rejected: 'Returned for Correction',
      sent: 'Sent',
      accepted: 'Accepted',
      declined: 'Declined',
      expired: 'Expired',
      converted: 'Converted to Invoice'
    };
    return labels[status] || status;
  },

  getDefaultDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  },

  formatDateInput(dateValue) {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  },

  setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  },

  setInputValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value || '';
  },

  formatCurrency(amount) {
    return window.AppFormatters?.formatCurrency
      ? window.AppFormatters.formatCurrency(amount)
      : Number(amount || 0).toFixed(2);
  },

  formatDocumentAmount(amount) {
    return this.formatCurrency(amount)
      .replace(/^\s*-?\s*K\s*/i, match => match.includes('-') ? '-' : '')
      .trim();
  },

  formatDate(dateValue) {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return window.AppFormatters?.formatDate(date) || date.toLocaleDateString();
  },

  async copyText(value) {
    try {
      await navigator.clipboard?.writeText?.(value);
    } catch (error) {
      console.warn('Clipboard copy failed:', error);
    }
  },

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value === null || value === undefined ? '' : String(value);
    return div.innerHTML;
  },

  formatApprovalRuntimeError(error, fallback = 'Failed to approve document') {
    const message = error?.message || String(error || '');
    if (/No handler registered for '(submit-document-for-approval|approve-document-with-credentials|update-invoice|update-quotation)'/i.test(message)) {
      return 'Restart the desktop app to finish enabling manager approval, then try again.';
    }
    return message || fallback;
  },

  showNotification(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      window.AppDialogs?.alert(message, {
        title: type === 'error' ? 'Error' : 'Notice',
        variant: type,
        primaryLabel: 'OK'
      });
    }
  }
  });
  return QuotationsInvoicesView;
})();
