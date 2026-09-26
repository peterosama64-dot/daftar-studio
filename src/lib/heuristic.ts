// Offline parser for «رتّبهالي» when no AI key is set, or the AI call fails.
// Rough by design: one item per clause, keyword-driven. Claude does the real job.
import { AR_DAYS, dayKey } from "./dates";
import { emptyParsed, type Parsed } from "./parsed";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const normalizeDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[٬،](?=\d{3}\b)/g, "").replace(/(\d),(\d{3})\b/g, "$1$2");

const INCOME = /(استلمت|قبضت|حوّلتلك|حولتلك|حوّل|حول لي|حولي|دخلي|اتدفعلي|دفعولي|وصلني|وصلتني)/;
const SUB = /(جددت|جدّدت|اشتراك|اشتركت|تجديد)/;
const EXPENSE = /(دفعت|اشتريت|صرفت|مصاريف)/;
const DONE = /(خلصت|خلّصت|سلمت|سلّمت|بعت (الـ)?نسخة النهائية)/;
const URGENT = /(مستعجل|ضروري|النهارده|حالاً|فوراً)/;

function amountOf(s: string): number | null {
  const m = normalizeDigits(s).match(/(\d+(?:\.\d+)?)\s*(الف|ألف|آلاف|k)?/i);
  if (!m) return null;
  return Number(m[1]) * (m[2] ? 1000 : 1);
}

function dueOf(s: string, today: Date): string {
  const add = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return dayKey(d); };
  if (/النهارده|انهارده/.test(s)) return add(0);
  if (/بعد بكرة|بعد بكره/.test(s)) return add(2);
  if (/بكرة|بكره/.test(s)) return add(1);
  if (/آخر الشهر|اخر الشهر/.test(s)) return dayKey(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  const names = [["الحد", "الأحد"], ["الاتنين", "الإثنين", "الاثنين"], ["التلات", "الثلاثاء"], ["الأربع", "الاربع", "الأربعاء"], ["الخميس"], ["الجمعة", "الجمعه"], ["السبت"]];
  for (let i = 0; i < 7; i++) {
    if (names[i].some((n) => s.includes(n)) || s.includes(AR_DAYS[i])) {
      let diff = (i - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      return add(diff);
    }
  }
  return "";
}

/** "من مكتبة الكرمة" → "مكتبة الكرمة", "لعيادة بسمة" → "عيادة بسمة" */
const NOT_CLIENT = /^(الشهر|بكرة|بكره|النهارده|الخميس|الجمعة|السبت|الأحد|الاتنين|التلات|الأربع|غير|أول|اول|آخر|اخر)$/;
function clientOf(s: string): string {
  const word = "[^\\s،,.\\d]+";
  const m =
    s.match(new RegExp(`(?:^|\\s)(?:من|عند|بتاع|بتاعة|لـ)\\s*(${word}(?:\\s+${word})?)`)) ??
    s.match(new RegExp(`(?:^|\\s)ل(?!ازم|سه|يه|ما|و\\s)(${word}(?:\\s+${word})?)`));
  if (!m) return "";
  const parts = m[1].trim().split(/\s+/).filter((w) => !NOT_CLIENT.test(w) && !/^(ومستعجل|مستعجل|الخميس|بكرة|النهارده|آخر|اخر|الشهر)$/.test(w));
  const c = parts.join(" ");
  return c.length >= 2 && !NOT_CLIENT.test(c) ? c : "";
}

const LEAD = /^و?(كمان|لازم|محتاج|عندي|أنا|انا|هـ?|أ?سلّ?م|ا?سلم|أ?عمل|اعمل|أ?بعت|ابعت|أ?خلّ?ص|أصمم|اصمم|أجهز|اجهز)\s+/;
const clean = (s: string) => {
  let t = s.replace(/\s+/g, " ").trim().replace(/^و\s+/, "");
  for (let i = 0; i < 4 && LEAD.test(t); i++) t = t.replace(LEAD, "");
  return t;
};

// WhatsApp export lines: "[9/25/26, 7:04:46 PM] Name: msg" (iOS) or "25/09/2026, 19:04 - Name: msg" (Android).
const CHAT_LINE = /^\s*\u200e?(?:\[[^\]]*\d{1,2}:\d{2}[^\]]*\]\s*|\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4},?\s+\d{1,2}:\d{2}(?:\s?[APap][Mm])?\s+-\s+)/;
const CHAT_NOISE = /(omitted|deleted this message|This message was deleted|end-to-end encrypted|changed the subject|joined using|added|left|‎?تم حذف هذه الرسالة|لقد حذفت هذه الرسالة|تم استبعاد|<[^>]+>|https?:\/\/\S+)/i;
const TASK_SIGNAL = /(لازم|محتاج|عايز|عاوز|ممكن|سلّ?م|ابعت|اعمل|صمم|صمّم|عدّ?ل|تعديل|لوجو|بوستر|براند|هوية|تصميم|فلاير|بانر|موك ?اب|ديدلاين|deadline|logo|poster|design|مستعجل|ضروري|بكرة|بكره|النهارده|الخميس|الجمعة|السبت|الأحد|الاتنين|التلات|الأربع|آخر الشهر|اخر الشهر|خلصت|خلّصت)/i;

const ME = /^(you|أنت|انت|me)$/i;

/** A pasted chat export → its messages (sender + body), without timestamps, media and system lines. */
function chatMessages(text: string): { from: string; body: string }[] | null {
  const lines = text.split(/\r?\n/);
  if (lines.filter((l) => CHAT_LINE.test(l)).length < 3) return null;
  return lines
    .map((l) => {
      const rest = l.replace(CHAT_LINE, "");
      const m = rest.match(/^([^:]{1,40}):\s*(.*)$/);
      return m ? { from: m[1].trim(), body: m[2].trim() } : { from: "", body: rest.trim() };
    })
    .filter((m) => m.body && !CHAT_NOISE.test(m.body));
}

export function heuristicParse(text: string, today = new Date()): Parsed {
  const out = emptyParsed();
  const chat = chatMessages(text);
  if (!chat) {
    // Emails from the Gmail panel arrive with header lines and ——— separators: keep only the bodies.
    const plain = text.split(/\r?\n/).filter((l) => !/^(From|Date|To|Cc|Subject):\s/i.test(l) && !/^[—-]{3,}\s*$/.test(l)).join("\n");
    parseInto(out, plain, today, false, "");
    return out;
  }
  // In a chat the client is whoever sent the message (not you).
  for (const m of chat) parseInto(out, m.body, today, true, ME.test(m.from) ? "" : m.from.slice(0, 60));
  return out;
}

function parseInto(out: Parsed, text: string, today: Date, chat: boolean, sender: string) {
  const who = (c: string) => sender || clientOf(c);
  const clauses = normalizeDigits(text)
    .split(/[.\n؛;]|،|(?:\s+و(?=(?:استلمت|قبضت|جددت|دفعت|اشتريت|صرفت|لازم|عندي|محتاج|خلصت|سلمت)))/)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);
  const todayKey = dayKey(today);
  for (const c of clauses) {
    const amt = amountOf(c);
    if (amt && INCOME.test(c)) {
      out.income.push({ name: clean(c.replace(INCOME, "").replace(/\d[\d.]*\s*(الف|ألف)?/, "")).slice(0, 80) || "دخل", client: who(c), amount: amt, date: todayKey });
    } else if (amt && SUB.test(c)) {
      const name = clean(c.replace(SUB, "").replace(/(بـ|ب)?\s*\d[\d.]*.*/, "")) || "اشتراك";
      out.subscriptions.push({ name: name.slice(0, 60), amount: amt });
    } else if (amt && EXPENSE.test(c)) {
      out.expenses.push({ name: clean(c.replace(EXPENSE, "").replace(/(بـ|ب)?\s*\d[\d.]*.*/, "")).slice(0, 80) || "مصروف", amount: amt, date: todayKey });
    } else {
      const done = DONE.test(c);
      // In a chat, most messages are conversation, not work: keep only ones that look like a task.
      if (chat && !TASK_SIGNAL.test(c)) continue;
      const title = clean(c.replace(DONE, "").replace(/(ومستعجل|مستعجل|ضروري)/g, "").replace(/\s+(يوم\s+)?(النهارده|بكرة|بكره|بعد بكرة|الخميس|الجمعة|السبت|الأحد|الاتنين|التلات|الأربع|آخر الشهر)\s*$/, ""));
      if (title.length < 3) continue;
      out.tasks.push({ title: title.slice(0, 120), client: who(c), due: done ? "" : dueOf(c, today), priority: URGENT.test(c) ? "high" : "normal", status: done ? "done" : "todo" });
    }
  }
}
