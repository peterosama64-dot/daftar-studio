import { fmt } from "@/lib/money";
import { goalPace, goalProgress } from "@/lib/goal";
import Link from "next/link";
import { setGoal } from "@/app/app/actions";
import { Button, inputClass } from "./ui";

/** Monthly income goal on the home page: set it inline, then see how far along the month is. */
export function GoalCard({ income, goal, month, today, cur }: { income: number; goal: number | null; month: string; today: Date; cur: string }) {
  const form = (label: string) => (
    <form action={setGoal} className="flex flex-wrap items-center gap-2">
      <input name="goal" inputMode="decimal" defaultValue={goal ?? ""} placeholder="مثلاً 15,000" aria-label="هدف الدخل الشهري" className={`${inputClass} num w-36 text-left`} />
      <Button kind="secondary" small>{label}</Button>
    </form>
  );
  if (!goal) {
    return (
      <section aria-label="هدف الشهر" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-rule px-5 py-4">
        <div>
          <p className="font-display font-semibold">حط هدف لدخلك كل شهر</p>
          <p className="text-sm text-muted">والدفتر يقولك وصلت لفين وفاضل كام في اليوم.</p>
        </div>
        {form("حط الهدف")}
      </section>
    );
  }
  const g = goalProgress(income, goal, month, today);
  const pace = goalPace(income, goal, month, today);
  return (
    <section aria-label="هدف الشهر" className="grid gap-2.5 rounded-2xl border border-rule bg-sheet px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display font-semibold">هدف الشهر</span>
        <span className="text-sm text-muted"><span className="num text-ink">{fmt(income)}</span> من <span className="num">{fmt(goal)}</span> {cur} · <span className="num">{g.pct}%</span></span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded bg-paper" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, g.pct)} aria-label="نسبة الوصول للهدف">
        <div className="h-full rounded bg-money" style={{ width: `${Math.min(100, g.pct)}%` }} />
        {g.current && !g.reached && (
          <i className="absolute inset-y-0 w-0.5 bg-ink" style={{ insetInlineStart: `${Math.min(100, Math.round((pace.expected / goal) * 100))}%` }} aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className={g.reached ? "font-semibold text-money" : "text-ink2"}>
          {g.reached
            ? `وصلت للهدف${income > goal ? ` وعدّيته بـ ${fmt(income - goal)} ${cur}` : ""}.`
            : g.current
              ? `${pace.ahead ? `إنت قدام الهدف بـ ${fmt(pace.diff)} ${cur}` : `إنت وراه بـ ${fmt(-pace.diff)} ${cur}`} · فاضل ${fmt(g.left)} ${cur}، حوالي ${fmt(g.perDay)} في اليوم (${g.daysLeft === 1 ? "النهارده آخر يوم" : g.daysLeft === 2 ? "باقي يومين" : `باقي ${g.daysLeft} ${g.daysLeft <= 10 ? "أيام" : "يوم"}`}).`
              : `ما وصلتش للهدف الشهر ده، كان فاضل ${fmt(g.left)} ${cur}.`}
        </p>
        <Link href="/app/goal" className="text-sm text-cyan">إزاي توصله ‹</Link>
      </div>
    </section>
  );
}
