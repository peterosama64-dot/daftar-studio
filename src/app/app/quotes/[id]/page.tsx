import { PARTY_SELECT, noParty } from "@/lib/party";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadFx } from "@/lib/data";
import { quoteNumber, quoteTotal, readItems, validUntil } from "@/lib/quote";
import { safeFileName } from "@/lib/invoice";
import { Button, btnClass } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { QuoteDoc } from "@/components/docs";
import { ShareBox } from "@/components/share-box";
import { ConfirmButton } from "@/components/confirm-button";
import { acceptQuote, deleteQuote, shareQuote, unshareQuote } from "../../actions";

export const metadata = { title: "عرض سعر" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await requireUser();
  const [q, user, cur] = await Promise.all([
    prisma.quote.findFirst({ where: { id, userId: uid } }),
    prisma.user.findUnique({ where: { id: uid }, select: PARTY_SELECT }),
    loadFx(uid),
  ]);
  if (!q) notFound();
  const items = readItems(q.items);
  const no = quoteNumber(q);
  const share = { what: "عرض السعر", make: shareQuote.bind(null, q.id), revoke: unshareQuote.bind(null, q.id) };
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/app/quotes" className="text-sm text-cyan">› كل العروض</Link>
        <div className="flex flex-wrap items-center gap-2">
          {q.status === "accepted" && q.taskId
            ? <Link href={`/app/tasks/${q.taskId}`} className={btnClass("secondary", true)}>افتح المهمة</Link>
            : <form action={acceptQuote.bind(null, q.id)}><Button small>العميل وافق ← اعمل مهمة</Button></form>}
          {!q.shareToken && <ShareBox path={null} {...share} />}
          <PrintButton file={safeFileName(`عرض-سعر-${q.client || "عميل"}-${no}`)} />
        </div>
      </div>
      {q.shareToken && (
        <div className="mx-auto w-full max-w-2xl">
          <ShareBox path={`/s/q/${q.shareToken}`} {...share} />
          {q.status !== "accepted" && <p className="mt-1.5 text-[0.8125rem] text-muted print:hidden">العميل يقدر يوافق من اللينك، وساعتها المهمة بتتعمل لوحدها ويوصلك تنبيه.</p>}
        </div>
      )}
      <QuoteDoc no={no} created={q.createdAt} validUntil={validUntil(q.createdAt, q.validDays)} from={user ?? noParty}
        client={q.client} title={q.title} items={items} total={quoteTotal(items)} deliveryDays={q.deliveryDays} notes={q.notes} cur={cur.short(q.currency)} />
      <form action={deleteQuote.bind(null, q.id)} className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-2 print:hidden">
        <ConfirmButton className="text-sm font-medium text-risk"
          message={q.status === "accepted" ? "تمسح العرض؟ المهمة اللي اتعملت منه هتفضل زي ما هي." : "تمسح العرض ده؟"}>امسح العرض</ConfirmButton>
        {q.status === "accepted" && <span className="text-[0.8125rem] text-muted">المهمة اللي اتعملت منه هتفضل زي ما هي.</span>}
      </form>
    </>
  );
}
