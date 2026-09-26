import { monthKey, monthName } from "./dates";

/** The due date of a monthly job in `month`: its day, or the month's last day when the month is shorter. */
export function recurringDue(month: string, dayOfMonth: number): Date {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(Math.max(1, dayOfMonth), last));
}

export const recurringTitle = (title: string, month: string) => `${title} · ${monthName(month)}`;

type Db = {
  recurringJob: {
    findMany: (a: { where: object }) => Promise<{ id: string; userId: string; title: string; client: string; amount: number; dayOfMonth: number }[]>;
    updateMany: (a: { where: object; data: object }) => Promise<{ count: number }>;
  };
  task: { create: (a: { data: { userId: string; title: string; client: string; agreed: number; due: Date; recurringId: string } }) => Promise<unknown> };
};

/**
 * Make this month's task for every active monthly job that doesn't have one yet (optionally for one user).
 * Each job is claimed for the month with a conditional update first, so overlapping runs never double up.
 */
export async function runRecurring(db: Db, today: Date, userId?: string): Promise<number> {
  const month = monthKey(today);
  const notThisMonth = { OR: [{ lastMonth: null }, { lastMonth: { not: month } }] };
  const jobs = await db.recurringJob.findMany({ where: { active: true, ...notThisMonth, ...(userId ? { userId } : {}) } });
  let made = 0;
  for (const j of jobs) {
    const claimed = await db.recurringJob.updateMany({ where: { id: j.id, ...notThisMonth }, data: { lastMonth: month } });
    if (!claimed.count) continue;
    await db.task.create({
      data: { userId: j.userId, title: recurringTitle(j.title, month), client: j.client, agreed: j.amount, due: recurringDue(month, j.dayOfMonth), recurringId: j.id },
    });
    made++;
  }
  return made;
}
