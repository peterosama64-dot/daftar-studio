import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort } from "@/lib/data";
import { now } from "@/lib/dates";
import { invoiceNumber, invoiceTotals, safeFileName } from "@/lib/invoice";
import { Card, btnClass } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { InvoiceDoc } from "@/components/docs";
import { ShareBox } from "@/components/share-box";
import { shareInvoice, unshareInvoice } from "../../../actions";

export const metadata = { title: "فاتورة" };

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
  const totals = invoiceTotals(t.agreed, t.paid);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {back}
        <div className="flex flex-wrap items-center gap-2">
          {!t.shareToken && <ShareBox path={null} what="الفاتورة" make={shareInvoice.bind(null, t.id)} revoke={unshareInvoice.bind(null, t.id)} />}
          <PrintButton file={safeFileName(`فاتورة-${t.client || "عميل"}-${no}`)} />
        </div>
      </div>
      {t.shareToken && <div className="mx-auto w-full max-w-2xl"><ShareBox path={`/s/i/${t.shareToken}`} what="الفاتورة" make={shareInvoice.bind(null, t.id)} revoke={unshareInvoice.bind(null, t.id)} /></div>}
      <InvoiceDoc no={no} issued={now()} from={{ name: user?.name ?? null, email: user?.email ?? "" }} client={t.client} title={t.title} {...totals} cur={cur.short} />
    </>
  );
}
