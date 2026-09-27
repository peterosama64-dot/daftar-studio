import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { portalFor } from "@/lib/portal";
import { invoiceNumber, invoiceTotals, safeFileName } from "@/lib/invoice";
import { now } from "@/lib/dates";
import { InvoiceDoc } from "@/components/docs";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "فاتورة" };

export default async function PortalInvoice({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const p = await portalFor(token);
  if (!p) notFound();
  const t = await prisma.task.findFirst({ where: { id, userId: p.userId, client: p.name } });
  if (!t?.agreed) notFound();
  const no = invoiceNumber(t);
  return (
    <>
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/s/c/${token}`} className="text-sm text-cyan">› كل الملف</Link>
        <PrintButton file={safeFileName(`فاتورة-${no}`)} />
      </div>
      <InvoiceDoc no={no} issued={now()} from={{ name: p.user.name, email: p.user.email }} client={t.client} title={t.title} {...invoiceTotals(t.agreed, t.paid)} cur={p.cur} />
    </>
  );
}
