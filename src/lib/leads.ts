export const LEAD_STAGES = [
  { key: "new", label: "جديد" },
  { key: "quoted", label: "بعتّله عرض" },
  { key: "waiting", label: "مستني رده" },
] as const;
export const LEAD_CLOSED = [{ key: "won", label: "اتفقنا" }, { key: "lost", label: "مانفعش" }] as const;
export const LEAD_STATUSES = [...LEAD_STAGES, ...LEAD_CLOSED].map((s) => s.key) as string[];
export type LeadStatus = (typeof LEAD_STAGES)[number]["key"] | (typeof LEAD_CLOSED)[number]["key"];

export type LeadLike = { status: string; nextAt: Date | null; budget: number | null; createdAt: Date; closedAt: Date | null };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Open leads whose follow-up day has come (today or earlier). */
export const followUpDue = <T extends LeadLike>(leads: T[], today: Date) =>
  leads.filter((l) => !["won", "lost"].includes(l.status) && l.nextAt && startOfDay(l.nextAt) <= startOfDay(today));

/** How the pipeline is doing: open count and value, and the win rate of the last 90 days. */
export function leadStats<T extends LeadLike>(leads: T[], today: Date) {
  const open = leads.filter((l) => !["won", "lost"].includes(l.status));
  const since = today.getTime() - 90 * 86_400_000;
  const closed = leads.filter((l) => l.closedAt && l.closedAt.getTime() >= since);
  const won = closed.filter((l) => l.status === "won").length;
  return {
    open: open.length,
    value: open.reduce((s, l) => s + (l.budget ?? 0), 0),
    winRate: closed.length ? Math.round((won / closed.length) * 100) : null,
    closed: closed.length,
  };
}
