import { daysUntil } from "./dates";

/** After this many days without a reply, a job, quote or contract counts as «مستني رد» and gets a nudge. */
export const WAIT_DAYS = 3;
/** Days (counted from sending or the last follow-up) on which the morning push mentions it. */
export const NUDGE_ON = [3, 7, 14];

export type WaitKind = "delivery" | "quote" | "contract";
export type WaitItem = { kind: WaitKind; id: string; title: string; client: string; since: Date; nudgedAt: Date | null; link: string; href: string };
export type Waiting = WaitItem & { days: number };

export const WAIT_LABEL: Record<WaitKind, string> = { delivery: "شغل مستني موافقة", quote: "عرض سعر", contract: "اتفاق" };

/** Days since it was sent, or since the last follow-up when that is later. */
export function waitingDays(i: Pick<WaitItem, "since" | "nudgedAt">, today: Date): number {
  const from = i.nudgedAt && i.nudgedAt > i.since ? i.nudgedAt : i.since;
  return Math.max(0, -(daysUntil(from, today) ?? 0));
}

export function waitingList(items: WaitItem[], today: Date): Waiting[] {
  return items.map((i) => ({ ...i, days: waitingDays(i, today) })).sort((a, b) => b.days - a.days);
}

/** A friendly follow-up the user can send on WhatsApp as is. */
export function followUpText(i: Pick<WaitItem, "kind" | "title" | "client">, link: string, sender: string): string {
  const hi = `أهلاً${i.client ? ` يا ${i.client}` : ""} 👋`;
  const body = {
    delivery: [`حبيت أطمن إن شغل «${i.title}» وصلك تمام.`, "لو في أي ملاحظات أو تعديلات قولّي، ولو كله تمام تقدر توافق عليه من هنا:", link],
    quote: [`حبيت أتابع معاك بخصوص عرض السعر «${i.title}».`, "لو عندك أي سؤال أو حابب نعدّل حاجة قولّي. العرض هنا:", link],
    contract: [`حبيت أفكّرك بالاتفاق على «${i.title}» عشان نقدر نبدأ.`, "تقدر تراجعه وتوافق عليه من هنا:", link],
  }[i.kind];
  return [hi, "", ...body, "", "مستني ردّك 🙏", ...(sender ? [sender] : [])].join("\n");
}

/** The morning push line: items that reached 3, 7 or 14 days today (so each is mentioned only on those days). */
export function waitingDigest(list: Waiting[]): string[] {
  return list.filter((w) => NUDGE_ON.includes(w.days)).map((w) => `${w.client || w.title} (${w.days} أيام)`);
}
