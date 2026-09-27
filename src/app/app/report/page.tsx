import { requireUser } from "@/lib/auth";
import { PageHead } from "@/components/month";
import { Card } from "@/components/ui";
import { AiReport } from "@/components/ai-report";
import { PrintButton } from "@/components/print-button";
import Link from "next/link";
import { Brand, btnClass } from "@/components/ui";
import { loadMonth, monthFrom, type SP } from "@/lib/data";
import { reportFacts, plainReport } from "@/lib/report";
import { incomeByClient, fmt, signed } from "@/lib/money";
import { aiEnabled } from "@/lib/ai";
import { monthName } from "@/lib/dates";

export const metadata = { title: "تقرير الشهر" };

export default async function Report({ searchParams }: { searchParams: SP }) {
  const uid = await requireUser();
  const month = await monthFrom(searchParams);
  const d = await loadMonth(month, uid);
  const f = reportFacts(month, d);
  const clients = incomeByClient(d.totals.income);
  const top = clients[0]?.[1] ?? 1;
  const kv: [string, string, string?][] = [
    ["خلصت", String(f.done.length)], ["لسه مخلصتش", String(f.urgent.length + f.later.length)],
    ["مستعجل", String(f.urgent.length), "text-risk"], ["متأخر عن ميعاده", String(f.overdue.length), f.overdue.length ? "text-risk" : ""],
    ["الدخل", fmt(f.totals.income)], ["الاشتراكات", fmt(f.totals.subscriptions), "text-risk"], ["مصاريف تانية", fmt(f.totals.expenses), "text-risk"],
    ["صافي الربح", signed(f.totals.net), f.totals.net < 0 ? "text-risk" : "text-money"], ["هامش الربح", `${f.totals.marginPct}%`],
  ];
  return (
    <>
      <div className="hidden items-center justify-between border-b border-rule pb-3 print:flex">
        <Brand href="/app" />
        <span className="text-sm text-muted">{new Date().toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" })}</span>
      </div>
      <PageHead title={`تقرير ${monthName(month)}`} base="/app/report" month={month}>
        <Link href={`/app/report/year?y=${month.slice(0, 4)}`} className={`${btnClass("ghost", true)} print:hidden`}>تقرير السنة</Link>
        <Link href="/app/report/rates" className={`${btnClass("ghost", true)} print:hidden`}>سعر ساعتك</Link>
        <Link href={`/app/report/compare?m=${month}`} className={`${btnClass("ghost", true)} print:hidden`}>قارن</Link>
        <PrintButton file={`تقرير-دفتر-الاستوديو-${month}`} />
      </PageHead>
      <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr] print:grid-cols-1 print:gap-3">
        <Card className="grid gap-3 rounded-tr-sm p-6 shadow-float print:gap-2 print:p-4">
          <div className="num flex justify-between text-xs text-muted"><span>REPORT · {month}</span><span>{d.cur.code}</span></div>
          <AiReport month={month} enabled={aiEnabled()} fallback={plainReport(f)} />
        </Card>
        <div className="grid gap-5 print:grid-cols-2 print:items-start print:gap-3">
          <Card className="p-5 print:p-4">
            <h2 className="mb-2 text-lg font-bold">الأرقام</h2>
            <dl className="grid">
              {kv.map(([k, v, c]) => (
                <div key={k} className="flex justify-between border-b border-rule py-2 last:border-b-0 print:py-1"><dt className="text-sm text-muted">{k}</dt><dd className={`num ${c ?? ""}`}>{v}</dd></div>
              ))}
            </dl>
          </Card>
          <Card className="grid gap-3 p-5 print:p-4">
            <h2 className="text-lg font-bold">الدخل حسب العميل</h2>
            {clients.length ? clients.slice(0, 6).map(([name, amt]) => (
              <div key={name} className="grid grid-cols-[88px_1fr_64px] items-center gap-2.5 text-[0.8125rem]">
                <span className="truncate text-muted">{name}</span>
                <div className="h-2.5 overflow-hidden rounded bg-paper"><div className="h-full rounded bg-money" style={{ width: `${(amt / top) * 100}%` }} /></div>
                <span className="num text-left text-muted">{fmt(amt)}</span>
              </div>
            )) : <p className="text-sm text-muted">مفيش دخل مسجّل في الشهر ده.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
