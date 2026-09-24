import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export async function getCurrency(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });
  return u?.currency ?? "EGP";
}
