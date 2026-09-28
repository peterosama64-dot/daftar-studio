import { taskDue } from "./invoice";
export type OwedTask = { id: string; title: string; client: string; agreed: number | null; paid: number | null; currency?: string | null; discount?: number | null; taxRate?: number | null };
/** owed is in the main currency; each task's remaining is in that task's own currency. */
export type OwedClient = { name: string; owed: number; tasks: { id: string; title: string; remaining: number; currency: string | null }[] };

export const NO_CLIENT = "من غير اسم عميل";

/** What clients still owe: agreed minus paid on each task, grouped by client, biggest first. */
export function owedByClient(tasks: OwedTask[], toBase: (amount: number, currency: string | null) => number = (a) => a): { total: number; clients: OwedClient[] } {
  const map = new Map<string, OwedClient>();
  for (const t of tasks) {
    const remaining = Math.max(0, taskDue(t) - (t.paid ?? 0));
    if (!remaining) continue;
    const name = t.client.trim() || NO_CLIENT;
    if (!map.has(name)) map.set(name, { name, owed: 0, tasks: [] });
    const c = map.get(name)!;
    c.owed += toBase(remaining, t.currency ?? null);
    c.tasks.push({ id: t.id, title: t.title, remaining, currency: t.currency ?? null });
  }
  const clients = [...map.values()].sort((a, b) => b.owed - a.owed);
  for (const c of clients) c.tasks.sort((a, b) => toBase(b.remaining, b.currency) - toBase(a.remaining, a.currency));
  return { total: clients.reduce((s, c) => s + c.owed, 0), clients };
}
