import { getLang } from './i18n';

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return getLang() === 'ar' ? 'ج.م ٠' : 'ج.م 0.00';
  }
  const num = Number(amount);
  const formatted = num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `ج.م ${formatted}`;
};

export const formatNumber = (num, options = {}) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const lang = getLang();
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
  const opts = {
    minimumFractionDigits: options.decimals || 0,
    maximumFractionDigits: options.decimals || 0,
    useGrouping: options.noCommas !== true,
  };
  try {
    return num.toLocaleString(locale, opts);
  } catch(e) {
    return num.toLocaleString('en-US', opts);
  }
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const lang = getLang();
  try {
    return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
  } catch(e) {
    return dateStr;
  }
};
