import { monthKey } from "./dates";

/**
 * Progress toward the monthly income goal. For the current month it also says how much is left
 * per remaining day (today included); for other months only whether it was reached.
 */
export function goalProgress(income: number, goal: number, month: string, today: Date) {
  const pct = goal > 0 ? Math.round((income / goal) * 100) : 0;
  const left = Math.max(0, goal - income);
  const current = monthKey(today) === month;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = current ? lastDay - today.getDate() + 1 : 0;
  return { pct, left, reached: income >= goal, current, daysLeft, perDay: current && left ? Math.ceil(left / daysLeft) : 0 };
}

/**
 * The pace line: where the goal says you should be by the end of today, and how far off you are.
 * Only meaningful for the month being lived; other months are simply reached or not.
 */
export function goalPace(income: number, goal: number, month: string, today: Date) {
  const { current } = goalProgress(income, goal, month, today);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const expected = current ? Math.round((goal * today.getDate()) / lastDay) : goal;
  const diff = Math.round(income - expected);
  return { expected, diff, ahead: diff >= 0, day: today.getDate(), lastDay };
}

export type GoalSource = { key: "owed" | "open" | "quotes"; label: string; amount: number; href: string };

/**
 * «إزاي أوصل للهدف»: the gap, and what in the notebook could close it — money already due from
 * clients, work agreed but not paid yet, and quotes still waiting for an answer. Each source is
 * counted in order and only up to what the gap needs, so `covered` never overstates the gap.
 */
export function goalGap(p: { income: number; goal: number; owed: number; open: number; quotes: number }) {
  const gap = Math.max(0, Math.round(p.goal - p.income));
  const all: GoalSource[] = [
    { key: "owed", label: "فلوس مستحقة عند عملاء", amount: Math.round(p.owed), href: "/app/money" },
    { key: "open", label: "شغل متفق عليه ولسه شغال", amount: Math.round(p.open), href: "/app/tasks" },
    { key: "quotes", label: "عروض أسعار مستنية رد", amount: Math.round(p.quotes), href: "/app/quotes" },
  ];
  const sources = all.filter((s) => s.amount > 0);
  let rest = gap;
  const steps = sources.map((s) => {
    const used = Math.min(rest, s.amount);
    rest -= used;
    return { ...s, used, enough: rest === 0 };
  });
  const covered = gap - rest;
  return { gap, sources: steps, covered, short: rest, enough: gap > 0 && rest === 0 };
}

/** One line telling you where you stand and what the shortest way to the goal is. */
export function goalAdvice(g: ReturnType<typeof goalGap>, money: (n: number) => string): string {
  if (!g.gap) return "وصلت للهدف الشهر ده. أي فلوس جديدة زيادة عليه.";
  if (!g.sources.length) return `فاضل ${money(g.gap)} ومفيش في الدفتر شغل ولا فلوس مستحقة تغطيهم — محتاج شغل جديد.`;
  const first = g.sources[0];
  if (g.enough) {
    const one = g.sources.filter((s) => s.used > 0).length === 1;
    return one
      ? `فاضل ${money(g.gap)}، و${first.label} لوحدها بـ ${money(first.amount)} تكفّيهم — ركّز عليها.`
      : `فاضل ${money(g.gap)}، واللي في الدفتر بيغطيهم: ابدأ بـ${first.label} (${money(first.amount)}).`;
  }
  return `فاضل ${money(g.gap)}، واللي في الدفتر بيغطي منهم ${money(g.covered)} بس — ناقص ${money(g.short)} شغل جديد.`;
}
