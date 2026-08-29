/**
 * App Dialogs
 * Provides branded replacements for native alert, confirm, and prompt dialogs.
 */

(function () {
  'use strict';

  const DEFAULTS = {
    alert: {
      title: 'Message',
      primaryLabel: 'OK'
    },
    confirm: {
      title: 'Confirm action',
      primaryLabel: 'Continue',
      cancelLabel: 'Cancel'
    },
    prompt: {
      title: 'Input required',
      primaryLabel: 'Continue',
      cancelLabel: 'Cancel',
      inputLabel: 'Details'
    }
  };

  function text(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function make(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = text(content);
    return element;
  }

  function openDialog(mode, message, options = {}) {
    const settings = {
      ...DEFAULTS[mode],
      ...options
    };

    return new Promise((resolve) => {
      const overlay = make('div', `app-dialog-overlay ${settings.variant || 'info'}`);
      const dialog = make('section', 'app-dialog');
      dialog.setAttribute('role', mode === 'alert' ? 'alertdialog' : 'dialog');
      dialog.setAttribute('aria-modal', 'true');

      const header = make('header', 'app-dialog-header');
      const titleWrap = make('div', 'app-dialog-title-wrap');
      if (settings.eyebrow) {
        titleWrap.appendChild(make('span', 'app-dialog-eyebrow', settings.eyebrow));
      }
      const title = make('h2', '', settings.title);
      title.id = `app-dialog-title-${Date.now()}`;
      titleWrap.appendChild(title);
      header.appendChild(titleWrap);

      const closeButton = make('button', 'app-dialog-close', 'x');
      closeButton.type = 'button';
      closeButton.setAttribute('aria-label', 'Close dialog');
      header.appendChild(closeButton);

      const body = make('div', 'app-dialog-body');
      const messageElement = make(
        settings.preformatted ? 'pre' : 'p',
        settings.preformatted ? 'app-dialog-message preformatted' : 'app-dialog-message',
        message
      );
      body.appendChild(messageElement);

      let input = null;
      let validation = null;
      if (mode === 'prompt') {
        const field = make('label', 'app-dialog-field');
        field.appendChild(make('span', '', settings.inputLabel));
        input = document.createElement(settings.multiline ? 'textarea' : 'input');
        if (!settings.multiline) {
          input.type = settings.inputType || 'text';
        } else {
          input.rows = settings.rows || 4;
        }
        input.value = text(settings.defaultValue);
        input.placeholder = text(settings.placeholder);
        field.appendChild(input);
        validation = make('span', 'app-dialog-validation');
        body.append(field, validation);
      }

      const footer = make('footer', 'app-dialog-footer');
      const shouldShowCancel = mode !== 'alert';
      const primaryButton = make(
        'button',
        `btn-primary app-dialog-primary ${settings.variant === 'danger' ? 'btn-danger' : ''}`,
        settings.primaryLabel
      );
      primaryButton.type = 'button';

      let cancelButton = null;
      if (shouldShowCancel) {
        cancelButton = make('button', 'btn-secondary app-dialog-cancel', settings.cancelLabel);
        cancelButton.type = 'button';
        footer.appendChild(cancelButton);
      }
      footer.appendChild(primaryButton);

      dialog.append(header, body, footer);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      document.body.classList.add('app-dialog-open');

      const cleanup = (value) => {
        document.removeEventListener('keydown', onKeydown);
        overlay.remove();
        document.body.classList.remove('app-dialog-open');
        resolve(value);
      };

      const cancelValue = mode === 'prompt' ? null : false;
      const onKeydown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cleanup(mode === 'alert' ? true : cancelValue);
        }
      };

      closeButton.addEventListener('click', () => cleanup(mode === 'alert' ? true : cancelValue));
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) cleanup(mode === 'alert' ? true : cancelValue);
      });
      if (cancelButton) cancelButton.addEventListener('click', () => cleanup(cancelValue));

      primaryButton.addEventListener('click', () => {
        if (mode === 'prompt') {
          const value = input ? input.value : '';
          if (settings.required && !value.trim()) {
            if (validation) validation.textContent = settings.requiredMessage || 'This field is required.';
            input?.focus();
            return;
          }
          cleanup(value);
          return;
        }
        cleanup(true);
      });

      document.addEventListener('keydown', onKeydown);
      requestAnimationFrame(() => {
        overlay.classList.add('show');
        (input || primaryButton).focus();
      });
    });
  }

  window.AppDialogs = {
    alert: (message, options) => openDialog('alert', message, options),
    confirm: (message, options) => openDialog('confirm', message, options),
    prompt: (message, options) => openDialog('prompt', message, options)
  };
})();
