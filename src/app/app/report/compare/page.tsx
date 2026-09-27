import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort, monthFrom, type SP } from "@/lib/data";
import { fmt, signed } from "@/lib/money";
import { AR_MONTHS } from "@/lib/dates";
import { change, compareMonths, type MonthStats } from "@/lib/compare";
import { PageHead } from "@/components/month";
import { Card } from "@/components/ui";

export const metadata = { title: "مقارنة الشهور" };

const label = (k: string) => `${AR_MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;

type Row = { name: string; get: (m: MonthStats) => number | null; show: (v: number | null) => string; goodUp?: boolean };

export default async function Compare({ searchParams }: { searchParams: SP }) {
  const uid = await requireUser();
  const month = await monthFrom(searchParams);
  const [entries, tasks, cur] = await Promise.all([
    prisma.entry.findMany({ where: { userId: uid } }),
    prisma.task.findMany({ where: { userId: uid }, select: { client: true, status: true, doneAt: true, timeSpent: true, agreed: true, createdAt: true } }),
    currencyShort(uid),
  ]);
  const { now, prev, lastYear } = compareMonths(entries, tasks, month);
  const money = (v: number | null) => (v === null ? "—" : fmt(v));
  const rows: Row[] = [
    { name: `الدخل (${cur.short})`, get: (m) => m.I, show: money, goodUp: true },
    { name: `الصرف (${cur.short})`, get: (m) => m.out, show: money, goodUp: false },
    { name: `الصافي (${cur.short})`, get: (m) => m.net, show: (v) => (v === null ? "—" : signed(v)), goodUp: true },
    { name: "شغل خلص", get: (m) => m.done, show: (v) => String(v ?? 0), goodUp: true },
    { name: "ساعات متسجّلة", get: (m) => m.hours, show: (v) => (v ? String(v) : "—") },
    { name: `سعر ساعتك (${cur.short})`, get: (m) => m.rate, show: money, goodUp: true },
    { name: "عملاء اشتغلت معاهم", get: (m) => m.clients, show: (v) => String(v ?? 0) },
    { name: "عملاء جداد", get: (m) => m.newClients, show: (v) => String(v ?? 0), goodUp: true },
  ];
  const badge = (r: Row, other: MonthStats) => {
    const pct = change(r.get(now), r.get(other));
    if (pct === null || pct === 0) return null;
    const good = r.goodUp === undefined ? null : (pct > 0) === r.goodUp;
    return <span dir="ltr" className={`block text-[0.6875rem] ${good === null ? "text-muted" : good ? "text-money" : "text-wait"}`}>{pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%</span>;
  };
  const cols = [
    { m: now, title: label(now.k), sub: "الشهر ده" },
    { m: prev, title: label(prev.k), sub: "اللي قبله" },
    { m: lastYear, title: label(lastYear.k), sub: "السنة اللي فاتت" },
  ];
  const lines: string[] = [];
  const dI = change(now.I, prev.I), dY = change(now.I, lastYear.I);
  if (dI !== null) lines.push(`دخلك ${dI >= 0 ? "زاد" : "قلّ"} ${Math.abs(dI)}% عن الشهر اللي فات.`);
  if (dY !== null) lines.push(`ومقارنةً بنفس الشهر السنة اللي فاتت ${dY >= 0 ? "زاد" : "قلّ"} ${Math.abs(dY)}%.`);
  if (now.top) lines.push(`أكتر عميل جاب الشهر ده: ${now.top.name} (${fmt(now.top.amount)} ${cur.short}).`);
  if (now.rate && prev.rate) { const d = change(now.rate, prev.rate)!; if (Math.abs(d) >= 10) lines.push(`سعر ساعتك ${d > 0 ? "طلع" : "نزل"} ${Math.abs(d)}%.`); }

  return (
    <>
      <Link href={`/app/report?m=${month}`} className="text-sm text-cyan">› التقرير</Link>
      <PageHead title="مقارنة الشهور" base="/app/report/compare" month={month} sub="الشهر ده جنب اللي قبله وجنب نفس الشهر السنة اللي فاتت" />
      {lines.length > 0 && <Card className="grid gap-1 p-5 text-[0.9375rem]">{lines.map((l) => <p key={l}>{l}</p>)}</Card>}
      <Card className="overflow-hidden">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule bg-paper">
              <th className="w-[34%] px-3 py-3 text-right font-medium text-muted">&nbsp;</th>
              {cols.map((c, i) => (
                <th key={c.m.k} className={`px-2 py-3 text-right align-bottom ${i === 0 ? "font-bold" : "font-medium"}`}>
                  <span className="block text-[0.6875rem] font-normal text-muted">{c.sub}</span>{c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-rule last:border-b-0">
                <th scope="row" className="px-3 py-2.5 text-right font-medium">{r.name}</th>
                {cols.map((c, i) => (
                  <td key={c.m.k} className={`px-2 py-2.5 ${i === 0 ? "font-semibold" : "text-ink2"}`}>
                    <span className="num">{r.show(r.get(c.m))}</span>
                    {i > 0 && badge(r, c.m)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="px-3 py-2.5 text-right font-medium">أكتر عميل</th>
              {cols.map((c, i) => <td key={c.m.k} className={`px-2 py-2.5 [overflow-wrap:anywhere] ${i === 0 ? "font-semibold" : "text-ink2"}`}>{c.m.top?.name ?? "—"}</td>)}
            </tr>
          </tbody>
        </table>
      </Card>
      <p className="text-[0.8125rem] text-muted">النسبة تحت كل رقم = الشهر ده زاد أو قلّ قد إيه عن العمود ده.</p>
    </>
  );
}
