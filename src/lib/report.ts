import { monthName, shortDate } from "./dates";
import { incomeByClient, fmt } from "./money";
import type { loadMonth } from "./data";

type M = Awaited<ReturnType<typeof loadMonth>>;

export function reportFacts(month: string, d: M) {
  const t = d.totals;
  const overdue = d.urgent.filter((x) => x.due && x.due < d.today && x.due.toDateString() !== d.today.toDateString());
  const clients = incomeByClient(t.income);
  const margin = t.I ? Math.round((t.net / t.I) * 100) : 0;
  return {
    month: monthName(month), currency: d.cur.short,
    done: d.doneThisMonth.map((x) => ({ title: x.title, client: x.client })),
    urgent: d.urgent.map((x) => ({ title: x.title, client: x.client, due: x.due ? shortDate(x.due) : "" })),
    later: d.later.map((x) => ({ title: x.title, client: x.client, due: x.due ? shortDate(x.due) : "" })),
    overdue: overdue.map((x) => x.title),
    totals: { income: t.I, subscriptions: t.S, expenses: t.X, net: t.net, marginPct: margin },
    subscriptions: t.subs.map((s) => ({ name: s.name, amount: s.amount })),
    topClient: clients[0] ? { name: clients[0][0], amount: clients[0][1], sharePct: t.I ? Math.round((clients[0][1] / t.I) * 100) : 0 } : null,
  };
}

/** The report without Claude: plain sentences from the same facts. */
export function plainReport(f: ReturnType<typeof reportFacts>): string[] {
  const L: string[] = [];
  const cur = f.currency;
  L.push(f.done.length ? `خلصت ${f.done.length} ${f.done.length === 1 ? "حاجة" : "حاجات"} في ${f.month}: ${f.done.slice(0, 5).map((x) => x.title).join("، ")}.` : `لسه مخلصتش حاجة في ${f.month}.`);
  if (f.overdue.length) L.push(`متأخر عن ميعاده: ${f.overdue.join("، ")}. ابدأ بيهم.`);
  if (f.urgent.length) L.push(`المستعجل دلوقتي: ${f.urgent.map((x) => x.title + (x.due ? ` (${x.due})` : "")).join("، ")}.`);
  if (f.later.length) L.push(`ليه وقت: ${f.later.map((x) => x.title).join("، ")}.`);
  L.push(`دخلك ${fmt(f.totals.income)} ${cur}، والاشتراكات ${fmt(f.totals.subscriptions)}، ومصاريف تانية ${fmt(f.totals.expenses)}، فصافي ربحك ${fmt(f.totals.net)} ${cur}${f.totals.income ? ` (هامش ${f.totals.marginPct}%)` : ""}.`);
  if (f.totals.income && f.totals.subscriptions / f.totals.income > 0.15) L.push(`الاشتراكات واكلة ${Math.round((f.totals.subscriptions / f.totals.income) * 100)}% من دخلك. بص على اللي مش بتستخدمه.`);
  if (f.topClient && f.topClient.sharePct >= 40) L.push(`${f.topClient.name} جاب ${f.topClient.sharePct}% من دخلك الشهر ده.`);
  return L;
}
