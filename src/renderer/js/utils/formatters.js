/**
 * Formatters
 * Provides renderer formatters helpers.
 */

(function(global) {
  const state = {
    currency: 'MWK',
    currencySymbol: 'K',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24-hour',
    timezone: 'Africa/Blantyre',
    taxName: 'VAT'
  };

  function normalizeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function normalizeCurrencyCode(value) {
    return 'MWK';
  }

  function getCurrencySymbol(currency, fallback = '') {
    return 'K';
  }

  function configure(settings = {}) {
    state.currency = normalizeCurrencyCode(settings.currency || state.currency);
    state.currencySymbol = getCurrencySymbol(state.currency, settings.currency_symbol);
    state.dateFormat = settings.date_format || state.dateFormat;
    state.timeFormat = settings.time_format || state.timeFormat;
    state.timezone = settings.timezone || state.timezone;
    state.taxName = settings.tax_name || state.taxName;
    return getSettings();
  }

  function getSettings() {
    return { ...state };
  }

  function formatNumber(value, options = {}) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: options.minimumFractionDigits ?? 2,
      maximumFractionDigits: options.maximumFractionDigits ?? 2
    }).format(normalizeNumber(value));
  }

  function formatCurrency(value, options = {}) {
    return `${state.currencySymbol}${formatNumber(value, options)}`;
  }

  function formatCompactCurrency(value) {
    const number = normalizeNumber(value);
    const absolute = Math.abs(number);
    let scaled = number;
    let suffix = '';

    if (absolute >= 1000000) {
      scaled = number / 1000000;
      suffix = 'm';
    } else if (absolute >= 1000) {
      scaled = number / 1000;
      suffix = 'k';
    }

    const decimals = Number.isInteger(scaled) ? 0 : 1;
    return `${state.currencySymbol}${formatNumber(scaled, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })}${suffix}`;
  }

  function toDate(value) {
    if (value instanceof Date) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getDateParts(value) {
    const date = toDate(value);
    if (!date) return null;
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: state.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date);
      return Object.fromEntries(parts.map(part => [part.type, part.value]));
    } catch {
      return {
        year: String(date.getFullYear()),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        day: String(date.getDate()).padStart(2, '0')
      };
    }
  }

  function formatDate(value) {
    const parts = getDateParts(value);
    if (!parts) return 'N/A';
    return state.dateFormat
      .replace(/YYYY/g, parts.year)
      .replace(/MM/g, parts.month)
      .replace(/DD/g, parts.day);
  }

  function formatTime(value) {
    const date = toDate(value);
    if (!date) return 'N/A';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: state.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: state.timeFormat !== '24-hour'
      }).format(date);
    } catch {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: state.timeFormat !== '24-hour'
      });
    }
  }

  function formatDateTime(value) {
    return `${formatDate(value)} ${formatTime(value)}`;
  }

  const api = {
    configure,
    getSettings,
    normalizeCurrencyCode,
    getCurrencySymbol,
    formatNumber,
    formatCurrency,
    formatCompactCurrency,
    formatDate,
    formatTime,
    formatDateTime
  };
  Object.defineProperties(api, {
    currencySymbol: { enumerable: true, get: () => state.currencySymbol },
    currencyCode: { enumerable: true, get: () => state.currency },
    taxLabel: { enumerable: true, get: () => state.taxName },
    timezone: { enumerable: true, get: () => state.timezone }
  });

  global.AppFormatters = Object.freeze(api);
  global.formatCurrency = formatCurrency;
})(typeof window !== 'undefined' ? window : globalThis);
