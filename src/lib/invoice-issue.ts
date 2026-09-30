import { prisma } from "./db";
import { now } from "./dates";
import { formatInvoiceNo, taskDue } from "./invoice";
import { newToken } from "./share";
import { mailConfigured, sendMail } from "./mail";
import { appUrl } from "./weekly-data";
import { CURRENCIES } from "./constants";
import { recurringMail } from "./invoice-mail";

/**
 * Give a job its invoice number, once. The counter lives on the user row and the UPDATE locks it,
 * so two clicks at the same moment can never take the same number; the loser rolls back and keeps
 * the number it was given (no gap is left behind, because the whole transaction is undone).
 */
export async function issueTaskNo(userId: string, taskId: string) {
  const year = now().getFullYear();
  try {
    await prisma.$transaction(async (tx) => {
      const t = await tx.task.findFirst({ where: { id: taskId, userId }, select: { invoiceNo: true, agreed: true } });
      if (!t || t.invoiceNo || !t.agreed) return;
      const [u] = await tx.$queryRaw<{ invoiceSeq: number; invoicePrefix: string }[]>`
        UPDATE "User" SET "invoiceSeq" = CASE WHEN "invoiceYear" = ${year} THEN "invoiceSeq" + 1 ELSE 1 END, "invoiceYear" = ${year}
        WHERE "id" = ${userId} RETURNING "invoiceSeq", "invoicePrefix"`;
      const got = await tx.task.updateMany({ where: { id: taskId, userId, invoiceNo: null }, data: { invoiceNo: formatInvoiceNo(u.invoicePrefix, year, u.invoiceSeq), invoicedAt: now() } });
      if (!got.count) throw new Error("already-issued");
    });
  } catch (e) {
    if (!(e instanceof Error && e.message === "already-issued")) throw e;
  }
}

type Job = { id: string; userId: string; title: string; clientEmail: string; autoInvoice: boolean };

/**
 * «اعمل الفاتورة كمان»: the month's job gets its invoice number and a client link the moment it's
 * made, and the link is emailed to the client when an address is saved and mail is set up.
 * `lastInvoice` is claimed for the month first, so a repeated run never emails twice.
 */
export async function autoInvoice(job: Job, taskId: string, month: string): Promise<boolean> {
  if (!job.autoInvoice) return false;
  await issueTaskNo(job.userId, taskId);
  await prisma.task.updateMany({ where: { id: taskId, userId: job.userId, shareToken: null }, data: { shareToken: newToken() } });
  if (!job.clientEmail || !mailConfigured()) return false;
  const claimed = await prisma.recurringJob.updateMany({
    where: { id: job.id, OR: [{ lastInvoice: null }, { lastInvoice: { not: month } }] },
    data: { lastInvoice: month },
  });
  if (!claimed.count) return false;
  const [task, user] = await Promise.all([
    prisma.task.findFirst({ where: { id: taskId, userId: job.userId }, select: { title: true, invoiceNo: true, shareToken: true, agreed: true, paid: true, discount: true, taxRate: true, currency: true } }),
    prisma.user.findUnique({ where: { id: job.userId }, select: { name: true, currency: true } }),
  ]);
  if (!task?.shareToken) return false;
  const code = task.currency ?? user?.currency ?? null;
  const mail = recurringMail({
    sender: user?.name ?? "", title: job.title, month, amount: taskDue(task),
    cur: CURRENCIES.find((c) => c.code === code)?.short ?? "ج.م",
    invoiceNo: task.invoiceNo, link: `${appUrl()}/s/i/${task.shareToken}`,
  });
  const res = await sendMail({ to: job.clientEmail, ...mail });
  // Sending failed: let go of the month again so tomorrow's run tries once more.
  if (!res.ok) await prisma.recurringJob.updateMany({ where: { id: job.id, lastInvoice: month }, data: { lastInvoice: null } });
  return res.ok;
}
