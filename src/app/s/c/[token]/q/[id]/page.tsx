import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { portalFor } from "@/lib/portal";
import { quoteExpired, quoteNumber, quoteTotal, readItems, validUntil } from "@/lib/quote";
import { safeFileName } from "@/lib/invoice";
import { QuoteDoc } from "@/components/docs";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui";
import { acceptPortalQuote } from "@/app/s/actions";

export const metadata = { title: "عرض سعر" };

export default async function PortalQuote({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const p = await portalFor(token);
  if (!p) notFound();
  const q = await prisma.quote.findFirst({ where: { id, userId: p.userId, client: p.name } });
  if (!q) notFound();
  const items = readItems(q.items);
  const no = quoteNumber(q);
  const expired = q.status !== "accepted" && quoteExpired(q.createdAt, q.validDays);
  return (
    <>
      <Link href={`/s/c/${token}`} className="text-sm text-cyan print:hidden">› كل الملف</Link>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {q.status === "accepted"
          ? <p className="font-semibold text-money">تمت الموافقة على العرض. شكرًا لكم.</p>
          : expired
            ? <p className="text-sm text-muted">انتهت مدة العرض. تواصل مع {p.user.name || "صاحب العرض"} لتحديثه.</p>
            : <form action={acceptPortalQuote.bind(null, token, q.id)}><Button>موافق على العرض</Button></form>}
        <PrintButton file={safeFileName(`عرض-سعر-${no}`)} />
      </div>
      <QuoteDoc no={no} created={q.createdAt} validUntil={validUntil(q.createdAt, q.validDays)} from={p.user} client={q.client} title={q.title}
        items={items} total={quoteTotal(items)} deliveryDays={q.deliveryDays} notes={q.notes} cur={p.cur} />
    </>
  );
}
