import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort, loadFx } from "@/lib/data";
import { fmt } from "@/lib/money";
import { clientHref } from "@/lib/contact";
import { hoursLabel, rateReport } from "@/lib/rates";
import { PageHead } from "@/components/month";
import { Card, Empty } from "@/components/ui";

export const metadata = { title: "سعر ساعتك" };

export default async function Rates() {
  const uid = await requireUser();
  const [tasks, cur, fx] = await Promise.all([
    prisma.task.findMany({ where: { userId: uid, agreed: { gt: 0 } }, select: { id: true, title: true, client: true, agreed: true, timeSpent: true, timerStart: true, currency: true } }),
    currencyShort(uid),
    loadFx(uid),
  ]);
  const r = rateReport(tasks.map((t) => ({ ...t, agreed: t.agreed === null ? null : fx.toBase(t.agreed, t.currency) })));
  const max = Math.max(...r.clients.map((c) => c.rate), 1);
  const per = `${cur.short}/ساعة`;
  const job = (j: (typeof r.best)[number]) => (
    <li key={j.id} className="flex flex-wrap items-center gap-2 border-b border-rule py-2 text-sm last:border-b-0">
      <Link href={`/app/tasks/${j.id}`} className="min-w-0 flex-1 [overflow-wrap:anywhere] hover:text-cyan">{j.title}{j.client ? <span className="text-muted"> · {j.client}</span> : null}</Link>
      <span className="text-muted">{fmt(j.earned)} في {hoursLabel(j.hours)}</span>
      <span className="num font-medium">{fmt(j.rate)}</span>
    </li>
  );
  return (
    <>
      <Link href="/app/report" className="text-sm text-cyan">› التقرير</Link>
      <PageHead title="سعر ساعتك" base="/app/report/rates" sub="من التايمر: كل شغلانة جابتلك كام في الساعة، عشان تعرف تسعّر صح" />
      {r.overall === null ? (
        <Card className="p-5">
          <Empty>لسه مفيش شغل متسعّر ومتسجّل وقته. شغّل التايمر من صفحة أي مهمة ليها مبلغ، وبعد ربع ساعة شغل هيظهر هنا.</Empty>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="الأرقام">
            {[
              ["متوسط ساعتك", `${fmt(r.overall)}`, per],
              ["ساعات متسجّلة", hoursLabel(r.hours), `في ${r.jobs} شغلانة`],
              ["جابوا", fmt(r.earned), cur.short],
              ["شغل من غير وقت", String(r.untracked), "مش داخل في الحساب"],
            ].map(([k, v, s]) => (
              <div key={k} className="grid gap-0.5 rounded-xl border border-rule bg-sheet px-4 py-3">
                <span className="text-[0.8125rem] text-muted">{k}</span>
                <span dir="rtl" className="num text-right text-xl font-medium">{v}</span>
                <span className="text-xs text-muted">{s}</span>
              </div>
            ))}
          </section>
          <Card className="p-5">
            <h2 className="mb-1 text-lg font-bold">حسب العميل</h2>
            <p className="mb-3 text-[0.8125rem] text-muted">الخط الرفيع = متوسطك ({fmt(r.overall)} {per}). الأخضر فوق المتوسط، والبرتقاني تحته — يمكن محتاج تزوّد سعره.</p>
            <ul className="grid gap-3">
              {r.clients.map((c) => {
                const above = c.rate >= r.overall!;
                return (
                  <li key={c.name} className="grid gap-1">
                    <div className="flex flex-wrap items-baseline gap-2 text-sm">
                      <Link href={clientHref(c.name)} className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere] hover:text-cyan">{c.name}</Link>
                      <span className="text-muted">{c.jobs} شغلانة · {hoursLabel(c.hours)}</span>
                      <span className={`num font-semibold ${above ? "text-money" : "text-wait"}`}>{fmt(c.rate)}</span>
                    </div>
                    <div className="relative h-2.5 rounded bg-paper" aria-hidden="true">
                      <div className={`h-full rounded ${above ? "bg-money" : "bg-wait"}`} style={{ width: `${(c.rate / max) * 100}%` }} />
                      <div className="absolute inset-y-[-3px] w-0.5 bg-ink" style={{ insetInlineStart: `${(r.overall! / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-2 text-lg font-bold">أحسن شغل في الساعة</h2>
              <ul>{r.best.map(job)}</ul>
            </Card>
            {r.worst.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-2 text-lg font-bold">أقل شغل في الساعة</h2>
                <ul>{r.worst.map(job)}</ul>
              </Card>
            )}
          </div>
        </>
      )}
    </>
  );
}
