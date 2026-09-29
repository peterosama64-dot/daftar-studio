import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadFx } from "@/lib/data";
import { now, shortDate } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { invoiceTotals } from "@/lib/invoice";
import { groupParts, groupTotals } from "@/lib/group-invoice";
import { PageHead } from "@/components/month";
import { Card, Empty, Pill } from "@/components/ui";

export const metadata = { title: "سجل الفواتير" };

/** Every issued invoice of a year, in number order, with what was billed, taxed, collected and still due. */
export default async function Invoices({ searchParams }: { searchParams: Promise<{ y?: string }> }) {
  const uid = await requireUser();
  const thisYear = now().getFullYear();
  const y = Number((await searchParams).y) || thisYear;
  const [rows, groups, fx] = await Promise.all([
    prisma.task.findMany({
      where: { userId: uid, invoiceNo: { not: null }, invoicedAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
      select: { id: true, title: true, client: true, agreed: true, paid: true, discount: true, taxRate: true, currency: true, invoiceNo: true, invoicedAt: true },
      orderBy: { invoicedAt: "asc" },
    }),
    prisma.clientInvoice.findMany({
      where: { userId: uid, issuedAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
      include: { tasks: { select: { id: true, title: true, agreed: true, paid: true, discount: true, taxRate: true, items: true, currency: true } } },
      orderBy: { issuedAt: "asc" },
    }),
    loadFx(uid),
  ]);
  const single = rows.map((t) => ({ id: t.id, href: `/app/tasks/${t.id}/invoice`, no: t.invoiceNo!, at: t.invoicedAt!, client: t.client, what: t.title, currency: t.currency, cancelled: false, m: invoiceTotals(t.agreed, t.paid, t.discount, t.taxRate) }));
  const grouped = groups.map((g) => ({
    id: g.id, href: `/app/invoices/${g.id}`, no: g.invoiceNo, at: g.issuedAt, client: g.client,
    what: `${g.tasks.length} شغلانات`, currency: g.tasks[0]?.currency ?? null, cancelled: !!g.cancelledAt, m: groupTotals(groupParts(g.tasks)),
  }));
  // Cancelled invoices keep their number in the log but add nothing to the totals.
  const list = [...single, ...grouped].sort((a, b) => a.no.localeCompare(b.no, "en"));
  const sum = (k: "total" | "tax" | "paid" | "remaining") => list.filter((t) => !t.cancelled).reduce((s, t) => s + fx.toBase(t.m[k], t.currency), 0);
  const c = fx.short(null);
  return (
    <>
      <PageHead title="سجل الفواتير" base="/app/invoices" sub={`${list.length} ${list.length === 1 ? "فاتورة" : "فواتير"} معتمدة في ${y}`}>
        <nav className="flex items-center gap-1 rounded-xl border border-rule bg-sheet p-1 text-sm" aria-label="السنة">
          <Link href={`/app/invoices?y=${y - 1}`} className="rounded-lg px-2.5 py-1 hover:bg-sunken" aria-label="السنة اللي فاتت">›</Link>
          <span className="num px-2">{y}</span>
          {y < thisYear && <Link href={`/app/invoices?y=${y + 1}`} className="rounded-lg px-2.5 py-1 hover:bg-sunken" aria-label="السنة الجاية">‹</Link>}
        </nav>
      </PageHead>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="الإجماليات">
        {([["الفواتير", sum("total"), ""], ["منها ضريبة", sum("tax"), ""], ["اتحصّل", sum("paid"), "text-money"], ["لسه مستحق", sum("remaining"), "text-wait"]] as const).map(([k, v, cls]) => (
          <div key={k} className="grid gap-0.5 rounded-xl border border-rule bg-sheet px-4 py-3">
            <span className="text-[0.8125rem] text-muted">{k}</span><span className={`num text-xl font-medium ${cls}`}>{fmt(v)} <span className="text-sm">{c}</span></span>
          </div>
        ))}
      </section>
      {list.length ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead><tr className="border-b border-rule bg-sunken text-right text-xs text-muted">
              <th className="px-3 py-2 font-medium">الرقم</th><th className="px-3 py-2 font-medium">التاريخ</th><th className="px-3 py-2 font-medium">العميل · الشغل</th>
              <th className="px-3 py-2 text-left font-medium">الإجمالي</th><th className="px-3 py-2 text-left font-medium">الضريبة</th><th className="px-3 py-2 font-medium">الحالة</th>
            </tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className={`border-b border-rule last:border-b-0 ${t.cancelled ? "text-muted" : ""}`}>
                  <td className="px-3 py-2"><Link href={t.href} className="num text-cyan">{t.no}</Link></td>
                  <td className="num px-3 py-2">{shortDate(t.at)}</td>
                  <td className="px-3 py-2 [overflow-wrap:anywhere]">{t.client || "—"} <span className="text-muted">· {t.what}</span></td>
                  <td className="num px-3 py-2 text-left">{fmt(t.m.total)} {fx.short(t.currency)}</td>
                  <td className="num px-3 py-2 text-left text-muted">{t.m.tax ? fmt(t.m.tax) : "—"}</td>
                  <td className="px-3 py-2">{t.cancelled ? <Pill>ملغية</Pill> : t.m.remaining === 0 ? <Pill tone="money">اتدفعت</Pill> : t.m.paid ? <Pill tone="waiting">فاضل {fmt(t.m.remaining)}</Pill> : <Pill tone="waiting">مستحقة</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : <Empty>مفيش فواتير معتمدة في {y}. افتح مهمة ← «الفاتورة» ← «اعتمد الفاتورة».</Empty>}
    </>
  );
}
