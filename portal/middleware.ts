import { NextResponse, type NextRequest } from "next/server";

// Edge-safe middleware: no Supabase client instantiation (see hasAuthCookie).
// rev: 2026-06-09 — force fresh compile, no Node-only deps in the edge bundle.

const MEMBER_PREFIXES = ["/me", "/archive", "/convenings", "/ask"];
const ADMIN_PREFIXES = ["/admin"];

/**
 * True if the request carries a Supabase auth-token cookie.
 *
 * @supabase/ssr stores the session in cookies named `sb-<project-ref>-auth-token`
 * (optionally chunked: `…-auth-token.0`, `.1`, …). We only check for presence —
 * this is a lightweight UX gate. The authoritative validation (getUser, which
 * verifies the JWT against the auth server) happens in Server Components / Route
 * Handlers running in the Node runtime, where the full Supabase client is safe.
 *
 * The middleware deliberately does NOT instantiate the Supabase client: it runs
 * in the Edge Runtime, and newer @supabase/supabase-js versions pull in modules
 * that are incompatible with Edge, which crashes the middleware (500 on every
 * route). A pure cookie read uses only Web-standard APIs and never throws.
 */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name) && c.value.length > 0);
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const needsAuth =
    MEMBER_PREFIXES.some((p) => pathname.startsWith(p)) ||
    ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  // Admin-email enforcement lives in app/admin/layout.tsx (Node runtime),
  // where the full session can be validated. Here we only gate on login.
  if (needsAuth && !hasAuthCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/ask|approve).*)"],
};
