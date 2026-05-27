const DATE_TIME_OPTIONS = { dateStyle: 'medium', timeStyle: 'short' };

function normalizePeriod(text) {
  return text.replace(/\b(am|pm)\b/gi, (period) => period.toUpperCase());
}

function hasExplicitTimeZone(value) {
  return /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
}

export function parseScheduleDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T|\s)(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?/
  );

  if (match && !hasExplicitTimeZone(raw)) {
    const [, year, month, day, hour, minute, second = '0', fraction = '0'] = match;
    const millisecond = Number(fraction.padEnd(3, '0').slice(0, 3));
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      millisecond
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function parseInstantDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  const normalized = hasExplicitTimeZone(raw) ? raw : `${raw}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatScheduleDateTime(value, fallback = '-') {
  const date = parseScheduleDateTime(value);
  if (!date) return fallback;
  return normalizePeriod(date.toLocaleString('en-IN', DATE_TIME_OPTIONS));
}

export function formatInstantDateTime(value, fallback = '-') {
  const date = parseInstantDateTime(value);
  if (!date) return fallback;
  return normalizePeriod(date.toLocaleString('en-IN', DATE_TIME_OPTIONS));
}
