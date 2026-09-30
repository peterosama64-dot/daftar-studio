import { monthKey, monthName } from "./dates";

/** The due date of a monthly job in `month`: its day, or the month's last day when the month is shorter. */
export function recurringDue(month: string, dayOfMonth: number): Date {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(Math.max(1, dayOfMonth), last));
}

export const recurringTitle = (title: string, month: string) => `${title} · ${monthName(month)}`;

export type RecurringRow = { id: string; userId: string; title: string; client: string; amount: number; dayOfMonth: number; autoInvoice: boolean; clientEmail: string };

type Db = {
  recurringJob: {
    findMany: (a: { where: object }) => Promise<RecurringRow[]>;
    updateMany: (a: { where: object; data: object }) => Promise<{ count: number }>;
  };
  task: { create: (a: { data: { userId: string; title: string; client: string; agreed: number; due: Date; recurringId: string } }) => Promise<{ id: string }> };
};

/**
 * Make this month's task for every active monthly job that doesn't have one yet (optionally for one user).
 * Each job is claimed for the month with a conditional update first, so overlapping runs never double up.
 * `onTask` runs on each new task — that's where the invoice is issued for jobs that ask for one.
 */
export async function runRecurring(db: Db, today: Date, userId?: string, onTask?: (job: RecurringRow, taskId: string, month: string) => Promise<unknown>): Promise<number> {
  const month = monthKey(today);
  const notThisMonth = { OR: [{ lastMonth: null }, { lastMonth: { not: month } }] };
  const jobs = await db.recurringJob.findMany({ where: { active: true, user: { suspendedAt: null }, ...notThisMonth, ...(userId ? { userId } : {}) } });
  let made = 0;
  for (const j of jobs) {
    const claimed = await db.recurringJob.updateMany({ where: { id: j.id, ...notThisMonth }, data: { lastMonth: month } });
    if (!claimed.count) continue;
    const task = await db.task.create({
      data: { userId: j.userId, title: recurringTitle(j.title, month), client: j.client, agreed: j.amount, due: recurringDue(month, j.dayOfMonth), recurringId: j.id },
    });
    if (onTask) await onTask(j, task.id, month);
    made++;
  }
  return made;
}
