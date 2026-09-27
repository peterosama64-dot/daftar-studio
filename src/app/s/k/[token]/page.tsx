import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isToken } from "@/lib/share";
import { safeFileName } from "@/lib/invoice";
import { ContractDoc } from "@/components/contract-doc";
import { PrintButton } from "@/components/print-button";
import { Button, Card, inputClass } from "@/components/ui";
import { acceptContract } from "../../actions";

export const metadata = { title: "اتفاق عمل" };

export default async function SharedContract({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) notFound();
  const c = await prisma.contract.findUnique({
    where: { shareToken: token, task: { user: { suspendedAt: null } } },
    include: { task: { select: { title: true, client: true, user: { select: { logoUrl: true } } } } },
  });
  if (!c) notFound();
  const accepted = c.acceptedAt && c.acceptedName ? { name: c.acceptedName, at: c.acceptedAt } : null;
  return (
    <>
      <div className="flex justify-end print:hidden"><PrintButton file={safeFileName(`عقد-${c.task.title}`)} /></div>
      <ContractDoc body={c.acceptedBody ?? c.body} logoUrl={c.task.user.logoUrl} accepted={accepted} />
      {!accepted && (
        <Card className="mx-auto grid w-full max-w-2xl gap-3 p-5 print:hidden">
          <h2 className="text-lg font-bold">الموافقة على الاتفاق</h2>
          <form action={acceptContract.bind(null, token)} className="grid gap-3">
            <label className="grid gap-1 text-sm">اكتب اسمك بالكامل
              <input name="name" required minLength={2} maxLength={80} defaultValue={c.task.client} className={inputClass} />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="agree" required className="mt-1" />
              <span>قرأت الاتفاق وأوافق على كل ما فيه، وأعتبر موافقتي هنا بمثابة توقيعي.</span>
            </label>
            <Button className="justify-self-start">أوافق على الاتفاق</Button>
          </form>
        </Card>
      )}
    </>
  );
}
