import Link from "next/link";
import { monthName, shiftMonth } from "@/lib/dates";

export function MonthSwitcher({ month, base }: { month: string; base: string }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-rule bg-sheet p-1" role="group" aria-label="الشهر">
      <Link href={`${base}?m=${shiftMonth(month, -1)}`} className="grid size-8 place-items-center rounded-lg text-muted hover:text-ink" aria-label="الشهر اللي فات">›</Link>
      <span className="min-w-24 text-center font-display text-sm font-semibold">{monthName(month)}</span>
      <Link href={`${base}?m=${shiftMonth(month, 1)}`} className="grid size-8 place-items-center rounded-lg text-muted hover:text-ink" aria-label="الشهر الجاي">‹</Link>
    </div>
  );
}

export function PageHead({ title, sub, month, base }: { title: string; sub?: string; month?: string; base: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold lg:text-[28px]">{title}</h1>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {month && <MonthSwitcher month={month} base={base} />}
    </header>
  );
}
