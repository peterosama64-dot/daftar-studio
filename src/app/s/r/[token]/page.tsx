import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isToken } from "@/lib/share";
import { revisionState } from "@/lib/revisions";
import { DeliveryFiles } from "@/components/delivery-files";
import { Button, Card, inputClass } from "@/components/ui";
import { approveWork, requestRevision } from "../../actions";

export const metadata = { title: "مراجعة الشغل" };

export default async function Review({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) notFound();
  const t = await prisma.task.findUnique({
    where: { reviewToken: token, user: { suspendedAt: null } },
    include: { user: { select: { name: true, email: true } }, deliveries: { orderBy: { createdAt: "asc" } }, revisions: { orderBy: { createdAt: "asc" } } },
  });
  if (!t) notFound();
  const r = revisionState(t.revisions.length, t.revisionsAllowed);
  const from = t.user.name || t.user.email;
  return (
    <>
      <header className="grid gap-1">
        <p className="text-sm text-muted">من {from}{t.client ? ` إلى ${t.client}` : ""}</p>
        <h1 className="text-2xl font-bold">{t.title}</h1>
      </header>
      <Card className="grid gap-4 p-5">
        {t.deliveries.length ? <DeliveryFiles files={t.deliveries} /> : <p className="text-sm text-muted">لسه مفيش ملفات.</p>}
        <p className="text-[0.8125rem] text-muted">دوس على أي صورة عشان تفتحها بالحجم الكامل.</p>
      </Card>

      {t.approvedAt ? (
        <Card className="p-5 text-center font-semibold text-money">تمت الموافقة على الشغل. شكرًا لكم.</Card>
      ) : t.deliveries.length > 0 && (
        <Card className="grid gap-4 p-5">
          <form action={approveWork.bind(null, token)}><Button className="w-full sm:w-auto">موافق على الشغل</Button></form>
          <form action={requestRevision.bind(null, token)} className="grid gap-2 border-t border-rule pt-4">
            <label htmlFor="note" className="font-semibold">محتاج تعديل؟</label>
            <textarea id="note" name="note" required maxLength={1000} rows={3} placeholder="اكتب التعديلات المطلوبة بالتفصيل" className={inputClass} />
            {r.allowed !== null && (
              <p className={`text-[0.8125rem] ${r.nextIsExtra ? "text-risk" : "text-muted"}`}>
                {r.nextIsExtra
                  ? `التعديلات المتفق عليها (${r.allowed}) خلصت، والتعديل ده ممكن يكون بتكلفة إضافية.`
                  : `ده هيبقى التعديل رقم ${r.used + 1} من ${r.allowed} متفق عليهم.`}
              </p>
            )}
            <Button kind="secondary" className="justify-self-start">ابعت طلب التعديل</Button>
          </form>
        </Card>
      )}

      {t.revisions.length > 0 && (
        <Card className="grid gap-2 p-5">
          <h2 className="font-semibold">التعديلات اللي اتطلبت</h2>
          <ol className="grid gap-1.5 text-sm">
            {t.revisions.map((x, i) => <li key={x.id} className="rounded-lg bg-paper px-3 py-2 whitespace-pre-wrap [overflow-wrap:anywhere]"><span className="num ml-2 text-muted">{i + 1}</span>{x.note || "—"}</li>)}
          </ol>
        </Card>
      )}
    </>
  );
}
