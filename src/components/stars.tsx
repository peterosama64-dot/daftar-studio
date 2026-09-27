/** ★★★★☆ — read-only, with an accessible label. */
export function Stars({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span role="img" aria-label={`${n} من 5`} className={`justify-self-start tracking-wider text-wait ${className}`} dir="ltr">
      {"★".repeat(n)}<span className="text-rule">{"★".repeat(5 - n)}</span>
    </span>
  );
}
