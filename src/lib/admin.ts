import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "./db";
import { requireUser } from "./auth";
import { isAdminEmail } from "./admin-emails";

export async function isAdmin(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return isAdminEmail(u?.email);
}

/** For the admin page and its actions. Non-admins get a 404, so the page doesn't reveal it exists. */
export async function requireAdmin(): Promise<string> {
  const uid = await requireUser();
  if (!(await isAdmin(uid))) notFound();
  return uid;
}
