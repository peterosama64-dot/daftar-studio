import { NextResponse, type NextRequest } from "next/server";

// Until real accounts land (next phase), APP_PASSWORD protects the app and API
// with the browser's built-in password prompt. Unset = open (local dev only).
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
  }
  return new NextResponse("محتاج كلمة السر", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="daftar", charset="UTF-8"' } });
}

export const config = { matcher: ["/app/:path*", "/api/:path*"] };
