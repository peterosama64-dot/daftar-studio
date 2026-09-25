import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "./session";

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function startSession(userId: string) {
  (await cookies()).set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Current user id, or null. Also checks the user still exists (deleted accounts lose access). */
export async function currentUserId(): Promise<string | null> {
  const uid = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const u = await prisma.user.findUnique({ where: { id: uid }, select: { id: true } });
  return u?.id ?? null;
}

/** For pages and server actions: the signed-in user's id, or a redirect to /login. */
export async function requireUser(): Promise<string> {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  return uid;
}
