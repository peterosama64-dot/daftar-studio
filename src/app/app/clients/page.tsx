import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { PageHead } from "@/components/month";
import { Card, Empty } from "@/components/ui";
import { prisma } from "@/lib/db";
import { currencyShort } from "@/lib/data";
import { fmt } from "@/lib/money";
import { monthKey, shortDate, now as nowTz } from "@/lib/dates";

export const metadata = { title: "العملاء" };

/** Clients are derived from the names used on tasks and income rows. */
export default async function Clients() {
  const uid = await requireUser();
  const [tasks, income, cur] = await Promise.all([
    prisma.task.findMany({ where: { userId: uid } }),
    prisma.entry.findMany({ where: { userId: uid, kind: "income" }, orderBy: { date: "desc" } }),
    currencyShort(uid),
  ]);
  const now = nowTz();
  const thisMonth = monthKey(now), thisYear = now.getFullYear();
  type Row = { name: string; open: number; lastDone: Date | null; month: number; year: number; owed: number; payments: { date: Date | null; amount: number; name: string }[] };
  const map = new Map<string, Row>();
  const get = (name: string) => {
    if (!map.has(name)) map.set(name, { name, open: 0, lastDone: null, month: 0, year: 0, owed: 0, payments: [] });
    return map.get(name)!;
  };
  for (const t of tasks) {
    if (!t.client) continue;
    const r = get(t.client);
    if (t.status !== "done") r.open++;
    else if (t.doneAt && (!r.lastDone || t.doneAt > r.lastDone)) r.lastDone = t.doneAt;
    if (t.agreed) r.owed += Math.max(0, t.agreed - (t.paid ?? 0));
  }
  for (const e of income) {
    if (!e.client) continue;
    const r = get(e.client);
    if (e.date && monthKey(e.date) === thisMonth) r.month += e.amount;
    if (e.date && e.date.getFullYear() === thisYear) r.year += e.amount;
    r.payments.push({ date: e.date, amount: e.amount, name: e.name });
  }
  const rows = [...map.values()].sort((a, b) => b.year - a.year || b.open - a.open);
  const owedTotal = rows.reduce((s, r) => s + r.owed, 0);
  return (
    <>
      <PageHead title="العملاء" base="/app/clients" sub={`${rows.length} عميل${owedTotal ? ` · ${fmt(owedTotal)} ${cur.short} لسه مستحقة` : ""}`} />
      {!rows.length ? (
        <Empty>أول ما تسجّل شغل أو فلوس باسم عميل هيظهر هنا لوحده.</Empty>
      ) : (
        <Card className="overflow-x-auto p-2">
          <table className="w-full min-w-[640px] text-[15px]">
            <thead>
              <tr className="border-b-2 border-ink text-right text-sm text-muted">
                <th className="px-3 py-2.5 font-normal">العميل</th><th className="px-3 py-2.5 font-normal">شغل مفتوح</th>
                <th className="px-3 py-2.5 font-normal">آخر تسليم</th><th className="px-3 py-2.5 font-normal">دخل الشهر</th>
                <th className="px-3 py-2.5 font-normal">دخل السنة</th><th className="px-3 py-2.5 font-normal">لسه مستحق</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-rule last:border-b-0">
                  <td className="px-3 py-3 font-semibold"><Link href={`/app/tasks?q=${encodeURIComponent(r.name)}`} className="hover:text-cyan">{r.name}</Link></td>
                  <td className="num px-3 py-3 text-right">{r.open}</td>
                  <td className="num px-3 py-3 text-right text-muted">{r.lastDone ? shortDate(r.lastDone) : "—"}</td>
                  <td className="num px-3 py-3 text-right">{fmt(r.month)}</td>
                  <td className="num px-3 py-3 text-right">{fmt(r.year)}</td>
                  <td className={`num px-3 py-3 text-right ${r.owed ? "text-wait" : "text-muted"}`}>{fmt(r.owed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-[13px] text-muted">«لسه مستحق» بيتحسب من المبلغ المتفق عليه ناقص اللي اتدفع في تفاصيل كل مهمة.</p>
    </>
  );
}
