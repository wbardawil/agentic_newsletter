# Vercel rewrites (alternative to the Cloudflare Worker)

Use this if you'd rather point apex DNS at Vercel and let Vercel serve
the portal under `/letter/*` while proxying everything else back to
Lovable.

## How it works

The `vercel.json` here lives at the root of the portal's Vercel project.
The first two rewrites are no-ops that just declare `/letter` and
`/letter/*` belong to the Next.js app. The third rewrite catches every
other path and reverse-proxies it to your Lovable URL — so the address
bar stays on `wadibardawil.com` even though Lovable is the origin.

## Setup

1. Copy `vercel.json` to the root of the `portal/` directory (or merge
   its `rewrites` block into your existing `vercel.json`).
2. In your Vercel project settings → Domains, add `wadibardawil.com` and
   `www.wadibardawil.com`. Vercel will give you DNS records to set at
   your registrar.
3. Replace the placeholder Lovable URL (`https://wadibardawil.lovable.app`)
   with the actual one Lovable assigned you.
4. Set `NEXT_PUBLIC_BASE_PATH=/letter` and `NEXT_PUBLIC_SITE_URL=https://wadibardawil.com`
   on the Vercel project's env vars.
5. Redeploy.

## Trade-offs vs. the Cloudflare Worker

- All traffic now flows through Vercel. Lovable becomes a backend, not
  the origin the browser talks to.
- Vercel's bandwidth meter counts the proxied Lovable traffic.
- SSL terminates at Vercel. If Lovable enforces TLS at its end (it does),
  the proxied requests stay encrypted but Vercel sees the contents.

Choose the Cloudflare Worker approach if you'd rather keep Lovable in
charge of the apex and only have Cloudflare route portal paths through.
See `../cloudflare-worker/README.md`.
