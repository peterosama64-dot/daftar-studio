import { z } from "zod";

/** Something recorded while offline, kept on the phone until it can be sent. */
export const OfflineOp = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  uid: z.string().min(1).max(64),
  kind: z.enum(["task", "income", "expense"]),
  title: z.string().trim().min(1).max(200),
  client: z.string().trim().max(80).default(""),
  amount: z.number().nonnegative().max(1e12).nullable().default(null),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type OfflineOp = z.infer<typeof OfflineOp>;

export const QUEUE_KEY = "daftar-offline-queue";

/** Parse an amount typed on the phone: Arabic-Indic digits, commas and spaces allowed. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,٬\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Read the queue from storage, dropping anything malformed. */
export function readQueue(raw: string | null): OfflineOp[] {
  try {
    const arr = JSON.parse(raw ?? "[]");
    return Array.isArray(arr) ? arr.flatMap((x) => { const p = OfflineOp.safeParse(x); return p.success ? [p.data] : []; }) : [];
  } catch { return []; }
}
