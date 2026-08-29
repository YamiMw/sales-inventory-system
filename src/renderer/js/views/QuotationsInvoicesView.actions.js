/**
 * attachQuotationsInvoicesActionMethods
 * Extracted prototype methods for QuotationsInvoicesView.
 */

(function () {
  if (typeof window === 'undefined' || !window.QuotationsInvoicesView) return;
  const QuotationsInvoicesView = window.QuotationsInvoicesView;
  Object.assign(QuotationsInvoicesView.prototype, {
  handleSecondarySave() {
    const amountPaid = document.getElementById('document-amount-paid');
    const settleStatus = document.getElementById('document-settle-status');
    if (amountPaid) amountPaid.value = '0';
    if (settleStatus) settleStatus.value = 'unpaid';
    this.saveDocument('draft');
  },

  handlePrimarySave() {
    if (this.documentType === 'quotation') {
      if (window.electronAPI?.approveDocumentWithCredentials) {
        this.openCreateApprovalPanel();
        return;
      }
      this.saveDocument('sent');
      return;
    }

    this.updateSettlementAmountPreview();
    if (window.electronAPI?.approveDocumentWithCredentials) {
      this.openCreateApprovalPanel();
      return;
    }

    this.saveDocument('issued');
  },

  updateSettlementAmountPreview() {
    const settleStatus = document.getElementById('document-settle-status')?.value;
    const amountPaid = document.getElementById('document-amount-paid');
    if (!amountPaid) return;

    if (settleStatus === 'paid') {
      amountPaid.value = this.calculateTotals().total.toFixed(2);
    } else if (settleStatus === 'unpaid') {
      amountPaid.value = '0';
    }
  },

  setDueDateFromPaymentTerms() {
    const terms = parseInt(document.getElementById('document-payment-terms')?.value || '0', 10) || 0;
    const dateInput = document.getElementById('document-due-date');
    if (dateInput) dateInput.value = this.getDefaultDate(terms);
  },

  setPaymentTermsFromDate(dateValue) {
    const terms = document.getElementById('document-payment-terms');
    if (!terms || !dateValue) return;

    const due = new Date(dateValue);
    const today = new Date();
    if (Number.isNaN(due.getTime())) return;
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const days = Math.max(0, Math.round((due - today) / 86400000));
    const allowed = ['0', '7', '14', '30'];
    terms.value = allowed.includes(String(days)) ? String(days) : '30';
  },

  async saveDocument(status, options = {}) {
    const validLines = this.getValidDocumentLines();

    if (!validLines.length) {
      this.showNotification('Add at least one product line', 'warning');
      return;
    }

    const totals = this.calculateTotals();
    this.setSavingState(true);

    try {
      const customerId = await this.resolveDocumentCustomerId();
      if (!customerId) {
        this.showNotification(`Add customer details before saving this ${this.documentType}`, 'warning');
        return;
      }

      const dateValue = this.documentType === 'quotation'
        ? document.getElementById('document-quotation-expiry')?.value
        : document.getElementById('document-due-date')?.value;
      const notes = document.getElementById('document-notes')?.value || null;
      const currentUser = this.getCurrentUser();
      const payload = {
        customerId,
        subtotal: totals.subtotal,
        discountPercent: totals.discountPercent,
        discountAmount: totals.discount,
        taxRate: totals.taxRate,
        taxName: totals.taxName,
        taxAmount: totals.tax,
        totalAmount: totals.total,
        notes,
        status,
        items: validLines,
        userId: currentUser?.id || null,
        credentials: {
          token: localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
        }
      };

      if (this.documentType === 'quotation') {
        payload.expiryDate = dateValue || this.getDefaultDate(this.getConfiguredDocumentDays('quotation'));
      } else {
        payload.dueDate = dateValue || this.getDefaultDate(this.getConfiguredDocumentDays('invoice'));
        payload.adjustStock = status !== 'draft';
        payload.amountPaid = parseFloat(document.getElementById('document-amount-paid')?.value) || 0;
        payload.paymentMethod = document.getElementById('document-payment-method')?.value || 'cash';
      }

      let result;
      if (this.editingDocument && this.documentType === 'quotation' && window.electronAPI?.updateQuotation) {
        result = await window.electronAPI.updateQuotation(this.editingDocument.id, payload);
      } else if (
        this.editingDocument
        && this.documentType === 'invoice'
        && this.normalizeStatus(this.editingDocument.status) === 'draft'
        && window.electronAPI?.updateInvoice
      ) {
        result = await window.electronAPI.updateInvoice(this.editingDocument.id, payload);
      } else {
        result = this.documentType === 'quotation'
          ? await window.electronAPI.createQuotation(payload)
          : await window.electronAPI.createInvoice(payload);
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to save document');
      }

      if (!options.silent) {
        const action = status === 'draft'
          ? 'saved as draft'
          : this.documentType === 'quotation'
            ? 'sent'
            : 'saved';
        this.showNotification(`${this.documentType === 'quotation' ? 'Quotation' : 'Invoice'} ${action}`, 'success');
      }

      const saveResult = result;
      if (!options.keepOpen) {
        this.closeCreateModal();
        await this.loadData();
        this.activeTab = this.documentType === 'quotation' ? 'quotations' : 'invoices';
        this.statusFilter = '';
        this.render();
      }
      return saveResult;
    } catch (error) {
      console.error('Failed to save document:', error);
      if (!options.silent) this.showNotification(this.formatApprovalRuntimeError(error, 'Failed to save document'), 'error');
      if (options.throwOnError) throw error;
      return null;
    } finally {
      this.setSavingState(false);
    }
  },

  setSavingState(isSaving) {
    ['document-save-draft-btn', 'document-save-send-btn', 'document-manager-approval-btn', 'document-create-approval-confirm', 'document-detail-approve', 'document-approval-confirm'].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = isSaving;
    });
  },

  syncActiveTab() {
    document.querySelectorAll('#quotations-invoices-view [data-doc-tab]').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.docTab === this.activeTab);
    });
  },

  openCreateApprovalPanel() {
    if (!window.electronAPI?.approveDocumentWithCredentials) {
      this.showNotification('Manager approval is unavailable in this app session', 'warning');
      return;
    }
    if (!this.canApproveCurrentInvoicePreview()) {
      this.showNotification('Manager approval is only available for editable draft documents', 'warning');
      return;
    }
    if (this.documentStep !== 'preview') return;

    const panel = document.getElementById('document-create-approval-panel');
    const errorBox = document.getElementById('document-create-approval-error');
    const username = document.getElementById('document-create-approval-username');
    const password = document.getElementById('document-create-approval-password');
    const note = document.getElementById('document-create-approval-note');
    if (!panel) return;
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }
    if (username) username.value = '';
    if (password) password.value = '';
    if (note) note.value = '';
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => username?.focus(), 50);
    if (window.lucide) window.lucide.createIcons();
  },

  closeCreateApprovalPanel() {
    const panel = document.getElementById('document-create-approval-panel');
    const errorBox = document.getElementById('document-create-approval-error');
    const username = document.getElementById('document-create-approval-username');
    const password = document.getElementById('document-create-approval-password');
    const note = document.getElementById('document-create-approval-note');
    if (panel) panel.hidden = true;
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }
    if (username) username.value = '';
    if (password) password.value = '';
    if (note) note.value = '';
  },

  async approveEditableInvoice() {
    const documentLabel = this.documentType === 'quotation' ? 'quotation' : 'invoice';
    const username = document.getElementById('document-create-approval-username')?.value?.trim() || '';
    const password = document.getElementById('document-create-approval-password')?.value || '';
    const note = document.getElementById('document-create-approval-note')?.value?.trim() || '';
    const errorBox = document.getElementById('document-create-approval-error');
    const showPanelError = (message) => {
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.hidden = false;
      }
      this.showNotification(message, 'warning');
    };

    if (!username || !password) {
      showPanelError(`Enter the manager username and password to approve this ${documentLabel}.`);
      return;
    }

    if (this.documentType === 'invoice') this.updateSettlementAmountPreview();
    this.setSavingState(true);
    try {
      const saved = await this.saveDocument('draft', {
        keepOpen: true,
        silent: true,
        throwOnError: true
      });
      const savedId = saved?.data?.id;
      if (!savedId) throw new Error(`The saved ${documentLabel} ID is missing.`);

      this.setSavingState(true);
      const approvalPayload = {
        username,
        password,
        note
      };
      if (this.documentType === 'invoice') {
        approvalPayload.amountPaid = parseFloat(document.getElementById('document-amount-paid')?.value) || 0;
        approvalPayload.paymentMethod = document.getElementById('document-payment-method')?.value || 'cash';
      }
      const result = await window.electronAPI.approveDocumentWithCredentials(this.documentType, savedId, approvalPayload);
      if (!result?.success) throw new Error(result?.error || `Failed to approve ${documentLabel}`);

      this.showNotification(
        result.data?.stockAdjustmentSkipped
          ? 'Invoice approved. Stock was not deducted because stock is insufficient.'
          : `${documentLabel.charAt(0).toUpperCase()}${documentLabel.slice(1)} approved and finalized`,
        'success'
      );
      this.closeCreateApprovalPanel();
      this.closeCreateModal();
      await this.loadData();
      this.activeTab = this.documentType === 'quotation' ? 'quotations' : 'invoices';
      this.statusFilter = '';
      this.render();
    } catch (error) {
      const message = this.formatApprovalRuntimeError(error, `Failed to approve ${documentLabel}`);
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.hidden = false;
      }
      this.showNotification(message, 'error');
    } finally {
      this.setSavingState(false);
    }
  },

  isIssuedInvoice(doc) {
    if (!doc || doc.type !== 'invoice') return false;
    return ['issued', 'unpaid', 'partial', 'overdue'].includes(this.normalizeStatus(doc.status));
  },

  canEditDocumentDraft(doc) {
    return Boolean(doc && ['draft', 'rejected'].includes(doc.approvalStatus) && this.normalizeStatus(doc.status) === 'draft');
  },

  canApproveCurrentInvoicePreview() {
    const approvalStatus = String(this.editingDocument?.approvalStatus || 'draft').toLowerCase();
    return Boolean(
      ['invoice', 'quotation'].includes(this.documentType)
      && this.documentStep === 'preview'
      && window.electronAPI?.approveDocumentWithCredentials
      && (!this.editingDocument || this.normalizeStatus(this.editingDocument.status) === 'draft')
      && ['draft', 'rejected'].includes(approvalStatus)
    );
  },

  canApproveDocument(doc) {
    const approvalStatus = String(doc?.approvalStatus || 'draft').toLowerCase();
    return Boolean(
      ['invoice', 'quotation'].includes(doc?.type)
      && window.electronAPI?.approveDocumentWithCredentials
      && this.normalizeStatus(doc.status) === 'draft'
      && ['draft', 'rejected', 'pending'].includes(approvalStatus)
    );
  },

  canRecordInvoicePayment(doc) {
    if (!doc || doc.type !== 'invoice') return false;
    return ['issued', 'unpaid', 'partial', 'overdue'].includes(this.normalizeStatus(doc.status));
  },

  canVoidIssuedInvoice(doc) {
    if (!doc || doc.type !== 'invoice') return false;
    return ['issued', 'unpaid', 'partial', 'overdue'].includes(this.normalizeStatus(doc.status));
  },

  toggleActionMenu(button, type, id) {
    const wasOpen = button.getAttribute('aria-expanded') === 'true';
    this.closeActionMenu();
    if (wasOpen) return;

    const doc = this.findDocument(type, id);
    if (!doc) return;

    const menu = this.createDocumentActionMenu(doc, type);
    document.body.appendChild(menu);
    this.actionMenu = menu;
    button.setAttribute('aria-expanded', 'true');

    const buttonRect = button.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(12, Math.min(buttonRect.right - menuRect.width, window.innerWidth - menuRect.width - 12))}px`;
    menu.style.top = `${Math.min(buttonRect.bottom + 8, window.innerHeight - menuRect.height - 12)}px`;

    menu.querySelectorAll('[data-menu-action]').forEach(item => {
      item.onclick = (event) => {
        event.stopPropagation();
        this.handleDocumentAction(item.dataset.menuAction, type, id);
      };
    });
  },

  createDocumentActionMenu(doc, type) {
    const isQuotation = type === 'quotation';
    const make = window.TemplateRenderer?.make || ((tag) => document.createElement(tag));
    const menu = make('div', { className: 'documents-action-menu' });
    const addButton = (action, label, iconSrc, className = '') => {
      const btn = make('button', { className, attrs: { type: 'button' }, dataset: { menuAction: action } });
      if (iconSrc && window.TemplateRenderer?.icon) btn.appendChild(window.TemplateRenderer.icon(iconSrc, 'custom-ui-icon'));
      btn.appendChild(document.createTextNode(` ${label}`));
      menu.appendChild(btn);
    };
    addButton('view', 'View Details', 'assets/images/icons/custom/eye_icon.svg');
    addButton('print', 'Print', 'assets/images/icons/custom/printer_icon.svg');
    addButton('pdf', 'Export PDF', 'assets/images/icons/custom/download_icon.svg');
    addButton('copy', 'Copy Code', 'assets/images/icons/custom/copy_icon.svg');
    if (this.canRecordInvoicePayment(doc)) addButton('payment', 'Record Payment', 'assets/images/icons/custom/credit_card_icon.svg');
    if (isQuotation && doc.status !== 'converted') addButton('convert', 'Convert to Invoice', 'assets/images/icons/custom/file_check_icon.svg');
    if (this.canEditDocumentDraft(doc)) addButton('edit', 'Edit Draft', 'assets/images/icons/custom/edit_icon.svg');
    if (isQuotation) addButton('delete', 'Delete Quote', 'assets/images/icons/custom/trash_icon.svg', 'danger');
    if (this.canVoidIssuedInvoice(doc)) addButton('void', 'Void Invoice', 'assets/images/icons/custom/ban_icon.svg', 'danger');
    return menu;
  },

  closeActionMenu() {
    document.querySelectorAll('#documents-tbody [data-doc-action="menu"]').forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
    });
    if (this.actionMenu) {
      this.actionMenu.remove();
      this.actionMenu = null;
    }
  },

  async handleDocumentAction(action, type, id) {
    this.closeActionMenu();
    const doc = this.findDocument(type, id);
    if (!doc) return;

    if (action === 'view') {
      this.openDetailModal(doc);
      return;
    }

    if (action === 'print') {
      this.openDetailModal(doc);
      setTimeout(() => {
        this.setDocumentPrintSource('detail');
        const cleanup = () => this.clearDocumentPrintSource();
        window.addEventListener('afterprint', cleanup, { once: true });
        window.print();
        window.setTimeout(cleanup, 2000);
      }, 150);
      return;
    }

    if (action === 'pdf') {
      this.openDetailModal(doc);
      setTimeout(() => this.exportDocumentPdf(doc), 200);
      return;
    }

    if (action === 'copy') {
      await this.copyText(doc.number);
      this.showNotification('Document code copied', 'success');
      return;
    }

    if (action === 'convert') {
      await this.convertQuotationToInvoice(doc);
      return;
    }

    if (action === 'payment') {
      await this.recordPayment(doc);
      return;
    }

    if (action === 'edit') {
      if (this.normalizeStatus(doc.status) === 'draft' && ['draft', 'rejected'].includes(doc.approvalStatus)) {
        this.openDraftForEditing(doc);
        return;
      }
      this.showNotification('Only editable drafts can be changed; pending or approved documents are locked', 'warning');
      return;
    }

    if (action === 'delete') {
      await this.deleteQuotation(doc);
      return;
    }

    if (action === 'void') {
      await this.voidInvoice(doc);
    }
  },

  openInlineApprovalPanel(doc) {
    if (!this.canApproveDocument(doc)) {
      this.showNotification('Manager approval is only available for editable draft documents', 'warning');
      return;
    }
    const panel = document.getElementById('document-detail-approval-panel');
    const errorBox = document.getElementById('document-approval-error');
    const username = document.getElementById('document-approval-username');
    const password = document.getElementById('document-approval-password');
    const note = document.getElementById('document-approval-note');
    if (!panel) return;
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }
    if (username) username.value = '';
    if (password) password.value = '';
    if (note) note.value = '';
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => username?.focus(), 50);
    if (window.lucide) window.lucide.createIcons();
  },

  closeInlineApprovalPanel() {
    const panel = document.getElementById('document-detail-approval-panel');
    const errorBox = document.getElementById('document-approval-error');
    const username = document.getElementById('document-approval-username');
    const password = document.getElementById('document-approval-password');
    const note = document.getElementById('document-approval-note');
    if (panel) panel.hidden = true;
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }
    if (username) username.value = '';
    if (password) password.value = '';
    if (note) note.value = '';
  },

  async approveAndFinalizeDocument(doc) {
    if (!this.canApproveDocument(doc)) {
      this.showNotification('Manager approval is only available for editable draft documents', 'warning');
      return;
    }

    const documentLabel = doc.type === 'quotation' ? 'quotation' : 'invoice';
    const username = document.getElementById('document-approval-username')?.value?.trim() || '';
    const password = document.getElementById('document-approval-password')?.value || '';
    const note = document.getElementById('document-approval-note')?.value?.trim() || '';
    const errorBox = document.getElementById('document-approval-error');

    if (!username || !password) {
      const message = `Enter the manager username and password to approve this ${documentLabel}.`;
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.hidden = false;
      }
      this.showNotification(message, 'warning');
      return;
    }

    this.setSavingState(true);
    try {
      const result = await window.electronAPI?.approveDocumentWithCredentials?.(doc.type, doc.id, {
        username,
        password,
        note
      });
      if (!result?.success) throw new Error(result?.error || `Failed to approve ${documentLabel}`);
      this.showNotification(
        result.data?.stockAdjustmentSkipped
          ? 'Invoice approved. Stock was not deducted because stock is insufficient.'
          : `${documentLabel.charAt(0).toUpperCase()}${documentLabel.slice(1)} approved and finalized`,
        'success'
      );
      this.closeInlineApprovalPanel();
      this.closeDetailModal();
      await this.loadData();
      this.render();
    } catch (error) {
      const message = this.formatApprovalRuntimeError(error, `Failed to approve ${documentLabel}`);
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.hidden = false;
      }
      this.showNotification(message, 'error');
    } finally {
      this.setSavingState(false);
    }
  },

  async convertQuotationToInvoice(quotation) {
    if (!quotation.items?.length) {
      this.showNotification('Quotation has no item lines to convert', 'warning');
      return;
    }

    try {
      const hasApprovalWorkflow = Boolean(window.electronAPI?.approveDocumentWithCredentials);
      const result = await window.electronAPI.createInvoice({
        quotationId: quotation.id,
        customerId: quotation.customerId,
        dueDate: this.getDefaultDate(30),
        subtotal: quotation.subtotal,
        discountPercent: quotation.discountPercent || 0,
        discountAmount: quotation.discount,
        taxRate: quotation.taxRate || this.getConfiguredTaxSettings().rate,
        taxName: quotation.taxName || this.getConfiguredTaxSettings().name,
        taxAmount: quotation.tax,
        totalAmount: quotation.total,
        notes: `Converted from quotation ${quotation.number}`,
        status: hasApprovalWorkflow ? 'draft' : 'issued',
        adjustStock: !hasApprovalWorkflow,
        credentials: {
          token: localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
        },
        items: quotation.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: this.normalizeDiscountPercent(item.discountPercent || 0)
        }))
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to convert quotation');
      }

      this.showNotification(
        hasApprovalWorkflow
          ? 'Quotation converted to an invoice draft. Use Manager Approval to finalize it'
          : 'Quotation converted to invoice',
        'success'
      );
      await this.loadData();
      this.activeTab = 'invoices';
      this.statusFilter = '';
      this.closeDetailModal();
      this.render();
    } catch (error) {
      console.error('Failed to convert quotation:', error);
      this.showNotification(error.message || 'Failed to convert quotation', 'error');
    }
  },

  async recordPayment(invoice) {
    const balanceDue = Math.max((invoice.total || 0) - this.getPaidAmount(invoice), 0);
    if (balanceDue <= 0) {
      this.showNotification('Invoice is already fully paid', 'info');
      return;
    }

    const modal = document.getElementById('document-detail-modal');
    if (!modal || modal.style.display !== 'flex' || this.detailDocument?.id !== invoice.id) {
      this.openDetailModal(invoice);
    }
    this.openPaymentPanel(invoice);
  },

  openPaymentPanel(invoice) {
    const panel = document.getElementById('document-detail-payment-panel');
    const errorBox = document.getElementById('document-payment-error');
    const summary = document.getElementById('document-payment-panel-summary');
    const amountInput = document.getElementById('document-payment-amount');
    const methodInput = document.getElementById('document-payment-method-entry');
    const referenceInput = document.getElementById('document-payment-reference');
    const notesInput = document.getElementById('document-payment-notes');
    if (!panel || !invoice) return;

    const balanceDue = Math.max((invoice.total || 0) - this.getPaidAmount(invoice), 0);
    if (summary) {
      summary.textContent = `${invoice.number} balance due: ${this.formatCurrency(balanceDue)}`;
    }
    if (amountInput) {
      amountInput.value = balanceDue.toFixed(2);
      amountInput.max = balanceDue.toFixed(2);
    }
    if (methodInput) methodInput.value = 'cash';
    if (referenceInput) referenceInput.value = '';
    if (notesInput) notesInput.value = '';
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.hidden = true;
    }

    this.closeInlineApprovalPanel();
    panel.hidden = false;
    amountInput?.focus();
    if (window.lucide) window.lucide.createIcons();
  },

  closePaymentPanel() {
    const panel = document.getElementById('document-detail-payment-panel');
    const errorBox = document.getElementById('document-payment-error');
    if (panel) panel.hidden = true;
    if (errorBox) {
      errorBox.textContent = '';
      errorBox.hidden = true;
    }
  },

  async submitPayment() {
    const invoice = this.detailDocument;
    if (!invoice) return;

    const amountInput = document.getElementById('document-payment-amount');
    const methodInput = document.getElementById('document-payment-method-entry');
    const referenceInput = document.getElementById('document-payment-reference');
    const notesInput = document.getElementById('document-payment-notes');
    const errorBox = document.getElementById('document-payment-error');
    const confirmButton = document.getElementById('document-payment-confirm');
    const showPaymentError = (message) => {
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.hidden = false;
      }
      this.showNotification(message, 'warning');
    };

    const balanceDue = Math.max((invoice.total || 0) - this.getPaidAmount(invoice), 0);
    const amount = parseFloat(amountInput?.value || '0');
    if (!Number.isFinite(amount) || amount <= 0) {
      showPaymentError('Enter a valid payment amount');
      return;
    }
    if (amount > balanceDue) {
      showPaymentError(`Payment exceeds balance due of ${this.formatCurrency(balanceDue)}`);
      return;
    }

    try {
      if (confirmButton) confirmButton.disabled = true;
      const result = await window.electronAPI?.recordInvoicePayment?.({
        invoiceId: invoice.id,
        amount,
        method: methodInput?.value || 'cash',
        reference: referenceInput?.value?.trim() || null,
        notes: notesInput?.value?.trim() || null
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to record payment');
      }

      this.showNotification('Payment recorded', 'success');
      this.closePaymentPanel();
      await this.loadData();
      const updated = this.findDocument('invoice', invoice.id);
      if (updated) this.openDetailModal(updated);
      this.render();
    } catch (error) {
      console.error('Failed to record payment:', error);
      const message = error.message || 'Failed to record payment';
      if (errorBox) {
        errorBox.textContent = message;
        errorBox.hidden = false;
      }
      this.showNotification(message, 'error');
    } finally {
      if (confirmButton) confirmButton.disabled = false;
    }
  },

  async exportDocumentPdf(doc) {
    this.setDocumentPrintSource('detail');
    try {
      await this.waitForDocumentImages('#document-detail-body');
      const result = await window.electronAPI?.exportDocumentPdf?.({
        documentNumber: doc.number,
        documentType: doc.type,
        source: 'detail',
        html: this.getPrintableDocumentHtml('detail')
      });
      if (result?.canceled) return;
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to export PDF');
      }
      this.showNotification('A4 PDF downloaded successfully', 'success');
    } catch (error) {
      console.error('Failed to export PDF:', error);
      this.showNotification(error.message || 'Failed to export PDF', 'error');
    } finally {
      this.clearDocumentPrintSource();
    }
  },

  async deleteQuotation(quotation) {
    const confirmed = await window.AppDialogs?.confirm(
      `Delete quotation ${quotation.number}? This cannot be undone.`,
      {
        title: 'Delete Quotation',
        eyebrow: 'Documents',
        primaryLabel: 'Delete Quotation',
        variant: 'danger'
      }
    );
    if (!confirmed) return;
    const reason = await window.AppDialogs?.prompt('Enter the reason for deleting this quotation:', {
      title: 'Deletion Reason',
      eyebrow: 'Audit Required',
      inputLabel: 'Reason',
      multiline: true,
      required: true,
      primaryLabel: 'Continue'
    });
    if (!reason?.trim()) return;

    try {
      const result = await window.electronAPI?.deleteQuotation?.(
        quotation.id,
        this.destructiveCredentials(reason)
      );
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to delete quotation');
      }

      this.showNotification('Quotation deleted', 'success');
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Failed to delete quotation:', error);
      this.showNotification(error.message || 'Failed to delete quotation', 'error');
    }
  },

  async voidInvoice(invoice) {
    const confirmed = await window.AppDialogs?.confirm(`Void invoice ${invoice.number}?`, {
      title: 'Void Invoice',
      eyebrow: 'Documents',
      primaryLabel: 'Void Invoice',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      const result = await window.electronAPI?.voidInvoice?.(invoice.id, 'Voided from Quotations & Invoices view');
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to void invoice');
      }

      this.showNotification('Invoice voided', 'success');
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Failed to void invoice:', error);
      this.showNotification(error.message || 'Failed to void invoice', 'error');
    }
  },

  async clearCurrentHistory() {
    const isInvoices = this.activeTab === 'invoices';
    const count = isInvoices ? this.invoices.length : this.quotations.length;
    if (!count) {
      this.showNotification(`No ${isInvoices ? 'invoices' : 'quotations'} to clear`, 'info');
      return;
    }

    const confirmed = await window.AppDialogs?.confirm(
      `Delete all ${count} ${isInvoices ? 'invoices' : 'quotations'}? This cannot be undone.`,
      {
        title: `Clear ${isInvoices ? 'Invoice' : 'Quotation'} History`,
        eyebrow: 'Documents',
        primaryLabel: 'Clear History',
        variant: 'danger'
      }
    );
    if (!confirmed) {
      return;
    }
    const reason = await window.AppDialogs?.prompt(
      `Enter the reason for clearing all ${isInvoices ? 'invoice' : 'quotation'} history:`,
      {
        title: 'Clear History Reason',
        eyebrow: 'Audit Required',
        inputLabel: 'Reason',
        multiline: true,
        required: true,
        primaryLabel: 'Continue'
      }
    );
    if (!reason?.trim()) return;

    try {
      const result = isInvoices
        ? await window.electronAPI?.clearInvoices?.(this.destructiveCredentials(reason))
        : await window.electronAPI?.clearQuotations?.(this.destructiveCredentials(reason));
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to clear history');
      }

      this.showNotification(`${isInvoices ? 'Invoice' : 'Quotation'} history cleared`, 'success');
      await this.loadData();
      this.render();
    } catch (error) {
      console.error('Failed to clear history:', error);
      this.showNotification(error.message || 'Failed to clear history', 'error');
    }
  },

  destructiveCredentials(reason) {
    return {
      token: localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '',
      reason: String(reason || '').trim()
    };
  },

  });
  return QuotationsInvoicesView;
})();
