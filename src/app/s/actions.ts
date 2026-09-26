"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isToken, acceptQuoteFor } from "@/lib/share";
import { pushToUser } from "@/lib/push";

/** The client accepts from the public link. Only a live link on a draft quote can do this. */
export async function acceptSharedQuote(token: string) {
  if (!isToken(token)) return;
  const q = await prisma.quote.findUnique({ where: { shareToken: token }, select: { id: true, userId: true, client: true, title: true } });
  if (!q) return;
  const r = await acceptQuoteFor(q.userId, q.id);
  if (r?.fresh) {
    await pushToUser(q.userId, {
      title: `${q.client || "العميل"} وافق على عرض السعر`,
      body: `«${q.title}» اتحوّل لمهمة في الدفتر.`,
      url: r.taskId ? `/app/tasks/${r.taskId}` : "/app/quotes",
      tag: `daftar-quote-${q.id}`,
    }).catch(() => {});
  }
  revalidatePath(`/s/q/${token}`);
}
