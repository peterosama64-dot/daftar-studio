import { clock } from "./dates";

/** How long before a meeting its reminder goes out. */
export const REMIND_MINUTES = 60;
/** A reminder that would arrive later than this after the start is pointless, so it's dropped. */
export const LATE_MINUTES = 5;

export type MeetingLike = { title: string; client: string; at: Date; place: string };

/** The window of meetings the reminder job looks at, around wall-clock `now`. */
export function reminderWindow(now: Date) {
  return { gte: new Date(now.getTime() - LATE_MINUTES * 60_000), lte: new Date(now.getTime() + REMIND_MINUTES * 60_000) };
}

const inMinutes = (n: number) =>
  n <= 1 ? "دلوقتي" : n >= 55 ? "بعد ساعة" : n === 2 ? "بعد دقيقتين" : n <= 10 ? `بعد ${n} دقايق` : `بعد ${n} دقيقة`;

/** The push for one meeting: «بعد ساعة: مكالمة مع نون» / «الساعة 2:30 م · meet.google.com/…». */
export function meetingReminder(m: MeetingLike, now: Date): { title: string; body: string } {
  const mins = Math.max(0, Math.round((m.at.getTime() - now.getTime()) / 60_000));
  const who = m.client && !m.title.includes(m.client) ? ` مع ${m.client}` : "";
  const body = [`الساعة ${clock(m.at)}`, m.place].filter(Boolean).join(" · ");
  return { title: `${inMinutes(mins)}: ${m.title}${who}`.slice(0, 120), body: body.slice(0, 200) };
}

/** A place that is a web link (Zoom, Meet, Teams…) opens as a link; anything else is an address. */
export function placeLink(place: string): string | null {
  const p = place.trim();
  if (/^https:\/\/\S+$/i.test(p)) return p;
  if (/^(meet\.google\.com|zoom\.us|[\w-]+\.zoom\.us|teams\.microsoft\.com)\/\S*$/i.test(p)) return `https://${p}`;
  return null;
}
