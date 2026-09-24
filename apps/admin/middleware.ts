import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes hidden by SIMPLE_MODE (default on). The pages still exist; they are
// simply unreachable until NEXT_PUBLIC_SIMPLE_MODE=false restores them.
const SIMPLE_MODE = process.env.NEXT_PUBLIC_SIMPLE_MODE !== "false";
const HIDDEN_PREFIXES = ["/activity", "/analytics", "/organizations", "/super/crm-oversight", "/super/groups"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that don't need auth
  if (pathname.startsWith("/login")) return NextResponse.next();

  // Guard hidden routes so a deep link can't reach a feature that's off.
  if (SIMPLE_MODE && HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Check for token in cookies (set by the login page)
  const token = request.cookies.get("admin_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|icon-512.png).*)"],
};
