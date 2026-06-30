export const money = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

export const brandText = (value, fallback = '') => {
  const source = value == null || value === '' ? fallback : value;
  return String(source || '').replace(/\bPLUGIN\b/g, 'Plugin');
};

export const dateTime = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const shortTime = (value) => {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export const minutesSeconds = (seconds = 0) => {
  const total = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(total / 60);
  const rest = Math.floor(total % 60);
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
};

export const pageItems = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  return [];
};

export const firstName = (name) => String(name || 'Driver').trim().split(/\s+/)[0] || 'Driver';

export const statusTone = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (['AVAILABLE', 'CONFIRMED', 'COMPLETED', 'PAID', 'ACTIVE'].includes(normalized)) return 'success';
  if (['PENDING', 'UNPAID', 'MODIFIED'].includes(normalized)) return 'warning';
  if (['CANCELLED', 'OUT_OF_SERVICE', 'UNAVAILABLE', 'FAILED'].includes(normalized)) return 'danger';
  return 'neutral';
};

export const toLocalDateTime = (date) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const dateInputValue = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const timeInputValue = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const parseLocalDateTime = (date, time) => {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
