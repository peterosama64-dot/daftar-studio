"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { now } from "@/lib/dates";
import { loadFx } from "@/lib/data";
import { aiEnabled, askToQuery } from "@/lib/ai";
import { answerAsk, type Answer } from "@/lib/ask";

// Per-instance limiter: 20 questions a minute per user.
const hits = new Map<string, number[]>();
function limited(uid: string) {
  const t = Date.now(), list = (hits.get(uid) ?? []).filter((x) => t - x < 60_000);
  list.push(t); hits.set(uid, list);
  return list.length > 20;
}

export type AskResult = { answer: Answer } | { error: string };

export async function askNotebook(question: string): Promise<AskResult> {
  const uid = await requireUser();
  const q = String(question ?? "").trim().slice(0, 300);
  if (!q) return { error: "اكتب سؤالك الأول." };
  if (!aiEnabled()) return { error: "المساعد محتاج الذكاء الاصطناعي يكون متوصّل، وده مش متظبط دلوقتي." };
  if (limited(uid)) return { error: "أسئلة كتير ورا بعض. استنى دقيقة وجرّب تاني." };
  const today = now();
  const [fx, clients, entries, tasks, meetings, leads] = await Promise.all([
    loadFx(uid),
    prisma.clientInfo.findMany({ where: { userId: uid }, select: { name: true }, take: 300 }),
    prisma.entry.findMany({ where: { userId: uid }, select: { kind: true, name: true, client: true, amount: true, date: true, startMonth: true, endMonth: true, category: true } }),
    prisma.task.findMany({ where: { userId: uid }, select: { id: true, title: true, client: true, agreed: true, paid: true, currency: true, status: true, due: true, doneAt: true, timeSpent: true, timerStart: true } }),
    prisma.meeting.findMany({ where: { userId: uid, at: { gte: new Date(today.getFullYear() - 1, 0, 1) } }, select: { title: true, client: true, at: true } }),
    prisma.lead.findMany({ where: { userId: uid }, select: { name: true, need: true, status: true, nextAt: true }, orderBy: { nextAt: { sort: "asc", nulls: "last" } } }),
  ]);
  // Names the model can map to: saved clients plus anyone named on a task or a payment.
  const names = [...new Set([...clients.map((c) => c.name), ...tasks.map((t) => t.client), ...entries.filter((e) => e.kind === "income").map((e) => e.client)].filter(Boolean))];
  const spec = await askToQuery(q, today, names, fx.base);
  if (!spec) return { error: "المساعد مش قادر يرد دلوقتي. جرّب كمان شوية." };
  return { answer: answerAsk(spec, { entries, tasks, meetings, leads, clients: names }, today, fx.short(null), fx.toBase) };
}
