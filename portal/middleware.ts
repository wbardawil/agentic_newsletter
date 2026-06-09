import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/supabase/types";

const MEMBER_PREFIXES = ["/me", "/archive", "/convenings", "/ask"];
const ADMIN_PREFIXES = ["/admin"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  type CookieToSet = { name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] };

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: { user } } = await (supabase.auth as any).getUser();
  const pathname = request.nextUrl.pathname;

  const needsAuth = MEMBER_PREFIXES.some((p) => pathname.startsWith(p)) ||
    ADMIN_PREFIXES.some((p) => pathname.startsWith(p));

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p)) && user) {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const email = (user.email ?? "").toLowerCase();
    if (!adminEmails.includes(email)) {
      const url = request.nextUrl.clone();
      url.pathname = "/me";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/ask|approve).*)"],
};
