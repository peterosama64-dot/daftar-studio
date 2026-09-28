import { PARTY_SELECT } from "@/lib/party";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { curShort } from "@/lib/fx";
import { isToken } from "@/lib/share";
import { invoiceTotals, safeFileName, shownInvoiceNo } from "@/lib/invoice";
import { now } from "@/lib/dates";
import { InvoiceDoc } from "@/components/docs";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "فاتورة" };

export default async function SharedInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) notFound();
  const t = await prisma.task.findUnique({ where: { shareToken: token, user: { suspendedAt: null } }, include: { user: { select: { ...PARTY_SELECT, currency: true } } } });
  if (!t || !t.agreed) notFound();
  const no = shownInvoiceNo(t);
  const cur = curShort(t.currency ?? t.user.currency);
  return (
    <>
      <div className="flex justify-end print:hidden"><PrintButton file={safeFileName(`فاتورة-${no}`)} /></div>
      <InvoiceDoc no={no} issued={t.invoicedAt ?? now()} from={t.user} client={t.client} title={t.title} {...invoiceTotals(t.agreed, t.paid, t.discount, t.taxRate)} cur={cur} />
    </>
  );
}
