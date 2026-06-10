export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'ج.م 0.00';
  return `ج.م ${Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

export const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-GB');
};

export const formatPercentage = (value) => {
  if (value === null || value === undefined) return '0%';
  return `${Number(value).toFixed(2)}%`;
};
