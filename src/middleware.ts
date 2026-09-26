import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Fast gate: no valid session cookie → /login (pages) or 401 (API).
// Pages and actions still re-check the user in the database (lib/auth.ts).
export async function middleware(req: NextRequest) {
  const uid = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (uid) return NextResponse.next();
  // The Gmail connect/callback routes are browser navigations (to and from Google), not fetches.
  const isNavigation = /^\/api\/gmail\/(connect|callback)$/.test(req.nextUrl.pathname);
  if (req.nextUrl.pathname.startsWith("/api/") && !isNavigation) {
    return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  }
  const url = new URL("/login", req.url);
  url.searchParams.set("next", isNavigation ? "/app/inbox" : req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/app/:path*", "/api/:path*"] };
