import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { currentUserId } from "@/lib/auth";
import { connectGmail } from "@/lib/gmail";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (result: string) => {
    const res = NextResponse.redirect(`${url.origin}/app/inbox?gmail=${result}`);
    res.cookies.set("gmail_state", "", { path: "/api/gmail", maxAge: 0 });
    return res;
  };
  const uid = await currentUserId();
  if (!uid) return NextResponse.redirect(`${url.origin}/login?next=/app/inbox`);
  const expected = (await cookies()).get("gmail_state")?.value ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!expected || !same(state, expected)) return back("failed");
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!code) return back("failed");
  try {
    return back(await connectGmail(uid, code, url.origin));
  } catch (e) {
    console.error("gmail callback", e instanceof Error ? e.message : e);
    return back("failed");
  }
}
