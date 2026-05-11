/**
 * Edge router for wadibardawil.com.
 *
 * Splits traffic by path:
 *   /letter/*   → Vercel deployment of the Next.js portal
 *   everything else → Lovable (apex marketing site)
 *
 * Deploy via `wrangler deploy` (see wrangler.toml). Configure two env
 * vars in the Cloudflare dashboard (or wrangler.toml) — they are the
 * URLs the Worker proxies to:
 *
 *   PORTAL_ORIGIN  e.g. https://transformation-letter-portal.vercel.app
 *   LOVABLE_ORIGIN e.g. https://wadibardawil.lovable.app
 *
 * Both origins must NOT include trailing slashes.
 */

export interface Env {
  PORTAL_ORIGIN: string;
  LOVABLE_ORIGIN: string;
}

const PORTAL_PREFIX = "/letter";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const targetBase = url.pathname === PORTAL_PREFIX || url.pathname.startsWith(`${PORTAL_PREFIX}/`)
      ? env.PORTAL_ORIGIN
      : env.LOVABLE_ORIGIN;

    if (!targetBase) {
      return new Response("Router misconfigured: missing origin env var.", { status: 502 });
    }

    const target = new URL(`${targetBase}${url.pathname}${url.search}`);

    // Strip hop-by-hop headers Cloudflare disallows and let the origin
    // decide caching. We forward cookies so Supabase auth keeps working.
    const upstream = await fetch(target.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "manual",
    });

    // For redirect responses from the portal, rewrite absolute URLs that
    // point at the Vercel origin so the address bar stays on
    // wadibardawil.com.
    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get("location");
      if (location) {
        const rewritten = rewriteOriginLocation(location, env, url.origin);
        const headers = new Headers(upstream.headers);
        headers.set("location", rewritten);
        return new Response(upstream.body, { status: upstream.status, headers });
      }
    }

    return upstream;
  },
};

function rewriteOriginLocation(location: string, env: Env, publicOrigin: string): string {
  for (const origin of [env.PORTAL_ORIGIN, env.LOVABLE_ORIGIN]) {
    if (origin && location.startsWith(origin)) {
      return location.replace(origin, publicOrigin);
    }
  }
  return location;
}
