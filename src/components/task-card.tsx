import Link from "next/link";
import type { Task } from "@prisma/client";
import { Pill } from "./ui";
import { dueTone } from "@/lib/tasks";
import { daysUntil, shortDate } from "@/lib/dates";
import { SOURCE_LABEL, type Source } from "@/lib/constants";
import { toggleTask, togglePriority, deleteTask } from "@/app/app/actions";

export function TaskCard({ t, today, compact }: { t: Task; today: Date; compact?: boolean }) {
  const done = t.status === "done";
  const d = daysUntil(t.due, today);
  const stripe = done ? "bg-money" : t.priority === "high" || (d !== null && d <= 2) ? "bg-risk" : d !== null && d <= 5 ? "bg-wait" : "bg-cyan";
  const tone = dueTone(t, today);
  const src = SOURCE_LABEL[t.source as Source];
  return (
    <article className={`flex overflow-hidden rounded-xl border border-rule bg-sheet ${done ? "opacity-75" : ""}`}>
      <span className={`w-1 shrink-0 ${stripe}`} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 items-start gap-3 px-3.5 py-3">
        <form action={toggleTask.bind(null, t.id)}>
          <button aria-label={done ? "رجّعها" : "خلصت"} className={`mt-0.5 grid size-[22px] place-items-center rounded-[7px] border-[1.5px] ${done ? "border-money bg-money text-on-accent" : "border-muted"}`}>
            {done && <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12l4 4 10-10" /></svg>}
          </button>
        </form>
        <div className="min-w-0 flex-1">
          <Link href={`/app/tasks/${t.id}`} className={`font-medium [overflow-wrap:anywhere] hover:text-cyan ${done ? "text-muted line-through" : ""}`}>{t.title}</Link>
          {!compact && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {tone.tone === "overdue" || tone.tone === "today" ? <Pill tone="urgent">{tone.label}</Pill> : tone.tone === "soon" ? <Pill tone="waiting">{tone.label}</Pill> : null}
              {tone.tone === "later" && t.due && <Pill mono>{shortDate(t.due)}</Pill>}
              {t.priority === "high" && !done && <Pill tone="urgent">مستعجل</Pill>}
              {t.client && <Pill tone="later">{t.client}</Pill>}
              {src && <Pill>{src}</Pill>}
            </div>
          )}
        </div>
        {!compact && (
          <div className="flex flex-col items-end gap-0.5 text-xs">
            {!done && (
              <form action={togglePriority.bind(null, t.id)}>
                <button className="px-1.5 py-0.5 text-muted hover:text-ink">{t.priority === "high" ? "مش مستعجل" : "مستعجل"}</button>
              </form>
            )}
            <form action={deleteTask.bind(null, t.id)}>
              <button className="px-1.5 py-0.5 text-muted hover:text-risk">امسح</button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
