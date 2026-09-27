import { fmt } from "./money";

export type ReminderData = {
  client: string;
  sender: string;
  cur: string;
  phone: string | null;
  tasks: { title: string; remaining: number; path: string }[];
};

/** A polite WhatsApp message asking a client to settle what they still owe, with an invoice link per job. */
export function reminderText(d: ReminderData, origin: string): string {
  const total = d.tasks.reduce((s, t) => s + t.remaining, 0);
  const lines = [`أهلاً يا ${d.client} 👋`, "", "حبيت أفكّرك بالمبلغ اللي لسه فاضل على الشغل:"];
  for (const t of d.tasks) {
    lines.push(`• ${t.title}: ${fmt(t.remaining)} ${d.cur}`);
    lines.push(`  الفاتورة: ${origin}${t.path}`);
  }
  if (d.tasks.length > 1) lines.push("", `الإجمالي: ${fmt(total)} ${d.cur}`);
  lines.push("", "لو تقدر تحوّله في أقرب وقت أكون شاكر جداً 🙏");
  if (d.sender) lines.push(d.sender);
  return lines.join("\n");
}

/** wa.me link carrying the message; without a phone WhatsApp asks which chat to send it to. */
export function whatsappMessageLink(base: string | null, text: string): string {
  return `${base ?? "https://wa.me/"}?text=${encodeURIComponent(text)}`;
}
