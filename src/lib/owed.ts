export type OwedTask = { id: string; title: string; client: string; agreed: number | null; paid: number | null };
export type OwedClient = { name: string; owed: number; tasks: { id: string; title: string; remaining: number }[] };

/** What clients still owe: agreed minus paid on each task, grouped by client, biggest first. */
export function owedByClient(tasks: OwedTask[]): { total: number; clients: OwedClient[] } {
  const map = new Map<string, OwedClient>();
  for (const t of tasks) {
    const remaining = Math.max(0, (t.agreed ?? 0) - (t.paid ?? 0));
    if (!remaining) continue;
    const name = t.client.trim() || "من غير اسم عميل";
    if (!map.has(name)) map.set(name, { name, owed: 0, tasks: [] });
    const c = map.get(name)!;
    c.owed += remaining;
    c.tasks.push({ id: t.id, title: t.title, remaining });
  }
  const clients = [...map.values()].sort((a, b) => b.owed - a.owed);
  for (const c of clients) c.tasks.sort((a, b) => b.remaining - a.remaining);
  return { total: clients.reduce((s, c) => s + c.owed, 0), clients };
}
