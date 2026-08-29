/* Local Lucide compatibility fallback for offline Electron use.
   It prevents runtime errors when views call window.lucide.createIcons().
   Prefer custom PNG/SVG icons in assets/images/icons/custom for visible UI. */
(function () {
  if (window.lucide && typeof window.lucide.createIcons === 'function') return;
  window.lucide = {
    createIcons: function () {
      document.querySelectorAll('i[data-lucide]').forEach(function (node) {
        node.classList.add('lucide-placeholder');
        node.setAttribute('aria-hidden', 'true');
      });
    }
  };
})();
