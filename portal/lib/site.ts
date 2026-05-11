/**
 * Single source of truth for the portal's base path and site URL.
 *
 * In production we deploy under wadibardawil.com/letter, so the Next.js
 * basePath is "/letter". In dev (or on a dedicated subdomain) we leave
 * NEXT_PUBLIC_BASE_PATH unset and basePath is "".
 *
 * Next.js auto-prefixes <Link href>, useRouter, and `redirect()` from
 * next/navigation, but it does NOT auto-prefix:
 *   - manual `new URL(path, request.url)` in Route Handlers
 *   - external callback URLs handed to third parties (Supabase magic links)
 *   - `next` redirect params we stuff into query strings
 * Use `withBase()` for those cases.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

export function withBase(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
}

export function siteUrl(path: string): string {
  return `${SITE_URL}${withBase(path)}`;
}
