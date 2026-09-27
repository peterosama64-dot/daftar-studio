import { hourlyRate, trackedSeconds } from "./timer";

export type RateTask = { id: string; title: string; client: string; agreed: number | null; timeSpent: number; timerStart: Date | null };
export type RateRow = { name: string; jobs: number; hours: number; earned: number; rate: number };

/**
 * What an hour of work earned, from the timer: overall, per client, and per job (best and worst).
 * Only jobs with a price and at least 15 minutes tracked count; the rest are reported as «untracked».
 */
export function rateReport(tasks: RateTask[], at = new Date()) {
  const jobs = tasks.flatMap((t) => {
    const sec = trackedSeconds(t.timeSpent, t.timerStart, at);
    const rate = hourlyRate(t.agreed, sec);
    return rate === null ? [] : [{ ...t, hours: sec / 3600, earned: t.agreed!, rate }];
  });
  const untracked = tasks.filter((t) => t.agreed && !jobs.some((j) => j.id === t.id)).length;
  const map = new Map<string, RateRow>();
  for (const j of jobs) {
    const name = j.client.trim() || "من غير اسم عميل";
    const r = map.get(name) ?? { name, jobs: 0, hours: 0, earned: 0, rate: 0 };
    r.jobs++; r.hours += j.hours; r.earned += j.earned;
    map.set(name, r);
  }
  const clients = [...map.values()].map((r) => ({ ...r, rate: r.earned / r.hours })).sort((a, b) => b.rate - a.rate);
  const hours = jobs.reduce((s, j) => s + j.hours, 0);
  const earned = jobs.reduce((s, j) => s + j.earned, 0);
  const byRate = [...jobs].sort((a, b) => b.rate - a.rate);
  return {
    overall: hours ? earned / hours : null,
    hours, earned, jobs: jobs.length, untracked, clients,
    best: byRate.slice(0, 5),
    // Lowest first, and never repeating a job already in «best».
    worst: byRate.slice(Math.max(5, byRate.length - 5)).reverse(),
  };
}

/** "3.5 س" / "45 د" — hours with one decimal, minutes under an hour. */
export const hoursLabel = (h: number) => (h < 1 ? `${Math.round(h * 60)} د` : `${Math.round(h * 10) / 10} س`);
