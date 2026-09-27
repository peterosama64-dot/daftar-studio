import { prisma } from "@/lib/db";
import { currentRound, revisionState } from "@/lib/revisions";
import { filesConfigured } from "@/lib/files";
import { shortDate } from "@/lib/dates";
import { addRevision, deleteDelivery, deleteRevision, setRevisionsAllowed, shareReview, unshareReview } from "@/app/app/actions";
import { Button, Card, Pill, inputClass } from "./ui";
import { FileUploader } from "./file-uploader";
import { DeliveryFiles } from "./delivery-files";
import { ShareBox } from "./share-box";

/** On the task page: delivered files by round, the client review link, and the revision log. */
export async function DeliveryCard({ task }: { task: { id: string; reviewToken: string | null; revisionsAllowed: number | null; approvedAt: Date | null } }) {
  const [files, revisions] = await Promise.all([
    prisma.delivery.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "asc" } }),
    prisma.revision.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const r = revisionState(revisions.length, task.revisionsAllowed);
  const round = currentRound(revisions.length);
  const share = { what: "ملفات التسليم", make: shareReview.bind(null, task.id), revoke: unshareReview.bind(null, task.id) };
  return (
    <Card className="mx-auto grid w-full max-w-2xl gap-5 p-5 lg:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">التسليم والتعديلات</h2>
        {task.approvedAt ? <Pill tone="money">العميل وافق · {shortDate(task.approvedAt)}</Pill>
          : files.length ? <Pill tone="waiting">مستني رد العميل</Pill> : null}
      </div>

      {filesConfigured() ? (
        <div className="grid gap-3">
          <FileUploader taskId={task.id} round={round} />
          {files.length
            ? <DeliveryFiles files={files} action={(f) => (
                <form action={deleteDelivery.bind(null, f.id)}><button className="px-1 hover:text-risk" aria-label={`امسح ${f.name}`}>✕</button></form>)} />
            : <p className="text-sm text-muted">ارفع صور الشغل أو PDF، وابعت للعميل لينك يشوفها منه ويوافق أو يطلب تعديل.</p>}
          {files.length > 0 && <ShareBox path={task.reviewToken ? `/s/r/${task.reviewToken}` : null} {...share} />}
        </div>
      ) : <p className="text-sm text-muted">رفع الملفات لسه مش متفعّل على الموقع.</p>}

      <div className="grid gap-3 border-t border-rule pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">التعديلات</h3>
          <form action={setRevisionsAllowed.bind(null, task.id)} className="flex items-center gap-2 text-sm">
            <label htmlFor={`rev-${task.id}`} className="text-muted">متفق على</label>
            <input id={`rev-${task.id}`} name="allowed" inputMode="numeric" defaultValue={task.revisionsAllowed ?? ""} placeholder="—" className={`${inputClass} num w-16 py-1.5 text-center`} />
            <span className="text-muted">تعديلات</span>
            <Button kind="secondary" small>احفظ</Button>
          </form>
        </div>
        <p className={`text-sm ${r.over ? "font-semibold text-risk" : "text-ink2"}`}>
          {r.allowed === null
            ? `اتطلب ${r.used} ${r.used === 1 ? "تعديل" : "تعديلات"}. حط عدد التعديلات المتفق عليها عشان الدفتر ينبهك لما تعدّيه.`
            : r.over
              ? `اتطلب ${r.used} تعديلات والمتفق عليه ${r.allowed}: فيه ${r.over} ${r.over === 1 ? "تعديل زيادة" : "تعديلات زيادة"} من حقك تحاسب عليهم.`
              : `اتطلب ${r.used} من ${r.allowed}. ${r.left ? `فاضل ${r.left}.` : "خلصوا، اللي جاي بفلوس."}`}
        </p>
        {revisions.length > 0 && (
          <ol className="grid gap-1.5 text-sm">
            {revisions.map((x, i) => {
              const extra = task.revisionsAllowed !== null && i >= task.revisionsAllowed;
              return (
                <li key={x.id} className={`flex items-start gap-2 rounded-lg px-2.5 py-2 ${extra ? "bg-risk-soft" : "bg-paper"}`}>
                  <span className="num text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{x.note || "—"}</span>
                  <span className="text-[0.75rem] text-muted">{x.by === "client" ? "العميل" : "إنت"} · {shortDate(x.createdAt)}{extra ? " · زيادة" : ""}</span>
                  <form action={deleteRevision.bind(null, x.id)}><button className="px-1 text-muted hover:text-risk" aria-label="امسح التعديل">✕</button></form>
                </li>
              );
            })}
          </ol>
        )}
        <form action={addRevision.bind(null, task.id)} className="flex flex-wrap gap-2">
          <input name="note" maxLength={1000} placeholder="العميل طلب تعديل؟ اكتبه هنا (مثلاً: يكبّر اللوجو)" className={`${inputClass} min-w-0 flex-1`} aria-label="التعديل" />
          <Button kind="secondary" small>سجّل تعديل</Button>
        </form>
      </div>
    </Card>
  );
}
