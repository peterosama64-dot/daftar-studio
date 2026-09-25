"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Sets a new password for a user who forgot theirs. The admin tells them the new one. */
export async function adminSetPassword(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  const password = String(f.get("password") ?? "");
  if (!id || password.length < 8 || password.length > 200) return;
  await prisma.user.updateMany({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  revalidatePath("/app/admin");
}

/** Deletes an account and everything in it (tasks and entries cascade). Not your own. */
export async function adminDeleteUser(f: FormData) {
  const me = await requireAdmin();
  const id = str(f, "id");
  if (!id || id === me || str(f, "confirm") !== "امسح") return;
  await prisma.user.deleteMany({ where: { id } });
  revalidatePath("/app/admin");
}
