import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CURRENCIES } from "@/lib/constants";
import { isToken } from "@/lib/share";
import { invoiceNumber, invoiceTotals, safeFileName } from "@/lib/invoice";
import { now } from "@/lib/dates";
import { InvoiceDoc } from "@/components/docs";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "فاتورة" };

export default async function SharedInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) notFound();
  const t = await prisma.task.findUnique({ where: { shareToken: token, user: { suspendedAt: null } }, include: { user: { select: { name: true, email: true, currency: true } } } });
  if (!t || !t.agreed) notFound();
  const no = invoiceNumber(t);
  const cur = CURRENCIES.find((c) => c.code === t.user.currency)?.short ?? "ج.م";
  return (
    <>
      <div className="flex justify-end print:hidden"><PrintButton file={safeFileName(`فاتورة-${no}`)} /></div>
      <InvoiceDoc no={no} issued={now()} from={{ name: t.user.name, email: t.user.email }} client={t.client} title={t.title} {...invoiceTotals(t.agreed, t.paid)} cur={cur} />
    </>
  );
}
