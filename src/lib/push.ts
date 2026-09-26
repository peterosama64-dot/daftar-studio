import "server-only";
import webpush from "web-push";
import { prisma } from "./db";
import { open, seal } from "./crypto";

// Web Push without any setup: the VAPID key pair is generated on first use and kept in AppSetting,
// the private half sealed with SESSION_SECRET.
let cached: { publicKey: string; privateKey: string } | null = null;

export async function vapidKeys() {
  if (cached) return cached;
  const load = async () => {
    const row = await prisma.appSetting.findUnique({ where: { key: "vapid" } });
    if (!row) return null;
    const v = JSON.parse(row.value) as { publicKey: string; privateKey: string };
    const privateKey = open(v.privateKey);
    return privateKey ? { publicKey: v.publicKey, privateKey } : null;
  };
  const existing = await load();
  if (existing) return (cached = existing);
  // First use (or SESSION_SECRET changed): make a pair. createMany+skipDuplicates keeps whichever
  // request won a race, so every browser ends up with the same key; a stale pair is replaced.
  const k = webpush.generateVAPIDKeys();
  const value = JSON.stringify({ publicKey: k.publicKey, privateKey: seal(k.privateKey) });
  const { count } = await prisma.appSetting.createMany({ data: [{ key: "vapid", value }], skipDuplicates: true });
  if (!count) {
    const winner = await load();
    if (winner) return (cached = winner);
    await prisma.appSetting.update({ where: { key: "vapid" }, data: { value } });
  }
  return (cached = { publicKey: k.publicKey, privateKey: k.privateKey });
}

export type PushPayload = { title: string; body: string; url?: string };

/** Sends to every device of the user; forgets devices the push service says are gone. */
export async function pushToUser(userId: string, payload: PushPayload): Promise<{ devices: number; sent: number }> {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return { devices: 0, sent: 0 };
  const { publicKey, privateKey } = await vapidKeys();
  const subject = process.env.PUSH_CONTACT || "mailto:admin@daftar.studio";
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
        vapidDetails: { subject, publicKey, privateKey }, TTL: 12 * 3600, urgency: "normal", timeout: 10_000,
      });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { id: s.id } });
      else console.error("push send failed", status ?? "", e instanceof Error ? e.message : e);
    }
  }));
  return { devices: subs.length, sent };
}
