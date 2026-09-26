/** Saturday-first week, as calendars in Egypt and the Gulf usually are. */
export const WEEK_START = 6;
export const WEEK_DAYS = ["السبت", "الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة"];

/** Weeks of the month as rows of 7 cells; days outside the month are null. */
export function monthGrid(month: string, weekStart = WEEK_START): (Date | null)[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() - weekStart + 7) % 7;
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(y, m - 1, i + 1))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}
