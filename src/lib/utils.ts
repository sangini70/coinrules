import { format } from 'date-fns';

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(value);
};

export const formatPrice = (value: number) => {
  if (value < 100) return value.toFixed(2);
  return value.toLocaleString();
};

export const formatPercent = (value: number) => {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

export const formatDate = (date: string | Date, pattern = 'yyyy-MM-dd HH:mm:ss') => {
  return format(new Date(date), pattern);
};
