import { fmt } from "./money";
import { shortDate } from "./dates";

export type WeeklyData = {
  name: string;
  cur: string;
  appUrl: string;
  done: { title: string; client: string }[];
  income: number;
  spent: number;
  upcoming: { title: string; client: string; due: Date }[];
  duePayments: { label: string; title: string; amount: number; due: Date }[];
  owed: number;
  followUps: number;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const who = (t: { title: string; client: string }) => (t.client ? `${t.title} (${t.client})` : t.title);

/** The Friday email: the week that passed and the week ahead. Null when there is nothing at all to say. */
export function buildWeekly(d: WeeklyData): { subject: string; html: string; text: string } | null {
  const net = d.income - d.spent;
  if (!d.done.length && !d.income && !d.spent && !d.upcoming.length && !d.duePayments.length && !d.owed && !d.followUps) return null;
  const subject = `ملخص أسبوعك: ${d.done.length ? `خلصت ${d.done.length} ${d.done.length === 1 ? "شغلانة" : "شغلانات"}` : "الأسبوع"}${d.income ? ` ودخلك ${fmt(d.income)} ${d.cur}` : ""}`;
  const sections: { title: string; lines: string[] }[] = [];
  sections.push({ title: "الأسبوع اللي فات", lines: [
    `خلصت: ${d.done.length ? d.done.map(who).join("، ") : "مفيش"}`,
    `دخل: ${fmt(d.income)} ${d.cur} · صرف: ${fmt(d.spent)} ${d.cur} · الصافي: ${net < 0 ? "−" : ""}${fmt(Math.abs(net))} ${d.cur}`,
  ] });
  const ahead: string[] = [];
  for (const t of d.upcoming) ahead.push(`${shortDate(t.due)} — تسليم ${who(t)}`);
  for (const p of d.duePayments) ahead.push(`${shortDate(p.due)} — دفعة «${p.label}» من «${p.title}»: ${fmt(p.amount)} ${d.cur}`);
  sections.push({ title: "الأسبوع الجاي", lines: ahead.length ? ahead : ["مفيش مواعيد."] });
  const extra: string[] = [];
  if (d.owed) extra.push(`ليك عند العملاء ${fmt(d.owed)} ${d.cur}.`);
  if (d.followUps) extra.push(`${d.followUps === 1 ? "عميل محتمل محتاج" : `${d.followUps} عملاء محتملين محتاجين`} متابعة.`);
  if (extra.length) sections.push({ title: "افتكر", lines: extra });

  const hello = d.name ? `أهلاً ${d.name}،` : "أهلاً،";
  const text = [hello, "", ...sections.flatMap((s) => [s.title + ":", ...s.lines.map((l) => `• ${l}`), ""]), `افتح الدفتر: ${d.appUrl}/app`].join("\n");
  const html = `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f4f3ef;font-family:Tahoma,Arial,sans-serif;color:#17181c">
<div style="max-width:560px;margin:0 auto;padding:24px 16px" dir="rtl">
<p style="font-size:16px;margin:0 0 16px">${esc(hello)}</p>
${sections.map((s) => `<div style="background:#fbfbf9;border:1px solid #dcdad3;border-radius:12px;padding:14px 16px;margin:0 0 12px">
<h2 style="font-size:16px;margin:0 0 8px">${esc(s.title)}</h2>
${s.lines.map((l) => `<p style="font-size:14px;line-height:1.7;margin:0">• ${esc(l)}</p>`).join("")}</div>`).join("\n")}
<p style="margin:20px 0 8px"><a href="${esc(d.appUrl)}/app" style="background:#17181c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px">افتح الدفتر</a></p>
<p style="font-size:12px;color:#6c6e78;margin:16px 0 0">بيوصلك الإيميل ده كل جمعة. تقدر توقفه من الإعدادات في الدفتر.</p>
</div></body></html>`;
  return { subject, html, text };
}
