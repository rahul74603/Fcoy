// ═══════════════════════════════════════════════════════════════════════
// LOCAL (INDIA) BUSINESS DATE HELPERS
// ───────────────────────────────────────────────────────────────────────
// `new Date().toISOString().split('T')[0]` returns a UTC date. Between
// midnight IST and 05:30 IST the UTC date is still "yesterday", which can
// shift attendance / leave / record dates by one day. These helpers format
// the date in the user's LOCAL wall-clock time, which for this app is the
// Indian business date.
// ═══════════════════════════════════════════════════════════════════════

/** Local calendar date as YYYY-MM-DD (no UTC shift). */
export function localDateISOString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format any date-like value to a local YYYY-MM-DD string (null-safe). */
export function toLocalDateInput(value: unknown): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value as string | number);
  if (isNaN(d.getTime())) return '';
  return localDateISOString(d);
}

/** Add whole days to a date and return a local YYYY-MM-DD string. */
export function addLocalDays(d: Date, days: number): string {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  return localDateISOString(next);
}
