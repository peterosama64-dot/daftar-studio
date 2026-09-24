"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, checkPassword, startSession, endSession } from "@/lib/auth";

export type AuthState = { error?: string; email?: string; name?: string } | null;

// Per-instance throttle on failures only: 8 failed attempts / 10 min per IP+email.
const failures = new Map<string, number[]>();
async function throttleKey(email: string) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return `${ip}|${email}`;
}
function blocked(key: string) {
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < 600_000);
  failures.set(key, recent);
  return recent.length >= 8;
}
const fail = (key: string) => failures.set(key, [...(failures.get(key) ?? []), Date.now()]);

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/app") && !s.startsWith("//") ? s : "/app";
};

const Signup = z.object({
  name: z.string().trim().max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});

export async function signup(_: AuthState, f: FormData): Promise<AuthState> {
  const p = Signup.safeParse({ name: f.get("name"), email: f.get("email"), password: f.get("password") });
  const email = String(f.get("email") ?? "");
  const name = String(f.get("name") ?? "").slice(0, 80);
  if (!p.success) {
    const field = p.error.issues[0]?.path[0];
    return { email, name, error: field === "password" ? "كلمة السر لازم تكون ٨ حروف على الأقل." : "الإيميل ده مش مظبوط." };
  }
  const key = await throttleKey(p.data.email);
  if (blocked(key)) return { email, name, error: "محاولات كتير. استنى شوية وجرّب تاني." };
  const exists = await prisma.user.findUnique({ where: { email: p.data.email }, select: { id: true } });
  if (exists) fail(key);
  if (exists) return { email, name, error: "الإيميل ده عليه حساب بالفعل. سجّل دخول بدل كده." };
  const user = await prisma.user.create({ data: { email: p.data.email, name: p.data.name, passwordHash: await hashPassword(p.data.password) } });
  await startSession(user.id);
  redirect("/app");
}

export async function login(_: AuthState, f: FormData): Promise<AuthState> {
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const password = String(f.get("password") ?? "");
  if (!email || !password) return { email, error: "اكتب الإيميل وكلمة السر." };
  const key = await throttleKey(email);
  if (blocked(key)) return { email, error: "محاولات كتير. استنى شوية وجرّب تاني." };
  const user = await prisma.user.findUnique({ where: { email } });
  // Same message for unknown email and wrong password.
  if (!user || !(await checkPassword(password, user.passwordHash))) {
    fail(key);
    return { email, error: "الإيميل أو كلمة السر مش مظبوطين." };
  }
  failures.delete(key);
  await startSession(user.id);
  redirect(safeNext(f.get("next")));
}

export async function logout() {
  await endSession();
  redirect("/login");
}
