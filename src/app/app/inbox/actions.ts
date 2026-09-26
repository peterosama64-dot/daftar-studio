"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { disconnectGmail } from "@/lib/gmail";

export async function disconnectGmailAction() {
  await disconnectGmail(await requireUser());
  revalidatePath("/app/inbox");
}
