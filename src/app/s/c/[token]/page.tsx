import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { portalFor } from "@/lib/portal";
import { makeFx, parseRates } from "@/lib/fx";
import { fmt } from "@/lib/money";
import { shortDate } from "@/lib/dates";
import { quoteExpired, quoteTotal, readItems } from "@/lib/quote";
import { Card, Pill } from "@/components/ui";

export const metadata = { title: "ملف العميل" };

/** The client's page: every quote, bill and delivery from this designer, in one link. */
export default async function Portal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await portalFor(token);
  if (!p) notFound();
  const where = { userId: p.userId, client: p.name };
  const [quotes, tasks] = await Promise.all([
    prisma.quote.findMany({ where, orderBy: { createdAt: "desc" } }),
    prisma.task.findMany({
      where, orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, agreed: true, paid: true, currency: true, due: true, reviewToken: true, approvedAt: true, installments: { orderBy: [{ position: "asc" }, { id: "asc" }], select: { label: true, amount: true, due: true, paidAt: true } } },
    }),
  ]);
  const billed = tasks.filter((t) => t.agreed);
  // Totals in the jobs' currency when they share one; mixed currencies are added up in the designer's main currency.
  const fx = makeFx(p.user.currency, parseRates(p.user.fxRates));
  const codes = new Set(billed.map((t) => fx.of(t.currency)));
  const mixed = codes.size > 1;
  const conv = (a: number, c: string | null) => (mixed ? fx.toBase(a, c) : a);
  const total = billed.reduce((s, t) => s + conv(t.agreed ?? 0, t.currency), 0);
  const paid = billed.reduce((s, t) => s + conv(Math.min(t.paid ?? 0, t.agreed ?? 0), t.currency), 0);
  const cur = fx.short(mixed ? fx.base : [...codes][0]);
  const tcur = (c: string | null) => (mixed ? ` ${fx.short(c)}` : "");
  const from = p.user.name || p.user.email;
  const stat = (k: string, v: number, c = "") => (
    <div className="grid gap-0.5 rounded-xl border border-rule bg-sheet px-4 py-3"><span className="text-[13px] text-muted">{k}</span><span className={`num text-xl font-medium ${c}`}>{fmt(v)}</span></div>
  );
  return (
    <>
      <header className="grid gap-1">
        <p className="text-sm text-muted">من {from}</p>
        <h1 className="text-2xl font-bold [overflow-wrap:anywhere]">أهلاً {p.name}</h1>
        <p className="text-sm text-ink2">هنا كل عروض الأسعار والفواتير والتسليمات بتاعتك في مكان واحد. المبالغ بالـ{cur}.</p>
      </header>
      {billed.length > 0 && (
        <section className="grid grid-cols-3 gap-3" aria-label="الحساب">
          {stat("إجمالي الشغل", total)}{stat("اتدفع", paid, "text-money")}{stat("الباقي", total - paid, total - paid > 0 ? "text-wait" : "")}
        </section>
      )}
      {billed.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">الفواتير</h2>
          <ul>{billed.map((t) => {
            const rem = Math.max(0, (t.agreed ?? 0) - (t.paid ?? 0));
            return (
              <li key={t.id} className="grid gap-1.5 border-b border-rule py-3 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/s/c/${token}/i/${t.id}`} className="min-w-0 flex-1 font-medium text-cyan [overflow-wrap:anywhere] hover:underline">{t.title}</Link>
                  <span className="num text-sm text-muted">{fmt(t.agreed ?? 0)}{tcur(t.currency)}</span>
                  {rem > 0 ? <Pill tone="waiting">باقي {fmt(rem)}{tcur(t.currency)}</Pill> : <Pill tone="money">خالص</Pill>}
                </div>
                {t.installments.length > 0 && (
                  <ul className="grid gap-0.5 ps-3 text-[13px] text-muted">{t.installments.map((x, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2">
                      <span>{x.label}</span><span className="num">{fmt(x.amount)}</span>
                      <span>{x.paidAt ? "· اتدفعت ✓" : x.due ? `· ميعادها ${shortDate(x.due)}` : ""}</span>
                    </li>
                  ))}</ul>
                )}
              </li>
            );
          })}</ul>
        </Card>
      )}
      {quotes.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">عروض الأسعار</h2>
          <ul>{quotes.map((q) => {
            const expired = q.status !== "accepted" && quoteExpired(q.createdAt, q.validDays);
            return (
              <li key={q.id} className="border-b border-rule last:border-b-0">
                <Link href={`/s/c/${token}/q/${q.id}`} className="flex flex-wrap items-center gap-2 py-2.5 hover:text-cyan">
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{q.title}</span>
                  <span className="num text-sm text-muted">{fmt(quoteTotal(readItems(q.items)))} {fx.short(q.currency)}</span>
                  {q.status === "accepted" ? <Pill tone="money">اتوافق</Pill> : expired ? <Pill>انتهى</Pill> : <Pill tone="waiting">مستني موافقتك</Pill>}
                </Link>
              </li>
            );
          })}</ul>
        </Card>
      )}
      {tasks.some((t) => t.reviewToken) && (
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">التسليمات</h2>
          <ul>{tasks.filter((t) => t.reviewToken).map((t) => (
            <li key={t.id} className="border-b border-rule last:border-b-0">
              <Link href={`/s/r/${t.reviewToken}`} className="flex items-center gap-2 py-2.5 hover:text-cyan">
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{t.title}</span>
                {t.approvedAt ? <Pill tone="money">وافقت عليه</Pill> : <Pill tone="waiting">مستني رأيك</Pill>}
              </Link>
            </li>
          ))}</ul>
        </Card>
      )}
      {!billed.length && !quotes.length && !tasks.some((t) => t.reviewToken) && <p className="text-muted">لسه مفيش حاجة هنا.</p>}
    </>
  );
}
