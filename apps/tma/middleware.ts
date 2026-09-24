import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// SIMPLE_MODE (default on) collapses the mini-app to the core booking loop.
// These surfaces still exist as code/routes; they are simply unreachable until
// NEXT_PUBLIC_SIMPLE_MODE=false restores them. Matched as exact or prefix paths,
// plus the formation/result sub-screens under /match/[id].
const SIMPLE_MODE = process.env.NEXT_PUBLIC_SIMPLE_MODE !== "false";
const HIDDEN_PREFIXES = ["/leaderboard", "/players", "/wallet"];
const HIDDEN_SUFFIXES = ["/formation", "/result"];

export function middleware(request: NextRequest) {
  if (!SIMPLE_MODE) return NextResponse.next();
  const { pathname } = request.nextUrl;

  const hidden =
    HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    HIDDEN_SUFFIXES.some((s) => pathname.endsWith(s));

  if (hidden) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|icon-512.png).*)"],
};
