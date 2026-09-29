import { invoiceLines, invoiceTotals, type InvoiceMath } from "./invoice";
import type { QuoteItem } from "./quote";

// A combined invoice: several jobs of one client on one document. Each job keeps its own discount and VAT,
// so the invoice shows a section per job and adds the sections up.

export type GroupTask = { id: string; title: string; agreed: number | null; paid: number | null; discount: number | null; taxRate: number | null; items?: unknown };
export type GroupPart = { id: string; title: string; lines: QuoteItem[]; m: InvoiceMath };

export function groupParts(tasks: GroupTask[]): GroupPart[] {
  return tasks.map((t) => ({ id: t.id, title: t.title, lines: invoiceLines(t), m: invoiceTotals(t.agreed, t.paid, t.discount, t.taxRate) }));
}

/** The invoice's own figures: every job's numbers added up. */
export function groupTotals(parts: GroupPart[]): InvoiceMath {
  const sum = (f: (m: InvoiceMath) => number) => Math.round(parts.reduce((s, p) => s + f(p.m), 0) * 100) / 100;
  const subtotal = sum((m) => m.subtotal), tax = sum((m) => m.tax), total = sum((m) => m.total);
  // One rate to print only when every job shares it; otherwise the VAT line stands without a percentage.
  const rates = new Set(parts.filter((p) => p.m.tax > 0).map((p) => p.m.taxRate));
  return { subtotal, discount: sum((m) => m.discount), taxRate: rates.size === 1 ? [...rates][0] : 0, tax, total, paid: sum((m) => m.paid), remaining: sum((m) => m.remaining) };
}
