import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentUserId } from "@/lib/auth";
import { authUrl, gmailConfigured } from "@/lib/gmail";

// Starts Google's consent screen. A random state in a short-lived cookie ties the callback to this browser.
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!(await currentUserId())) return NextResponse.redirect(`${origin}/login?next=/app/inbox`);
  if (!gmailConfigured()) return NextResponse.redirect(`${origin}/app/inbox?gmail=not_configured`);
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authUrl(origin, state));
  res.cookies.set("gmail_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/gmail", maxAge: 600 });
  return res;
}
