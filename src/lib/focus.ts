export type FocusPlan = { work: number; rest: number }; // minutes
export const PLANS: FocusPlan[] = [{ work: 25, rest: 5 }, { work: 50, rest: 10 }];

export type FocusState = { taskId: string; phase: "work" | "rest"; endsAt: number; plan: FocusPlan };

/** "24:59" */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** What comes after a phase ends: work → rest, rest → idle. */
export function nextPhase(s: FocusState, at: number): FocusState | null {
  return s.phase === "work" ? { ...s, phase: "rest", endsAt: at + s.plan.rest * 60_000 } : null;
}

/** Today's completed focus blocks (kept per browser). */
export const todayKey = (d = new Date()) => `focus-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
