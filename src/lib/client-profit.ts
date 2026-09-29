import { daysUntil } from "./dates";
import { trackedSeconds } from "./timer";
import { taskDue } from "./invoice";

// «مين بيكسّبك فعلاً»: not just who paid the most, but what each client cost in hours, revisions and waiting
// for the money. Everything is in the main currency; the caller converts.

export type ProfitTask = {
  id: string; client: string; agreed: number | null; paid: number | null; status: string;
  doneAt: Date | null; timeSpent: number; timerStart: Date | null;
  revisions: number; allowed: number | null;
  discount?: number | null; taxRate?: number | null;
};
export type ProfitIncome = { client: string; name: string; amount: number; date: Date | null };

export type ProfitRow = {
  name: string; income: number; jobs: number; hours: number; rate: number | null;
  revisions: number; extraRevisions: number; owed: number; waitDays: number | null; score: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * A row per client: what they paid, hours tracked, the hourly rate that comes out of it, revisions beyond
 * what the price included, what they still owe, and the longest wait on an unpaid finished job.
 * `score` ranks them: the hourly rate, cut for extra revisions and for money still sitting unpaid.
 */
export function clientProfit(tasks: ProfitTask[], income: ProfitIncome[], today: Date, at = new Date()): ProfitRow[] {
  const rows = new Map<string, ProfitRow>();
  const get = (raw: string) => {
    const name = raw.trim() || "من غير اسم عميل";
    if (!rows.has(name)) rows.set(name, { name, income: 0, jobs: 0, hours: 0, rate: null, revisions: 0, extraRevisions: 0, owed: 0, waitDays: null, score: 0 });
    return rows.get(name)!;
  };
  // Income with no client belongs to «من غير اسم عميل», never to the payment's own name.
  for (const e of income) get(e.client).income += e.amount;
  for (const t of tasks) {
    const r = get(t.client);
    r.jobs++;
    r.hours += trackedSeconds(t.timeSpent, t.timerStart, at) / 3600;
    r.revisions += t.revisions;
    r.extraRevisions += t.allowed === null ? 0 : Math.max(0, t.revisions - t.allowed);
    // What is still owed counts the job's discount and VAT, like everywhere else in the app.
    const owed = Math.max(0, taskDue(t) - (t.paid ?? 0));
    r.owed += owed;
    if (owed > 0 && t.status === "done" && t.doneAt) {
      const days = Math.max(0, -(daysUntil(t.doneAt, today) ?? 0));
      r.waitDays = Math.max(r.waitDays ?? 0, days);
    }
  }
  const out = [...rows.values()].map((r) => {
    const rate = r.hours >= 0.25 ? r.income / r.hours : null;
    // Each extra revision costs ~5% of the rate, each month of waiting ~10%, down to a floor of 40%.
    const penalty = Math.max(0.4, 1 - 0.05 * r.extraRevisions - 0.1 * ((r.waitDays ?? 0) / 30));
    return { ...r, hours: r1(r.hours), rate: rate === null ? null : Math.round(rate), score: rate === null ? 0 : rate * penalty };
  });
  return out.sort((a, b) => b.score - a.score || b.income - a.income);
}

/** One line in plain Arabic about the best and the most expensive client. */
export function profitVerdict(rows: ProfitRow[], money: (n: number) => string): string | null {
  const rated = rows.filter((r) => r.rate !== null);
  if (rated.length < 2) return null;
  const best = rated[0], worst = rated[rated.length - 1];
  if (best.name === worst.name) return null;
  const why = worst.extraRevisions > 0 && (worst.waitDays ?? 0) >= 30
    ? "تعديلات زيادة وتأخير في الدفع"
    : worst.extraRevisions > 0 ? "تعديلات زيادة عن المتفق عليه"
      : (worst.waitDays ?? 0) >= 30 ? "تأخير في الدفع" : "وقت كتير مقابل فلوس أقل";
  return `ساعتك مع ${best.name} بتجيب ${money(best.rate!)}، ومع ${worst.name} ${money(worst.rate!)} — بسبب ${why}.`;
}
