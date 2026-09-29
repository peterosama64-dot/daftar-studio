import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort, loadFx } from "@/lib/data";
import { fmt } from "@/lib/money";
import { now } from "@/lib/dates";
import { clientHref } from "@/lib/contact";
import { clientProfit, profitVerdict } from "@/lib/client-profit";
import { hoursLabel } from "@/lib/rates";
import { PageHead } from "@/components/month";
import { Card, Empty, Pill } from "@/components/ui";

export const metadata = { title: "مين بيكسّبك" };

export default async function ClientProfit() {
  const uid = await requireUser();
  const [tasks, income, cur, fx] = await Promise.all([
    prisma.task.findMany({
      where: { userId: uid },
      select: { id: true, client: true, agreed: true, paid: true, status: true, doneAt: true, timeSpent: true, timerStart: true, currency: true, discount: true, taxRate: true, revisionsAllowed: true, _count: { select: { revisions: true } } },
    }),
    prisma.entry.findMany({ where: { userId: uid, kind: "income" }, select: { client: true, name: true, amount: true, date: true } }),
    currencyShort(uid),
    loadFx(uid),
  ]);
  const rows = clientProfit(
    tasks.map((t) => ({
      id: t.id, client: t.client, status: t.status, doneAt: t.doneAt, timeSpent: t.timeSpent, timerStart: t.timerStart,
      agreed: t.agreed === null ? null : fx.toBase(t.agreed, t.currency), paid: t.paid === null ? null : fx.toBase(t.paid, t.currency),
      revisions: t._count.revisions, allowed: t.revisionsAllowed,
      // The discount is in the job's own currency, like the price it comes off.
      discount: t.discount === null ? null : fx.toBase(t.discount, t.currency), taxRate: t.taxRate,
    })),
    income, now(),
  );
  const verdict = profitVerdict(rows, (n) => `${fmt(n)} ${cur.short}`);
  const max = Math.max(...rows.map((r) => r.rate ?? 0), 1);

  return (
    <>
      <Link href="/app/report" className="text-sm text-cyan">› التقرير</Link>
      <PageHead title="مين بيكسّبك" base="/app/report/clients" sub="مش اللي دفع أكتر، لكن اللي ساعتك معاه بتجيب أكتر بعد الوقت والتعديلات والتأخير" />
      {verdict && <p className="rounded-xl border border-cyan bg-cyan-soft px-4 py-3 text-[0.9375rem]">{verdict}</p>}
      {rows.length ? (
        <div className="grid gap-2.5">
          {rows.map((r) => (
            <Card key={r.name} className="grid gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={clientHref(r.name)} className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere] hover:text-cyan">{r.name}</Link>
                {r.rate !== null ? <span className="num text-lg font-bold">{fmt(r.rate)} <span className="text-xs font-normal text-muted">{cur.short}/ساعة</span></span>
                  : <span className="text-sm text-muted">مفيش وقت متسجّل</span>}
              </div>
              {r.rate !== null && (
                <div className="h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                  <div className="h-full rounded-full bg-cyan" style={{ width: `${Math.max(3, (r.rate / max) * 100)}%` }} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <span>دفع <span className="num text-ink">{fmt(r.income)}</span> {cur.short}</span>
                <span><span className="num text-ink">{r.jobs}</span> {r.jobs === 1 ? "شغلانة" : "شغلانات"}</span>
                {r.hours > 0 && <span>{hoursLabel(r.hours)}</span>}
                {r.revisions > 0 && <span><span className="num text-ink">{r.revisions}</span> تعديل</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.extraRevisions > 0 && <Pill tone="waiting">{r.extraRevisions} تعديل زيادة عن المتفق</Pill>}
                {r.owed > 0 && <Pill tone="waiting">لسه عليه {fmt(r.owed)} {cur.short}</Pill>}
                {r.waitDays !== null && r.waitDays >= 30 && <Pill tone="urgent">فلوس مستنية من {r.waitDays} يوم</Pill>}
              </div>
            </Card>
          ))}
        </div>
      ) : <Card className="p-5"><Empty>لسه مفيش عملاء. سجّل شغلك وفلوسك وهتلاقي المقارنة هنا.</Empty></Card>}
      <p className="text-xs text-muted">الترتيب بسعر الساعة بعد خصم بسيط على كل تعديل زيادة وكل شهر تأخير في الدفع. الشغل من غير تايمر مش داخل في حساب الساعة.</p>
    </>
  );
}
