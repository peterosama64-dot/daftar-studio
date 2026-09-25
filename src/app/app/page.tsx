import { requireUser } from "@/lib/auth";
import { Capture } from "@/components/capture";
import { MoneyStrip } from "@/components/money-strip";
import { TaskCard } from "@/components/task-card";
import { PageHead } from "@/components/month";
import { Empty, Pill, SectionHead } from "@/components/ui";
import { loadMonth, monthFrom, type SP } from "@/lib/data";
import { AR_DAYS, AR_MONTHS, daysUntil, shortDate } from "@/lib/dates";
import { fmt } from "@/lib/money";

export default async function Home({ searchParams }: { searchParams: SP }) {
  const uid = await requireUser();
  const month = await monthFrom(searchParams);
  const { today, urgent, tasks, entries, totals, cur } = await loadMonth(month, uid);
  const h = today.getHours();
  const greet = h < 12 ? "صباح الخير" : "مساء الخير";

  // Next 7 days: tasks due + subscriptions/income expected are shown by date.
  const week = tasks
    .filter((t) => t.status !== "done" && t.due && (daysUntil(t.due, today) ?? 99) >= 0 && (daysUntil(t.due, today) ?? 99) <= 7)
    .sort((a, b) => a.due!.getTime() - b.due!.getTime());

  return (
    <>
      <PageHead title={greet} base="/app" month={month}
        sub={`${AR_DAYS[today.getDay()]} ${today.getDate()} ${AR_MONTHS[today.getMonth()]}${urgent.length ? ` · عندك ${urgent.length} ${urgent.length === 1 ? "حاجة مستعجلة" : "حاجات مستعجلة"}` : ""}`} />
      <MoneyStrip I={totals.I} S={totals.S} X={totals.X} net={totals.net} cur={cur.short} />
      <Capture />
      {!tasks.length && !entries.length && (
        <Empty>الدفتر لسه فاضي. قول أو اكتب أول حاجة فوق، زي «لازم أسلّم البوستر السبت، واستلمت ٣٠٠٠ من العميل».</Empty>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <SectionHead title="ابدأ بدول" count={urgent.length} rule="risk" />
          <div className="grid gap-2.5">
            {urgent.length ? urgent.slice(0, 6).map((t) => <TaskCard key={t.id} t={t} today={today} />) : <Empty>مفيش حاجة مستعجلة.</Empty>}
          </div>
        </section>
        <section>
          <SectionHead title="الأسبوع ده" />
          {week.length ? (
            <ul className="grid">
              {week.map((t) => (
                <li key={t.id} className="flex items-center gap-3 border-b border-rule py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="num text-right text-[11px] text-muted">{AR_DAYS[t.due!.getDay()]} {shortDate(t.due!)}</div>
                    <div className="text-sm [overflow-wrap:anywhere]">{t.title}</div>
                  </div>
                  {t.priority === "high" ? <Pill tone="urgent">مستعجل</Pill> : <Pill tone="later">مهمة</Pill>}
                </li>
              ))}
            </ul>
          ) : <Empty>مفيش مواعيد تسليم في الأسبوع ده.</Empty>}
          {totals.subs.length > 0 && (
            <p className="mt-3 text-[13px] text-muted">اشتراكاتك الشهر ده: <span className="num">{fmt(totals.S)}</span> {cur.short}</p>
          )}
        </section>
      </div>
    </>
  );
}
