import { monthName } from "./dates";
import { fmt } from "./money";

/** The email that carries a monthly invoice link to the client. */
export function recurringMail(d: { sender: string; title: string; month: string; amount: number; cur: string; invoiceNo: string | null; link: string }) {
  const from = d.sender || "دفتر الاستوديو";
  const subject = `فاتورة ${monthName(d.month)}${d.invoiceNo ? ` رقم ${d.invoiceNo}` : ""} — ${d.title}`;
  const line = `فاتورة ${d.title} لشهر ${monthName(d.month)} بمبلغ ${fmt(d.amount)} ${d.cur}.`;
  const text = [`فاتورة من ${from}`, "", line, "", `تفتح الفاتورة من هنا: ${d.link}`].join("\n");
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<div dir="rtl" style="font-family:system-ui,sans-serif;line-height:1.7;color:#17181c">
<p style="margin:0 0 12px">فاتورة من <b>${esc(from)}</b></p>
<p style="margin:0 0 16px">${esc(line)}</p>
<p style="margin:0"><a href="${esc(d.link)}" style="background:#17181c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px">افتح الفاتورة</a></p>
</div>`;
  return { subject, text, html };
}
