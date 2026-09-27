import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Fast gate: no valid session cookie → /login (pages) or 401 (API).
// Pages and actions still re-check the user in the database (lib/auth.ts).
export async function middleware(req: NextRequest) {
  // The reminder jobs are called by a scheduler, not a user (they check CRON_SECRET themselves).
  if (req.nextUrl.pathname === "/api/cron/reminders" || req.nextUrl.pathname === "/api/cron/meetings") return NextResponse.next();
  // Local-testing file server (it answers 404 unless LOCAL_FILES=1); the client review page loads images from it.
  if (req.nextUrl.pathname.startsWith("/api/files/local/")) return NextResponse.next();
  const uid = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (uid) return NextResponse.next();
  // Gmail connect/callback (to and from Google) and the Excel / backup downloads are browser navigations, not fetches.
  const isNavigation = /^\/api\/(gmail\/(connect|callback)|export|backup)$/.test(req.nextUrl.pathname);
  if (req.nextUrl.pathname.startsWith("/api/") && !isNavigation) {
    return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  }
  const url = new URL("/login", req.url);
  url.searchParams.set("next", /^\/api\/(export|backup)$/.test(req.nextUrl.pathname) ? "/app/settings" : isNavigation ? "/app/inbox" : req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/app/:path*", "/api/:path*"] };
