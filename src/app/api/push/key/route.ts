import { NextResponse } from "next/server";
import { vapidKeys } from "@/lib/push";

export async function GET() {
  return NextResponse.json({ publicKey: (await vapidKeys()).publicKey });
}
