import { t } from './i18n';

// ─── Number & Currency Formatting ────────────────────────────────────────────
//
// STANDARD (decided 2026-06-22, applies system-wide):
//   Currency  →  "1,234.00 EGP"   Western digits, comma-thousands,
//                                  period-decimal, symbol AFTER with a space
//   Numbers   →  "1,234"          Western digits, comma-thousands
//   Dates     →  "DD/MM/YYYY"     Western digits, fixed format
//
// Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and ج.م prefix are deliberately NOT used.
// The system UI is Arabic but numbers/currency display in the international
// format familiar to Egyptian business users.

// Currency: "1,234.00 EGP"
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0.00 EGP';
  const num = Number(amount);
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${formatted} EGP`;
};

// Plain number: "1,234" or "1,234.56" with optional decimal places
export const formatNumber = (num, options = {}) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: options.decimals || 0,
    maximumFractionDigits: options.decimals || 0,
    useGrouping: options.noCommas !== true,
  });
};

// Date: "DD/MM/YYYY" — always Western digits, always this format
export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day   = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year  = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
};

// Status label: resolves a raw DB status enum through i18n
// Checks a page-specific namespace first (e.g. 'hr' for attendance),
// then falls back to common.statuses.*, then to the raw value itself.
// Added 2026-06-21 — see delivery of getStatusLabel fix.
export const getStatusLabel = (status, namespace = null) => {
  if (!status) return '';
  if (namespace) {
    const nsKey = `${namespace}.${status}`;
    const nsResult = t(nsKey);
    if (nsResult !== nsKey) return nsResult;
  }
  const commonKey = `common.statuses.${status}`;
  const commonResult = t(commonKey);
  return commonResult !== commonKey ? commonResult : status;
};

// RTL direction helper
export const applyDirection = (lang) => {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
  if (lang === 'ar') {
    document.body.classList.add('rtl');
    document.body.classList.remove('ltr');
  } else {
    document.body.classList.add('ltr');
    document.body.classList.remove('rtl');
  }
};
