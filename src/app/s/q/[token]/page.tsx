import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CURRENCIES } from "@/lib/constants";
import { isToken } from "@/lib/share";
import { quoteNumber, quoteTotal, readItems, validUntil } from "@/lib/quote";
import { safeFileName } from "@/lib/invoice";
import { now } from "@/lib/dates";
import { QuoteDoc } from "@/components/docs";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui";
import { acceptSharedQuote } from "../../actions";

export const metadata = { title: "عرض سعر" };

export default async function SharedQuote({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) notFound();
  const q = await prisma.quote.findUnique({ where: { shareToken: token, user: { suspendedAt: null } }, include: { user: { select: { name: true, email: true, currency: true } } } });
  if (!q) notFound();
  const items = readItems(q.items);
  const no = quoteNumber(q);
  const until = validUntil(q.createdAt, q.validDays);
  const expired = q.status !== "accepted" && until < new Date(now().getFullYear(), now().getMonth(), now().getDate());
  const cur = CURRENCIES.find((c) => c.code === q.user.currency)?.short ?? "ج.م";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {q.status === "accepted"
          ? <p className="font-semibold text-money">تمت الموافقة على العرض. شكرًا لكم.</p>
          : expired
            ? <p className="text-sm text-muted">انتهت مدة العرض. تواصل مع {q.user.name || "صاحب العرض"} لتحديثه.</p>
            : <form action={acceptSharedQuote.bind(null, token)}><Button>موافق على العرض</Button></form>}
        <PrintButton file={safeFileName(`عرض-سعر-${no}`)} />
      </div>
      <QuoteDoc no={no} created={q.createdAt} validUntil={until} from={{ name: q.user.name, email: q.user.email }} client={q.client} title={q.title}
        items={items} total={quoteTotal(items)} deliveryDays={q.deliveryDays} notes={q.notes} cur={cur} />
    </>
  );
}
