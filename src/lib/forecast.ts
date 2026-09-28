import { monthKey } from "./dates";
import { taskDue } from "./invoice";

export type FcTask = { id: string; title: string; client: string; agreed: number | null; paid: number | null; due: Date | null; status: string; recurringId: string | null; installments: { amount: number; due: Date | null; paidAt: Date | null }[] };
export type FcJob = { title: string; client: string; amount: number; dayOfMonth: number; active: boolean; lastMonth: string | null };
export type FcItem = { title: string; client: string; amount: number; date: Date | null; href?: string };

/**
 * Money expected in months `now` and `next` (YYYY-MM), converted to the main currency by `toBase`:
 * unpaid planned payments by their date; a job's remaining amount (what payments don't already cover)
 * by its due date; monthly jobs not yet made for that month. Overdue money counts in the current month;
 * money with no date at all is reported apart, as «unscheduled».
 */
export function expectedIncome<T extends FcTask>(tasks: T[], jobs: FcJob[], now: string, next: string, toBase: (a: number, t: T | null) => number) {
  const by: Record<string, FcItem[]> = { [now]: [], [next]: [] };
  const unscheduled: FcItem[] = [];
  const slot = (d: Date | null) => {
    if (!d) return null;
    const k = monthKey(d);
    return k <= now ? now : k === next ? next : null;
  };
  for (const t of tasks) {
    if (!t.agreed) continue;
    const remaining = Math.max(0, taskDue(t) - (t.paid ?? 0));
    if (!remaining) continue;
    const planned = t.installments.filter((i) => !i.paidAt);
    let covered = 0;
    for (const i of planned) {
      const amount = Math.min(i.amount, remaining - covered);
      if (amount <= 0) break;
      covered += amount;
      const item = { title: t.title, client: t.client, amount: toBase(amount, t), date: i.due, href: `/app/tasks/${t.id}` };
      const k = slot(i.due);
      if (k) by[k].push(item); else if (!i.due) unscheduled.push(item);
    }
    const rest = remaining - covered;
    if (rest > 0) {
      const item = { title: t.title, client: t.client, amount: toBase(rest, t), date: t.due, href: `/app/tasks/${t.id}` };
      const k = slot(t.due);
      if (k) by[k].push(item); else if (!t.due) unscheduled.push(item);
    }
  }
  for (const j of jobs) {
    if (!j.active) continue;
    for (const k of [now, next]) {
      if (j.lastMonth && j.lastMonth >= k) continue; // that month's task already exists (and is counted above)
      const [y, m] = k.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      by[k].push({ title: j.title, client: j.client, amount: toBase(j.amount, null), date: new Date(y, m - 1, Math.min(j.dayOfMonth, last)) });
    }
  }
  const sum = (a: FcItem[]) => a.reduce((s, x) => s + x.amount, 0);
  for (const k of [now, next]) by[k].sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
  return { now: by[now], next: by[next], unscheduled, totalNow: sum(by[now]), totalNext: sum(by[next]), totalUnscheduled: sum(unscheduled) };
}
