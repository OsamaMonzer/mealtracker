// Date helpers. Dates are plain 'YYYY-MM-DD' strings in the user's local time —
// never use toISOString() for "today", that is UTC (wrong before 8am in Malaysia).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDateStr = (s) => typeof s === 'string' && DATE_RE.test(s);

// Browser: local date of the device.
export function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Server: today in APP_TIMEZONE (defaults to Malaysia).
export function todayInTz(tz = process.env.APP_TIMEZONE || 'Asia/Kuala_Lumpur') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// 'YYYY-MM-DD' + n days → 'YYYY-MM-DD' (timezone-independent).
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
