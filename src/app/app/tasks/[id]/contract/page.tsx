import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeFileName } from "@/lib/invoice";
import { ContractDoc } from "@/components/contract-doc";
import { PrintButton } from "@/components/print-button";
import { ShareBox } from "@/components/share-box";
import { ConfirmButton } from "@/components/confirm-button";
import { Button, Card, btnClass, inputClass } from "@/components/ui";
import { createContract, deleteContract, reopenContract, saveContract, shareContract, unshareContract } from "../../../actions";

export const metadata = { title: "العقد" };

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await requireUser();
  const [t, user] = await Promise.all([
    prisma.task.findFirst({ where: { id, userId: uid }, select: { id: true, title: true, client: true, contract: true } }),
    prisma.user.findUnique({ where: { id: uid }, select: { logoUrl: true } }),
  ]);
  if (!t) notFound();
  const c = t.contract;
  return (
    <>
      <Link href={`/app/tasks/${t.id}`} className="text-sm text-cyan print:hidden">› رجوع للمهمة</Link>
      {!c ? (
        <Card className="mx-auto grid w-full max-w-2xl gap-3 p-6">
          <h1 className="text-xl font-bold">عقد «{t.title}»</h1>
          <p className="text-sm text-muted">هعملك عقد بسيط من بيانات المهمة: الشغل وخطواته، السعر والدفعات، ميعاد التسليم، عدد التعديلات، وحقوق الملكية. تقدر تعدّل أي حاجة فيه قبل ما تبعته للعميل.</p>
          <form action={createContract.bind(null, t.id)}><Button>اعمل العقد</Button></form>
        </Card>
      ) : (
        <>
          <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 print:hidden">
            <p className="text-sm">{c.acceptedAt ? <span className="font-semibold text-money">العميل وافق ✓</span> : c.shareToken ? "مستني موافقة العميل" : "مسودة — لسه ما اتبعتش"}</p>
            <div className="flex flex-wrap gap-2">
              <PrintButton file={safeFileName(`عقد-${t.client || t.title}`)} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-2xl print:hidden">
            <ShareBox path={c.shareToken ? `/s/k/${c.shareToken}` : null} what="العقد ويوافق عليه" make={shareContract.bind(null, t.id)} revoke={unshareContract.bind(null, t.id)} label="لينك للعميل يوافق" />
          </div>
          <ContractDoc body={c.acceptedBody ?? c.body} logoUrl={user?.logoUrl} accepted={c.acceptedAt && c.acceptedName ? { name: c.acceptedName, at: c.acceptedAt } : null} />
          {c.acceptedAt ? (
            <Card className="mx-auto grid w-full max-w-2xl gap-2 p-5 print:hidden">
              <p className="text-sm text-muted">العقد اتقفل لأن العميل وافق عليه. لو محتاج تغيّر حاجة، اعمل نسخة جديدة والعميل هيوافق عليها تاني.</p>
              <form action={reopenContract.bind(null, t.id)}><ConfirmButton message="أكيد؟ موافقة العميل الحالية هتتشال" className={btnClass("secondary", true)}>نسخة جديدة</ConfirmButton></form>
            </Card>
          ) : (
            <Card className="mx-auto grid w-full max-w-2xl gap-3 p-5 print:hidden">
              <h2 className="text-lg font-bold">عدّل العقد</h2>
              <form action={saveContract.bind(null, t.id)} className="grid gap-2">
                <textarea name="body" defaultValue={c.body} rows={18} aria-label="نص العقد" className={`${inputClass} leading-7`} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button small>احفظ</Button>
                  <p className="text-[0.8125rem] text-muted">أول سطر هو العنوان.</p>
                </div>
              </form>
              <form action={deleteContract.bind(null, t.id)}><ConfirmButton message="أكيد تمسح العقد؟" className="text-sm font-medium text-risk">امسح العقد</ConfirmButton></form>
            </Card>
          )}
          <p className="mx-auto w-full max-w-2xl text-[0.8125rem] text-muted print:hidden">ده نموذج مبسّط يساعدك تتفق بوضوح، مش استشارة قانونية. للشغل الكبير راجعه مع محامي.</p>
        </>
      )}
    </>
  );
}
