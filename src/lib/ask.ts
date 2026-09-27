import { z } from "zod";
import { AR_DAYS, AR_MONTHS, clock, dayKey, monthKey, parseDay, shiftMonth, shortDate } from "./dates";
import { activeIn, fmt, type EntryLike } from "./money";
import { CATEGORIES, CATEGORY_KEYS, categoryLabel } from "./categories";
import { owedByClient } from "./owed";
import { trackedSeconds } from "./timer";

// «اسأل دفترك»: the AI only turns the question into this query. The numbers are then counted here, from the
// user's own rows, so an answer can never contain a figure the model made up.

export const AskSchema = z.object({
  topic: z.enum(["income", "spend", "net", "owed", "tasks", "hours", "clients", "meetings", "leads", "help"])
    .describe("income = money received; spend = expenses + subscriptions; net = income - spend; owed = what clients still owe; tasks = jobs; hours = time tracked; clients = best/most clients; meetings = calls/meetings; leads = potential clients; help = anything else"),
  client: z.string().describe("Exact client name from the list, or \"\" for all clients"),
  category: z.enum(["", ...CATEGORY_KEYS] as [string, ...string[]]).describe("Expense category key, or \"\""),
  from: z.string().describe("First day YYYY-MM-DD, or \"\" when the question has no period"),
  to: z.string().describe("Last day YYYY-MM-DD (inclusive), or \"\""),
  groupBy: z.enum(["none", "client", "month", "category"]),
  status: z.enum(["any", "open", "done", "late"]).describe("For tasks only"),
  reply: z.string().describe("Only for topic help: a one-sentence answer in Egyptian Arabic saying what you can answer"),
});
export type AskSpec = z.infer<typeof AskSchema>;

export function askSystem(today: Date, clients: string[], currency: string) {
  return (
    `You turn questions from a freelance designer in Egypt about their own work notebook into a query. ` +
    `Today is ${AR_DAYS[today.getDay()]} ${dayKey(today)}. Money is in ${currency}. ` +
    `Resolve periods to real dates: «السنة دي» = ${today.getFullYear()}-01-01 to ${dayKey(today)}; «الشهر ده» = this month so far; ` +
    `«الشهر اللي فات» = all of last month; «السنة اللي فاتت» = all of last year; «الأسبوع ده» = from Saturday. Leave from/to empty when no period is asked. ` +
    `For meetings, «الجاية» / no period means from today for 7 days. ` +
    `Map any client the user names to the closest exact name in this list: ${JSON.stringify(clients.slice(0, 200))}. If none fits, write the name as said. ` +
    `Categories: ${CATEGORIES.map((c) => `${c.key} = ${c.label}`).join("; ")}. ` +
    `«مين أكتر عميل» / best clients → topic clients. «كام ساعة» → hours. «مين لسه مدفعش» / «ليا كام بره» → owed. ` +
    `Use groupBy month for «كل شهر» / «بالشهور», client for «لكل عميل», category for «في إيه» about spending. ` +
    `Questions that are not about this data → topic help.`
  );
}

// ---------- answering ----------
export type AskEntry = EntryLike & { category: string | null };
export type AskTask = { id: string; title: string; client: string; agreed: number | null; paid: number | null; currency: string | null; status: string; due: Date | null; doneAt: Date | null; timeSpent: number; timerStart: Date | null };
export type AskMeeting = { title: string; client: string; at: Date };
export type AskLead = { name: string; need: string; status: string; nextAt: Date | null };
export type AskData = { entries: AskEntry[]; tasks: AskTask[]; meetings: AskMeeting[]; leads: AskLead[]; clients: string[] };

export type AnswerLine = { label: string; value: string; href?: string };
export type Answer = { text: string; lines: AnswerLine[]; href?: string };

/** Loose Arabic matching: hamza forms, ta marbuta, alef maqsura, «ال», spacing and case don't matter. */
const norm = (s: string) => s.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/(^|\s)ال/g, "$1").replace(/[^\p{L}\p{N}]/gu, "");
export function clientMatches(name: string, wanted: string): boolean {
  if (!wanted) return true;
  const a = norm(name), b = norm(wanted);
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
}

type Period = { from: Date | null; to: Date | null };
/** from/to as dates; `to` becomes the start of the next day so comparisons are `< to`. */
export function periodOf(spec: Pick<AskSpec, "from" | "to">): Period {
  let from = parseDay(spec.from), to = parseDay(spec.to);
  if (from && to && to < from) [from, to] = [to, from];
  return { from, to: to ? new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1) : null };
}
const inPeriod = (d: Date | null, p: Period) => !!d && (!p.from || d >= p.from) && (!p.to || d < p.to);

export function periodLabel(p: Period, today: Date): string {
  if (!p.from && !p.to) return "من الأول";
  const last = p.to ? new Date(p.to.getFullYear(), p.to.getMonth(), p.to.getDate() - 1) : today;
  const f = p.from;
  if (f && f.getDate() === 1 && f.getMonth() === 0 && last.getFullYear() === f.getFullYear() && (dayKey(last) === dayKey(today) || (last.getMonth() === 11 && last.getDate() === 31)))
    return f.getFullYear() === today.getFullYear() ? "السنة دي" : `سنة ${f.getFullYear()}`;
  if (f && f.getDate() === 1 && monthKey(f) === monthKey(last) && (dayKey(last) === dayKey(today) || new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).getDate() === 1))
    return monthKey(f) === monthKey(today) ? "الشهر ده" : `${AR_MONTHS[f.getMonth()]} ${f.getFullYear()}`;
  const d = (x: Date) => `${shortDate(x)}${x.getFullYear() !== today.getFullYear() ? `/${x.getFullYear()}` : ""}`;
  if (!f) return `لحد ${d(last)}`;
  return dayKey(f) === dayKey(last) ? `يوم ${d(f)}` : `من ${d(f)} لـ ${d(last)}`;
}

/** Months (YYYY-MM) a period covers, for subscriptions; an open start begins at the first month with data. */
function monthsOf(p: Period, today: Date, entries: EntryLike[]): string[] {
  const first = p.from ? monthKey(p.from)
    : entries.reduce((m, e) => { const k = e.startMonth ?? (e.date ? monthKey(e.date) : null); return k && k < m ? k : m; }, monthKey(today));
  const last = monthKey(p.to ? new Date(p.to.getTime() - 1) : today);
  const out: string[] = [];
  for (let k = first; k <= last && out.length < 240; k = shiftMonth(k, 1)) out.push(k);
  return out;
}

const monthLabel = (k: string) => `${AR_MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;

function grouped(rows: { key: string; amount: number }[], cur: string, max = 8): AnswerLine[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.key, (m.get(r.key) ?? 0) + r.amount);
  return [...m.entries()].filter(([, v]) => Math.round(v)).sort((a, b) => b[1] - a[1]).slice(0, max).map(([label, v]) => ({ label, value: `${fmt(v)} ${cur}` }));
}
const byMonth = (rows: { key: string; amount: number }[], cur: string): AnswerLine[] => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.key, (m.get(r.key) ?? 0) + r.amount);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => ({ label: monthLabel(k), value: `${fmt(v)} ${cur}` }));
};

const who = (client: string) => (client ? ` من ${client}` : "");

export function answerAsk(spec: AskSpec, data: AskData, today: Date, cur: string, toBase: (a: number, c: string | null) => number = (a) => a): Answer {
  const p = periodOf(spec);
  const when = periodLabel(p, today);
  const client = spec.client.trim();

  const incomeRows = () => data.entries.filter((e) => e.kind === "income" && inPeriod(e.date, p) && clientMatches(e.client || e.name, client));
  const spendRows = () => {
    const cat = (e: AskEntry) => !spec.category || e.category === spec.category;
    const expenses = data.entries.filter((e) => e.kind === "expense" && inPeriod(e.date, p) && cat(e))
      .map((e) => ({ e, month: monthKey(e.date!), amount: e.amount }));
    const subs = monthsOf(p, today, data.entries).flatMap((k) => data.entries.filter((e) => activeIn(e, k) && cat(e)).map((e) => ({ e, month: k, amount: e.amount })));
    return [...expenses, ...subs];
  };

  switch (spec.topic) {
    case "income": {
      const rows = incomeRows();
      const total = rows.reduce((s, e) => s + e.amount, 0);
      if (!rows.length) return { text: `مفيش دخل متسجّل${who(client)} ${when}.`, lines: [], href: "/app/money" };
      const lines = spec.groupBy === "month" ? byMonth(rows.map((e) => ({ key: monthKey(e.date!), amount: e.amount })), cur)
        : spec.groupBy === "client" || !client ? grouped(rows.map((e) => ({ key: e.client || e.name, amount: e.amount })), cur) : [];
      return { text: `دخلك${who(client)} ${when}: ${fmt(total)} ${cur} (${rows.length === 1 ? "دفعة واحدة" : `${rows.length} دفعات`}).`, lines, href: "/app/money" };
    }
    case "spend": {
      const rows = spendRows();
      const total = rows.reduce((s, r) => s + r.amount, 0);
      const what = spec.category ? `على «${categoryLabel(spec.category)}»` : "";
      if (!rows.length) return { text: `مفيش صرف متسجّل ${what} ${when}.`.replace(/\s+/g, " "), lines: [], href: "/app/money" };
      const lines = spec.groupBy === "month" ? byMonth(rows.map((r) => ({ key: r.month, amount: r.amount })), cur)
        : spec.groupBy === "category" || (!spec.category && spec.groupBy === "none") ? grouped(rows.map((r) => ({ key: categoryLabel(r.e.category), amount: r.amount })), cur)
          : grouped(rows.map((r) => ({ key: r.e.name, amount: r.amount })), cur);
      return { text: `صرفت ${what} ${when}: ${fmt(total)} ${cur}.`.replace(/\s+/g, " "), lines, href: "/app/money" };
    }
    case "net": {
      const I = incomeRows().reduce((s, e) => s + e.amount, 0);
      const O = spendRows().reduce((s, r) => s + r.amount, 0);
      const net = I - O;
      return {
        text: net >= 0 ? `صافي ربحك ${when}: ${fmt(net)} ${cur}.` : `${when} خسرت ${fmt(-net)} ${cur}.`,
        lines: [{ label: "الدخل", value: `${fmt(I)} ${cur}` }, { label: "الصرف", value: `${fmt(O)} ${cur}` }],
        href: "/app/money",
      };
    }
    case "owed": {
      const o = owedByClient(data.tasks.filter((t) => clientMatches(t.client, client)), toBase);
      if (!o.total) return { text: client ? `${client} مش عليه فلوس ليك.` : "مفيش فلوس ليك عند حد. 👌", lines: [], href: "/app/money" };
      return {
        text: client ? `لسه ليك عند ${o.clients[0].name} ${fmt(o.total)} ${cur}.` : `لسه ليك ${fmt(o.total)} ${cur} عند ${o.clients.length === 1 ? "عميل واحد" : `${o.clients.length} عملاء`}.`,
        lines: client ? o.clients.flatMap((c) => c.tasks).slice(0, 8).map((t) => ({ label: t.title, value: `${fmt(toBase(t.remaining, t.currency))} ${cur}`, href: `/app/tasks/${t.id}` }))
          : o.clients.slice(0, 8).map((c) => ({ label: c.name, value: `${fmt(c.owed)} ${cur}`, href: `/app/clients/${encodeURIComponent(c.name)}` })),
        href: "/app/money",
      };
    }
    case "tasks": {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      let list = data.tasks.filter((t) => clientMatches(t.client, client));
      const hasP = !!(p.from || p.to);
      if (spec.status === "done") list = list.filter((t) => t.status === "done" && (!hasP || inPeriod(t.doneAt, p)));
      else if (spec.status === "late") list = list.filter((t) => t.status !== "done" && t.due && t.due < start);
      else if (spec.status === "open") list = list.filter((t) => t.status !== "done" && (!hasP || inPeriod(t.due, p)));
      else if (hasP) list = list.filter((t) => inPeriod(t.status === "done" ? t.doneAt : t.due, p));
      const label = spec.status === "done" ? "خلّصت" : spec.status === "late" ? "متأخر عليك" : spec.status === "open" ? "لسه عندك" : "عندك";
      const n = list.length;
      const tail = `${client ? ` لـ ${client}` : ""}${hasP && spec.status !== "late" ? ` ${when}` : ""}`;
      if (!n) return { text: spec.status === "late" ? `مفيش حاجة متأخرة${client ? ` لـ ${client}` : ""}. 👌` : `مفيش مهام${tail}.`, lines: [], href: "/app/tasks" };
      list.sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));
      return {
        text: `${label} ${n === 1 ? "مهمة واحدة" : `${n} مهام`}${tail}.`,
        lines: list.slice(0, 10).map((t) => ({ label: t.client && !client ? `${t.title} · ${t.client}` : t.title, value: t.status === "done" ? (t.doneAt ? shortDate(t.doneAt) : "✓") : t.due ? shortDate(t.due) : "—", href: `/app/tasks/${t.id}` })),
        href: "/app/tasks",
      };
    }
    case "hours": {
      const hasP = !!(p.from || p.to);
      const list = data.tasks.filter((t) => clientMatches(t.client, client) && (!hasP || inPeriod(t.doneAt ?? t.due, p)))
        .map((t) => ({ t, h: trackedSeconds(t.timeSpent, t.timerStart, new Date()) / 3600 })).filter((x) => x.h > 0);
      const hours = list.reduce((s, x) => s + x.h, 0);
      if (!hours) return { text: `مفيش وقت متسجّل بالتايمر${client ? ` لـ ${client}` : ""}${hasP ? ` ${when}` : ""}.`, lines: [], href: "/app/report/rates" };
      const priced = list.filter((x) => x.t.agreed);
      const earned = priced.reduce((s, x) => s + toBase(x.t.agreed!, x.t.currency), 0), ph = priced.reduce((s, x) => s + x.h, 0);
      const h = (n: number) => (n < 10 ? n.toFixed(1).replace(/\.0$/, "") : String(Math.round(n)));
      return {
        text: `اشتغلت ${h(hours)} ساعة${client ? ` على ${client}` : ""}${hasP ? ` ${when}` : ""}${ph >= 0.25 ? `، يعني الساعة جابت حوالي ${fmt(earned / ph)} ${cur}` : ""}.`,
        lines: list.sort((a, b) => b.h - a.h).slice(0, 8).map((x) => ({ label: x.t.title, value: `${h(x.h)} س`, href: `/app/tasks/${x.t.id}` })),
        href: "/app/report/rates",
      };
    }
    case "clients": {
      const rows = incomeRows();
      const lines = grouped(rows.map((e) => ({ key: e.client || e.name, amount: e.amount })), cur);
      if (!lines.length) return { text: `مفيش دخل متسجّل ${when} عشان أقارن العملاء.`, lines: [], href: "/app/clients" };
      return { text: `أكتر عميل جاب فلوس ${when}: ${lines[0].label} (${lines[0].value}).`, lines, href: "/app/clients" };
    }
    case "meetings": {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const q = p.from || p.to ? p : { from: today, to: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 8) };
      const list = data.meetings.filter((m) => inPeriod(m.at, q) && clientMatches(m.client, client)).sort((a, b) => a.at.getTime() - b.at.getTime());
      const span = p.from || p.to ? ` ${when}` : " الأيام الجاية";
      if (!list.length) return { text: `مفيش مواعيد${client ? ` مع ${client}` : ""}${span}.`, lines: [], href: "/app/meetings" };
      return {
        text: `عندك ${list.length === 1 ? "ميعاد واحد" : `${list.length} مواعيد`}${client ? ` مع ${client}` : ""}${span}.`,
        lines: list.slice(0, 10).map((m) => ({ label: m.client && !m.title.includes(m.client) ? `${m.title} · ${m.client}` : m.title, value: `${dayKey(m.at) === dayKey(today) ? "النهارده" : `${AR_DAYS[m.at.getDay()]} ${shortDate(m.at)}`} ${clock(m.at)}` })),
        href: "/app/meetings",
      };
    }
    case "leads": {
      const open = data.leads.filter((l) => ["new", "quoted", "waiting"].includes(l.status));
      if (!open.length) return { text: "مفيش عملاء محتملين مفتوحين دلوقتي.", lines: [], href: "/app/leads" };
      return {
        text: `عندك ${open.length === 1 ? "عميل محتمل واحد" : `${open.length} عملاء محتملين`} لسه ماتقفلوش.`,
        lines: open.slice(0, 8).map((l) => ({ label: l.need ? `${l.name} · ${l.need}` : l.name, value: l.nextAt ? `تابع ${shortDate(l.nextAt)}` : "" })),
        href: "/app/leads",
      };
    }
    default:
      return { text: spec.reply.trim().slice(0, 300) || HELP, lines: [] };
  }
}

export const HELP = "أقدر أجاوبك عن فلوسك وشغلك: دخلك من عميل أو في فترة، صرفت كام وفي إيه، مين لسه عليه فلوس، المهام المتأخرة، ساعات شغلك، مواعيدك، والعملاء المحتملين.";

export const ASK_EXAMPLES = [
  "كام دخلت السنة دي؟",
  "مين لسه عليه فلوس ليا؟",
  "صرفت كام الشهر اللي فات وفي إيه؟",
  "إيه المتأخر عليا؟",
  "مين أكتر عميل جاب فلوس السنة دي؟",
  "عندي مواعيد إيه الأسبوع ده؟",
];
