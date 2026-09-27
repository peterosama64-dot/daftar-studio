import { cache } from "react";
import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

/**
 * The signed-in user's row, read once per request: a page, its layout and the helpers they call
 * (session check, currency, exchange rates, goal, budgets) all share one query instead of one each.
 * Outside a React render (server actions, route handlers) it simply reads fresh every time.
 */
export const userRow = cache((userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, suspendedAt: true, lastSeenAt: true, currency: true, fxRates: true, budgets: true, incomeGoal: true },
  }),
);

export async function getCurrency(userId: string): Promise<string> {
  return (await userRow(userId))?.currency ?? "EGP";
}
