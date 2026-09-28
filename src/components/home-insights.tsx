import Link from "next/link";
import { prisma, userRow } from "@/lib/db";
import { loadFx } from "@/lib/data";
import { fmt, monthTotals, signed, type EntryLike } from "@/lib/money";
import { AR_MONTHS, monthKey, shiftMonth, shortDate } from "@/lib/dates";
import { expectedIncome } from "@/lib/forecast";
import { attentionItems } from "@/lib/attention";
import { loadWaiting } from "@/lib/waiting-data";
import { taskDue } from "@/lib/invoice";
import { WAIT_DAYS, waitingList } from "@/lib/waiting";
import { parseBudgets, spendByCategory } from "@/lib/categories";
import { Card, Pill, SectionHead } from "./ui";

type E = EntryLike & { category: string | null };
type T = { id: string; title: string; status: string; agreed: number | null; paid: number | null; doneAt: Date | null; currency: string | null };

const monthName = (k: string) => AR_MONTHS[Number(k.slice(5, 7)) - 1];

/** «محتاج منك» (what's waiting on you) and «توقع الفلوس» (where this month and next will land). */
export async function HomeInsights({ uid, today, entries, tasks }: { uid: string; today: Date; entries: E[]; tasks: T[] }) {
  const now = monthKey(today), next = shiftMonth(now, 1);
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const [fx, user, duePay, leads, reviews, open, jobs, meetings, waits] = await Promise.all([
    loadFx(uid),
    userRow(uid),
    prisma.installment.findMany({ where: { userId: uid, paidAt: null, due: { not: null, lt: endOfToday } }, include: { task: { select: { title: true, currency: true } } }, orderBy: { due: "asc" }, take: 10 }),
    prisma.lead.findMany({ where: { userId: uid, status: { in: ["new", "quoted", "waiting"] }, nextAt: { not: null, lt: endOfToday } }, select: { id: true, name: true, nextAt: true }, take: 10 }),
    prisma.task.findMany({
      where: { userId: uid, OR: [{ reviewToken: { not: null } }, { revisions: { some: { by: "client" } } }] },
      select: { id: true, title: true, client: true, approvedAt: true, nudgedAt: true, deliveries: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 }, revisions: { where: { by: "client" }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
      take: 50, orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: { userId: uid, agreed: { gt: 0 } },
      select: { id: true, title: true, client: true, agreed: true, paid: true, discount: true, taxRate: true, due: true, status: true, recurringId: true, currency: true, installments: { select: { amount: true, due: true, paidAt: true }, orderBy: { position: "asc" } } },
    }),
    prisma.recurringJob.findMany({ where: { userId: uid, active: true } }),
    prisma.meeting.findMany({ where: { userId: uid, at: { gte: today, lt: endOfToday } }, select: { id: true, title: true, client: true, at: true }, orderBy: { at: "asc" }, take: 5 }),
    loadWaiting(uid),
  ]);
  const items = attentionItems({
    today, fmt: (n) => `${fmt(n)} ${fx.short(null)}`,
    duePayments: duePay.map((p) => ({ id: p.id, taskId: p.taskId, label: p.label, title: p.task.title, amount: fx.toBase(p.amount, p.task.currency), due: p.due! })),
    followUps: leads.map((l) => ({ id: l.id, name: l.name, nextAt: l.nextAt! })),
    reviews: reviews.map((r) => ({ id: r.id, title: r.title, client: r.client, approvedAt: r.approvedAt, lastDelivery: r.deliveries[0]?.createdAt ?? null, lastClientRevision: r.revisions[0]?.createdAt ?? null, nudgedAt: r.nudgedAt })),
    doneUnpaid: tasks.filter((t) => t.status === "done" && t.doneAt && t.agreed && taskDue(t) > (t.paid ?? 0))
      .map((t) => ({ id: t.id, title: t.title, remaining: fx.toBase(taskDue(t) - (t.paid ?? 0), t.currency), doneAt: t.doneAt! })),
    meetings,
    waiting: waitingList(waits.filter((w) => w.kind !== "delivery"), today).filter((w) => w.days >= WAIT_DAYS)
      .map((w) => ({ key: w.kind + w.id, label: w.kind === "contract" ? "الاتفاق" : "عرض السعر", title: w.title, client: w.client, days: w.days })),
    overBudget: spendByCategory(entries, now, parseBudgets(user?.budgets)).filter((r) => r.over).map((r) => r.label),
  });

  const fc = expectedIncome(open, jobs, now, next, (a, t) => fx.toBase(a, t?.currency ?? null));
  const cur = monthTotals(entries, now), nxt = monthTotals(entries, next);
  const landNow = cur.I + fc.totalNow - cur.S - cur.X;
  const landNext = fc.totalNext - nxt.S;
  const c = fx.short(null);
  const upcoming = [...fc.now, ...fc.next].filter((x) => !x.date || x.date >= new Date(today.getFullYear(), today.getMonth(), today.getDate())).slice(0, 5);
  const overdueNow = fc.now.filter((x) => x.date && x.date < new Date(today.getFullYear(), today.getMonth(), today.getDate())).reduce((s, x) => s + x.amount, 0);
  const line = (k: string, v: number, cls = "") => (
    <div className="flex justify-between gap-3 text-sm"><span className="text-muted">{k}</span><span className={`num ${cls}`}>{signed(v)}</span></div>
  );
  const hasForecast = fc.totalNow || fc.totalNext || cur.I || cur.S || cur.X;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section aria-label="محتاج منك">
        <SectionHead title="محتاج منك" count={items.length} rule="risk" />
        {items.length ? (
          <ul className="grid gap-2">
            {items.map((x) => (
              <li key={x.key}>
                <Link href={x.href} className="flex items-center gap-2 rounded-xl border border-rule bg-sheet px-3 py-2.5 text-sm hover:border-cyan">
                  <span className={`size-2 shrink-0 rounded-full ${x.tone === "urgent" ? "bg-risk" : x.tone === "waiting" ? "bg-wait" : "bg-cyan"}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{x.text}</span>
                  <span className="text-muted" aria-hidden="true">‹</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="rounded-xl border border-dashed border-rule px-4 py-3 text-sm text-muted">مفيش حاجة مستنياك. 👌</p>}
      </section>
      {hasForecast ? (
        <Card className="grid gap-4 p-5" aria-labelledby="fc-h">
          <h2 id="fc-h" className="text-lg font-bold">توقع الفلوس</h2>
          <div className="grid gap-1.5">
            <p className="font-semibold">{monthName(now)} <span className="text-xs font-normal text-muted">(الشهر ده)</span></p>
            {line("اتقبض", cur.I, "text-money")}
            {line("لسه جاي", fc.totalNow)}
            {line("اشتراكات ومصاريف", -(cur.S + cur.X))}
            <div className="flex justify-between gap-3 border-t border-rule pt-1.5 font-semibold"><span>هتقفل على حوالي</span><span><span className={`num ${landNow < 0 ? "text-risk" : "text-money"}`}>{signed(landNow)}</span> {c}</span></div>
            {overdueNow > 0 && <p className="text-[0.8125rem] text-wait">منهم {fmt(overdueNow)} {c} ميعادهم عدّى — فكّر العملاء.</p>}
          </div>
          <div className="grid gap-1.5">
            <p className="font-semibold">{monthName(next)} <span className="text-xs font-normal text-muted">(الجاي)</span></p>
            {line("متوقع يدخل", fc.totalNext)}
            {line("اشتراكات", -nxt.S)}
            <div className="flex justify-between gap-3 border-t border-rule pt-1.5 font-semibold"><span>حوالي</span><span><span className={`num ${landNext < 0 ? "text-risk" : ""}`}>{signed(landNext)}</span> {c}</span></div>
          </div>
          {upcoming.length > 0 && (
            <ul className="grid gap-1 border-t border-rule pt-3 text-sm">
              {upcoming.map((x, i) => (
                <li key={i} className="flex items-center gap-2">
                  {x.date ? <Pill mono>{shortDate(x.date)}</Pill> : <Pill>من غير ميعاد</Pill>}
                  {x.href ? <Link href={x.href} className="min-w-0 flex-1 truncate hover:text-cyan">{x.title}{x.client ? ` · ${x.client}` : ""}</Link>
                    : <span className="min-w-0 flex-1 truncate">{x.title}{x.client ? ` · ${x.client}` : ""} <span className="text-xs text-muted">(شهري)</span></span>}
                  <span className="num text-muted">{fmt(x.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {fc.totalUnscheduled > 0 && <p className="text-[0.8125rem] text-muted">وفيه {fmt(fc.totalUnscheduled)} {c} على شغل من غير ميعاد — حط مواعيد أو دفعات عشان تدخل في التوقع.</p>}
        </Card>
      ) : null}
    </div>
  );
}
