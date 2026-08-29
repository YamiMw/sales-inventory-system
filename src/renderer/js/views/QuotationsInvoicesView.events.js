/**
 * Quotations and Invoices Events
 * Extracted event bindings for QuotationsInvoicesView.
 */

(function () {
  if (typeof window === 'undefined' || !window.QuotationsInvoicesView) return;
  const QuotationsInvoicesView = window.QuotationsInvoicesView;
  Object.assign(QuotationsInvoicesView.prototype, {
  setupEventListeners() {
    window.addEventListener('settings-updated', (event) => {
      this.settings = { ...this.settings, ...(event.detail || {}) };
      this.refreshFormPreview(true);
      if (this.detailDocument) {
        const body = document.getElementById('document-detail-body');
        if (body) body.innerHTML = this.renderDocumentPrintSheet(this.detailDocument);
      }
    });

    document.querySelectorAll('#quotations-invoices-view [data-doc-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setActiveDocumentView(btn.dataset.docTab);
      });
    });

    document.getElementById('documents-search')?.addEventListener('input', (event) => {
      this.search = event.target.value;
      this.currentPage = 1;
      this.renderTable();
    });

    document.getElementById('documents-status-filter')?.addEventListener('change', (event) => {
      this.statusFilter = event.target.value;
      this.currentPage = 1;
      this.renderTable();
    });

    document.querySelector('#quotations-invoices-view .documents-date-picker')?.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    document.getElementById('documents-date-range-toggle')?.addEventListener('click', () => {
      this.toggleDateRangePopup();
    });

    document.getElementById('documents-date-apply')?.addEventListener('click', () => {
      this.applyDateRange();
    });

    document.getElementById('documents-date-clear')?.addEventListener('click', () => {
      this.clearDateRange();
    });

    document.getElementById('documents-refresh-btn')?.addEventListener('click', async () => {
      await this.loadData();
      this.render();
      this.showNotification('Documents refreshed', 'success');
    });

    document.getElementById('documents-reset-filters')?.addEventListener('click', () => {
      this.resetFilters();
    });

    document.getElementById('documents-per-page')?.addEventListener('change', (event) => {
      this.perPage = parseInt(event.target.value, 10) || 25;
      this.currentPage = 1;
      this.renderTable();
    });

    document.getElementById('quotations-invoices-view')?.addEventListener('click', (event) => {
      const createButton = event.target?.closest?.('#new-document-btn');
      if (!createButton) return;
      event.preventDefault();
      event.stopPropagation();
      this.openCreateForActiveTab();
    });

    document.getElementById('document-modal-close')?.addEventListener('click', () => this.closeCreateModal());
    document.getElementById('document-cancel-btn')?.addEventListener('click', () => this.closeCreateModal());
    document.getElementById('document-back-btn')?.addEventListener('click', () => this.goToPreviousDocumentStep());
    document.getElementById('document-next-btn')?.addEventListener('click', () => this.goToNextDocumentStep());
    document.getElementById('document-preview-print-btn')?.addEventListener('click', () => this.printPreviewDocument());
    document.getElementById('document-preview-pdf-btn')?.addEventListener('click', () => this.downloadPreviewPdf());
    document.getElementById('document-save-draft-btn')?.addEventListener('click', () => this.handleSecondarySave());
    document.getElementById('document-save-send-btn')?.addEventListener('click', () => this.handlePrimarySave());
    document.getElementById('document-manager-approval-btn')?.addEventListener('click', () => this.openCreateApprovalPanel());
    document.getElementById('document-create-approval-panel-close')?.addEventListener('click', () => this.closeCreateApprovalPanel());
    document.getElementById('document-create-approval-cancel')?.addEventListener('click', () => this.closeCreateApprovalPanel());
    document.getElementById('document-create-approval-confirm')?.addEventListener('click', () => this.approveEditableInvoice());
    document.getElementById('document-add-customer-btn')?.addEventListener('click', () => this.openNewCustomerModal());
    document.getElementById('document-add-line')?.addEventListener('click', () => this.addLine());
    document.getElementById('document-discount')?.addEventListener('input', () => this.renderLineTotals());
    document.getElementById('document-tax')?.addEventListener('input', () => this.renderLineTotals());
    document.getElementById('document-tax-rate')?.addEventListener('change', () => this.renderLineTotals());
    document.getElementById('document-payment-terms')?.addEventListener('change', () => {
      this.setDueDateFromPaymentTerms();
      this.refreshFormPreview();
    });
    document.getElementById('document-settle-status')?.addEventListener('change', () => {
      this.updateSettlementAmountPreview();
      this.refreshFormPreview();
    });
    document.getElementById('document-payment-method')?.addEventListener('change', () => this.refreshFormPreview());
    document.getElementById('document-due-date')?.addEventListener('change', () => {
      this.refreshFormPreview();
    });
    document.getElementById('document-notes')?.addEventListener('input', () => this.refreshFormPreview());
    document.getElementById('document-quotation-expiry')?.addEventListener('change', (event) => {
      const dateInput = document.getElementById('document-due-date');
      if (dateInput) dateInput.value = event.target.value;
      this.refreshFormPreview();
    });
    document.getElementById('document-detail-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'document-detail-modal') {
        this.closeDetailModal();
      }
    });
    document.getElementById('document-detail-close')?.addEventListener('click', () => this.closeDetailModal());
    document.getElementById('document-detail-cancel')?.addEventListener('click', () => this.closeDetailModal());
    document.getElementById('document-detail-edit-draft')?.addEventListener('click', () => {
      this.openDraftForEditing(this.detailDocument);
    });
    document.getElementById('document-detail-approve')?.addEventListener('click', () => {
      if (this.detailDocument) this.openInlineApprovalPanel(this.detailDocument);
    });
    document.getElementById('document-detail-payment')?.addEventListener('click', () => {
      if (this.detailDocument) this.recordPayment(this.detailDocument);
    });
    document.getElementById('document-payment-panel-close')?.addEventListener('click', () => this.closePaymentPanel());
    document.getElementById('document-payment-cancel')?.addEventListener('click', () => this.closePaymentPanel());
    document.getElementById('document-payment-confirm')?.addEventListener('click', () => this.submitPayment());
    document.getElementById('document-detail-void')?.addEventListener('click', () => {
      if (this.detailDocument) this.voidInvoice(this.detailDocument);
    });
    document.getElementById('document-approval-panel-close')?.addEventListener('click', () => this.closeInlineApprovalPanel());
    document.getElementById('document-approval-cancel')?.addEventListener('click', () => this.closeInlineApprovalPanel());
    document.getElementById('document-approval-confirm')?.addEventListener('click', () => {
      if (this.detailDocument) this.approveAndFinalizeDocument(this.detailDocument);
    });
    document.getElementById('document-detail-print')?.addEventListener('click', () => {
      if (!this.detailDocument) return;
      this.setDocumentPrintSource('detail');
      const cleanup = () => this.clearDocumentPrintSource();
      window.addEventListener('afterprint', cleanup, { once: true });
      window.print();
      window.setTimeout(cleanup, 2000);
    });
    document.getElementById('document-detail-pdf')?.addEventListener('click', () => {
      if (this.detailDocument) this.exportDocumentPdf(this.detailDocument);
    });

    document.getElementById('document-customer-search')?.addEventListener('input', (event) => {
      this.clearCustomerSelectionIfSearchChanged(event.target.value);
      this.renderCustomerResults(event.target.value);
    });
    document.getElementById('document-customer-search')?.addEventListener('focus', (event) => {
      this.renderCustomerResults(event.target.value);
    });
    document.getElementById('document-customer-results')?.addEventListener('click', (event) => {
      const result = event.target.closest('[data-customer-id]');
      if (result) {
        this.selectCustomer(result.dataset.customerId);
      }
    });

    document.getElementById('document-product-search')?.addEventListener('input', (event) => {
      this.renderProductResults(event.target.value);
    });
    document.getElementById('document-product-search')?.addEventListener('focus', (event) => {
      this.renderProductResults(event.target.value);
    });
    document.getElementById('document-product-results')?.addEventListener('click', (event) => {
      const result = event.target.closest('[data-product-id]');
      if (result) {
        this.addProductLine(result.dataset.productId);
      }
    });

    document.getElementById('document-lines')?.addEventListener('change', (event) => this.handleLineChange(event));
    document.getElementById('document-lines')?.addEventListener('input', (event) => this.handleLineInput(event));
    document.getElementById('document-lines')?.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-line-remove]');
      if (removeButton) {
        this.removeLine(parseInt(removeButton.dataset.lineRemove, 10));
      }
    });

    document.addEventListener('click', (event) => {
      this.closeActionMenu();
      if (!event.target.closest('#quotations-invoices-view .documents-date-picker')) {
        this.closeDateRangePopup();
      }
      if (!event.target.closest('.documents-search-card')) {
        this.hideLookupResults();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (this.customerModal?.style.display === 'flex') {
          this.closeNewCustomerModal();
          return;
        }
        this.closeActionMenu();
        this.closeDateRangePopup();
        this.closeDetailModal();
        this.closeCreateModal();
      }
    });
  }
  });
  return QuotationsInvoicesView;
})();
