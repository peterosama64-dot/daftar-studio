import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma, userRow } from "./db";
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

const SEEN_EVERY = 60 * 60 * 1000;

/**
 * Current user id, or null. Also checks the user still exists and isn't suspended (deleted or suspended
 * accounts lose access at once), and notes activity at most once an hour for the admin page.
 */
export async function currentUserId(): Promise<string | null> {
  const uid = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const u = await userRow(uid);
  if (!u || u.suspendedAt) return null;
  const t = Date.now();
  if (!u.lastSeenAt || t - u.lastSeenAt.getTime() > SEEN_EVERY) {
    await prisma.user.updateMany({ where: { id: uid }, data: { lastSeenAt: new Date(t) } }).catch(() => {});
  }
  return u.id;
}

/** For pages and server actions: the signed-in user's id, or a redirect to /login. */
export async function requireUser(): Promise<string> {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  return uid;
}
