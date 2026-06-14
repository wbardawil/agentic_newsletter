import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const MEMBER_PREFIXES = ["/me", "/archive", "/convenings", "/ask"];
const ADMIN_PREFIXES = ["/admin"];

/**
 * Middleware using @supabase/ssr's recommended pattern.
 *
 * MUST call supabase.auth.getUser() on every request so that:
 * 1. Expired access tokens are exchanged for a fresh one via the refresh token.
 * 2. The refreshed token is written to the response cookies BEFORE the Server
 *    Component renders — Server Components cannot set cookies themselves.
 *
 * Without this, users appear logged-out in Server Components even with a valid
 * refresh token, because the access-token cookie is stale and there is no
 * middleware writing the refreshed one.
 *
 * History: an earlier version omitted the Supabase client here to avoid
 * __dirname errors from @supabase/supabase-js on the Edge runtime. Those
 * errors came from the old auth-helpers package. @supabase/ssr is Edge-safe.
 */
export async function middleware(request: NextRequest) {
  // Start with a passthrough response. setAll() below will replace it if
  // Supabase needs to write refreshed auth cookies.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          // Mutate the request cookies so downstream middleware/handlers see them.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Rebuild the response so the new cookies reach the browser.
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Calling getUser() is what triggers the token refresh and writes the cookies.
  // Do NOT use getSession() here — it doesn't revalidate the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const needsAuth =
    MEMBER_PREFIXES.some((p) => pathname.startsWith(p)) ||
    ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  // Admin-email enforcement lives in app/admin/layout.tsx (Node runtime),
  // where the full session can be validated. Here we only gate on login.
  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/ask|approve).*)"],
};
