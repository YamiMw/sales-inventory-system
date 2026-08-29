/**
 * POS View Events
 * Extracted event bindings for POSView.
 */

(function () {
  if (typeof window === 'undefined' || !window.POSView) return;
  const POSView = window.POSView;
  Object.assign(POSView.prototype, {
  attachEventListeners() {
    if (this.elements.backBtn) {
      this.elements.backBtn.addEventListener('click', () => {
        if (window.app && window.app.navigateTo) {
          window.app.navigateTo('dashboard');
        }
      });
    }

    this.elements.sessionLiveBtn?.addEventListener('click', () => this.setSessionMode('live'));
    this.elements.sessionHoldBtn?.addEventListener('click', () => this.setSessionMode('hold'));

    if (this.elements.productSearch) {
      this.elements.productSearch.addEventListener('input', (event) => {
        this.searchQuery = event.target.value || '';
        this.renderProducts();
      });
      this.elements.productSearch.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        this.handleProductSearchSubmit();
      });
    }

    if (this.elements.barcodeInput) {
      this.elements.barcodeInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.handleBarcodeAdd();
        }
      });
    }

    if (this.elements.categoryFilter) {
      this.elements.categoryFilter.addEventListener('change', (event) => {
        this.category = event.target.value || '';
        this.renderProducts();
      });
    }

    if (this.elements.customerSearch) {
      this.elements.customerSearch.addEventListener('input', () => this.renderCustomerSearchResults());
      this.elements.customerSearch.addEventListener('focus', () => this.renderCustomerSearchResults());
    }

    if (this.elements.customerSearchResults) {
      this.elements.customerSearchResults.addEventListener('click', (event) => {
        const target = event.target.closest('.customer-result');
        if (!target) return;
        const customerId = target.dataset.customerId;
        const customer = this.customers.find(item => String(item.id) === String(customerId));
        if (customer) {
          this.selectCustomer(customer);
        }
      });
    }

    if (this.elements.newCustomerBtn) {
      this.elements.newCustomerBtn.addEventListener('click', () => this.openNewCustomerModal());
    }

    if (this.elements.paymentMethodButtons) {
      this.elements.paymentMethodButtons.forEach(button => {
        button.addEventListener('click', () => this.setPaymentMethod(button.dataset.method || 'cash'));
      });
    }

    if (this.elements.taxExemptCheckbox) {
      this.elements.taxExemptCheckbox.addEventListener('change', (event) => {
        this.isTaxExempt = event.target.checked;
        this.updateTotals();
      });
    }

    if (this.elements.discountSelect) {
      this.elements.discountSelect.addEventListener('change', (event) => {
        this.discountRate = parseFloat(event.target.value) || 0;
        this.updateTotals();
      });
    }

    if (this.elements.clearCartBtn) {
      this.elements.clearCartBtn.addEventListener('click', () => {
        this.clearCart();
      });
    }

    if (this.elements.checkoutBtn) {
      this.elements.checkoutBtn.addEventListener('click', () => this.openPaymentModal());
    }

    if (this.elements.productsGrid) {
      this.elements.productsGrid.addEventListener('click', (event) => {
        const addButton = event.target.closest('.product-add-btn, .product-waitlist-btn');
        const row = event.target.closest('[data-product-id]');
        if (!addButton && !row) return;
        const productId = (addButton || row).dataset.productId || row?.dataset.productId;
        const product = this.products.find(item => String(item.id) === String(productId));
        if (product) this.addToCart(product);
      });
    }

    if (this.elements.cartItemsList) {
      this.elements.cartItemsList.addEventListener('click', (event) => {
        const removeButton = event.target.closest('[data-cart-remove]');
        const changeButton = event.target.closest('[data-quantity-change]');
        if (removeButton) {
          const productId = removeButton.dataset.cartRemove;
          this.removeFromCart(productId);
        } else if (changeButton) {
          const productId = changeButton.dataset.quantityChange;
          const delta = parseInt(changeButton.dataset.delta, 10) || 0;
          this.changeQuantity(productId, delta);
        }
      });
      this.elements.cartItemsList.addEventListener('change', (event) => {
        const quantityInput = event.target.closest('[data-cart-quantity]');
        if (!quantityInput) return;
        this.setCartQuantity(quantityInput.dataset.cartQuantity, quantityInput.value);
      });
      this.elements.cartItemsList.addEventListener('keydown', (event) => {
        const quantityInput = event.target.closest('[data-cart-quantity]');
        if (!quantityInput || event.key !== 'Enter') return;
        event.preventDefault();
        quantityInput.blur();
      });
    }

    if (this.elements.quickKeysGrid) {
      this.elements.quickKeysGrid.addEventListener('click', (event) => {
        const key = event.target.closest('.quick-key-button');
        if (!key) return;
        const action = key.dataset.action;
        const value = key.dataset.value;
        if (action) {
          this.handleQuickKeyAction(action);
        } else if (this.elements.barcodeInput && value) {
          this.elements.barcodeInput.value += value;
        }
      });
    }

    if (this.elements.numpadButtons) {
      this.elements.numpadButtons.forEach(button => {
        button.addEventListener('click', () => {
          if (!this.elements.barcodeInput) return;
          const action = button.dataset.action;
          const value = button.dataset.num;
          if (action === 'clear') {
            this.elements.barcodeInput.value = '';
          } else if (action === 'backspace') {
            this.elements.barcodeInput.value = this.elements.barcodeInput.value.slice(0, -1);
          } else if (value) {
            this.elements.barcodeInput.value += value;
          }
        });
      });
    }

    document.addEventListener('keydown', (event) => {
      if (!this.isActiveView()) return;
      if (event.ctrlKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        this.elements.productSearch?.focus();
      }
      if (event.key === 'Escape') {
        if (this.paymentModal?.style.display === 'flex') {
          this.closePaymentModal();
          return;
        }
        if (this.customerModal?.style.display === 'flex') {
          this.closeNewCustomerModal();
          return;
        }
        this.elements.productSearch?.blur();
        this.elements.customerSearch?.blur();
      }
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (event.key === 'Enter' && this.cart.length && !isTyping) {
        this.openPaymentModal();
      }
      if (!isTyping && /^F(1|2|3|4|5|10)$/.test(event.key)) {
        event.preventDefault();
        const actions = {
          F1: 'cash',
          F2: 'card',
          F3: 'mobile',
          F4: 'clear',
          F5: 'hold',
          F10: 'checkout'
        };
        this.handleQuickKeyAction(actions[event.key]);
      }
    });

    document.addEventListener('click', (event) => {
      if (!this.elements.customerSelectionArea?.contains(event.target)) {
        this.hideCustomerSearchResults();
      }
    });
  }
  });
  return POSView;
})();
