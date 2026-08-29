/**
 * CSP-safe DOM bootstrapping.
 * Keeps simple DOM actions out of inline scripts and event attributes.
 */

(function () {
  'use strict';

  document.addEventListener('click', event => {
    const closeControl = event.target.closest('[data-close-modal]');
    if (!closeControl) {
      return;
    }

    const modalId = closeControl.getAttribute('data-close-modal');
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  });

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
})();
