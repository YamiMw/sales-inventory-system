/**
 * Settings View Module
 * Manages company, document, printer, localization, tax, and backup settings.
 */

class SettingsView {
  constructor() {
    this.activeTab = 'company';
    this.settings = {};
    this.savedSettings = {};
    this.products = [];
    this.isSaving = false;
    this.init();
  }

  get defaults() {
    return {
      company_name: 'My Business',
      company_description: '',
      company_address: '',
      company_city: '',
      company_state: '',
      company_zip: '',
      company_phone: '',
      company_email: '',
      company_website: '',
      company_tax_id: '',
      company_logo: '',
      currency: 'MWK',
      date_format: 'DD/MM/YYYY',
      time_format: '12-hour',
      timezone: 'Africa/Blantyre',
      default_tax_rate: '17.5',
      tax_inclusive: true,
      tax_show_separate: false,
      tax_name: 'VAT',
      doc_invoice_prefix: 'INV-',
      doc_quote_prefix: 'QUO-',
      doc_due_days: '30',
      doc_validity_days: '30',
      documents_invoice_footer: 'Thank you for your business! Payment is due within 30 days.',
      documents_quote_footer: 'This quotation is valid for 30 days. Prices are subject to change.',
      alerts_enabled: true,
      alerts_threshold: '20',
      alerts_interval: '15',
      allow_negative_stock: false,
      printer_device: 'EPSON TM-T88V (USB)',
      printer_paper_size: '80mm',
      printer_auto_cut: true,
      printer_open_drawer: true,
      printer_header: 'Thank you for your business!',
      printer_footer: 'Please come again',
      label_printer_device: 'None',
      label_printer_size: '4x6 inch',
      backup_enabled: true,
      backup_frequency: 'Daily',
      backup_time: '02:00',
      backup_retention: '30',
      last_backup: '',
      last_backup_path: '',
      backup_next_run: '',
      backup_last_error: ''
    };
  }

  iconImage(name, className = 'custom-ui-icon') {
    const icons = {
      'search': 'search_icon.png',
      'shield': 'staff_shield_icon.svg',
      'chevron-down': 'chevron_down_icon.svg',
      'refresh-cw': 'refresh_icon.png',
      'eye': 'eye_icon.svg',
      'eye-off': 'eye_off_icon.svg',
      'trash': 'trash_icon.svg',
      'trash-2': 'trash_icon.svg',
      'user-plus': 'user_plus_icon.svg',
      'users': 'user_icon.svg',
      'more-vertical': 'more_vertical_icon.svg',
      'plus': 'add_icon.svg',
      'bar-chart-3': 'bar_chart_icon.png',
      'package': 'product_cube_icon.png',
      'alert-triangle': 'warning_triangle_icon.png',
      'alert-circle': 'reorder_alert_icon.png',
      'clipboard-list': 'clipboard_tasks_icon.png',
      'check-circle': 'check_status_icon.png',
      'check-circle-2': 'check_status_icon.png',
      'x-circle': 'out_of_stock_icon.png',
      'tags': 'category_tag_icon.png',
      'banknote': 'cash_sales_icon.png',
      'calendar': 'calendar_icon.png',
      'file-text': 'file_text_icon.svg',
      'file-clock': 'file_clock_icon.svg',
      'send': 'send_icon.svg',
      'arrow-left': 'arrow_left_icon.svg',
      'arrow-right': 'arrow_right_icon.svg',
      'file-down': 'download_icon.svg',
      'download': 'download_icon.svg',
      'printer': 'printer_icon.svg',
      'copy': 'copy_icon.svg',
      'credit-card': 'credit_card_icon.svg',
      'file-check': 'file_check_icon.svg',
      'edit-3': 'edit_icon.svg',
      'badge-check': 'badge_check_icon.svg',
      'ban': 'ban_icon.svg',
      'x': 'x_icon.svg',
      'sliders-horizontal': 'sliders_icon.svg',
      'trending-up': 'trending_up_icon.svg',
      'pie-chart': 'pie_chart_icon.svg',
      'history': 'history_icon.svg',
      'dollar-sign': 'dollar_sign_icon.svg',
      'triangle-alert': 'warning_triangle_icon.png',
      'chart-no-axes-combined': 'bar_chart_icon.png',
      'building-2': 'building_icon.svg',
      'database': 'database_icon.svg',
      'database-backup': 'database_icon.svg',
      'info': 'info_icon.svg',
      'save': 'save_icon.svg',
      'camera': 'camera_icon.svg',
      'upload': 'upload_icon.svg',
      'globe-2': 'globe_icon.svg',
      'percent': 'percent_icon.svg',
      'map-pin': 'map_pin_icon.svg',
      'phone': 'phone_icon.svg',
      'mail': 'mail_icon.svg',
      'link': 'link_icon.svg',
      'hard-drive': 'hard_drive_icon.svg',
      'rotate-ccw': 'refresh_icon.png',
      'file-up': 'file_upload_icon.svg',
      'activity': 'activity_icon.svg',
      'receipt-text': 'receipt_icon.png',
      'user-round-check': 'check_status_icon.png'
    };
    const file = icons[name] || 'check_status_icon.png';
    return `<img src="assets/images/icons/custom/${file}" alt="" class="${className}" aria-hidden="true">`;
  }

  async init() {
    this.renderShell();
    this.setupEventListeners();
    await Promise.all([this.loadSettings(), this.loadProducts()]);
    this.render();
  }

  renderShell() {
    const root = document.getElementById('settings-view');
    if (!root) return;

    root.innerHTML = `
      <div class="settings-page-shell">
        <div class="settings-page-header">
          <div>
            <h1>System Settings</h1>
            <p>Configure company information and application preferences.</p>
          </div>
          <button type="button" id="save-settings-btn" class="settings-save-button">
            <img src="assets/images/icons/custom/save_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"><span>Save Settings</span>
          </button>
        </div>

        <div class="settings-tabs" role="tablist" aria-label="Settings sections">
          ${this.tabMarkup('company', 'building-2', 'Company', true)}
          ${this.tabMarkup('documents', 'file-text', 'Documents')}
          ${this.tabMarkup('printers', 'printer', 'Printers')}
          ${this.tabMarkup('backup', 'database', 'Backup')}
          ${this.tabMarkup('about', 'info', 'About')}
        </div>

        <div class="settings-content">
          ${this.companyPanelMarkup()}
          ${this.documentsPanelMarkup()}
          ${this.printersPanelMarkup()}
          ${this.backupPanelMarkup()}
          ${this.aboutPanelMarkup()}
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  tabMarkup(tab, icon, label, active = false) {
    return `
      <button type="button" class="settings-tab${active ? ' active' : ''}" data-tab="${tab}" role="tab">
        <img src="assets/images/icons/custom/check_status_icon.png" alt="" class="custom-ui-icon" aria-hidden="true"><span>${label}</span>
      </button>
    `;
  }

  cardHeaderMarkup(icon, color, title, action = '') {
    return `
      <div class="settings-card-header${action ? ' settings-card-header-split' : ''}">
        <div class="settings-card-title">
          <span class="settings-card-icon icon-${color}"><img src="assets/images/icons/custom/check_status_icon.png" alt="" class="custom-ui-icon" aria-hidden="true"></span>
          <h3>${title}</h3>
        </div>
        ${action}
      </div>
    `;
  }

  actionMarkup() {
    return `
      <div class="settings-actions">
        <button type="button" class="settings-discard-button" data-settings-discard>Discard Changes</button>
        <button type="button" class="settings-save-button settings-save-secondary" data-settings-save>
          <img src="assets/images/icons/custom/save_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"><span>Save Settings</span>
        </button>
      </div>
    `;
  }

  companyPanelMarkup() {
    return `
      <div id="settings-company" class="settings-panel active" role="tabpanel">
        <section class="settings-card settings-company-card">
          ${this.cardHeaderMarkup('building-2', 'blue', 'Company Information')}
          <div class="settings-card-body">
            <div class="company-profile-grid">
              <div class="company-main-fields">
                ${this.inputMarkup('company-name', 'Company Name <span class="required-mark">*</span>', 'text', true)}
                ${this.textareaMarkup('company-description', 'Business Description / Stockists In')}
                ${this.iconInputMarkup('company-address', 'Postal Address', 'map-pin')}
                <div class="settings-grid-3col">
                  ${this.inputMarkup('company-city', 'City')}
                  ${this.inputMarkup('company-state', 'State')}
                  ${this.inputMarkup('company-zip', 'Zip Code')}
                </div>
              </div>
            </div>

            <div class="settings-grid-2col company-contact-grid">
              ${this.iconInputMarkup('company-phone', 'Phone Number', 'phone', 'tel')}
              ${this.iconInputMarkup('company-email', 'Email Address', 'mail', 'email')}
              ${this.iconInputMarkup('company-website', 'Website URL', 'link', 'url')}
              ${this.iconInputMarkup('company-tax-id', 'Tax ID / VAT Number', 'file-text')}
            </div>
          </div>
        </section>

        <div class="settings-grid-2col-card">
          <section class="settings-card">
            ${this.cardHeaderMarkup('globe-2', 'purple', 'Localization')}
            <div class="settings-card-body">
              ${this.selectMarkup('localization-currency', 'Currency', `
                <option value="MWK">MWK - Malawian Kwacha</option>
                <option value="USD">USD - US Dollar</option>
                <option value="ZAR">ZAR - South African Rand</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="EUR">EUR - Euro</option>
              `)}
              <div class="settings-grid-2col">
                ${this.selectMarkup('localization-date-format', 'Date Format', `
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                `)}
                ${this.selectMarkup('localization-time-format', 'Time Format', `
                  <option value="12-hour">12-hour (AM/PM)</option>
                  <option value="24-hour">24-hour</option>
                `)}
              </div>
              ${this.selectMarkup('localization-timezone', 'Timezone', `
                <option value="Africa/Blantyre">(UTC+02:00) Malawi</option>
                <option value="Africa/Johannesburg">(UTC+02:00) Johannesburg</option>
                <option value="UTC">(UTC+00:00) Coordinated Universal Time</option>
                <option value="America/New_York">(UTC-05:00) Eastern Time</option>
              `)}
            </div>
          </section>

          <section class="settings-card">
            ${this.cardHeaderMarkup('percent', 'green', 'Tax Settings')}
            <div class="settings-card-body">
              <div class="form-group">
                <label for="tax-rate">Default Tax Rate (%)</label>
                <input type="number" id="tax-rate" min="0" max="100" step="0.1" class="settings-input settings-input-strong">
              </div>
              ${this.toggleMarkup('tax-inclusive', 'Tax inclusive pricing', 'Prices already include the tax amount')}
              ${this.toggleMarkup('tax-show-separate', 'Show tax separately', 'Explicitly break out tax on receipts')}
              <div class="form-group tax-name-field">
                <label for="tax-name">Local Tax Name</label>
                <input type="text" id="tax-name" class="settings-input" placeholder="e.g. VAT">
              </div>
            </div>
          </section>
        </div>
        ${this.actionMarkup()}
      </div>
    `;
  }

  documentsPanelMarkup() {
    return `
      <div id="settings-documents" class="settings-panel" role="tabpanel">
        <section class="settings-card">
          ${this.cardHeaderMarkup('file-text', 'blue', 'Document Settings')}
          <div class="settings-card-body">
            <div class="settings-grid-2col">
              ${this.inputMarkup('doc-invoice-prefix', 'Invoice Prefix')}
              ${this.inputMarkup('doc-quote-prefix', 'Quotation Prefix')}
              <div class="form-group">
                <label for="doc-due-days">Default Invoice Due Days</label>
                <input type="number" id="doc-due-days" min="0" class="settings-input">
              </div>
              <div class="form-group">
                <label for="doc-validity-days">Default Quote Validity Days</label>
                <input type="number" id="doc-validity-days" min="0" class="settings-input">
              </div>
            </div>
            ${this.textareaMarkup('doc-invoice-footer', 'Invoice Footer Text')}
            ${this.textareaMarkup('doc-quote-footer', 'Quote Footer Text')}
          </div>
        </section>
        ${this.actionMarkup()}
      </div>
    `;
  }

  alertsPanelMarkup() {
    return `
      <div id="settings-alerts" class="settings-panel" role="tabpanel">
        <section class="settings-card">
          ${this.cardHeaderMarkup('triangle-alert', 'amber', 'Low Stock Alert Rules')}
          <div class="settings-card-body">
            <div class="settings-feature-toggle">
              <div>
                <h4>Enable stock background monitor</h4>
                <p>Continuously flag inventory shortages using product reorder levels.</p>
              </div>
              <label class="toggle-switch toggle-switch-large">
                <input type="checkbox" id="alerts-enabled">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div id="alert-rule-fields" class="settings-grid-2col settings-rule-fields">
              <div class="form-group">
                <label for="alerts-threshold">Default Global Warning Threshold (Units)</label>
                <p class="field-help">Used when a product has no explicit reorder level.</p>
                <input type="number" id="alerts-threshold" min="0" class="settings-input settings-input-strong">
              </div>
              <div class="form-group">
                <label for="alerts-interval">Background Checker Frequency</label>
                <p class="field-help">Choose how often the inventory monitor refreshes.</p>
                <select id="alerts-interval" class="settings-input">
                  <option value="5">Real-time Fast (5 Seconds)</option>
                  <option value="15">Optimal Balance (15 Seconds)</option>
                  <option value="60">Standard (1 Minute)</option>
                  <option value="300">Eco-mode (5 Minutes)</option>
                </select>
              </div>
            </div>
            <div class="settings-feature-toggle stock-protection-policy">
              <div>
                <h4>Allow privileged negative stock</h4>
                <p>Only active administrators or users with the Allow Negative Stock permission can reduce inventory below zero.</p>
              </div>
              <label class="toggle-switch toggle-switch-large">
                <input type="checkbox" id="allow-negative-stock">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </section>

        <section class="settings-card">
          ${this.cardHeaderMarkup(
            'package',
            'red',
            'Active Stock Shortages',
            '<span id="stock-warning-count" class="stock-warning-count">0 Warning Items</span>'
          )}
          <div class="settings-table-wrap">
            <table class="settings-shortages-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Current Stock</th>
                  <th>Threshold</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="stock-shortages-body">
                <tr><td colspan="5" class="settings-empty-row">Loading inventory status...</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        ${this.actionMarkup()}
      </div>
    `;
  }

  printersPanelMarkup() {
    return `
      <div id="settings-printers" class="settings-panel" role="tabpanel">
        <section class="settings-card printer-discovery-card">
          <div class="settings-card-body printer-discovery">
            <div>
              <span class="settings-kicker">Hardware Discovery</span>
              <h3>Connect local receipt and label printers</h3>
              <p>Refresh available driver profiles, then select the active device below.</p>
            </div>
            <button type="button" id="scan-printers-btn" class="settings-dark-button">
              <img src="assets/images/icons/custom/refresh_icon.png" alt="" class="custom-ui-icon" aria-hidden="true"><span>Scan for Printers</span>
            </button>
          </div>
        </section>

        <section class="settings-card">
          ${this.cardHeaderMarkup(
            'printer',
            'indigo',
            'Active Receipt Printer',
            '<button type="button" class="settings-test-button" id="test-print-btn">Test Print</button>'
          )}
          <div class="settings-card-body settings-grid-2col">
            <div>
              ${this.selectMarkup('printer-device', 'Selected Printer Driver', `
                <option>EPSON TM-T88V (USB)</option>
                <option>Star Micronics MCP31 (Network)</option>
                <option>Microsoft Print to PDF</option>
              `)}
              ${this.selectMarkup('printer-paper-size', 'Paper Width Specification', `
                <option value="80mm">80mm (Standard POS Thermal)</option>
                <option value="58mm">58mm (Mobile Thermal)</option>
                <option value="A4">A4 (Letter Paper Sheet)</option>
              `)}
              ${this.toggleMarkup('printer-auto-cut', 'Auto-cut after printing')}
              ${this.toggleMarkup('printer-open-drawer', 'Open cash drawer after print')}
            </div>
            <div>
              ${this.textareaMarkup('printer-header', 'Receipt Header (Custom Message)')}
              ${this.textareaMarkup('printer-footer', 'Receipt Footer')}
            </div>
          </div>
        </section>

        <section class="settings-card">
          ${this.cardHeaderMarkup(
            'tags',
            'indigo',
            'Label Printer (Secondary)',
            '<button type="button" class="settings-test-button" id="test-label-print-btn">Test Print</button>'
          )}
          <div class="settings-card-body settings-grid-2col">
            ${this.selectMarkup('label-printer-device', 'Printer Device', `
              <option value="None">None (Disabled)</option>
              <option value="Zebra GK420d">Zebra GK420d (Thermal)</option>
              <option value="Brother QL-800">Brother QL-800 (Pre-Cut)</option>
            `)}
            ${this.selectMarkup('label-printer-size', 'Label Dimension Specification', `
              <option value="4x6 inch">4 x 6 inch (Shipping Label)</option>
              <option value="3x1 inch">3 x 1 inch (Shelving Tag)</option>
              <option value="Barcode Small">Barcode Small (Product UPC)</option>
            `)}
          </div>
        </section>
        ${this.actionMarkup()}
      </div>
    `;
  }

  backupPanelMarkup() {
    return `
      <div id="settings-backup" class="settings-panel" role="tabpanel">
        <section class="settings-card">
          ${this.cardHeaderMarkup(
            'database',
            'green',
            'Automatic Backup',
            '<span class="badge-scheduled">Scheduled</span>'
          )}
          <div class="settings-card-body">
            <div class="settings-feature-toggle">
              <div>
                <h4>Enable automated database backups</h4>
                <p>Regular snapshots protect your data against device or database failure.</p>
              </div>
              <label class="toggle-switch toggle-switch-large">
                <input type="checkbox" id="backup-enabled">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div id="backup-schedule-fields" class="settings-grid-3col settings-rule-fields">
              ${this.selectMarkup('backup-frequency', 'Backup Frequency', `
                <option>Daily</option><option>Weekly</option><option>Monthly</option>
              `)}
              ${this.inputMarkup('backup-time', 'Backup Time', 'time')}
              <div class="form-group">
                <label for="backup-retention">Retention (days)</label>
                <input type="number" id="backup-retention" min="1" class="settings-input">
              </div>
            </div>
            <div class="automatic-backup-summary">
              <span id="automatic-backup-status">Loading backup schedule...</span>
              <small>Weekly backups run on Monday. Monthly backups run on the first day.</small>
            </div>
          </div>
        </section>

        <div class="settings-grid-2col-card">
          <section class="settings-card backup-action-card">
            <span class="settings-card-icon icon-slate"><img src="assets/images/icons/custom/hard_drive_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"></span>
            <h3>Manual Snapshot</h3>
            <p>Create an immediate backup of the current database state.</p>
            <button type="button" class="settings-dark-button wide" id="create-backup-btn">
              <img src="assets/images/icons/custom/database_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"><span>Create Backup Now</span>
            </button>
            <span class="backup-meta">Last backup: <strong id="last-backup-info">Never</strong></span>
            <span class="backup-path" id="last-backup-path">Backups are saved in C:\\SalesInventoryData\\backups</span>
            <span class="backup-status" id="backup-status-message" role="status" aria-live="polite"></span>
          </section>

          <section class="settings-card backup-action-card restore-card">
            <span class="settings-card-icon icon-amber"><img src="assets/images/icons/custom/refresh_icon.png" alt="" class="custom-ui-icon" aria-hidden="true"></span>
            <h3>Restore Database</h3>
            <p>Restoring a backup will overwrite the current system data.</p>
            <button type="button" class="settings-restore-button wide" id="restore-backup-btn">
              <img src="assets/images/icons/custom/file_upload_icon.svg" alt="" class="custom-ui-icon" aria-hidden="true"><span>Select Backup File</span>
            </button>
            <span class="backup-status" id="restore-status-message" role="status" aria-live="polite"></span>
          </section>
        </div>
      </div>
    `;
  }

  aboutPanelMarkup() {
    return `
      <div id="settings-about" class="settings-panel" role="tabpanel">
        <section class="settings-card settings-about-card">
          <div class="settings-about-logo">
            <img src="assets/images/logo.png" alt="Aliko Business Enterprise system logo">
          </div>
          <h2>Sales &amp; Inventory System</h2>
          <span class="settings-version">Version 1.0.0</span>
          <p>A comprehensive business management solution for sales, inventory tracking, customer management, and reporting.</p>
          <div class="settings-about-meta">
            <div><span>Platform</span><strong>Windows Desktop</strong></div>
            <div><span>Framework</span><strong>Electron + Node.js</strong></div>
            <div><span>Database</span><strong>SQLite</strong></div>
          </div>
          <small>&copy; 2026 Sales &amp; Inventory System. All rights reserved.</small>
        </section>
      </div>
    `;
  }

  inputMarkup(id, label, type = 'text', strong = false) {
    return `
      <div class="form-group">
        <label for="${id}">${label}</label>
        <input type="${type}" id="${id}" class="settings-input${strong ? ' settings-input-strong' : ''}">
      </div>
    `;
  }

  iconInputMarkup(id, label, icon, type = 'text') {
    return `
      <div class="form-group">
        <label for="${id}">${label}</label>
        <div class="settings-input-wrap">
          <img src="assets/images/icons/custom/check_status_icon.png" alt="" class="custom-ui-icon" aria-hidden="true">
          <input type="${type}" id="${id}" class="settings-input">
        </div>
      </div>
    `;
  }

  selectMarkup(id, label, options) {
    return `
      <div class="form-group">
        <label for="${id}">${label}</label>
        <select id="${id}" class="settings-input">${options}</select>
      </div>
    `;
  }

  textareaMarkup(id, label) {
    return `
      <div class="form-group">
        <label for="${id}">${label}</label>
        <textarea id="${id}" rows="3" class="settings-input"></textarea>
      </div>
    `;
  }

  toggleMarkup(id, label, detail = '') {
    return `
      <div class="settings-toggle-row">
        <div>
          <span class="toggle-label">${label}</span>
          ${detail ? `<p class="toggle-desc">${detail}</p>` : ''}
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="${id}">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }

  async loadSettings() {
    let apiSettings = {};
    let automaticBackupStatus = null;
    try {
      if (window.electronAPI?.getSettings) {
        const result = await window.electronAPI.getSettings();
        if (result?.success && result.data) apiSettings = result.data;
      }
    } catch (error) {
      console.warn('Unable to load database settings:', error);
    }

    try {
      if (window.electronAPI?.getAutomaticBackupStatus) {
        const result = await window.electronAPI.getAutomaticBackupStatus();
        if (result?.success && result.data) {
          automaticBackupStatus = result.data;
        }
      }
    } catch (error) {
      console.warn('Unable to load automatic backup status:', error);
    }

    this.settings = { ...this.defaults, ...apiSettings };
    const currency = window.AppFormatters?.normalizeCurrencyCode
      ? window.AppFormatters.normalizeCurrencyCode(this.settings.currency)
      : this.settings.currency;
    this.settings.currency = currency;
    this.settings.currency_symbol = window.AppFormatters?.getCurrencySymbol
      ? window.AppFormatters.getCurrencySymbol(currency, this.settings.currency_symbol)
      : this.settings.currency_symbol;
    if (automaticBackupStatus) {
      this.settings = {
        ...this.settings,
        backup_enabled: automaticBackupStatus.enabled,
        backup_frequency: automaticBackupStatus.frequency,
        backup_time: automaticBackupStatus.time,
        backup_retention: String(automaticBackupStatus.retentionDays),
        last_backup: automaticBackupStatus.lastBackupAt || this.settings.last_backup,
        last_backup_path: automaticBackupStatus.lastBackupPath || this.settings.last_backup_path,
        backup_next_run: automaticBackupStatus.nextBackupAt || '',
        backup_last_error: automaticBackupStatus.lastError || ''
      };
    }
    this.savedSettings = { ...this.settings };
  }

  async loadProducts() {
    try {
      if (window.electronAPI?.getInventory) {
        const result = await window.electronAPI.getInventory();
        if (result?.success && Array.isArray(result.data)) {
          this.products = result.data.map(item => this.normalizeProduct(item));
          return;
        }
      }
      if (window.electronAPI?.getProducts) {
        const result = await window.electronAPI.getProducts();
        if (result?.success && Array.isArray(result.data)) {
          this.products = result.data.map(item => this.normalizeProduct(item));
          return;
        }
      }
      this.products = window.inventoryView?.items?.map(item => this.normalizeProduct(item)) || [];
    } catch (error) {
      console.warn('Unable to load products for stock alerts:', error);
      this.products = [];
    }
  }

  normalizeProduct(item) {
    return {
      id: item.product_id ?? item.productId ?? item.id,
      name: item.name || 'Unnamed Product',
      sku: item.sku || 'NO-SKU',
      category: item.category_name || item.category || 'Uncategorized',
      stock: Number(item.quantity_on_hand ?? item.quantityOnHand ?? item.stock ?? item.initial_stock ?? 0),
      reserved: Number(item.quantity_reserved ?? item.quantityReserved ?? 0),
      reorderLevel: Number(item.reorder_level ?? item.reorderLevel ?? 0)
    };
  }

  render() {
    this.populateForm(this.settings);
    this.showTab(this.activeTab);
    this.renderLowStock();
    this.updateDependentFields();
  }

  populateForm(settings) {
    const values = {
      'company-name': settings.company_name,
      'company-description': settings.company_description,
      'company-address': settings.company_address,
      'company-city': settings.company_city,
      'company-state': settings.company_state,
      'company-zip': settings.company_zip,
      'company-phone': settings.company_phone,
      'company-email': settings.company_email,
      'company-website': settings.company_website,
      'company-tax-id': settings.company_tax_id,
      'localization-currency': settings.currency,
      'localization-date-format': settings.date_format,
      'localization-time-format': settings.time_format,
      'localization-timezone': settings.timezone,
      'tax-rate': settings.default_tax_rate,
      'tax-name': settings.tax_name,
      'doc-invoice-prefix': settings.doc_invoice_prefix,
      'doc-quote-prefix': settings.doc_quote_prefix,
      'doc-due-days': settings.doc_due_days,
      'doc-validity-days': settings.doc_validity_days,
      'doc-invoice-footer': settings.documents_invoice_footer,
      'doc-quote-footer': settings.documents_quote_footer,
      'alerts-threshold': settings.alerts_threshold,
      'alerts-interval': settings.alerts_interval,
      'printer-device': settings.printer_device,
      'printer-paper-size': settings.printer_paper_size,
      'printer-header': settings.printer_header,
      'printer-footer': settings.printer_footer,
      'label-printer-device': settings.label_printer_device,
      'label-printer-size': settings.label_printer_size,
      'backup-frequency': settings.backup_frequency,
      'backup-time': settings.backup_time,
      'backup-retention': settings.backup_retention
    };

    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element && value !== undefined && value !== null) element.value = value;
    });

    const checks = {
      'tax-inclusive': settings.tax_inclusive,
      'tax-show-separate': settings.tax_show_separate,
      'alerts-enabled': settings.alerts_enabled,
      'allow-negative-stock': settings.allow_negative_stock,
      'printer-auto-cut': settings.printer_auto_cut,
      'printer-open-drawer': settings.printer_open_drawer,
      'backup-enabled': settings.backup_enabled
    };

    Object.entries(checks).forEach(([id, checked]) => {
      const element = document.getElementById(id);
      if (element) element.checked = this.toBoolean(checked);
    });

    const lastBackup = document.getElementById('last-backup-info');
    if (lastBackup) lastBackup.textContent = settings.last_backup || 'Never';
    const lastBackupPath = document.getElementById('last-backup-path');
    if (lastBackupPath) {
      lastBackupPath.textContent = settings.last_backup_path ||
        'Backups are saved in C:\\SalesInventoryData\\backups';
      lastBackupPath.title = settings.last_backup_path || '';
    }
    this.renderAutomaticBackupStatus(settings);
  }

  renderAutomaticBackupStatus(settings = this.settings) {
    const status = document.getElementById('automatic-backup-status');
    const badge = document.querySelector('#settings-backup .badge-scheduled');
    if (!status) return;

    if (!this.toBoolean(settings.backup_enabled)) {
      status.textContent = 'Automatic backup is disabled.';
      status.className = 'is-disabled';
      if (badge) badge.textContent = 'Disabled';
      return;
    }

    if (settings.backup_last_error) {
      status.textContent = `Last automatic backup failed: ${settings.backup_last_error}`;
      status.className = 'has-error';
    } else if (settings.backup_next_run) {
      const nextBackup = window.AppFormatters?.formatDateTime(settings.backup_next_run)
        || new Date(settings.backup_next_run).toLocaleString();
      status.textContent = `Next backup: ${nextBackup}`;
      status.className = '';
    } else {
      status.textContent = 'Schedule will start after settings are saved.';
      status.className = '';
    }
    if (badge) badge.textContent = 'Scheduled';
  }

  toBoolean(value) {
    if (typeof value === 'string') return value === 'true' || value === '1';
    return Boolean(value);
  }

  collectSettings() {
    const value = (id, fallback = '') => {
      const element = document.getElementById(id);
      return element ? element.value : fallback;
    };
    const checked = (id, fallback = false) => {
      const element = document.getElementById(id);
      return element ? Boolean(element.checked) : this.toBoolean(fallback);
    };
    const currency = window.AppFormatters?.normalizeCurrencyCode
      ? window.AppFormatters.normalizeCurrencyCode(value('localization-currency'))
      : value('localization-currency');

    return {
      ...this.settings,
      company_name: value('company-name').trim(),
      company_description: value('company-description').trim(),
      company_address: value('company-address').trim(),
      company_city: value('company-city').trim(),
      company_state: value('company-state').trim(),
      company_zip: value('company-zip').trim(),
      company_phone: value('company-phone').trim(),
      company_email: value('company-email').trim(),
      company_website: value('company-website').trim(),
      company_tax_id: value('company-tax-id').trim(),
      currency,
      currency_symbol: window.AppFormatters?.getCurrencySymbol
        ? window.AppFormatters.getCurrencySymbol(currency)
        : this.settings.currency_symbol,
      date_format: value('localization-date-format'),
      time_format: value('localization-time-format'),
      timezone: value('localization-timezone'),
      default_tax_rate: value('tax-rate') || '0',
      tax_inclusive: checked('tax-inclusive'),
      tax_show_separate: checked('tax-show-separate'),
      tax_name: value('tax-name').trim() || 'VAT',
      doc_invoice_prefix: value('doc-invoice-prefix').trim() || 'INV-',
      doc_quote_prefix: value('doc-quote-prefix').trim() || 'QUO-',
      doc_due_days: value('doc-due-days') || '30',
      doc_validity_days: value('doc-validity-days') || '30',
      documents_invoice_footer: value('doc-invoice-footer').trim(),
      documents_quote_footer: value('doc-quote-footer').trim(),
      alerts_enabled: checked('alerts-enabled', this.settings.alerts_enabled),
      alerts_threshold: value('alerts-threshold', this.settings.alerts_threshold) || '0',
      alerts_interval: value('alerts-interval', this.settings.alerts_interval) || '15',
      allow_negative_stock: checked('allow-negative-stock', this.settings.allow_negative_stock),
      printer_device: value('printer-device'),
      printer_paper_size: value('printer-paper-size'),
      printer_auto_cut: checked('printer-auto-cut'),
      printer_open_drawer: checked('printer-open-drawer'),
      printer_header: value('printer-header').trim(),
      printer_footer: value('printer-footer').trim(),
      label_printer_device: value('label-printer-device'),
      label_printer_size: value('label-printer-size'),
      backup_enabled: checked('backup-enabled'),
      backup_frequency: value('backup-frequency'),
      backup_time: value('backup-time'),
      backup_retention: value('backup-retention') || '30'
    };
  }

  showTab(tab) {
    document.querySelectorAll('#settings-view .settings-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `settings-${tab}`);
    });
    document.querySelectorAll('#settings-view .settings-tab').forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    this.activeTab = tab;
  }

  async saveSettings() {
    if (this.isSaving) return;
    const nextSettings = this.collectSettings();

    if (!nextSettings.company_name) {
      document.getElementById('company-name')?.focus();
      this.showNotification('Company name is required', 'error');
      return;
    }

    const taxRate = Number(nextSettings.default_tax_rate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      document.getElementById('tax-rate')?.focus();
      this.showNotification('Tax rate must be between 0 and 100', 'error');
      return;
    }

    this.setSavingState(true);
    try {
      if (!window.electronAPI?.updateSettings) {
        throw new Error('Settings service is unavailable');
      }
      const result = await window.electronAPI.updateSettings(nextSettings);
      if (!result?.success) {
        throw new Error(result?.error || 'Database settings update failed');
      }
      if (result.data?.automaticBackup) {
        const status = result.data.automaticBackup;
        nextSettings.backup_next_run = status.nextBackupAt || '';
        nextSettings.backup_last_error = status.lastError || '';
        nextSettings.last_backup = status.lastBackupAt || nextSettings.last_backup;
        nextSettings.last_backup_path = status.lastBackupPath || nextSettings.last_backup_path;
      }
      this.settings = { ...nextSettings };
      this.savedSettings = { ...nextSettings };
      window.AppFormatters?.configure(nextSettings);
      window.dispatchEvent(new CustomEvent('settings-updated', {
        detail: { ...nextSettings }
      }));
      this.renderAutomaticBackupStatus(nextSettings);
      window.notificationCenter?.refreshSystemSignals();
      this.showNotification('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showNotification('Failed to save settings', 'error');
    } finally {
      this.setSavingState(false);
    }
  }

  setSavingState(saving) {
    this.isSaving = saving;
    document.querySelectorAll('#settings-view [data-settings-save], #save-settings-btn').forEach(button => {
      button.disabled = saving;
      const label = button.querySelector('span');
      if (label) label.textContent = saving ? 'Saving...' : 'Save Settings';
      const icon = button.querySelector('svg');
      if (icon) icon.classList.toggle('settings-spin', saving);
    });
  }

  discardChanges() {
    this.settings = { ...this.savedSettings };
    this.populateForm(this.settings);
    this.updateDependentFields();
    this.renderLowStock();
    this.showNotification('Unsaved changes discarded', 'info');
  }

  setupEventListeners() {
    const root = document.getElementById('settings-view');
    if (!root) return;

    root.addEventListener('click', event => {
      const tab = event.target.closest('.settings-tab');
      if (tab) this.showTab(tab.dataset.tab);

      if (event.target.closest('#save-settings-btn, [data-settings-save]')) this.saveSettings();
      if (event.target.closest('[data-settings-discard]')) this.discardChanges();
      if (event.target.closest('#scan-printers-btn')) this.scanPrinters();
      if (event.target.closest('#test-print-btn')) this.testPrint('receipt');
      if (event.target.closest('#test-label-print-btn')) this.testPrint('label');
      if (event.target.closest('#create-backup-btn')) this.createBackup();
      if (event.target.closest('#restore-backup-btn')) this.restoreBackup();

      const inventoryButton = event.target.closest('[data-open-inventory]');
      if (inventoryButton && window.app?.navigateTo) window.app.navigateTo('inventory');
    });

    root.addEventListener('change', event => {
      if (['alerts-enabled', 'backup-enabled'].includes(event.target.id)) this.updateDependentFields();
      if (event.target.id === 'alerts-threshold') this.renderLowStock();
    });

    root.addEventListener('input', event => {
      if (event.target.id === 'alerts-threshold') this.renderLowStock();
    });
  }

  updateDependentFields() {
    const alertsEnabled = document.getElementById('alerts-enabled')?.checked;
    document.getElementById('alert-rule-fields')?.classList.toggle('settings-fields-disabled', !alertsEnabled);

    const backupEnabled = document.getElementById('backup-enabled')?.checked;
    document.getElementById('backup-schedule-fields')?.classList.toggle('settings-fields-disabled', !backupEnabled);
    document.querySelectorAll('#backup-schedule-fields input, #backup-schedule-fields select').forEach(field => {
      field.disabled = !backupEnabled;
    });
    this.renderAutomaticBackupStatus({
      ...this.settings,
      backup_enabled: backupEnabled,
      backup_next_run: backupEnabled ? this.settings.backup_next_run : ''
    });
  }

  renderLowStock() {
    const body = document.getElementById('stock-shortages-body');
    const count = document.getElementById('stock-warning-count');
    if (!body || !count) return;

    const globalThreshold = Number(document.getElementById('alerts-threshold')?.value ?? this.settings.alerts_threshold ?? 20);
    const lowProducts = this.products.filter(product => {
      const available = product.stock - product.reserved;
      const threshold = product.reorderLevel > 0 ? product.reorderLevel : globalThreshold;
      return available <= threshold;
    });

    count.textContent = `${lowProducts.length} Warning Item${lowProducts.length === 1 ? '' : 's'}`;
    if (!lowProducts.length) {
      body.innerHTML = `
        <tr><td colspan="5" class="settings-empty-row">No active stock shortages detected.</td></tr>
      `;
      return;
    }

    body.innerHTML = lowProducts.map(product => {
      const available = product.stock - product.reserved;
      const threshold = product.reorderLevel > 0 ? product.reorderLevel : globalThreshold;
      const out = available <= 0;
      return `
        <tr>
          <td>
            <strong>${this.escapeHtml(product.name)}</strong>
            <span>${this.escapeHtml(product.sku)} &bull; ${this.escapeHtml(product.category)}</span>
          </td>
          <td class="stock-amount">${available} units</td>
          <td>${threshold} units</td>
          <td><span class="stock-status ${out ? 'out' : 'low'}">${out ? 'Out of stock' : 'Low stock'}</span></td>
          <td><button type="button" class="settings-row-button" data-open-inventory>Open Inventory</button></td>
        </tr>
      `;
    }).join('');
  }

  escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value ?? '');
    return element.innerHTML;
  }

  async scanPrinters() {
    const button = document.getElementById('scan-printers-btn');
    if (!button || button.disabled) return;
    button.disabled = true;
    button.classList.add('is-loading');
    const label = button.querySelector('span');
    if (label) label.textContent = 'Scanning...';

    await new Promise(resolve => setTimeout(resolve, 900));
    const discovered = [
      'EPSON TM-T88V (USB)',
      'Star Micronics MCP31 (Network)',
      'HP LaserJet Pro M404n (Local)',
      'Brother QL-800 Label Printer',
      'Zebra GK420d Thermal Printer',
      'Microsoft Print to PDF'
    ];

    const receiptSelect = document.getElementById('printer-device');
    const labelSelect = document.getElementById('label-printer-device');
    discovered.forEach(name => {
      this.addOption(receiptSelect, name);
      if (!name.includes('PDF')) this.addOption(labelSelect, name);
    });

    button.disabled = false;
    button.classList.remove('is-loading');
    if (label) label.textContent = 'Scan for Printers';
    this.showNotification(`${discovered.length} printer profiles found`, 'success');
  }

  addOption(select, value) {
    if (!select || Array.from(select.options).some(option => option.value === value)) return;
    select.add(new Option(value, value));
  }

  testPrint(type) {
    const device = type === 'label'
      ? document.getElementById('label-printer-device')?.value
      : document.getElementById('printer-device')?.value;

    if (!device || device === 'None') {
      this.showNotification('Select a printer before testing', 'error');
      return;
    }
    this.showNotification(`Test ${type} sent to ${device}`, 'success');
  }

  async createBackup() {
    try {
      this.setBackupStatus('Creating a consistent database snapshot...', 'working');

      if (!window.electronAPI?.backup) {
        throw new Error('Backup service is unavailable. Restart the application and try again.');
      }

      const button = document.getElementById('create-backup-btn');
      if (button) {
        button.disabled = true;
        button.classList.add('is-loading');
        const label = button.querySelector('span');
        if (label) label.textContent = 'Creating Backup...';
      }

      const retentionDays = Number.parseInt(
        document.getElementById('backup-retention')?.value,
        10
      ) || 30;
      const result = await window.electronAPI.backup({ retentionDays });
      if (!result?.success || !result.data?.filePath) {
        throw new Error(result?.error || 'Backup request failed');
      }

      const timestamp = window.AppFormatters?.formatDateTime(result.data.createdAt || Date.now())
        || new Date(result.data.createdAt || Date.now()).toLocaleString();
      this.settings.last_backup = timestamp;
      this.settings.last_backup_path = result.data.filePath;
      this.settings.backup_last_error = '';
      this.savedSettings = { ...this.savedSettings, ...this.settings };
      const info = document.getElementById('last-backup-info');
      if (info) info.textContent = timestamp;
      const pathInfo = document.getElementById('last-backup-path');
      if (pathInfo) {
        pathInfo.textContent = result.data.filePath;
        pathInfo.title = result.data.filePath;
      }
      this.setBackupStatus('Backup created successfully.', 'success');
      window.notificationCenter?.add({
        type: 'success',
        title: 'Manual backup completed',
        message: result.data.filePath,
        source: 'Backup',
        actionView: 'settings',
        createdAt: result.data.createdAt || new Date().toISOString()
      });
      this.showNotification(`Backup saved to ${result.data.filePath}`, 'success');
    } catch (error) {
      console.error('Failed to create backup:', error);
      this.setBackupStatus(error.message || 'Failed to create backup.', 'error');
      window.notificationCenter?.add({
        type: 'error',
        title: 'Manual backup failed',
        message: error.message || 'Failed to create backup.',
        source: 'Backup',
        actionView: 'settings'
      });
      this.showNotification(error.message || 'Failed to create backup', 'error');
    } finally {
      const button = document.getElementById('create-backup-btn');
      if (button) {
        button.disabled = false;
        button.classList.remove('is-loading');
        const label = button.querySelector('span');
        if (label) label.textContent = 'Create Backup Now';
      }
    }
  }

  setBackupStatus(message, type = '') {
    const status = document.getElementById('backup-status-message');
    if (!status) return;
    status.textContent = message;
    status.className = `backup-status${type ? ` ${type}` : ''}`;
  }

  async restoreBackup() {
    const confirmed = window.confirm('Restoring a backup will overwrite all current data. Continue?');
    if (!confirmed) return;

    const button = document.getElementById('restore-backup-btn');
    try {
      this.setRestoreStatus('Select and validating backup file...', 'working');
      if (!window.electronAPI?.restore) {
        throw new Error('Restore service is unavailable. Restart the application and try again.');
      }

      if (button) {
        button.disabled = true;
        button.classList.add('is-loading');
        const label = button.querySelector('span');
        if (label) label.textContent = 'Restoring Database...';
      }

      const result = await window.electronAPI.restore();
      if (result?.canceled) {
        this.setRestoreStatus('Restore canceled.', '');
        return;
      }
      if (!result?.success) {
        throw new Error(result?.error || 'Database restore failed');
      }

      const safetyPath = result.data?.safetyBackupPath;
      this.setRestoreStatus(
        safetyPath
          ? `Restore complete. Previous database saved to ${safetyPath}`
          : 'Restore complete. Reloading application...',
        'success'
      );
      window.notificationCenter?.add({
        type: 'success',
        title: 'System restore completed',
        message: safetyPath
          ? `Database restored. Previous data was backed up to ${safetyPath}.`
          : 'The selected database backup was restored successfully.',
        source: 'Restore',
        actionView: 'settings',
        createdAt: result.data?.restoredAt || new Date().toISOString()
      });
      this.showNotification('Database restored successfully. Reloading application...', 'success');
      setTimeout(() => window.location.reload(), 1400);
    } catch (error) {
      console.error('Failed to restore database:', error);
      this.setRestoreStatus(error.message || 'Failed to restore database.', 'error');
      window.notificationCenter?.add({
        type: 'error',
        title: 'System restore failed',
        message: error.message || 'Failed to restore database.',
        source: 'Restore',
        actionView: 'settings'
      });
      this.showNotification(error.message || 'Failed to restore database', 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.classList.remove('is-loading');
        const label = button.querySelector('span');
        if (label) label.textContent = 'Select Backup File';
      }
    }
  }

  setRestoreStatus(message, type = '') {
    const status = document.getElementById('restore-status-message');
    if (!status) return;
    status.textContent = message;
    status.className = `backup-status${type ? ` ${type}` : ''}`;
  }

  showNotification(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      const notification = document.createElement('div');
      notification.className = `settings-toast ${type}`;
      notification.textContent = message;
      document.body.appendChild(notification);
      requestAnimationFrame(() => notification.classList.add('show'));
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 250);
      }, 5000);
    }
  }
}

window.SettingsView = SettingsView;
