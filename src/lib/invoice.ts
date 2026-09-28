import { monthKey } from "./dates";

/** The old per-task number, kept for invoices that were shared before sequential numbers existed. */
export function invoiceNumber(t: { id: string; createdAt: Date }): string {
  return `INV-${monthKey(t.createdAt).replace("-", "")}-${t.id.slice(-4).toUpperCase()}`;
}

/** "INV-2026-001" — the prefix the user picked, the year, and the count in that year (at least 3 digits). */
export const formatInvoiceNo = (prefix: string, year: number, seq: number) => `${(prefix || "INV").trim()}-${year}-${String(seq).padStart(3, "0")}`;

/** The number shown on an invoice: its sequential number once issued, else the old one. */
export const shownInvoiceNo = (t: { id: string; createdAt: Date; invoiceNo?: string | null }) => t.invoiceNo ?? invoiceNumber(t);

const r2 = (n: number) => Math.round(n * 100) / 100;

export type InvoiceMath = { subtotal: number; discount: number; taxRate: number; tax: number; total: number; paid: number; remaining: number };

/**
 * An invoice's figures: the agreed price, minus the discount, plus VAT on what's left; then paid (capped at
 * the total) and what remains (never negative). Rounded to the piastre.
 */
export function invoiceTotals(agreed: number | null, paid: number | null, discount: number | null = null, taxRate: number | null = null): InvoiceMath {
  const subtotal = Math.max(0, agreed ?? 0);
  const off = Math.min(subtotal, Math.max(0, discount ?? 0));
  const rate = Math.min(100, Math.max(0, taxRate ?? 0));
  const tax = r2(((subtotal - off) * rate) / 100);
  const total = r2(subtotal - off + tax);
  const got = Math.min(total, Math.max(0, paid ?? 0));
  return { subtotal, discount: off, taxRate: rate, tax, total, paid: got, remaining: r2(total - got) };
}

/** What the client owes for a task in total (after discount and VAT) — what «paid» is measured against. */
export const taskDue = (t: { agreed: number | null; discount?: number | null; taxRate?: number | null }) =>
  invoiceTotals(t.agreed, 0, t.discount ?? null, t.taxRate ?? null).total;

/** A file name that works on every OS: Arabic letters kept, anything else odd becomes "-". */
export const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
