import { notFound } from "next/navigation";
import { PARTY_SELECT } from "@/lib/party";
import { prisma } from "@/lib/db";
import { curShort } from "@/lib/fx";
import { isToken } from "@/lib/share";
import { safeFileName } from "@/lib/invoice";
import { groupParts, groupTotals } from "@/lib/group-invoice";
import { InvoiceDoc } from "@/components/docs";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "فاتورة" };

/** The client's copy of a combined invoice. */
export default async function SharedGroupInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) notFound();
  const inv = await prisma.clientInvoice.findUnique({
    where: { shareToken: token, cancelledAt: null, user: { suspendedAt: null } },
    include: { user: { select: { ...PARTY_SELECT, currency: true } }, tasks: { select: { id: true, title: true, agreed: true, paid: true, discount: true, taxRate: true, items: true, currency: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!inv) notFound();
  const parts = groupParts(inv.tasks);
  return (
    <>
      <div className="flex justify-end print:hidden"><PrintButton file={safeFileName(`فاتورة-${inv.invoiceNo}`)} /></div>
      <InvoiceDoc no={inv.invoiceNo} issued={inv.issuedAt} from={inv.user} client={inv.client} parts={parts} {...groupTotals(parts)} cur={curShort(inv.tasks[0]?.currency ?? inv.user.currency)} />
    </>
  );
}
