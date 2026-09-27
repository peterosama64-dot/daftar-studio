/* eslint-disable @next/next/no-img-element -- files come from Blob storage with arbitrary hosts */
import type { ReactNode } from "react";

type D = { id: string; url: string; name: string; type: string; round: number };

/** Delivered files grouped by round, newest round first; images shown, PDFs as links. */
export function DeliveryFiles({ files, action }: { files: D[]; action?: (d: D) => ReactNode }) {
  const rounds = [...new Set(files.map((f) => f.round))].sort((a, b) => b - a);
  return (
    <div className="grid gap-4">
      {rounds.map((r, i) => {
        const list = files.filter((f) => f.round === r);
        const body = (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {list.map((f) => (
              <figure key={f.id} className="grid gap-1">
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-rule bg-paper">
                  {f.type.startsWith("image/")
                    ? <img src={f.url} alt={f.name} loading="lazy" className="aspect-square w-full object-contain" />
                    : <span className="grid aspect-square place-items-center text-sm font-semibold text-muted">PDF</span>}
                </a>
                <figcaption className="flex items-center gap-1 text-[0.75rem] text-muted">
                  <span className="min-w-0 flex-1 truncate" dir="auto">{f.name}</span>{action?.(f)}
                </figcaption>
              </figure>
            ))}
          </div>
        );
        const title = `النسخة ${r}${i === 0 && rounds.length > 1 ? " (الأحدث)" : ""}`;
        return i === 0
          ? <section key={r} className="grid gap-2"><h3 className="text-sm font-semibold">{title}</h3>{body}</section>
          : <details key={r} className="grid gap-2"><summary className="cursor-pointer text-sm text-muted">{title}</summary><div className="mt-2">{body}</div></details>;
      })}
    </div>
  );
}
