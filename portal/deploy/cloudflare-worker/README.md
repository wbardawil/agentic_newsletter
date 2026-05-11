# Cloudflare Worker — wadibardawil.com edge router

Splits traffic at the edge so `wadibardawil.com/letter/*` hits the
Next.js portal on Vercel and everything else stays on Lovable.

## End-to-end setup

You do this once. Plan ~30 min total.

### 1. Deploy the portal to Vercel

1. Push this repo's `claude/build-newsletter-portal-mxHYb` branch.
2. In Vercel: New Project → import the repo. Set the **Root Directory**
   to `portal`.
3. Set env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SITE_URL=https://wadibardawil.com`
   - `NEXT_PUBLIC_BASE_PATH=/letter`
   - `ADMIN_EMAILS=wadi@wadibardawil.com`
4. Deploy. Vercel hands you a URL like
   `https://transformation-letter-portal.vercel.app`. Keep it.
5. In Supabase Auth → URL Configuration, set:
   - **Site URL:** `https://wadibardawil.com`
   - **Additional redirect URL:** `https://wadibardawil.com/letter/auth/callback`

### 2. Move wadibardawil.com DNS to Cloudflare

1. Sign up for Cloudflare (free).
2. **Add a site:** `wadibardawil.com`. Cloudflare scans your current DNS
   records — keep them as scanned. The CNAME / A record that points at
   Lovable should still point at Lovable. (Cloudflare will proxy it.)
3. Cloudflare gives you two nameservers. Log into your registrar and
   replace the existing nameservers with Cloudflare's. Propagation is
   usually 5–30 minutes.

### 3. Deploy this Worker

From `portal/deploy/cloudflare-worker/`:

```bash
npm install
npx wrangler login
```

Edit `wrangler.toml` and set:

```toml
PORTAL_ORIGIN  = "https://transformation-letter-portal.vercel.app"
LOVABLE_ORIGIN = "https://<your-lovable-subdomain>.lovable.app"
```

(The Lovable origin is whatever URL Lovable assigned you — visible in
the Lovable dashboard.)

Then:

```bash
npx wrangler deploy
```

Wrangler binds the Worker to the two routes declared in `wrangler.toml`
(`wadibardawil.com/*` and `www.wadibardawil.com/*`).

### 4. Smoke test

- `https://wadibardawil.com/`              → Lovable
- `https://wadibardawil.com/letter`        → portal landing
- `https://wadibardawil.com/letter/apply`  → apply form
- `https://wadibardawil.com/letter/sign-in`→ sign-in (try a magic link, confirm it lands on `/letter/me`)

### 5. Paste the hero snippet into Lovable

`../lovable/hero-snippet.html` is ready to drop into a Lovable HTML
block on the landing page. It links to `/letter/apply` and `/letter`,
both of which the Worker routes to Vercel.

## Why a Worker and not just Cloudflare Page Rules

Page Rules can do path-based forwarding but only as a redirect (the URL
changes in the browser bar). The Worker proxies the request invisibly,
so the address bar stays on `wadibardawil.com` while the body comes from
Vercel. That's required for Next's basePath, cookies, and SSR to work
cleanly under one apex.

## Auth cookies

Supabase sets cookies on `wadibardawil.com` (the domain the browser
sees). The Worker forwards them verbatim. Sign-in works under
`/letter/*` and the cookies survive across sub-paths.
