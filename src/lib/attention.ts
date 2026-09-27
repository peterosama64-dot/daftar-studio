import { clock, daysUntil } from "./dates";

export type AttnItem = { key: string; text: string; href: string; tone: "urgent" | "waiting" | "later"; days: number };

export type AttnInput = {
  today: Date;
  duePayments: { id: string; taskId: string; label: string; title: string; amount: number; due: Date }[];
  followUps: { id: string; name: string; nextAt: Date }[];
  reviews: { id: string; title: string; client: string; approvedAt: Date | null; lastDelivery: Date | null; lastClientRevision: Date | null; nudgedAt?: Date | null }[];
  doneUnpaid: { id: string; title: string; remaining: number; doneAt: Date }[];
  overBudget: string[];
  /** Quotes and contracts the client hasn't answered for WAIT_DAYS or more (delivered work is in `reviews`). */
  waiting?: { key: string; label: string; title: string; client: string; days: number }[];
  /** Meetings still ahead today. */
  meetings?: { id: string; title: string; client: string; at: Date }[];
  fmt: (n: number) => string;
};

const ago = (d: Date, today: Date) => Math.max(0, -(daysUntil(d, today) ?? 0));
const days = (n: number) => (n === 0 ? "النهارده" : n === 1 ? "من امبارح" : n === 2 ? "من يومين" : n <= 10 ? `من ${n} أيام` : `من ${n} يوم`);

/**
 * The home page's «محتاج منك» list: what is waiting on the user right now, most pressing first.
 * A client's revision request counts until a newer delivery is uploaded; delivered work nags after
 * 3 days without a reply; finished-but-unpaid jobs after 7 days.
 */
export function attentionItems(i: AttnInput, max = 8): AttnItem[] {
  const out: AttnItem[] = [];
  // Today's meetings lead the list: they happen at a set time whatever else is waiting.
  for (const m of i.meetings ?? []) {
    const soon = m.at.getTime() - i.today.getTime() <= 60 * 60_000;
    out.push({ key: `meet-${m.id}`, text: `ميعاد الساعة ${clock(m.at)}: ${m.title}${m.client && !m.title.includes(m.client) ? ` مع ${m.client}` : ""}`, href: "/app/meetings", tone: soon ? "urgent" : "later", days: 1001 - (m.at.getHours() * 60 + m.at.getMinutes()) / 1440 });
  }
  for (const r of i.reviews) {
    if (r.lastClientRevision && (!r.lastDelivery || r.lastClientRevision > r.lastDelivery)) {
      const n = ago(r.lastClientRevision, i.today);
      out.push({ key: `rev-${r.id}`, text: `${r.client || "العميل"} طلب تعديل في «${r.title}» ${days(n)}`, href: `/app/tasks/${r.id}`, tone: "urgent", days: n + 100 });
    } else if (!r.approvedAt && r.lastDelivery) {
      const n = ago(r.nudgedAt && r.nudgedAt > r.lastDelivery ? r.nudgedAt : r.lastDelivery, i.today);
      if (n >= 3) out.push({ key: `wait-${r.id}`, text: `مستني رد ${r.client || "العميل"} على «${r.title}» ${days(n)}`, href: "/app/waiting", tone: "later", days: n });
    }
  }
  for (const p of i.duePayments) {
    const n = ago(p.due, i.today);
    out.push({ key: `pay-${p.id}`, text: `دفعة «${p.label}» من «${p.title}» مستحقة${n ? ` ${days(n)}` : " النهارده"} (${i.fmt(p.amount)})`, href: `/app/tasks/${p.taskId}`, tone: "waiting", days: n + 50 });
  }
  for (const l of i.followUps) {
    const n = ago(l.nextAt, i.today);
    out.push({ key: `lead-${l.id}`, text: `تابع مع ${l.name}${n ? ` (متأخر ${n === 1 ? "يوم" : n === 2 ? "يومين" : `${n} ${n <= 10 ? "أيام" : "يوم"}`})` : ""}`, href: "/app/leads", tone: "later", days: n + 20 });
  }
  for (const t of i.doneUnpaid) {
    const n = ago(t.doneAt, i.today);
    if (n >= 7) out.push({ key: `owed-${t.id}`, text: `خلصت «${t.title}» ${days(n)} ولسه فاضل ${i.fmt(t.remaining)}`, href: `/app/tasks/${t.id}`, tone: "waiting", days: n + 10 });
  }
  for (const w of i.waiting ?? []) {
    out.push({ key: `waitc-${w.key}`, text: `مستني رد ${w.client || "العميل"} على ${w.label} «${w.title}» ${days(w.days)}`, href: "/app/waiting", tone: "later", days: w.days });
  }
  for (const c of i.overBudget) out.push({ key: `budget-${c}`, text: `عدّيت ميزانية «${c}» الشهر ده`, href: "/app/money", tone: "urgent", days: 30 });
  return out.sort((a, b) => b.days - a.days).slice(0, max);
}
