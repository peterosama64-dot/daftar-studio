import Link from "next/link";
import { notFound } from "next/navigation";
import { PARTY_SELECT, noParty } from "@/lib/party";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadFx } from "@/lib/data";
import { safeFileName } from "@/lib/invoice";
import { groupParts, groupTotals } from "@/lib/group-invoice";
import { Card } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { InvoiceDoc } from "@/components/docs";
import { ShareBox } from "@/components/share-box";
import { ConfirmButton } from "@/components/confirm-button";
import { cancelGroupInvoice, shareGroupInvoice, unshareGroupInvoice } from "../../actions";

export const metadata = { title: "فاتورة مجمّعة" };

export default async function GroupInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await requireUser();
  const [inv, user, fx] = await Promise.all([
    prisma.clientInvoice.findFirst({
      where: { id, userId: uid },
      include: { tasks: { select: { id: true, title: true, agreed: true, paid: true, discount: true, taxRate: true, items: true, currency: true }, orderBy: { createdAt: "asc" } } },
    }),
    prisma.user.findUnique({ where: { id: uid }, select: PARTY_SELECT }),
    loadFx(uid),
  ]);
  if (!inv) notFound();
  const parts = groupParts(inv.tasks);
  const totals = groupTotals(parts);
  const cur = fx.short(inv.tasks[0]?.currency ?? null);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/app/invoices" className="text-sm text-cyan">› سجل الفواتير</Link>
        <div className="flex flex-wrap items-center gap-2">
          {!inv.cancelledAt && !inv.shareToken && <ShareBox path={null} what="الفاتورة" make={shareGroupInvoice.bind(null, inv.id)} revoke={unshareGroupInvoice.bind(null, inv.id)} />}
          <PrintButton file={safeFileName(`فاتورة-${inv.client}-${inv.invoiceNo}`)} />
        </div>
      </div>
      {inv.shareToken && <div className="mx-auto w-full max-w-2xl"><ShareBox path={`/s/gi/${inv.shareToken}`} what="الفاتورة" make={shareGroupInvoice.bind(null, inv.id)} revoke={unshareGroupInvoice.bind(null, inv.id)} /></div>}
      <Card className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 p-4 print:hidden">
        {inv.cancelledAt
          ? <p className="text-sm text-risk">الفاتورة دي اتلغت، والشغلانات رجعت تتفوتر لوحدها. رقمها محجوز ومش بيتكرر.</p>
          : <>
              <p className="text-sm text-muted">فاتورة واحدة لـ {inv.tasks.length} شغلانات لـ{inv.client}. الدفعات بتتسجّل على كل شغلانة زي ما هي.</p>
              <form action={cancelGroupInvoice.bind(null, inv.id)}>
                <ConfirmButton message="هتلغي الفاتورة المجمّعة؟ الشغلانات هترجع تتفوتر لوحدها." className="text-sm text-risk">ألغي الفاتورة</ConfirmButton>
              </form>
            </>}
      </Card>
      <InvoiceDoc no={inv.invoiceNo} issued={inv.issuedAt} from={user ?? noParty} client={inv.client} parts={parts} {...totals} cur={cur} />
    </>
  );
}
