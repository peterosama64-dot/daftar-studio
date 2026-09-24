import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export async function getCurrency(): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key: "currency" } });
  return s?.value ?? "EGP";
}
