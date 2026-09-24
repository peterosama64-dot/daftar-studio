export const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export const AR_DAYS = ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];

/**
 * "Now" as a wall-clock Date in the studio's timezone (APP_TIMEZONE, default Africa/Cairo).
 * Servers run in UTC; without this, "today" flips a day early or late around midnight.
 */
export function now(tz = process.env.APP_TIMEZONE || "Africa/Cairo"): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return new Date(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar-day key in local time: "YYYY-MM-DD". */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "YYYY-MM" */
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

export function monthName(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${AR_MONTHS[m - 1]} ${y}`;
}

export function isMonthKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/** Whole calendar days from `today` to `due` (negative = overdue). */
export function daysUntil(due: Date | null | undefined, today: Date): number | null {
  if (!due) return null;
  const a = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86_400_000);
}

/** "25/9" */
export const shortDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;

/** Parse "YYYY-MM-DD" as a local calendar date; null when invalid. */
export function parseDay(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1 ? dt : null;
}
