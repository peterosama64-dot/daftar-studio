import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma, userRow } from "@/lib/db";
import { loadFx, loadMonth, monthFrom, type SP } from "@/lib/data";
import { fmt, monthTotals } from "@/lib/money";
import { AR_MONTHS, monthKey, shiftMonth } from "@/lib/dates";
import { taskDue } from "@/lib/invoice";
import { goalAdvice, goalGap, goalPace, goalProgress } from "@/lib/goal";
import { PageHead } from "@/components/month";
import { Button, Card, Empty, Pill, inputClass } from "@/components/ui";
import { setGoal } from "../actions";

export const metadata = { title: "هدف الشهر" };

const monthLabel = (k: string) => AR_MONTHS[Number(k.slice(5, 7)) - 1];

export default async function Goal({ searchParams }: { searchParams: SP }) {
  const uid = await requireUser();
  const month = await monthFrom(searchParams);
  const [{ entries, totals, cur, today }, user, fx] = await Promise.all([loadMonth(month, uid), userRow(uid), loadFx(uid)]);
  const goal = user?.incomeGoal ?? null;
  const [jobs, quotes] = await Promise.all([
    prisma.task.findMany({ where: { userId: uid, agreed: { gt: 0 } }, select: { agreed: true, paid: true, discount: true, taxRate: true, status: true, currency: true } }),
    prisma.quote.findMany({ where: { userId: uid, status: "draft", sharedAt: { not: null } }, select: { items: true, currency: true } }),
  ]);
  const money = (n: number) => `${fmt(n)} ${cur.short}`;

  if (!goal) {
    return (
      <>
        <PageHead title="هدف الشهر" base="/app/goal" month={month} />
        <Card className="grid gap-3 p-5">
          <p className="font-display text-lg font-semibold">حط هدف لدخلك كل شهر</p>
          <p className="text-sm text-muted">والدفتر يقولك وصلت لفين، وإنت قدام ولا وراء، وإيه اللي في إيدك يوصّلك للباقي.</p>
          <form action={setGoal} className="flex flex-wrap items-center gap-2">
            <input name="goal" inputMode="decimal" placeholder="مثلاً 15,000" aria-label="هدف الدخل الشهري" className={`${inputClass} num w-40 text-left`} />
            <Button>حط الهدف</Button>
          </form>
        </Card>
      </>
    );
  }

  const remaining = (t: { agreed: number | null; paid: number | null; discount?: number | null; taxRate?: number | null; currency: string | null }) =>
    fx.toBase(Math.max(0, taskDue(t) - (t.paid ?? 0)), t.currency);
  const owed = jobs.filter((t) => t.status === "done").reduce((s, t) => s + remaining(t), 0);
  const open = jobs.filter((t) => t.status !== "done").reduce((s, t) => s + remaining(t), 0);
  const pipeline = quotes.reduce((s, q) => {
    const items = Array.isArray(q.items) ? (q.items as { amount?: number }[]) : [];
    return s + fx.toBase(items.reduce((a, i) => a + (Number(i.amount) || 0), 0), q.currency);
  }, 0);

  const p = goalProgress(totals.I, goal, month, today);
  const pace = goalPace(totals.I, goal, month, today);
  const g = goalGap({ income: totals.I, goal, owed, open, quotes: pipeline });
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((k) => ({ k, I: monthTotals(entries, k).I }));
  const max = Math.max(goal, ...months.map((m) => m.I), 1);

  return (
    <>
      <PageHead title="هدف الشهر" base="/app/goal" month={month} sub={`هدفك ${money(goal)} في الشهر`}>
        <Link href="/app/money" className="text-sm text-cyan">الفلوس ‹</Link>
      </PageHead>

      <Card className="grid gap-3 p-5" aria-labelledby="goal-now">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="goal-now" className="text-lg font-bold">{monthLabel(month)} لحد دلوقتي</h2>
          <span className="text-sm text-muted"><span className="num text-ink">{fmt(totals.I)}</span> من <span className="num">{fmt(goal)}</span> {cur.short} · <span className="num">{p.pct}%</span></span>
        </div>
        <div className="relative h-3 overflow-hidden rounded bg-paper" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, p.pct)} aria-label="نسبة الوصول للهدف">
          <div className={`h-full rounded ${p.reached ? "bg-money" : "bg-cyan"}`} style={{ width: `${Math.min(100, p.pct)}%` }} />
          {p.current && !p.reached && (
            <i className="absolute inset-y-0 w-0.5 bg-ink" style={{ insetInlineStart: `${Math.min(100, Math.round((pace.expected / goal) * 100))}%` }} aria-hidden="true" />
          )}
        </div>
        {p.current && !p.reached && (
          <p className="text-sm">
            الخط الأسود هو مكانك المفروض النهارده (<span className="num">{fmt(pace.expected)}</span> {cur.short} يوم <span className="num">{pace.day}</span> من <span className="num">{pace.lastDay}</span>) —{" "}
            <b className={pace.ahead ? "text-money" : "text-risk"}>{pace.ahead ? `إنت قدامه بـ ${money(pace.diff)}` : `إنت وراه بـ ${money(-pace.diff)}`}</b>.
          </p>
        )}
        <p className={`text-sm ${p.reached ? "font-semibold text-money" : "text-ink2"}`}>{goalAdvice(g, money)}</p>
        {p.current && !p.reached && (
          <p className="text-sm text-muted">يعني حوالي <span className="num text-ink">{fmt(p.perDay)}</span> {cur.short} في اليوم لآخر الشهر ({p.daysLeft === 1 ? "النهارده آخر يوم" : `باقي ${p.daysLeft} ${p.daysLeft <= 10 ? "أيام" : "يوم"}`}).</p>
        )}
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="p-5" aria-labelledby="goal-ways">
          <h2 id="goal-ways" className="mb-1 text-lg font-bold">إزاي توصل للباقي</h2>
          <p className="mb-3 text-sm text-muted">{g.gap ? `فاضل ${money(g.gap)}. دي الحاجات اللي في دفترك وتقدر تقفل بيها الفرق:` : "الهدف اتحقق، فمفيش فرق تقفله."}</p>
          {g.sources.length ? (
            <ul>
              {g.sources.map((s) => (
                <li key={s.key} className="flex flex-wrap items-center gap-3 border-b border-rule py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <Link href={s.href} className="font-medium hover:text-cyan">{s.label} ‹</Link>
                    {s.used > 0 && g.gap > 0 && <div className="text-xs text-muted">يقفل <span className="num">{fmt(s.used)}</span> من الفرق</div>}
                  </div>
                  <span className="num text-money">{fmt(s.amount)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>مفيش فلوس مستحقة ولا شغل شغال ولا عروض مستنية.</Empty>}
          {g.gap > 0 && g.short > 0 && (
            <p className="mt-3 text-sm text-risk">ناقص <span className="num">{fmt(g.short)}</span> {cur.short} شغل جديد عشان توصل.</p>
          )}
        </Card>

        <Card className="p-5" aria-labelledby="goal-hist">
          <h2 id="goal-hist" className="mb-1 text-lg font-bold">آخر ٦ شهور مع الهدف</h2>
          <p className="mb-3 text-sm text-muted">الخط المنقّط هو الهدف الحالي.</p>
          <ul className="grid gap-2.5">
            {months.map((m) => (
              <li key={m.k} className="grid gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{monthLabel(m.k)}{m.k === monthKey(today) ? " (الشهر ده)" : ""}</span>
                  <span className="flex items-center gap-2">
                    <span className="num text-muted">{fmt(m.I)}</span>
                    {m.I >= goal ? <Pill tone="money">وصل</Pill> : <Pill>{"ناقص "}<span className="num">{fmt(goal - m.I)}</span></Pill>}
                  </span>
                </div>
                <div className="relative h-2 overflow-hidden rounded bg-paper">
                  <div className={`h-full rounded ${m.I >= goal ? "bg-money" : "bg-wait"}`} style={{ width: `${Math.round((m.I / max) * 100)}%` }} />
                  <i className="absolute inset-y-0 border-e border-dashed border-ink" style={{ insetInlineStart: `${Math.round((goal / max) * 100)}%` }} aria-hidden="true" />
                </div>
              </li>
            ))}
          </ul>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted hover:text-ink">غيّر الهدف</summary>
            <form action={setGoal} className="mt-2 flex flex-wrap items-center gap-2">
              <input name="goal" inputMode="decimal" defaultValue={goal} aria-label="هدف الدخل الشهري" className={`${inputClass} num w-36 text-left`} />
              <Button kind="secondary" small>احفظ</Button>
            </form>
          </details>
        </Card>
      </div>
    </>
  );
}
