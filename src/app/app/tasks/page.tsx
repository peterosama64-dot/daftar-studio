import { TaskCard } from "@/components/task-card";
import { PageHead } from "@/components/month";
import { Button, Empty, SectionHead, inputClass } from "@/components/ui";
import { loadMonth, monthFrom, type SP } from "@/lib/data";
import { SOURCE_LABEL, type Source } from "@/lib/constants";
import { addTask } from "../actions";
import Link from "next/link";

export const metadata = { title: "الشغل" };

export default async function Tasks({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const month = await monthFrom(searchParams);
  const { today, urgent, later, doneThisMonth } = await loadMonth(month);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const src = typeof sp.src === "string" && sp.src in SOURCE_LABEL ? (sp.src as Source) : null;
  const show = (list: typeof urgent) => list.filter((t) => (!q || t.title.includes(q) || t.client.includes(q)) && (!src || t.source === src));
  const cols = [
    { key: "u", title: "مستعجل", rule: "risk" as const, list: show(urgent), empty: "مفيش حاجة مستعجلة." },
    { key: "l", title: "ليه لسه شوية", rule: "cyan" as const, list: show(later), empty: "مفيش شغل مؤجل." },
    { key: "d", title: "خلصته", rule: "money" as const, list: show(doneThisMonth), empty: "لسه مخلصتش حاجة الشهر ده." },
  ];
  const chip = (label: string, value: Source | null) => {
    const on = src === value;
    const params = new URLSearchParams({ m: month, ...(q ? { q } : {}), ...(value ? { src: value } : {}) });
    return (
      <Link key={label} href={`/app/tasks?${params}`} className={`rounded-full border px-3 py-1 text-[13px] ${on ? "border-ink bg-ink text-paper" : "border-rule bg-sheet text-ink2"}`}>{label}</Link>
    );
  };
  return (
    <>
      <PageHead title="الشغل" base="/app/tasks" month={month} sub={`${urgent.length + later.length} مفتوحة · ${urgent.length} مستعجلة · ${doneThisMonth.length} خلصت الشهر ده`} />
      <div className="flex flex-wrap items-center gap-3">
        <form className="w-full sm:w-64" action="/app/tasks">
          <input type="hidden" name="m" value={month} />
          <input name="q" defaultValue={q} placeholder="دوّر في الشغل…" className={inputClass} aria-label="دوّر في الشغل" />
        </form>
        <div className="flex flex-wrap gap-1.5">{chip("الكل", null)}{chip("بالصوت", "voice")}{chip("من الإيميل", "gmail")}{chip("من الشات", "chat")}</div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[1.25fr_1fr_0.9fr]">
        {cols.map((c) => (
          <section key={c.key}>
            <SectionHead title={c.title} count={c.list.length} rule={c.rule} />
            <div className="grid gap-2.5">{c.list.length ? c.list.map((t) => <TaskCard key={t.id} t={t} today={today} />) : <Empty>{c.empty}</Empty>}</div>
          </section>
        ))}
      </div>
      <details className="rounded-2xl border border-dashed border-rule bg-sheet p-4">
        <summary className="cursor-pointer font-semibold text-cyan">＋ ضيف مهمة بإيدك</summary>
        <form action={addTask} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <input name="title" required placeholder="المهمة" className={inputClass} aria-label="المهمة" />
          <input name="client" placeholder="العميل" className={inputClass} aria-label="العميل" />
          <input name="due" type="date" className={inputClass} aria-label="الميعاد" />
          <select name="priority" defaultValue="normal" className={inputClass} aria-label="الأولوية">
            <option value="high">مستعجل</option><option value="normal">عادي</option><option value="low">مش مستعجل</option>
          </select>
          <Button small>ضيف</Button>
        </form>
      </details>
    </>
  );
}
