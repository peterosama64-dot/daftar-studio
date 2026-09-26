import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort } from "@/lib/data";
import { fmt } from "@/lib/money";
import { quoteNumber, quoteTotal, readItems, validUntil } from "@/lib/quote";
import { safeFileName } from "@/lib/invoice";
import { Brand, Button, Card, btnClass } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { acceptQuote, deleteQuote } from "../../actions";

export const metadata = { title: "عرض سعر" };

const longDate = (d: Date) => d.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric" });

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await requireUser();
  const [q, user, cur] = await Promise.all([
    prisma.quote.findFirst({ where: { id, userId: uid } }),
    prisma.user.findUnique({ where: { id: uid }, select: { name: true, email: true } }),
    currencyShort(uid),
  ]);
  if (!q) notFound();
  const items = readItems(q.items);
  const no = quoteNumber(q);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/app/quotes" className="text-sm text-cyan">› كل العروض</Link>
        <div className="flex flex-wrap items-center gap-2">
          {q.status === "accepted" && q.taskId
            ? <Link href={`/app/tasks/${q.taskId}`} className={btnClass("secondary", true)}>افتح المهمة</Link>
            : <form action={acceptQuote.bind(null, q.id)}><Button small>العميل وافق ← اعمل مهمة</Button></form>}
          <PrintButton file={safeFileName(`عرض-سعر-${q.client || "عميل"}-${no}`)} />
        </div>
      </div>
      <Card className="mx-auto grid w-full max-w-2xl gap-6 p-6 lg:p-9 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-5">
          <div className="grid gap-1">
            <h1 className="text-3xl font-extrabold">عرض سعر</h1>
            <p className="num text-sm text-muted">{no}</p>
          </div>
          <div className="grid gap-1 text-sm sm:text-left">
            <span className="text-muted">التاريخ</span><span className="font-semibold">{longDate(q.createdAt)}</span>
            <span className="mt-1 text-muted">ساري حتى</span><span className="font-semibold">{longDate(validUntil(q.createdAt, q.validDays))}</span>
          </div>
        </header>
        <section className="grid gap-5 sm:grid-cols-2 print:grid-cols-2">
          <div className="grid gap-1">
            <span className="text-xs text-muted">من</span>
            <span className="font-display text-lg font-bold">{user?.name || user?.email}</span>
            {user?.name && <span dir="ltr" className="text-right text-sm text-ink2">{user.email}</span>}
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted">إلى</span>
            <span className="font-display text-lg font-bold">{q.client || "—"}</span>
          </div>
        </section>
        <div>
          <p className="mb-2 font-display text-lg font-bold">{q.title}</p>
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="border-b border-ink text-right text-sm text-muted">
                <th className="w-10 py-2 pl-3 font-medium">#</th><th className="py-2 font-medium">البيان</th><th className="w-40 py-2 text-left font-medium">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x, i) => (
                <tr key={i} className="border-b border-rule">
                  <td className="num py-2.5 pl-3 text-muted">{i + 1}</td>
                  <td className="py-2.5 [overflow-wrap:anywhere]">{x.desc}</td>
                  <td className="num py-2.5 text-left">{fmt(x.amount)} {cur.short}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between border-t-2 border-ink pt-2.5 text-[17px] font-bold sm:mr-auto sm:w-72 print:mr-auto print:w-72">
          <span>الإجمالي</span><span className="num">{fmt(quoteTotal(items))} {cur.short}</span>
        </div>
        {(q.deliveryDays || q.notes) && (
          <section className="grid gap-1.5 text-sm">
            {q.deliveryDays ? <p><span className="text-muted">مدة التنفيذ: </span>{q.deliveryDays} يوم من تاريخ الموافقة</p> : null}
            {q.notes && <p className="whitespace-pre-wrap"><span className="text-muted">الشروط: </span>{q.notes}</p>}
          </section>
        )}
        <footer className="border-t border-rule pt-4 text-center text-sm text-muted">
          <p>يسعدنا تعاونكم، ونتطلع للعمل معكم.</p>
          <div className="mt-3 hidden justify-center opacity-60 print:flex"><Brand href="/app" /></div>
        </footer>
      </Card>
      {q.status !== "accepted" && (
        <form action={deleteQuote.bind(null, q.id)} className="mx-auto w-full max-w-2xl print:hidden">
          <button className="text-sm font-medium text-risk">امسح العرض</button>
        </form>
      )}
    </>
  );
}
