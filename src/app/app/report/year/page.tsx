import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort } from "@/lib/data";
import { AR_MONTHS, monthKey, monthName, now } from "@/lib/dates";
import { fmt, signed } from "@/lib/money";
import { yearSummary } from "@/lib/year";
import { Brand, Card, Empty } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "تقرير السنة" };

export default async function YearReport({ searchParams }: { searchParams: Promise<{ y?: string }> }) {
  const uid = await requireUser();
  const thisYear = now().getFullYear();
  const raw = Number((await searchParams).y);
  const year = Number.isInteger(raw) && raw >= 2000 && raw <= thisYear + 1 ? raw : thisYear;
  const [entries, tasks, cur] = await Promise.all([
    prisma.entry.findMany({ where: { userId: uid } }),
    prisma.task.findMany({ where: { userId: uid }, select: { status: true, doneAt: true, timeSpent: true, createdAt: true } }),
    currencyShort(uid),
  ]);
  // Hours count for the year the task was created in.
  const y = yearSummary(entries, tasks.filter((t) => t.createdAt.getFullYear() === year), year, monthKey(now()));
  const max = Math.max(1, ...y.months.map((m) => Math.max(m.I, m.S + m.X)));
  const topClient = y.clients[0]?.[1] ?? 1;
  const kv: [string, string, string?][] = [
    ["الدخل", fmt(y.I)], ["الاشتراكات", fmt(y.S), "text-risk"], ["مصاريف تانية", fmt(y.X), "text-risk"],
    ["صافي الربح", signed(y.net), y.net < 0 ? "text-risk" : "text-money"], ["هامش الربح", `${y.margin}%`],
    ["متوسط الدخل الشهري", fmt(y.activeMonths ? y.I / y.activeMonths : 0)], ["شغلانات خلصت", String(y.done)], ["ساعات متسجلة بالتايمر", String(y.hours)],
  ];
  return (
    <>
      <div className="hidden items-center justify-between border-b border-rule pb-3 print:flex"><Brand href="/app" /><span className="num text-sm text-muted">{year}</span></div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold lg:text-[28px]">تقرير سنة <span className="num">{year}</span></h1>
          <p className="text-sm text-muted">{y.best ? `أحسن شهر: ${monthName(y.best)}` : "مفيش دخل متسجل في السنة دي"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <PrintButton file={`تقرير-سنة-${year}-دفتر-الاستوديو`} />
          <div className="flex items-center gap-1 rounded-xl border border-rule bg-sheet p-1" role="group" aria-label="السنة">
            <Link href={`/app/report/year?y=${year - 1}`} className="grid size-8 place-items-center rounded-lg text-muted hover:text-ink" aria-label="السنة اللي فاتت">›</Link>
            <span className="num min-w-14 text-center font-display text-sm font-semibold">{year}</span>
            {year < thisYear ? <Link href={`/app/report/year?y=${year + 1}`} className="grid size-8 place-items-center rounded-lg text-muted hover:text-ink" aria-label="السنة الجاية">‹</Link> : <span className="size-8" />}
          </div>
        </div>
      </header>

      <Card className="min-w-0 p-5 print:p-4">
        <h2 className="mb-3 text-lg font-bold">شهر بشهر</h2>
        <div className="flex h-48 items-end gap-1.5 border-b border-rule print:h-36" role="img" aria-label="الدخل والصرف كل شهر">
          {y.months.map((m) => (
            <div key={m.k} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className={`num hidden text-[10px] sm:block print:block ${m.net < 0 ? "text-risk" : "text-money"}`}>{m.I || m.S || m.X ? fmt(m.net) : ""}</span>
              <div className="flex w-full items-end justify-center gap-0.5" style={{ height: "80%" }}>
                <i className="block w-1/3 max-w-5 rounded-t bg-money" style={{ height: `${(m.I / max) * 100}%` }} />
                <i className="block w-1/3 max-w-5 rounded-t bg-risk-soft" style={{ height: `${((m.S + m.X) / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">{y.months.map((m, i) => <span key={m.k} className="min-w-0 flex-1 overflow-hidden text-center text-[10px] text-muted">{AR_MONTHS[i].slice(0, 3)}</span>)}</div>
        <div className="mt-2 flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-money" />دخل</span>
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-risk-soft" />اشتراكات ومصاريف</span>
        </div>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-2 print:grid-cols-2 print:gap-3">
        <Card className="p-5 print:p-4">
          <h2 className="mb-2 text-lg font-bold">الأرقام</h2>
          <dl className="grid">
            {kv.map(([k, v, c]) => (
              <div key={k} className="flex justify-between border-b border-rule py-2 last:border-b-0 print:py-1"><dt className="text-sm text-muted">{k}</dt><dd className={`num ${c ?? ""}`}>{v}</dd></div>
            ))}
          </dl>
        </Card>
        <div className="grid gap-5 print:gap-3">
          <Card className="grid gap-2.5 p-5 print:p-4">
            <h2 className="text-lg font-bold">أكتر العملاء دخلًا</h2>
            {y.clients.length ? y.clients.map(([name, amt]) => (
              <div key={name} className="grid grid-cols-[96px_1fr_72px] items-center gap-2.5 text-[13px]">
                <span className="truncate text-muted">{name}</span>
                <div className="h-2.5 overflow-hidden rounded bg-paper"><div className="h-full rounded bg-money" style={{ width: `${(amt / topClient) * 100}%` }} /></div>
                <span className="num text-left text-muted">{fmt(amt)}</span>
              </div>
            )) : <Empty>مفيش دخل باسم عملاء.</Empty>}
          </Card>
          <Card className="p-5 print:p-4">
            <h2 className="mb-1.5 text-lg font-bold">الاشتراكات كلّفتك</h2>
            {y.subs.length ? (
              <ul>{y.subs.map((s) => (
                <li key={s.name} className="flex justify-between border-b border-rule py-1.5 text-sm last:border-b-0">
                  <span>{s.name} <span className="text-xs text-muted">({s.months} {s.months <= 10 ? "شهور" : "شهر"})</span></span>
                  <span className="num text-risk">{fmt(s.total)}</span>
                </li>
              ))}</ul>
            ) : <Empty>مفيش اشتراكات.</Empty>}
          </Card>
        </div>
      </div>
      <p className="text-[13px] text-muted print:hidden">المبالغ بالـ{cur.short}. <Link href="/app/report" className="text-cyan">تقرير الشهر ‹</Link></p>
    </>
  );
}
