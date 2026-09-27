import { clock, daysUntil } from "./dates";
import { fmt } from "./money";

export type DigestTask = { title: string; client: string; due: Date | null; status: string };

const MAX_BODY = 220;
const label = (t: DigestTask) => (t.client ? `${t.title} (${t.client})` : t.title);

export type DigestOwed = { total: number; clients: number; currency: string };
/** A planned payment that is due (today or overdue) and not marked paid. */
export type DigestDue = { label: string; title: string; client: string; amount: number };

/** A meeting today, with its time. */
export type DigestMeeting = { title: string; client: string; at: Date };

const cut = (s: string) => (s.length > MAX_BODY ? s.slice(0, MAX_BODY - 1).trimEnd() + "…" : s);

/**
 * The morning reminder: what is overdue, due today and due tomorrow, today's meetings, payments due, leads to
 * follow up and — on Sundays only — how much clients still owe. Null when there is nothing to say, so quiet
 * days send no notification. The title names the most pressing kind.
 */
export function buildDigest(tasks: DigestTask[], today: Date, owed?: DigestOwed, dues: DigestDue[] = [], follow: string[] = [], meets: DigestMeeting[] = []): { title: string; body: string; count: number } | null {
  const open = tasks.filter((t) => t.status !== "done" && t.due);
  const overdue = open.filter((t) => daysUntil(t.due, today)! < 0);
  const dueToday = open.filter((t) => daysUntil(t.due, today) === 0);
  const tomorrow = open.filter((t) => daysUntil(t.due, today) === 1);
  const count = overdue.length + dueToday.length + tomorrow.length;
  const owedLine = owed && owed.total > 0 && today.getDay() === 0
    ? `ليك ${fmt(owed.total)} ${owed.currency} عند ${owed.clients === 1 ? "عميل" : `${owed.clients} عملاء`}` : "";
  const meetLine = meets.length ? `مواعيدك: ${meets.map((m) => `${clock(m.at)} ${m.client && !m.title.includes(m.client) ? `${m.title} (${m.client})` : m.title}`).join("، ")}` : "";
  const duesLine = dues.length
    ? `دفعات مستحقة: ${dues.map((d) => `${d.label} ${d.client ? `${d.title} (${d.client})` : d.title} ${fmt(d.amount)}`).join("، ")}` : "";
  const followLine = follow.length ? `تابع مع: ${follow.join("، ")}` : "";
  if (!count && !meetLine && !duesLine && !followLine) {
    return owedLine ? { title: "فلوسك عند العملاء", body: `${owedLine}. افتح «الفلوس» وشوف مين.`, count: 0 } : null;
  }

  const parts: string[] = [];
  if (overdue.length) parts.push(`متأخر: ${overdue.map(label).join("، ")}`);
  if (dueToday.length) parts.push(`النهارده: ${dueToday.map(label).join("، ")}`);
  if (tomorrow.length) parts.push(`بكرة: ${tomorrow.map(label).join("، ")}`);
  for (const l of [meetLine, duesLine, followLine, owedLine]) if (l) parts.push(l);

  const title =
    overdue.length ? `عندك ${overdue.length === 1 ? "مهمة متأخرة" : `${overdue.length} مهام متأخرة`}` :
    dueToday.length ? `النهارده عندك ${dueToday.length === 1 ? "مهمة" : `${dueToday.length} مهام`}` :
    tomorrow.length ? `بكرة عندك ${tomorrow.length === 1 ? "مهمة" : `${tomorrow.length} مهام`}` :
    meets.length ? `النهارده عندك ${meets.length === 1 ? "ميعاد" : `${meets.length} مواعيد`}` :
    dues.length ? (dues.length === 1 ? "عندك دفعة مستحقة" : `عندك ${dues.length} دفعات مستحقة`) :
    follow.length === 1 ? "عندك عميل محتاج متابعة" : `عندك ${follow.length} عملاء محتاجين متابعة`;
  return { title, body: cut(parts.join(" · ")), count };
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
