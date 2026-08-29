/**
 * attachReportsViewOutputMethods
 * Extracted preview and export methods for ReportsView.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory;
  } else if (root && root.ReportsView) {
    factory(root.ReportsView);
  }
})(typeof window !== 'undefined' ? window : globalThis, function attachReportsViewOutputMethods(ReportsView) {
  if (!ReportsView) return ReportsView;
  Object.assign(ReportsView.prototype, {
  showPreview() {
    const modal = document.getElementById('report-preview-modal');
    const title = document.getElementById('report-preview-title');
    const content = document.getElementById('report-preview-content');
    if (!modal || !title || !content || !this.reportData) return;

    title.textContent = this.reportData.title || 'Report Preview';
    content.innerHTML = this.buildReportContentHtml();
    modal.style.display = 'flex';
    this.refreshIcons();
  },

  buildReportContentHtml() {
    const includeReportExtras = this.includeSummary || this.includeCharts;
    let html = '';

    if (includeReportExtras) {
      html += `
        <div class="report-preview-header">
          <h2>${this.escapeHtml(this.reportData.title || 'Report')}</h2>
          ${this.reportData.period ? `<p>${this.escapeHtml(this.reportData.period)}</p>` : ''}
        </div>
      `;
    }

    if (this.includeSummary && this.reportData.summary) {
      html += this.renderSummary(this.reportData.summary);
    }

    if (includeReportExtras && Array.isArray(this.reportData.notices) && this.reportData.notices.length) {
      html += this.renderNotices(this.reportData.notices);
    }

    if (this.includeCharts && this.reportData.chart && this.reportData.chart.length) {
      html += this.renderChart(this.reportData.chart);
    }

    return html + this.renderReportTable();
  },

  renderReportTable() {
    const rows = this.reportData.rows || [];
    const headers = this.reportData.headers || [];
    const hasRows = rows.length > 0;
    const itemText = rows.length === 1 ? 'item' : 'items';
    const tableClass = this.isSalesReport() ? 'report-preview-table report-sales-table' : 'report-preview-table';

    let html = `
      <div class="report-table-card">
        <div class="report-table-toolbar">
          <span>Showing ${this.formatNumber(rows.length)} of ${this.formatNumber(rows.length)} ${itemText}</span>
        </div>
        <div class="report-table-wrap">
          <table class="${tableClass}">
            <thead>
              <tr>
                ${headers.map(header => `<th>${this.escapeHtml(header)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
    `;

    if (hasRows) {
      rows.forEach(row => {
        html += '<tr>';
        row.forEach((cell, index) => {
          const header = headers[index] || '';
          html += `<td class="${this.getReportCellClass(header)}">${this.renderReportCell(cell, header)}</td>`;
        });
        html += '</tr>';
      });
    } else {
      html += `<tr><td colspan="${headers.length || 1}" class="report-empty-cell">No records found for the selected date range.</td></tr>`;
    }

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    return html;
  },

  renderReportCell(value, header = '') {
    const text = this.escapeHtml(value);
    const normalizedHeader = String(header).toLowerCase();

    if (normalizedHeader === 'sale number') {
      return `<span class="report-sale-number">${text}</span>`;
    }

    if (normalizedHeader === 'category') {
      return String(value || '')
        .split(';')
        .map(category => category.trim())
        .filter(Boolean)
        .map(category => `<span class="report-category-pill">${this.escapeHtml(category)}</span>`)
        .join('') || '<span class="report-muted-value">Uncategorized</span>';
    }

    if (normalizedHeader === 'payment method') {
      return `<span class="report-payment-pill">${text || 'N/A'}</span>`;
    }

    if (normalizedHeader === 'status') {
      return `<span class="report-status-pill">${text || 'N/A'}</span>`;
    }

    return text;
  },

  renderSummary(summary) {
    let html = '<div class="report-preview-summary">';
    Object.entries(summary).forEach(([key, value]) => {
      html += `
        <div class="summary-item">
          <div class="label">${this.escapeHtml(this.labelize(key))}</div>
          <div class="value">${this.escapeHtml(this.formatSummaryValue(value, key))}</div>
        </div>
      `;
    });
    html += '</div>';
    return html;
  },

  renderNotices(notices) {
    return `
      <div class="report-integrity-notice" role="status">
        <strong>Data availability</strong>
        <ul>
          ${notices.map(notice => `<li>${this.escapeHtml(notice)}</li>`).join('')}
        </ul>
      </div>
    `;
  },

  renderChart(chartData) {
    const max = Math.max(...chartData.map(item => this.toNumber(item.value)), 1);
    return `
      <div class="report-chart-container">
        ${chartData.slice(0, 8).map(item => {
          const value = this.toNumber(item.value);
          return `
            <div class="report-chart-row">
              <span>${this.escapeHtml(item.label)}</span>
              <div class="report-chart-track"><div style="width:${Math.max((value / max) * 100, 4)}%"></div></div>
              <strong>${this.escapeHtml(this.formatCompactNumber(value))}</strong>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  closePreview() {
    const modal = document.getElementById('report-preview-modal');
    if (modal) modal.style.display = 'none';
  },

  async downloadReport() {
    if (!this.reportData) return;

    try {
      if (this.format === 'pdf') {
        await this.downloadPdfReport();
        return;
      }

      const content = this.buildCSV();
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.getReportFileBaseName()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      this.showNotification('Report downloaded successfully', 'success');
    } catch (error) {
      console.error('Report download failed:', error);
      this.showNotification(error.message || 'Report download failed', 'error');
    }
  },

  async downloadPdfReport() {
    const pdfExporter = window.electronAPI?.exportReportPdf || window.electronAPI?.exportDocumentPdf;
    if (typeof pdfExporter !== 'function') {
      throw new Error('PDF download is unavailable');
    }

    const result = await pdfExporter({
      documentNumber: this.getReportFileBaseName(),
      html: this.buildPdfReportHtml(),
      fullHtml: true,
      landscape: true
    });

    if (result?.canceled) return;
    if (!result || result.success === false) {
      throw new Error(result?.error || 'PDF download failed');
    }

    this.showNotification('PDF report downloaded successfully', 'success');
  },

  buildPdfReportHtml() {
    const title = this.escapeHtml(this.reportData?.title || 'Report');
    return `<!doctype html>
<html>
<head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { margin: 0; background: #ffffff; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
        .report-pdf-root { width: 100%; }
        .report-preview-header { padding: 0 0 14px; text-align: center; }
        .report-preview-header h2 { margin: 0; color: #0f172a; font-size: 18px; font-weight: 800; }
        .report-preview-header p { margin: 5px 0 0; color: #64748b; font-size: 10px; }
        .report-preview-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 12px; }
        .summary-item { padding: 9px; border: 1px solid #e2e8f0; border-radius: 6px; }
        .summary-item .label { margin-bottom: 5px; color: #64748b; font-size: 7px; font-weight: 800; text-transform: uppercase; }
        .summary-item .value { color: #0f172a; font-size: 12px; font-weight: 800; }
        .report-integrity-notice { margin-bottom: 12px; padding: 9px 10px; color: #7c2d12; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; font-size: 8px; }
        .report-chart-container { margin-bottom: 12px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; }
        .report-chart-row { display: grid; grid-template-columns: 115px 1fr 60px; gap: 8px; align-items: center; margin-bottom: 6px; color: #475569; font-size: 8px; }
        .report-chart-track { height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
        .report-chart-track > div { height: 100%; background: #2563eb; }
        .report-table-card { overflow: hidden; border: 1px solid #dbe2ea; border-radius: 7px; }
        .report-table-toolbar { padding: 8px 10px; color: #475569; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; }
        .report-table-wrap { overflow: visible; border: 0; }
        .report-preview-table { width: 100%; min-width: 0; border-collapse: collapse; table-layout: auto; }
        .report-preview-table th { padding: 7px 8px; color: #334155; text-align: left; white-space: nowrap; background: #f3f4f6; border-bottom: 1px solid #e2e8f0; font-size: 7px; font-weight: 800; text-transform: uppercase; }
        .report-preview-table td { padding: 7px 8px; color: #334155; border-bottom: 1px solid #edf2f7; font-size: 8px; vertical-align: top; }
        .report-preview-table tbody tr:nth-child(even) td { background: #fafafa; }
        .report-preview-table tbody tr:last-child td { border-bottom: 0; }
        .report-sale-number { color: #46658d; font-weight: 800; }
        .report-category-pill, .report-payment-pill, .report-status-pill { display: inline-block; margin: 0 3px 3px 0; padding: 3px 6px; border-radius: 6px; font-size: 7px; font-weight: 700; white-space: nowrap; }
        .report-category-pill { color: #46658d; background: #f1f5f9; }
        .report-payment-pill { color: #075985; background: #e0f2fe; }
        .report-status-pill { color: #047857; background: #d1fae5; }
        .report-empty-cell { padding: 22px !important; color: #94a3b8 !important; text-align: center !important; }
      </style>
</head>
<body>
      <section class="report-pdf-root">
        ${this.buildReportContentHtml()}
      </section>
    </body>
</html>
    `;
  },

  getReportFileBaseName() {
    const type = String(this.currentReportType || 'generated').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'generated';
    return `report-${type}-${new Date().toISOString().slice(0, 10)}`;
  },

  buildCSV() {
    const lines = [];
    const includeReportExtras = this.includeSummary || this.includeCharts;

    if (includeReportExtras) {
      lines.push([this.reportData.title || 'Report'].map(value => this.csvEscape(value)).join(','));
      if (this.reportData.period) lines.push(['Period', this.reportData.period].map(value => this.csvEscape(value)).join(','));
      lines.push([]);
    }

    if (includeReportExtras && Array.isArray(this.reportData.notices) && this.reportData.notices.length) {
      lines.push(['Data Availability'].map(value => this.csvEscape(value)).join(','));
      this.reportData.notices.forEach(notice => {
        lines.push(['Notice', notice].map(value => this.csvEscape(value)).join(','));
      });
      lines.push([]);
    }

    if (this.includeSummary && this.reportData.summary) {
      lines.push(['Summary', 'Value'].map(value => this.csvEscape(value)).join(','));
      Object.entries(this.reportData.summary).forEach(([key, value]) => {
        lines.push([this.labelize(key), this.formatSummaryValue(value, key)].map(item => this.csvEscape(item)).join(','));
      });
      lines.push([]);
    }

    lines.push((this.reportData.headers || []).map(value => this.csvEscape(value)).join(','));
    (this.reportData.rows || []).forEach(row => {
      lines.push(row.map(value => this.csvEscape(value)).join(','));
    });

    return lines.join('\n');
  },

  setReportLoading(card, isLoading) {
    if (!card) return;
    const buttonLabel = card.querySelector('.report-generate-btn');
    if (buttonLabel) buttonLabel.textContent = isLoading ? 'Generating...' : 'Generate';
    card.disabled = isLoading;
    card.classList.toggle('is-loading', isLoading);
  }
  });
  return ReportsView;
});
