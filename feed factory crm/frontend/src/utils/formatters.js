import { getLang } from './i18n';

// Arabic-Indic digit mapper
const arabicIndic = {
  '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
  '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩'
};

const toArabicIndic = (str) => {
  return String(str).replace(/[0-9]/g, d => arabicIndic[d] || d);
};

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'ج.م ٠';
  const num = Number(amount);
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const lang = getLang();
  const display = lang === 'ar' ? toArabicIndic(formatted) : formatted;
  return `ج.م ${display}`;
};

export const formatNumber = (num, options = {}) => {
  if (num === null || num === undefined || isNaN(num)) return '٠';
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: options.decimals || 0,
    maximumFractionDigits: options.decimals || 0,
    useGrouping: options.noCommas !== true,
  });
  const lang = getLang();
  return lang === 'ar' ? toArabicIndic(formatted) : formatted;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const formatted = `${day}/${month}/${year}`;
    const lang = getLang();
    return lang === 'ar' ? toArabicIndic(formatted) : formatted;
  } catch(e) {
    return dateStr;
  }
};

// Apply RTL direction based on language
export const applyDirection = (lang) => {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
  
  // Add/remove RTL class on body for CSS targeting
  if (lang === 'ar') {
    document.body.classList.add('rtl');
    document.body.classList.remove('ltr');
  } else {
    document.body.classList.add('ltr');
    document.body.classList.remove('rtl');
  }
};
