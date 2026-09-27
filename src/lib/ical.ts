// A read-only iCalendar (RFC 5545) feed that Google / Apple Calendar subscribe to.
// Dates in the app are wall-clock times in the studio's timezone, so timed events carry TZID.

export type IcalEvent =
  | { uid: string; title: string; description?: string; url?: string; day: Date } // all-day
  | { uid: string; title: string; description?: string; url?: string; start: Date; minutes: number; location?: string };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const local = (d: Date) => `${ymd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Escapes text values: backslash, semicolon, comma and newlines. */
export const icalText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds a content line at 75 octets (UTF-8), never splitting a character. */
export function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "", size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ""; size = 0; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcal(name: string, events: IcalEvent[], tz: string, stamp = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//daftar-studio//AR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${icalText(name)}`, `X-WR-TIMEZONE:${tz}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utc(stamp)}`);
    if ("day" in e) {
      const next = new Date(e.day.getFullYear(), e.day.getMonth(), e.day.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${ymd(e.day)}`, `DTEND;VALUE=DATE:${ymd(next)}`, "TRANSP:TRANSPARENT");
    } else {
      lines.push(`DTSTART;TZID=${tz}:${local(e.start)}`, `DTEND;TZID=${tz}:${local(new Date(e.start.getTime() + e.minutes * 60_000))}`);
      if (e.location) lines.push(`LOCATION:${icalText(e.location)}`);
    }
    lines.push(`SUMMARY:${icalText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${icalText(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
