import { monthKey } from "./dates";

/**
 * Progress toward the monthly income goal. For the current month it also says how much is left
 * per remaining day (today included); for other months only whether it was reached.
 */
export function goalProgress(income: number, goal: number, month: string, today: Date) {
  const pct = goal > 0 ? Math.round((income / goal) * 100) : 0;
  const left = Math.max(0, goal - income);
  const current = monthKey(today) === month;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = current ? lastDay - today.getDate() + 1 : 0;
  return { pct, left, reached: income >= goal, current, daysLeft, perDay: current && left ? Math.ceil(left / daysLeft) : 0 };
}
