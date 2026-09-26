import { daysUntil } from "./dates";
import { fmt } from "./money";

export type DigestTask = { title: string; client: string; due: Date | null; status: string };

const MAX_BODY = 220;
const label = (t: DigestTask) => (t.client ? `${t.title} (${t.client})` : t.title);

export type DigestOwed = { total: number; clients: number; currency: string };

/**
 * The morning reminder: what is overdue, due today and due tomorrow, plus — on Sundays only — how much
 * clients still owe. Null when there is nothing to say, so quiet days send no notification.
 */
export function buildDigest(tasks: DigestTask[], today: Date, owed?: DigestOwed): { title: string; body: string; count: number } | null {
  const open = tasks.filter((t) => t.status !== "done" && t.due);
  const overdue = open.filter((t) => daysUntil(t.due, today)! < 0);
  const dueToday = open.filter((t) => daysUntil(t.due, today) === 0);
  const tomorrow = open.filter((t) => daysUntil(t.due, today) === 1);
  const count = overdue.length + dueToday.length + tomorrow.length;
  const owedLine = owed && owed.total > 0 && today.getDay() === 0
    ? `ليك ${fmt(owed.total)} ${owed.currency} عند ${owed.clients === 1 ? "عميل" : `${owed.clients} عملاء`}` : "";
  if (!count && !owedLine) return null;
  if (!count) return { title: "فلوسك عند العملاء", body: `${owedLine}. افتح «الفلوس» وشوف مين.`, count: 0 };

  const parts: string[] = [];
  if (overdue.length) parts.push(`متأخر: ${overdue.map(label).join("، ")}`);
  if (dueToday.length) parts.push(`النهارده: ${dueToday.map(label).join("، ")}`);
  if (tomorrow.length) parts.push(`بكرة: ${tomorrow.map(label).join("، ")}`);
  if (owedLine) parts.push(owedLine);
  let body = parts.join(" · ");
  if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY - 1).trimEnd() + "…";

  const title =
    overdue.length ? `عندك ${overdue.length === 1 ? "مهمة متأخرة" : `${overdue.length} مهام متأخرة`}` :
    dueToday.length ? `النهارده عندك ${dueToday.length === 1 ? "مهمة" : `${dueToday.length} مهام`}` :
    `بكرة عندك ${tomorrow.length === 1 ? "مهمة" : `${tomorrow.length} مهام`}`;
  return { title, body, count };
}

/**
 * The first-of-the-month notification: last month's income, spending and net profit, plus how the
 * income goal went when one is set.
 */
export function buildMonthly(monthLabel: string, t: { I: number; S: number; X: number; net: number }, goal: number | null, currency: string): { title: string; body: string } | null {
  if (!t.I && !t.S && !t.X) return null;
  const margin = t.I ? ` (هامش ${Math.round((t.net / t.I) * 100)}%)` : "";
  const net = t.net < 0 ? `خسارة ${fmt(-t.net)}` : `صافي ربحك ${fmt(t.net)}`;
  let body = `دخلك ${fmt(t.I)} ${currency}، وصرفت ${fmt(t.S + t.X)}، ف${net} ${currency}${t.net < 0 ? "" : margin}.`;
  if (goal) body += t.I >= goal ? " وصلت لهدف الشهر." : ` كان فاضل ${fmt(goal - t.I)} على الهدف.`;
  return { title: `ملخص ${monthLabel}`, body };
}
