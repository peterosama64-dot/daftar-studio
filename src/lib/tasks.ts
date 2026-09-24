import { daysUntil } from "./dates";

export type TaskLike = { status: string; priority: string; due: Date | null };
export type Bucket = "urgent" | "later" | "done";

/** Urgent = marked high, or due within 2 days (including overdue). */
export function bucket(t: TaskLike, today: Date): Bucket {
  if (t.status === "done") return "done";
  const d = daysUntil(t.due, today);
  if (t.priority === "high" || (d !== null && d <= 2)) return "urgent";
  return "later";
}

export function byDue<T extends { due: Date | null }>(a: T, b: T): number {
  const x = a.due ? a.due.getTime() : Infinity;
  const y = b.due ? b.due.getTime() : Infinity;
  return x - y;
}

export type DueTone = "overdue" | "today" | "soon" | "later" | null;

export function dueTone(t: TaskLike, today: Date): { tone: DueTone; label: string } {
  const d = daysUntil(t.due, today);
  if (d === null || t.status === "done") return { tone: null, label: "" };
  if (d < 0) return { tone: "overdue", label: d === -1 ? "متأخرة يوم" : `متأخرة ${-d} أيام` };
  if (d === 0) return { tone: "today", label: "النهارده" };
  if (d === 1) return { tone: "soon", label: "بكرة" };
  if (d <= 3) return { tone: "soon", label: `بعد ${d} أيام` };
  return { tone: "later", label: "" };
}
