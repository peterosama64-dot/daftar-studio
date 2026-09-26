import { monthKey } from "./dates";

/** Stable, human-readable invoice number for a task: INV-YYYYMM-XXXX (month it was created + id tail). */
export function invoiceNumber(t: { id: string; createdAt: Date }): string {
  return `INV-${monthKey(t.createdAt).replace("-", "")}-${t.id.slice(-4).toUpperCase()}`;
}

/** Total, paid and remaining for an invoice; paid is capped at the total, remaining never negative. */
export function invoiceTotals(agreed: number | null, paid: number | null) {
  const total = Math.max(0, agreed ?? 0);
  const got = Math.min(total, Math.max(0, paid ?? 0));
  return { total, paid: got, remaining: total - got };
}

/** A file name that works on every OS: Arabic letters kept, anything else odd becomes "-". */
export const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
