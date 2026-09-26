import { daysUntil } from "./dates";

export type DigestTask = { title: string; client: string; due: Date | null; status: string };

const MAX_BODY = 220;
const label = (t: DigestTask) => (t.client ? `${t.title} (${t.client})` : t.title);

/**
 * The morning reminder: what is overdue, due today and due tomorrow. Null when there is nothing to say,
 * so quiet days send no notification.
 */
export function buildDigest(tasks: DigestTask[], today: Date): { title: string; body: string; count: number } | null {
  const open = tasks.filter((t) => t.status !== "done" && t.due);
  const overdue = open.filter((t) => daysUntil(t.due, today)! < 0);
  const dueToday = open.filter((t) => daysUntil(t.due, today) === 0);
  const tomorrow = open.filter((t) => daysUntil(t.due, today) === 1);
  const count = overdue.length + dueToday.length + tomorrow.length;
  if (!count) return null;

  const parts: string[] = [];
  if (overdue.length) parts.push(`متأخر: ${overdue.map(label).join("، ")}`);
  if (dueToday.length) parts.push(`النهارده: ${dueToday.map(label).join("، ")}`);
  if (tomorrow.length) parts.push(`بكرة: ${tomorrow.map(label).join("، ")}`);
  let body = parts.join(" · ");
  if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY - 1).trimEnd() + "…";

  const title =
    overdue.length ? `عندك ${overdue.length === 1 ? "مهمة متأخرة" : `${overdue.length} مهام متأخرة`}` :
    dueToday.length ? `النهارده عندك ${dueToday.length === 1 ? "مهمة" : `${dueToday.length} مهام`}` :
    `بكرة عندك ${tomorrow.length === 1 ? "مهمة" : `${tomorrow.length} مهام`}`;
  return { title, body, count };
}
