import { prisma } from "@/lib/db";
import { addSubtask, deleteSubtask, toggleSubtask } from "@/app/app/actions";
import { Button, Card, inputClass } from "./ui";

/** The task's steps: tick them off, add several at once (one per line), see how far along it is. */
export async function ChecklistCard({ taskId }: { taskId: string }) {
  const items = await prisma.subtask.findMany({ where: { taskId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const done = items.filter((x) => x.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <Card className="mx-auto grid w-full max-w-2xl gap-3 p-5 lg:p-7" aria-label="خطوات الشغل">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">خطوات الشغل</h2>
        {items.length > 0 && <span className="num text-sm text-muted">{done}/{items.length} · {pct}%</span>}
      </div>
      {items.length > 0 && (
        <>
          <div className="h-2 overflow-hidden rounded bg-paper" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="نسبة الإنجاز">
            <div className="h-full rounded bg-money" style={{ width: `${pct}%` }} />
          </div>
          <ul className="grid">
            {items.map((x) => (
              <li key={x.id} className="flex items-center gap-3 border-b border-rule py-2 last:border-b-0">
                <form action={toggleSubtask.bind(null, x.id)}>
                  <button aria-label={x.done ? `رجّع «${x.title}»` : `خلصت «${x.title}»`}
                    className={`grid size-[20px] place-items-center rounded-[6px] border-[1.5px] ${x.done ? "border-money bg-money text-on-accent" : "border-muted"}`}>
                    {x.done && <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12l4 4 10-10" /></svg>}
                  </button>
                </form>
                <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${x.done ? "text-muted line-through" : ""}`}>{x.title}</span>
                <form action={deleteSubtask.bind(null, x.id)}><button className="px-1 text-muted hover:text-risk" aria-label={`امسح «${x.title}»`}>✕</button></form>
              </li>
            ))}
          </ul>
        </>
      )}
      <form action={addSubtask.bind(null, taskId)} className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <textarea name="title" rows={items.length ? 1 : 3} required placeholder={items.length ? "خطوة جديدة" : "اكتب الخطوات، كل خطوة في سطر:\nاسكتشات\nتلوين\nتسليم الملفات"} aria-label="خطوة جديدة" className={`${inputClass} resize-y`} />
        <Button kind="secondary" small className="self-start">ضيف</Button>
      </form>
    </Card>
  );
}
