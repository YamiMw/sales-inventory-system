/**
 * Shared template rendering helpers.
 * Repeated database-driven rows/lists should clone <template> blocks from index.html
 * instead of owning large HTML strings inside JS view files.
 */
(function attachTemplateRenderer(global) {
  function clone(templateId) {
    const template = document.getElementById(templateId);
    if (!template || !template.content) return null;
    return template.content.firstElementChild.cloneNode(true);
  }

  function setText(root, selector, value) {
    const element = root?.querySelector?.(selector);
    if (element) element.textContent = value == null ? '' : String(value);
    return element;
  }

  function setHtml(root, selector, value) {
    const element = root?.querySelector?.(selector);
    if (element) element.innerHTML = value == null ? '' : String(value);
    return element;
  }

  function setAttr(root, selector, attr, value) {
    const element = selector ? root?.querySelector?.(selector) : root;
    if (element) element.setAttribute(attr, value == null ? '' : String(value));
    return element;
  }

  function clear(container) {
    if (!container) return;
    container.replaceChildren();
  }

  function appendEmptyRow(tbody, colspan, title, message, className) {
    if (!tbody) return;
    const row = clone('app-empty-row-template') || document.createElement('tr');
    const cell = row.querySelector('td') || row.insertCell?.(0);
    if (cell) {
      cell.colSpan = colspan || 1;
      if (className) cell.className = className;
    }
    setText(row, '[data-empty-title]', title || 'No records found');
    setText(row, '[data-empty-message]', message || '');
    tbody.replaceChildren(row);
  }

  function appendEmptyBlock(container, message, className) {
    if (!container) return;
    const block = document.createElement('div');
    block.className = className || 'empty';
    block.textContent = message || 'No records found';
    container.replaceChildren(block);
  }



  function make(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text !== undefined) element.textContent = options.text == null ? '' : String(options.text);
    if (options.html !== undefined) element.innerHTML = options.html == null ? '' : String(options.html);
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([key, value]) => {
        if (value === false || value === null || value === undefined) return;
        if (value === true) element.setAttribute(key, '');
        else element.setAttribute(key, String(value));
      });
    }
    if (options.dataset) {
      Object.entries(options.dataset).forEach(([key, value]) => {
        if (value !== null && value !== undefined) element.dataset[key] = String(value);
      });
    }
    if (options.children) element.append(...options.children.filter(Boolean));
    return element;
  }

  function icon(src, className = 'custom-ui-icon', alt = '') {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.className = className;
    img.setAttribute('aria-hidden', 'true');
    return img;
  }

  function replaceSelectOptions(select, options, placeholderText = '', placeholderValue = '') {
    if (!select) return;
    const nodes = [];
    if (placeholderText !== null) {
      const placeholder = document.createElement('option');
      placeholder.value = placeholderValue;
      placeholder.textContent = placeholderText;
      nodes.push(placeholder);
    }
    (options || []).forEach(option => {
      const item = Array.isArray(option) ? { value: option[0], label: option[1] } : option;
      const node = document.createElement('option');
      node.value = item.value == null ? '' : String(item.value);
      node.textContent = item.label == null ? '' : String(item.label);
      if (item.selected) node.selected = true;
      nodes.push(node);
    });
    select.replaceChildren(...nodes);
  }

  function renderPagination(container, totalPages, currentPage, onPage, options = {}) {
    if (!container) return;
    if (!totalPages || totalPages <= 1) {
      container.replaceChildren();
      return;
    }
    const maxVisible = options.maxVisible || totalPages;
    const fragment = document.createDocumentFragment();
    const addButton = (page, label, disabled = false, active = false, title = '') => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pagination-btn${active ? ' active' : ''}`;
      btn.dataset.page = String(page);
      btn.textContent = String(label);
      if (title) btn.title = title;
      if (disabled) btn.disabled = true;
      btn.addEventListener('click', () => onPage(page));
      fragment.appendChild(btn);
    };
    if (options.arrows) addButton('prev', options.prevLabel || '<', currentPage === 1, false, 'Previous');
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
    if (startPage > 1) {
      addButton(1, '1', false, currentPage === 1);
      if (startPage > 2) fragment.appendChild(make('span', { className: 'pagination-ellipsis', text: '...' }));
    }
    for (let i = startPage; i <= endPage; i += 1) addButton(i, i, false, i === currentPage);
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) fragment.appendChild(make('span', { className: 'pagination-ellipsis', text: '...' }));
      addButton(totalPages, totalPages, false, currentPage === totalPages);
    }
    if (options.arrows) addButton('next', options.nextLabel || '>', currentPage === totalPages, false, 'Next');
    container.replaceChildren(fragment);
  }

  function appendStockHistoryRows(tbody, history, formatter) {
    if (!tbody) return;
    if (!history || history.length === 0) {
      appendEmptyRow(tbody, 6, 'No stock movements yet', '', 'stock-history-empty');
      return;
    }
    const fragment = document.createDocumentFragment();
    history.forEach(transaction => {
      const row = clone('stock-history-row-template') || document.createElement('tr');
      const quantity = Number(transaction.quantity) || 0;
      const changeClass = quantity >= 0 ? 'positive' : 'negative';
      const notes = formatter.notes ? formatter.notes(transaction) : (transaction.notes || '-');
      setText(row, '[data-date]', formatter.date(transaction));
      const typeCell = row.querySelector('[data-type]');
      typeCell?.replaceChildren(make('span', { className: 'stock-history-type', text: formatter.type(transaction) }));
      const changeCell = row.querySelector('[data-change]');
      changeCell?.replaceChildren(make('span', { className: `stock-history-change ${changeClass}`, text: formatter.quantity(quantity) }));
      setText(row, '[data-before]', formatter.before(transaction));
      setText(row, '[data-after]', formatter.after(transaction));
      const notesCell = row.querySelector('[data-notes]');
      if (notesCell) {
        notesCell.className = 'stock-history-notes';
        notesCell.title = notes;
        notesCell.textContent = notes;
      }
      fragment.appendChild(row);
    });
    tbody.replaceChildren(fragment);
  }

  global.TemplateRenderer = { clone, setText, setHtml, setAttr, clear, appendEmptyRow, appendEmptyBlock, make, icon, replaceSelectOptions, renderPagination, appendStockHistoryRows };
})(window);
