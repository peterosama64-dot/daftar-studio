import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AR_DAYS, clock, dayKey, daysUntil, now, parseDay, shortDate } from "@/lib/dates";
import { hoursLabel, planDays, planRisks, weekStart, type PlanTask } from "@/lib/week";
import { PageHead } from "@/components/month";
import { Button, inputClass } from "@/components/ui";
import { WeekBoard, type BoardTask } from "@/components/week-board";
import { autoPlanWeek, setDayHours } from "../actions";

export const metadata = { title: "خطة الأسبوع" };

export default async function Week({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const uid = await requireUser();
  const today = now();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = weekStart(parseDay((await searchParams).w) ?? today);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const [tasks, user, meetings] = await Promise.all([
    prisma.task.findMany({ where: { userId: uid, status: { not: "done" } }, select: { id: true, title: true, client: true, due: true, priority: true, status: true, planDay: true, estimate: true }, orderBy: [{ due: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] }),
    prisma.user.findUnique({ where: { id: uid }, select: { dayHours: true } }),
    prisma.meeting.findMany({ where: { userId: uid, at: { gte: start, lt: end } }, select: { title: true, at: true }, orderBy: { at: "asc" } }),
  ]);
  const dayHours = user?.dayHours ?? 6;
  const isCurrentOrFuture = end > todayStart;
  // A job left on a past day and not done goes back to «مش متوزّعة» (when looking at this week or later).
  const stale = (t: PlanTask) => isCurrentOrFuture && !!t.planDay && t.planDay < todayStart;
  const plan = planDays(tasks.filter((t) => !stale(t)), start, dayHours);
  const risks = planRisks(tasks, today);
  const riskIds = new Set(risks.filter((r) => r.kind !== "unplanned-soon").map((r) => r.id));

  const toBoard = (t: PlanTask): BoardTask => ({
    id: t.id, title: t.title, client: t.client, due: t.due ? dayKey(t.due) : null,
    dueLabel: t.due ? (daysUntil(t.due, today) === 0 ? "النهارده" : daysUntil(t.due, today) === 1 ? "بكرة" : `${AR_DAYS[t.due.getDay()]} ${shortDate(t.due)}`) : null,
    late: riskIds.has(t.id), high: t.priority === "high", day: t.planDay ? dayKey(t.planDay) : null, stale: stale(t),
    hours: t.estimate ? String(Math.round((t.estimate / 60) * 100) / 100) : "",
  });
  const days = plan.map((p) => ({
    key: p.key, name: AR_DAYS[p.day.getDay()], date: shortDate(p.day), today: p.key === dayKey(today), past: p.day < todayStart,
    load: p.minutes ? `${hoursLabel(p.minutes)} من ${dayHours}${p.over ? " · متحمّل زيادة" : ""}` : "فاضي",
    over: p.over, pct: dayHours ? (p.minutes / (dayHours * 60)) * 100 : 0,
    tasks: p.tasks.map(toBoard), meetings: meetings.filter((m) => dayKey(m.at) === p.key).map((m) => `${clock(m.at)} ${m.title}`),
  }));
  const unplanned = tasks.filter((t) => !t.planDay || stale(t)).map(toBoard);
  const planned = plan.reduce((s, p) => s + p.minutes, 0);
  const inThisWeek = plan.flatMap((p) => p.tasks);
  const shift = (n: number) => dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + n * 7));

  return (
    <>
      <PageHead title="خطة الأسبوع" base="/app/week"
        sub={`${shortDate(start)} – ${shortDate(new Date(end.getTime() - 86_400_000))} · ${inThisWeek.length ? `${inThisWeek.length} ${inThisWeek.length === 1 ? "مهمة" : "مهام"} بحوالي ${hoursLabel(planned)}` : "لسه مفيش حاجة متوزّعة"}`}>
        <nav className="flex items-center gap-1 rounded-xl border border-rule bg-sheet p-1 text-sm" aria-label="الأسابيع">
          <Link href={`/app/week?w=${shift(-1)}`} className="rounded-lg px-2.5 py-1 hover:bg-sunken" aria-label="الأسبوع اللي فات">›</Link>
          <Link href="/app/week" className="rounded-lg px-2.5 py-1 hover:bg-sunken">الأسبوع ده</Link>
          <Link href={`/app/week?w=${shift(1)}`} className="rounded-lg px-2.5 py-1 hover:bg-sunken" aria-label="الأسبوع الجاي">‹</Link>
        </nav>
      </PageHead>

      <div className="flex flex-wrap items-end gap-3">
        {isCurrentOrFuture && unplanned.length > 0 && (
          <form action={autoPlanWeek.bind(null, dayKey(start))}><Button>وزّعهم لي</Button></form>
        )}
        <form action={setDayHours} className="flex items-end gap-2">
          <label className="grid gap-1 text-sm font-medium">ساعات شغلك في اليوم
            <input name="dayHours" defaultValue={dayHours} key={dayHours} inputMode="numeric" className={`${inputClass} num w-20 text-center`} />
          </label>
          <Button kind="secondary" small>احفظ</Button>
        </form>
        <p className="text-xs text-muted">المهمة من غير تقدير بتتحسب ساعتين. اسحب المهمة على اليوم، أو اختار اليوم من القايمة.</p>
      </div>

      {risks.length > 0 && (
        <section aria-label="مواعيد في خطر" className="grid gap-1.5 rounded-xl border border-risk bg-risk-soft p-3 text-sm">
          <h2 className="font-bold text-risk">مواعيد تسليم في خطر</h2>
          <ul className="grid gap-1">{risks.slice(0, 8).map((r) => <li key={r.id + r.kind}><Link href={`/app/tasks/${r.id}`} className="hover:underline">{r.text}</Link></li>)}</ul>
        </section>
      )}
      {days.some((d) => d.over && !d.past) && (
        <p className="rounded-xl border border-wait bg-wait-soft px-4 py-2.5 text-sm">
          {days.filter((d) => d.over && !d.past).map((d) => (d.today ? "النهارده" : d.name)).join(" و")} متحمّل أكتر من {dayHours} ساعات. انقل حاجة ليوم فاضي.
        </p>
      )}

      <WeekBoard days={days} unplanned={unplanned} />
    </>
  );
}
