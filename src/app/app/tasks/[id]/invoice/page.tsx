import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort } from "@/lib/data";
import { now } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { invoiceNumber, invoiceTotals, safeFileName } from "@/lib/invoice";
import { Brand, Card, btnClass } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "فاتورة" };

const longDate = (d: Date) => d.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric" });

export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await requireUser();
  const [t, user, cur] = await Promise.all([
    prisma.task.findFirst({ where: { id, userId: uid } }),
    prisma.user.findUnique({ where: { id: uid }, select: { name: true, email: true } }),
    currencyShort(uid),
  ]);
  if (!t) notFound();
  const back = <Link href={`/app/tasks/${t.id}`} className="text-sm text-cyan print:hidden">› رجوع للمهمة</Link>;
  if (!t.agreed) {
    return (
      <>
        {back}
        <Card className="mx-auto grid w-full max-w-2xl gap-3 p-6 text-center">
          <p className="font-semibold">الفاتورة محتاجة المبلغ المتفق عليه.</p>
          <p className="text-sm text-muted">اكتبه في المهمة واحفظ، وبعدها ارجع هنا.</p>
          <Link href={`/app/tasks/${t.id}`} className={`${btnClass("primary")} mx-auto`}>افتح المهمة</Link>
        </Card>
      </>
    );
  }
  const no = invoiceNumber(t);
  const { total, paid, remaining } = invoiceTotals(t.agreed, t.paid);
  const row = (k: string, v: string, strong = false) => (
    <div className={`flex justify-between py-1.5 ${strong ? "border-t-2 border-ink pt-2.5 font-bold" : ""}`}>
      <span className={strong ? "" : "text-muted"}>{k}</span><span className="num">{v} {cur.short}</span>
    </div>
  );
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {back}
        <PrintButton file={safeFileName(`فاتورة-${t.client || "عميل"}-${no}`)} />
      </div>
      <Card className="mx-auto grid w-full max-w-2xl gap-6 p-6 lg:p-9 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-5">
          <div className="grid gap-1">
            <h1 className="text-3xl font-extrabold">فاتورة</h1>
            <p className="num text-sm text-muted">{no}</p>
          </div>
          <div className="grid gap-1 text-sm sm:text-left">
            <span className="text-muted">تاريخ الإصدار</span>
            <span className="font-semibold">{longDate(now())}</span>
          </div>
        </header>

        <section className="grid gap-5 sm:grid-cols-2 print:grid-cols-2">
          <div className="grid gap-1">
            <span className="text-xs text-muted">من</span>
            <span className="font-display text-lg font-bold">{user?.name || user?.email}</span>
            {user?.name && <span dir="ltr" className="text-right text-sm text-ink2">{user.email}</span>}
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted">إلى</span>
            <span className="font-display text-lg font-bold">{t.client || "—"}</span>
          </div>
        </section>

        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-ink text-right text-sm text-muted">
              <th className="py-2 font-medium">البيان</th>
              <th className="w-40 py-2 text-left font-medium">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-rule">
              <td className="py-3 font-semibold">{t.title}</td>
              <td className="num py-3 text-left">{fmt(total)} {cur.short}</td>
            </tr>
          </tbody>
        </table>

        <div className="grid w-full gap-0.5 text-[15px] sm:mr-auto sm:max-w-xs print:mr-auto print:max-w-xs">
          {row("الإجمالي", fmt(total))}
          {row("المدفوع", fmt(paid))}
          {row("المتبقي المستحق", fmt(remaining), true)}
        </div>

        {remaining === 0 && <p className="text-center font-semibold text-money">تم سداد الفاتورة بالكامل. شكرًا لكم.</p>}
        <footer className="border-t border-rule pt-4 text-center text-sm text-muted">
          <p>شكرًا لتعاملكم معنا.</p>
          <div className="mt-3 hidden justify-center opacity-60 print:flex"><Brand href="/app" /></div>
        </footer>
      </Card>
    </>
  );
}
