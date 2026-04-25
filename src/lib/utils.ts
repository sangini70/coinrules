import { format } from 'date-fns';

export const formatCurrency = (value: number | null | undefined) => {
  const safeValue = Number.isFinite(value as number) ? Number(value) : 0;
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(safeValue);
};

export const formatPrice = (value: number | null | undefined) => {
  const safeValue = Number.isFinite(value as number) ? Number(value) : 0;
  if (safeValue < 100) return safeValue.toFixed(2);
  return safeValue.toLocaleString();
};

export const formatPercent = (value: number | null | undefined) => {
  const safeValue = Number.isFinite(value as number) ? Number(value) : 0;
  return `${safeValue > 0 ? '+' : ''}${safeValue.toFixed(2)}%`;
};

export const formatDate = (date: string | Date, pattern = 'yyyy-MM-dd HH:mm:ss') => {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return '-';
  return format(parsedDate, pattern);
};
