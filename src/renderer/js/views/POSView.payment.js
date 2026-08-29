/**
 * attachPOSViewPaymentMethods
 * Extracted prototype methods for POSView.
 */

(function () {
  if (typeof window === 'undefined' || !window.POSView) return;
  const POSView = window.POSView;
  Object.assign(POSView.prototype, {
  ensurePaymentModal() {
    if (this.paymentModal) return this.paymentModal;
    const modal = document.getElementById('pos-payment-modal');
    if (!modal) {
      console.error('Missing #pos-payment-modal in index.html');
      return null;
    }
    if (this.elements.view && modal.parentElement !== this.elements.view) {
      this.elements.view.appendChild(modal);
    }
    this.paymentModal = modal;
    if (!modal.dataset.bound) {
      modal.dataset.bound = 'true';
      modal.querySelectorAll('[data-payment-close], [data-payment-cancel]').forEach(button => {
        button.addEventListener('click', () => this.closePaymentModal());
      });
      modal.addEventListener('click', (event) => {
        if (event.target === modal) this.closePaymentModal();
      });
      modal.querySelector('#pos-payment-form')?.addEventListener('submit', (event) => this.processPayment(event));
      modal.querySelector('#pos-payment-received')?.addEventListener('input', (event) => {
        this.paymentAmountReceived = Math.max(parseFloat(event.target.value) || 0, 0);
        this.updatePaymentModal();
      });
      modal.querySelectorAll('[data-payment-method]').forEach(button => {
        button.addEventListener('click', () => this.setPaymentMethod(button.dataset.paymentMethod || 'cash'));
      });
      modal.querySelectorAll('[data-payment-quick]').forEach(button => {
        button.addEventListener('click', () => this.setPaymentAmount(parseFloat(button.dataset.paymentQuick) || 0));
      });
    }
    return modal;
  },

  openPaymentModal() {
    if (!this.cart.length) return;

    const modal = this.ensurePaymentModal();
    if (!modal) return;
    this.syncCurrencyDisplay();
    const modalMethods = Array.from(modal.querySelectorAll('[data-payment-method]')).map(button => button.dataset.paymentMethod);
    if (!modalMethods.includes(this.paymentMethod)) {
      this.paymentMethod = modalMethods[0] || 'card';
      this.syncPaymentMethod();
    }
    this.paymentAmountReceived = 0;
    modal.querySelector('#pos-payment-reference').value = '';
    modal.querySelector('#pos-print-receipt').checked = true;
    const emailReceipt = modal.querySelector('#pos-email-receipt');
    if (emailReceipt) {
      emailReceipt.checked = false;
      emailReceipt.disabled = !this.selectedCustomer?.email;
    }
    this.setPaymentAmount(this.paymentMethod === 'cash' ? 0 : this.getCartTotals().total);
    modal.style.display = 'flex';
    window.setTimeout(() => modal.querySelector('#pos-payment-received')?.focus(), 50);
  },

  closePaymentModal(force = false) {
    if (!this.paymentModal || (this.paymentProcessing && !force)) return;
    this.paymentModal.style.display = 'none';
  },

  setPaymentAmount(amount) {
    this.paymentAmountReceived = Math.max(parseFloat(amount) || 0, 0);
    const input = this.paymentModal?.querySelector('#pos-payment-received');
    if (input) input.value = this.paymentAmountReceived > 0 ? this.paymentAmountReceived.toFixed(2) : '';
    this.updatePaymentModal();
  },

  updatePaymentModal() {
    const modal = this.paymentModal;
    if (!modal) return;

    const { total } = this.getCartTotals();
    const amountReceived = Math.max(this.paymentAmountReceived || 0, 0);
    const amountDue = Math.max(total - amountReceived, 0);
    const changeDue = Math.max(amountReceived - total, 0);

    const totalEl = modal.querySelector('[data-payment-total]');
    const changeCard = modal.querySelector('[data-change-card]');
    const changeLabel = modal.querySelector('[data-change-label]');
    const changeAmount = modal.querySelector('[data-change-amount]');
    const processButton = modal.querySelector('#pos-process-payment-btn');
    const amountLabel = modal.querySelector('label[for="pos-payment-received"] > span');

    if (totalEl) totalEl.textContent = this.formatCurrency(total);
    this.updatePaymentQuickAmounts(total);
    if (amountLabel) amountLabel.textContent = 'Amount Received';
    modal.querySelectorAll('[data-payment-method]').forEach(button => {
      button.classList.toggle('active', button.dataset.paymentMethod === this.paymentMethod);
    });

    if (changeCard) changeCard.classList.toggle('is-due', amountDue > 0);
    if (changeLabel) changeLabel.textContent = amountDue > 0 ? 'Amount Due' : 'Change Due';
    if (changeAmount) changeAmount.textContent = this.formatCurrency(amountDue > 0 ? amountDue : changeDue);

    if (processButton) {
      processButton.disabled = this.paymentProcessing || !this.cart.length || amountReceived < total;
      const processLabel = processButton.querySelector('span:last-child') || processButton;
      processLabel.textContent = this.paymentProcessing ? 'Processing...' : 'Process Payment';
    }
  },

  getPaymentQuickAmounts(total) {
    const amount = Math.max(Number(total) || 0, 0);
    if (amount <= 0) return [20, 50, 100];

    const candidates = [
      Math.ceil(amount / 10) * 10,
      Math.ceil(amount / 50) * 50,
      Math.ceil(amount / 100) * 100
    ];
    const quickAmounts = [];
    candidates.forEach(candidate => {
      if (candidate > 0 && !quickAmounts.includes(candidate)) quickAmounts.push(candidate);
    });

    const fallbackStep = amount <= 100 ? 50 : amount <= 500 ? 100 : 500;
    let next = quickAmounts[quickAmounts.length - 1] || Math.ceil(amount);
    while (quickAmounts.length < 3) {
      next += fallbackStep;
      if (!quickAmounts.includes(next)) quickAmounts.push(next);
    }

    return quickAmounts.slice(0, 3);
  },

  updatePaymentQuickAmounts(total) {
    if (!this.paymentModal) return;

    const amounts = this.getPaymentQuickAmounts(total);
    this.paymentModal.querySelectorAll('[data-payment-quick]').forEach((button, index) => {
      const amount = amounts[index] ?? amounts[amounts.length - 1];
      button.dataset.paymentQuick = String(amount);
      button.textContent = this.formatCurrency(amount);
    });
  },

  syncCurrencyDisplay() {
    if (!this.paymentModal) return;

    this.paymentModal.querySelectorAll('[data-currency-symbol]').forEach(element => {
      element.textContent = window.AppFormatters.currencySymbol;
    });
    this.updatePaymentModal();
  },

  async processPayment(event) {
    event.preventDefault();
    if (!this.cart.length || this.paymentProcessing) return;

    const { total } = this.getCartTotals();
    if (this.paymentAmountReceived < total) {
      this.showNotification('Amount received is less than the total', 'error');
      this.paymentModal?.querySelector('#pos-payment-received')?.focus();
      return;
    }

    this.paymentProcessing = true;
    this.updatePaymentModal();

    const paymentDetails = {
      amountReceived: this.paymentAmountReceived,
      reference: this.paymentModal?.querySelector('#pos-payment-reference')?.value.trim() || '',
      printReceipt: Boolean(this.paymentModal?.querySelector('#pos-print-receipt')?.checked),
      emailReceipt: Boolean(this.paymentModal?.querySelector('#pos-email-receipt')?.checked)
    };

    try {
      await this.handleCheckout(paymentDetails);
    } finally {
      this.paymentProcessing = false;
      this.updatePaymentModal();
    }
  },

  ensureNewCustomerModal() {
    if (this.customerModal) return this.customerModal;
    const modal = document.getElementById('pos-customer-form-modal');
    if (!modal) {
      console.error('Missing #pos-customer-form-modal in index.html');
      return null;
    }
    if (this.elements.view && modal.parentElement !== this.elements.view) {
      this.elements.view.appendChild(modal);
    }
    this.customerModal = modal;
    if (!modal.dataset.bound) {
      modal.dataset.bound = 'true';
      modal.querySelectorAll('[data-pos-customer-close]').forEach(button => {
        button.addEventListener('click', () => this.closeNewCustomerModal());
      });
      modal.addEventListener('click', (event) => {
        if (event.target === modal) this.closeNewCustomerModal();
      });
      modal.querySelector('#pos-customer-form')?.addEventListener('submit', (event) => this.saveNewCustomerFromModal(event));
      modal.querySelector('#pos-new-customer-name')?.addEventListener('input', () => this.updateNewCustomerSubmitState());
      modal.querySelectorAll('[data-pos-customer-type]').forEach(button => {
        button.addEventListener('click', () => this.setNewCustomerType(button.dataset.posCustomerType || 'Individual'));
      });
    }
    return modal;
  },

  openNewCustomerModal() {
    const modal = this.ensureNewCustomerModal();
    const form = modal.querySelector('#pos-customer-form');
    form?.reset();
    this.setNewCustomerType('Individual');
    this.updateNewCustomerSubmitState();
    modal.style.display = 'flex';
    window.setTimeout(() => modal.querySelector('#pos-new-customer-name')?.focus(), 50);
  },

  closeNewCustomerModal() {
    if (this.customerModal) {
      this.customerModal.style.display = 'none';
    }
  },

  setNewCustomerType(type) {
    const modal = this.ensureNewCustomerModal();
    const select = modal.querySelector('#pos-new-customer-type');
    if (select) select.value = type;

    modal.querySelectorAll('[data-pos-customer-type]').forEach(button => {
      const isActive = button.dataset.posCustomerType === type;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  },

  updateNewCustomerSubmitState() {
    const modal = this.ensureNewCustomerModal();
    const saveButton = modal.querySelector('#pos-save-customer-btn');
    const name = modal.querySelector('#pos-new-customer-name')?.value.trim();
    if (saveButton) saveButton.disabled = !name;
  },

  async saveNewCustomerFromModal(event) {
    event.preventDefault();

    const modal = this.ensureNewCustomerModal();
    const saveButton = modal.querySelector('#pos-save-customer-btn');
    const name = modal.querySelector('#pos-new-customer-name')?.value.trim();
    const phone = modal.querySelector('#pos-new-customer-phone')?.value.trim();
    const email = modal.querySelector('#pos-new-customer-email')?.value.trim();
    const address = modal.querySelector('#pos-new-customer-address')?.value.trim();
    const type = modal.querySelector('#pos-new-customer-type')?.value
      || modal.querySelector('[data-pos-customer-type].active')?.dataset.posCustomerType
      || 'Individual';
    const creditLimit = parseFloat(modal.querySelector('#pos-new-customer-credit-limit')?.value || '0') || 0;
    const status = modal.querySelector('#pos-new-customer-status')?.value || 'Active';

    if (!name) {
      this.showNotification('Customer name is required', 'error');
      modal.querySelector('#pos-new-customer-name')?.focus();
      return;
    }

    const customerData = {
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      type,
      creditLimit,
      status
    };

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
    }

    try {
      if (!window.electronAPI || typeof window.electronAPI.createCustomer !== 'function') {
        throw new Error('Customer creation service is unavailable');
      }

      const result = await window.electronAPI.createCustomer(customerData);
      if (!result?.success) {
        throw new Error(result?.error || 'Unable to create customer');
      }

      const customer = this.normalizeCustomer({ ...customerData, ...(result.data || {}) });
      if (!customer) {
        throw new Error('Customer was saved but the returned record was invalid');
      }

      this.customers.unshift(customer);
      this.loadErrors.customers = '';
      if (window.customersView && Array.isArray(window.customersView.customers)) {
        window.customersView.customers.unshift(customer);
        window.customersView.filterCustomers?.();
      }

      this.selectCustomer(customer);
      this.closeNewCustomerModal();
      this.showNotification(`Customer ${customer.name} created`, 'success');
    } catch (error) {
      console.error('Create customer failed:', error);
      this.showNotification(error.message || 'Failed to create customer', 'error');
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Save Customer';
        this.updateNewCustomerSubmitState();
      }
    }
  },

  async handleCheckout(paymentDetails = {}) {
    if (!this.cart.length) return false;

    const totals = this.getCartTotals();
    const { total } = totals;
    const paymentAmount = Number.isFinite(Number(paymentDetails.amountReceived)) ? Number(paymentDetails.amountReceived) : total;
    const reference = paymentDetails.reference ? ` - ${paymentDetails.reference}` : '';
    const salePayload = {
      customerId: this.selectedCustomer ? this.selectedCustomer.id : null,
      items: this.cart.map(item => ({ productId: item.id, quantity: item.quantity })),
      payments: [{ method: this.paymentMethod, amount: paymentAmount }],
      discountRate: this.discountRate,
      subtotal: totals.subtotal,
      discountAmount: totals.discount,
      taxAmount: totals.tax,
      totalAmount: totals.total,
      taxExempt: this.isTaxExempt,
      notes: `POS checkout${reference}`
    };

    try {
      if (window.electronAPI && window.electronAPI.createSale) {
        const result = await window.electronAPI.createSale(salePayload);
        if (result.success) {
          if (paymentDetails.printReceipt && window.ReceiptPrinter) {
            const totals = this.getCartTotals();
            const trustedTotals = {
              subtotal: Number.isFinite(Number(result.data?.subtotal)) ? Number(result.data.subtotal) : totals.subtotal,
              discount: Number.isFinite(Number(result.data?.discountAmount)) ? Number(result.data.discountAmount) : totals.discount,
              tax: Number.isFinite(Number(result.data?.taxAmount)) ? Number(result.data.taxAmount) : totals.tax,
              total: Number.isFinite(Number(result.data?.totalAmount)) ? Number(result.data.totalAmount) : totals.total
            };
            const amountPaid = Number.isFinite(Number(paymentDetails.amountReceived))
              ? Number(paymentDetails.amountReceived)
              : trustedTotals.total;
            try {
              await window.ReceiptPrinter.printReceipt({
                ...result.data,
                ...trustedTotals,
                discountAmount: trustedTotals.discount,
                taxAmount: trustedTotals.tax,
                totalAmount: trustedTotals.total,
                customerName: this.selectedCustomer?.name || 'Walk-in Customer',
                customerAddress: this.selectedCustomer?.address || '',
                amountPaid,
                amountReceived: amountPaid,
                change: Math.max(amountPaid - trustedTotals.total, 0),
                changeDue: Math.max(amountPaid - trustedTotals.total, 0),
                paymentMethod: this.paymentMethod,
                items: this.cart.map(item => ({ ...item }))
              }, window.appSettings || {});
            } catch (printError) {
              console.error('Receipt print failed:', printError);
              this.showNotification(printError.message || 'Sale completed, but receipt printing failed', 'warning');
            }
          }
          this.showNotification(`Sale completed (${result.data?.invoiceNumber || 'invoice'})`, 'success');
          this.closePaymentModal(true);
          this.cart = [];
          await this.loadProducts();
          this.renderSaleState();
          return true;
        }

        this.showNotification(result.error || 'Unable to complete sale', 'error');
        return false;
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      this.showNotification(error.message || 'Checkout failed', 'error');
      return false;
    }

    this.showNotification('Checkout service is unavailable', 'error');
    return false;
  }
  });
  return POSView;
})();
