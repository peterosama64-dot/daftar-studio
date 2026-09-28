import "server-only";
import { gzipSync } from "node:zlib";
import { prisma } from "./db";
import { buildBackup } from "./backup";
import { dayKey } from "./dates";
import { mailConfigured, sendMail } from "./mail";

/** How many weekly copies are kept per account. */
export const KEEP = 4;
/** Emailed copies above this size are only kept in the app (mail providers cap attachments). */
const MAIL_MAX = 15 * 1024 * 1024;

/** Saves a copy of the whole notebook now (gzipped), drops copies beyond KEEP, and emails it when mail is set up. */
export async function makeAutoBackup(userId: string, today: Date, email?: string): Promise<{ id: string; size: number; mailed: boolean }> {
  const json = JSON.stringify(await buildBackup(userId));
  const size = Buffer.byteLength(json);
  const row = await prisma.autoBackup.create({ data: { userId, size, data: gzipSync(json) }, select: { id: true } });
  const old = await prisma.autoBackup.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: KEEP, select: { id: true } });
  if (old.length) await prisma.autoBackup.deleteMany({ where: { userId, id: { in: old.map((o) => o.id) } } });
  let mailed = false;
  if (email && mailConfigured() && size <= MAIL_MAX) {
    const day = dayKey(today);
    mailed = (await sendMail({
      to: email,
      subject: `نسخة دفترك الاحتياطية — ${day}`,
      text: "دي نسخة احتياطية من دفترك كله. احتفظ بيها، ولو احتجتها افتح الإعدادات ← «نسخة احتياطية» ← «استرجع من ملف».",
      html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8">دي نسخة احتياطية من دفترك كله.<br>احتفظ بيها، ولو احتجتها افتح <b>الإعدادات ← نسخة احتياطية ← استرجع من ملف</b>.</div>`,
      attachments: [{ filename: `daftar-backup-${day}.json`, content: Buffer.from(json).toString("base64") }],
    })).ok;
  }
  return { id: row.id, size, mailed };
}

/**
 * The weekly run (from the daily cron): every account with automatic copies on whose last copy is a week old
 * or more. Each account is claimed for today first, so overlapping runs never make two copies.
 */
export async function runAutoBackups(today: Date, limit = 40): Promise<number> {
  const key = dayKey(today);
  const weekAgo = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));
  const due = { autoBackup: true, suspendedAt: null, OR: [{ lastAutoBackup: null }, { lastAutoBackup: { lt: weekAgo } }] };
  const users = await prisma.user.findMany({ where: due, select: { id: true, email: true }, take: limit, orderBy: { createdAt: "asc" } });
  let made = 0;
  for (const u of users) {
    const claimed = await prisma.user.updateMany({ where: { id: u.id, ...due }, data: { lastAutoBackup: key } });
    if (!claimed.count) continue;
    try { await makeAutoBackup(u.id, today, u.email); made++; } catch (e) { console.error("auto backup", u.id, e instanceof Error ? e.message : e); }
  }
  return made;
}
