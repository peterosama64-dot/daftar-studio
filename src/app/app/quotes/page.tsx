import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadFx } from "@/lib/data";
import { fmt } from "@/lib/money";
import { shortDate } from "@/lib/dates";
import { quoteNumber, quoteTotal, readItems } from "@/lib/quote";
import { PageHead } from "@/components/month";
import { Card, Empty, Pill } from "@/components/ui";
import { QuoteForm } from "@/components/quote-form";

export const metadata = { title: "عروض الأسعار" };

export default async function Quotes() {
  const uid = await requireUser();
  const [quotes, fx] = await Promise.all([prisma.quote.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 100 }), loadFx(uid)]);
  return (
    <>
      <PageHead title="عروض الأسعار" base="/app/quotes" sub="ابعت للعميل عرض سعر، ولما يوافق يتحوّل لشغلانة بضغطة" />
      <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card className="p-5"><h2 className="mb-3 text-lg font-bold">عرض سعر جديد</h2><QuoteForm base={fx.base} currencies={fx.usable.map((c) => ({ code: c, short: fx.short(c) }))} /></Card>
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">العروض</h2>
          {quotes.length ? (
            <ul>
              {quotes.map((q) => (
                <li key={q.id} className="border-b border-rule last:border-b-0">
                  <Link href={`/app/quotes/${q.id}`} className="flex items-center gap-3 py-3 hover:text-cyan">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold [overflow-wrap:anywhere]">{q.title}</span>
                      <span className="text-xs text-muted">{[q.client, quoteNumber(q), shortDate(q.createdAt)].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="num">{fmt(quoteTotal(readItems(q.items)))} <span className="text-xs text-muted">{fx.short(q.currency)}</span></span>
                    {q.status === "accepted" ? <Pill tone="money">اتوافق عليه</Pill> : <Pill tone="waiting">مستني رد</Pill>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>لسه معملتش عروض أسعار.</Empty>}
        </Card>
      </div>
    </>
  );
}
