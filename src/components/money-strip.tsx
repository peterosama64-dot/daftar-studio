import { fmt, signed } from "@/lib/money";

export function MoneyStrip({ I, S, X, net, cur }: { I: number; S: number; X: number; net: number; cur: string }) {
  const out = S + X;
  const base = Math.max(I, out, 1);
  const amt = (v: string, cls: string, size = "text-[26px]") => (
    <span className={`flex items-baseline gap-1.5 ${cls}`}>
      <span className={`num font-medium ${size}`}>{v}</span>
      <span className="text-sm font-medium">{cur}</span>
    </span>
  );
  return (
    <section aria-label="فلوس الشهر" className="grid rounded-2xl border border-rule bg-sheet shadow-float sm:grid-cols-3">
      <div className="order-2 grid gap-1 border-t border-dashed border-rule px-5 py-4 sm:order-1 sm:border-t-0">
        <span className="text-[13px] text-muted">دخلي الشهر ده</span>
        {amt(fmt(I), "text-ink")}
      </div>
      <div className="order-3 grid gap-1 border-t border-dashed border-rule px-5 py-4 sm:order-2 sm:border-x sm:border-t-0">
        <span className="text-[13px] text-muted">صرفت · اشتراكات <span className="num">{fmt(S)}</span> + مصاريف <span className="num">{fmt(X)}</span></span>
        {amt(fmt(out), "text-muted")}
      </div>
      <div className="order-1 grid gap-1 px-5 py-4 sm:order-3">
        <span className="text-[13px] text-muted">صافي ربحي</span>
        {amt(signed(net), net < 0 ? "text-risk" : "text-money")}
        <div className="mt-1 flex h-1.5 overflow-hidden rounded bg-rule" aria-hidden="true">
          <i className="block bg-money" style={{ width: `${(Math.max(net, 0) / base) * 100}%` }} />
          <i className="block bg-risk" style={{ width: `${(Math.min(out, base) / base) * 100}%` }} />
        </div>
      </div>
    </section>
  );
}
