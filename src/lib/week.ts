import { dayKey, daysUntil } from "./dates";
import { WEEK_START } from "./calendar";

/** A job without an estimate counts as this many minutes on the plan. */
export const DEFAULT_ESTIMATE = 120;

export type PlanTask = { id: string; title: string; client: string; due: Date | null; priority: string; status: string; planDay: Date | null; estimate: number | null };

/** The Saturday (WEEK_START) that starts the week containing `d`, at local midnight. */
export function weekStart(d: Date, start = WEEK_START): Date {
  const back = (d.getDay() - start + 7) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
}

export const weekDays = (start: Date) => Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));

export const minutesOf = (t: Pick<PlanTask, "estimate">) => t.estimate ?? DEFAULT_ESTIMATE;

/** "3 س" / "1.5 س" / "45 د" */
export function hoursLabel(min: number): string {
  if (min < 60) return `${min} د`;
  const h = Math.round((min / 60) * 2) / 2;
  return `${h % 1 ? h.toFixed(1) : h} س`;
}

export type DayPlan = { day: Date; key: string; tasks: PlanTask[]; minutes: number; over: boolean };

/** Each day of the week with its planned open jobs, how full it is, and whether it's over the daily hours. */
export function planDays(tasks: PlanTask[], start: Date, dayHours: number): DayPlan[] {
  return weekDays(start).map((day) => {
    const key = dayKey(day);
    const list = tasks.filter((t) => t.status !== "done" && t.planDay && dayKey(t.planDay) === key);
    const minutes = list.reduce((s, t) => s + minutesOf(t), 0);
    return { day, key, tasks: list, minutes, over: minutes > dayHours * 60 };
  });
}

export type Risk = { id: string; kind: "late-plan" | "overdue" | "unplanned-soon"; text: string };

/**
 * Deadlines at risk: a job planned for a day after its deadline, a job already late, or one due within
 * three days that isn't on the plan at all.
 */
export function planRisks(tasks: PlanTask[], today: Date): Risk[] {
  const out: Risk[] = [];
  for (const t of tasks) {
    if (t.status === "done" || !t.due) continue;
    const left = daysUntil(t.due, today)!;
    if (left < 0) out.push({ id: t.id, kind: "overdue", text: `«${t.title}» عدّى ميعاد تسليمه` });
    else if (t.planDay && daysUntil(t.planDay, t.due)! > 0) out.push({ id: t.id, kind: "late-plan", text: `«${t.title}» متحطوط بعد ميعاد تسليمه` });
    else if (!t.planDay && left <= 3) out.push({ id: t.id, kind: "unplanned-soon", text: `«${t.title}» تسليمه ${left === 0 ? "النهارده" : left === 1 ? "بكرة" : `بعد ${left} أيام`} ومش متوزّع` });
  }
  const rank = { overdue: 0, "late-plan": 1, "unplanned-soon": 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/**
 * «وزّعهم لي»: puts the unplanned open jobs on days of this week, most urgent first (deadline, then priority),
 * each on the earliest day from today that still has room and isn't after its deadline. A job that fits
 * nowhere before its deadline goes on the emptiest allowed day; one that can't be placed at all is skipped.
 * Returns the new day per job id; existing placements are left alone.
 */
export function autoPlan(tasks: PlanTask[], start: Date, today: Date, dayHours: number): Map<string, Date> {
  const cap = dayHours * 60;
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = weekDays(start).filter((d) => d >= from);
  const load = new Map(planDays(tasks, start, dayHours).map((p) => [p.key, p.minutes]));
  const pr: Record<string, number> = { high: 0, normal: 1, low: 2 };
  const todo = tasks.filter((t) => t.status !== "done" && !t.planDay)
    .sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity) || (pr[a.priority] ?? 1) - (pr[b.priority] ?? 1));
  const out = new Map<string, Date>();
  for (const t of todo) {
    const m = minutesOf(t);
    const allowed = days.filter((d) => !t.due || daysUntil(t.due, d)! >= 0);
    const pool = allowed.length ? allowed : days.slice(0, 1); // already late: first available day
    if (!pool.length) continue;
    const fit = pool.find((d) => (load.get(dayKey(d)) ?? 0) + m <= cap);
    // No day before the deadline has room: the emptiest one, but only when the job must be done this week.
    const mustThisWeek = !!t.due && daysUntil(t.due, days[days.length - 1])! <= 0;
    const pick = fit ?? (mustThisWeek || !allowed.length ? pool.reduce((a, b) => ((load.get(dayKey(a)) ?? 0) <= (load.get(dayKey(b)) ?? 0) ? a : b)) : null);
    if (!pick) continue;
    out.set(t.id, pick);
    load.set(dayKey(pick), (load.get(dayKey(pick)) ?? 0) + m);
  }
  return out;
}
