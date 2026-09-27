export type AdminUser = { createdAt: Date; lastSeenAt: Date | null; suspendedAt: Date | null; tasks: number; entries: number; files: number; bytes: number };

const DAY = 86_400_000;

/** Headline numbers for the admin page, from per-account counts only (never anyone's content). */
export function adminStats(users: AdminUser[], at: Date) {
  const since = (d: Date | null, days: number) => !!d && at.getTime() - d.getTime() < days * DAY;
  return {
    users: users.length,
    new30: users.filter((u) => since(u.createdAt, 30)).length,
    active1: users.filter((u) => since(u.lastSeenAt, 1)).length,
    active7: users.filter((u) => since(u.lastSeenAt, 7)).length,
    suspended: users.filter((u) => u.suspendedAt).length,
    tasks: users.reduce((s, u) => s + u.tasks, 0),
    entries: users.reduce((s, u) => s + u.entries, 0),
    files: users.reduce((s, u) => s + u.files, 0),
    bytes: users.reduce((s, u) => s + u.bytes, 0),
  };
}

/** 1.4 MB / 820 KB / 0 */
export function humanBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return String(n);
}

/** «النهارده» / «امبارح» / «من ٥ أيام» / «من شهرين» / «لسه» — how long since an account was last used. */
export function lastSeen(d: Date | null, at: Date): string {
  if (!d) return "لسه متسجّلش نشاط";
  const days = Math.floor((at.getTime() - d.getTime()) / DAY);
  if (days < 1) return "النهارده";
  if (days < 2) return "امبارح";
  if (days < 3) return "من يومين";
  if (days < 11) return `من ${days} أيام`;
  if (days < 30) return `من ${days} يوم`;
  const m = Math.floor(days / 30);
  return m === 1 ? "من شهر" : m === 2 ? "من شهرين" : m <= 10 ? `من ${m} شهور` : `من ${m} شهر`;
}
