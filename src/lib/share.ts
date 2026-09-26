import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { now } from "./dates";
import { quoteNotes, quoteNumber, quoteTotal, readItems } from "./quote";

/** An unguessable link token (128 bits, URL-safe). */
export const newToken = () => randomBytes(16).toString("base64url");
export const isToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(t);

/**
 * Accept a quote: flip draft → accepted once (conditional update) and create its task, linking it back.
 * Returns the task id, or null when the quote doesn't exist; a second call just returns the existing task.
 */
export async function acceptQuoteFor(userId: string, id: string): Promise<{ taskId: string | null; fresh: boolean } | null> {
  const q = await prisma.quote.findFirst({ where: { id, userId } });
  if (!q) return null;
  let fresh = false;
  if (q.status !== "accepted") {
    const items = readItems(q.items);
    const due = q.deliveryDays ? new Date(now().getTime() + q.deliveryDays * 86_400_000) : null;
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.quote.updateMany({ where: { id, userId, status: "draft" }, data: { status: "accepted" } });
      if (!claimed.count) return;
      const t = await tx.task.create({
        data: { userId, title: q.title, client: q.client, agreed: quoteTotal(items), due, notes: quoteNotes(quoteNumber(q), items, q.deliveryDays, q.notes) },
      });
      await tx.quote.updateMany({ where: { id, userId }, data: { taskId: t.id } });
      fresh = true;
    });
  }
  const after = await prisma.quote.findFirst({ where: { id, userId }, select: { taskId: true } });
  return { taskId: after?.taskId ?? null, fresh };
}
