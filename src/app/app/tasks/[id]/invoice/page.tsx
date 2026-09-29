import { PARTY_SELECT, noParty } from "@/lib/party";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadFx } from "@/lib/data";
import { now } from "@/lib/dates";
import { formatInvoiceNo, invoiceLines, invoiceTotals, safeFileName, shownInvoiceNo } from "@/lib/invoice";
import { Button, Card, btnClass, inputClass } from "@/components/ui";
import { InvoiceLines } from "@/components/invoice-lines";
import { PrintButton } from "@/components/print-button";
import { InvoiceDoc } from "@/components/docs";
import { ShareBox } from "@/components/share-box";
import { issueInvoice, setInvoiceTerms, shareInvoice, unshareInvoice } from "../../../actions";

export const metadata = { title: "فاتورة" };

export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await requireUser();
  const [t, user, cur] = await Promise.all([
    prisma.task.findFirst({ where: { id, userId: uid } }),
    prisma.user.findUnique({ where: { id: uid }, select: { ...PARTY_SELECT, invoicePrefix: true, invoiceYear: true, invoiceSeq: true, taxRate: true } }),
    loadFx(uid),
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
  const no = shownInvoiceNo(t);
  const totals = invoiceTotals(t.agreed, t.paid, t.discount, t.taxRate);
  // Shared before sequential numbers existed: keeps its old number so the client's copy doesn't change.
  const legacy = !t.invoiceNo && !!t.shareToken;
  const draft = !t.invoiceNo && !legacy;
  const year = now().getFullYear();
  const nextNo = user ? formatInvoiceNo(user.invoicePrefix, year, user.invoiceYear === year ? user.invoiceSeq + 1 : 1) : "";
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
      <Card className="mx-auto grid w-full max-w-2xl gap-3 p-4 print:hidden">
        {draft ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">الفاتورة لسه مسودة. لما تعتمدها تاخد رقم <span className="num font-semibold">{nextNo}</span> وتاريخ النهارده، والرقم ده مش بيتكرر.</p>
            <form action={issueInvoice.bind(null, t.id)}><Button small>اعتمد الفاتورة</Button></form>
          </div>
        ) : <p className="text-sm text-muted">{legacy ? "الفاتورة دي اتبعتت قبل الترقيم المتسلسل، فمحتفظة برقمها القديم." : <>معتمدة برقم <span className="num font-semibold text-ink">{t.invoiceNo}</span>.</>}</p>}
        <form action={setInvoiceTerms.bind(null, t.id)} className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm font-medium">خصم ({cur.short(t.currency)})
            <input name="discount" defaultValue={t.discount ?? ""} inputMode="decimal" placeholder="0" className={`${inputClass} num w-28 text-left`} />
          </label>
          <label className="grid gap-1 text-sm font-medium">ضريبة القيمة المضافة %
            <input name="taxRate" defaultValue={t.taxRate ?? user?.taxRate ?? ""} inputMode="decimal" placeholder="مفيش" className={`${inputClass} num w-28 text-left`} />
          </label>
          <Button kind="secondary" small>احفظ</Button>
        </form>
        <InvoiceLines taskId={t.id} initial={invoiceLines(t)} title={t.title} cur={cur.short(t.currency)} />
        <p className="text-xs text-muted">الخصم والضريبة بيغيّروا المبلغ المستحق على العميل في كل حتة في الدفتر (الفلوس، العملاء، التذكير).{!t.taxRate && user?.taxRate ? ` نسبة ${user.taxRate}% مكتوبة من الإعدادات، دوس «احفظ» عشان تتطبق.` : ""}</p>
      </Card>
      <InvoiceDoc no={no} draft={draft} issued={t.invoicedAt ?? now()} from={user ?? noParty} client={t.client} title={t.title} lines={invoiceLines(t)} {...totals} cur={cur.short(t.currency)} />
    </>
  );
}
