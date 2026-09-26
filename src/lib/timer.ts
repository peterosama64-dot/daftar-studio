/** Seconds tracked so far, including a running session. */
export function trackedSeconds(timeSpent: number, timerStart: Date | null, at = new Date()): number {
  return timeSpent + (timerStart ? Math.max(0, Math.floor((at.getTime() - timerStart.getTime()) / 1000)) : 0);
}

/** "2 س 05 د", "45 د", "0 د" — hours and minutes, the way people say them. */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60), h = Math.floor(m / 60), mm = m % 60;
  return h ? `${h} س ${String(mm).padStart(2, "0")} د` : `${mm} د`;
}

/** What an hour of this task earned; null until there is an amount and at least 15 minutes tracked. */
export function hourlyRate(agreed: number | null, sec: number): number | null {
  return agreed && sec >= 15 * 60 ? agreed / (sec / 3600) : null;
}
