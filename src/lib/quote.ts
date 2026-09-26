import { monthKey } from "./dates";

export type QuoteItem = { desc: string; amount: number };

/** Line items from the form: pairs of item_desc / item_amount, blanks and bad amounts dropped. */
export function parseItems(descs: FormDataEntryValue[], amounts: FormDataEntryValue[]): QuoteItem[] {
  const out: QuoteItem[] = [];
  descs.forEach((d, i) => {
    const desc = String(d ?? "").trim().slice(0, 200);
    const amount = Number(String(amounts[i] ?? "").replace(/[,٬\s]/g, "").replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))));
    if (desc && Number.isFinite(amount) && amount > 0) out.push({ desc, amount });
  });
  return out.slice(0, 30);
}

/** Items saved as JSON, read back defensively. */
export function readItems(v: unknown): QuoteItem[] {
  return Array.isArray(v)
    ? v.filter((x): x is QuoteItem => !!x && typeof x.desc === "string" && typeof x.amount === "number")
    : [];
}

export const quoteTotal = (items: QuoteItem[]) => items.reduce((s, x) => s + x.amount, 0);

export const quoteNumber = (q: { id: string; createdAt: Date }) =>
  `Q-${monthKey(q.createdAt).replace("-", "")}-${q.id.slice(-4).toUpperCase()}`;

export const validUntil = (createdAt: Date, days: number) =>
  new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate() + days);

/** The task notes that carry the quote's breakdown once the client accepts. */
export const quoteNotes = (no: string, items: QuoteItem[], deliveryDays: number | null, notes: string) =>
  [`من عرض السعر ${no}:`, ...items.map((x) => `- ${x.desc}: ${x.amount}`), deliveryDays ? `مدة التسليم: ${deliveryDays} يوم` : "", notes]
    .filter(Boolean).join("\n");
