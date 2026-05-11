# Deploying the portal under wadibardawil.com/letter

You picked the subpath deployment — same domain, one URL, the portal
served at `/letter/*` while Lovable keeps the apex. There are two ways
to do that. Pick one and follow its sub-README.

| Option | Where DNS lives | How it splits traffic | When to use |
|---|---|---|---|
| **Cloudflare Worker** (`cloudflare-worker/`) | Cloudflare | A Worker at the edge proxies `/letter/*` → Vercel and everything else → Lovable. | Default. Lovable stays the origin for the apex; you only get Cloudflare in front. |
| **Vercel rewrites** (`vercel-rewrites/`) | Vercel | The apex points at Vercel. Vercel serves `/letter/*` natively and reverse-proxies everything else back to Lovable. | If you'd rather have one platform handle the apex. |

Both options end with the same reader-facing URLs:

| URL | Served by |
|---|---|
| `wadibardawil.com/` | Lovable |
| `wadibardawil.com/about` (on Lovable's site, if you have one) | Lovable |
| `wadibardawil.com/letter` | Portal landing (six-topic explainer) |
| `wadibardawil.com/letter/about` | Portal publisher page |
| `wadibardawil.com/letter/apply` | Apply gate |
| `wadibardawil.com/letter/sign-in` | Magic-link sign-in |
| `wadibardawil.com/letter/archive` | Member archive |
| `wadibardawil.com/letter/me` | Member home |
| `wadibardawil.com/letter/me/ask` | Transformation AI |
| `wadibardawil.com/letter/convenings` | Member convenings |
| `wadibardawil.com/letter/admin/applications` | Admin queue |

## Hero on the Lovable landing

`lovable/hero-snippet.html` is a self-contained HTML block you can paste
into Lovable to add the newsletter hero (orange CTA included). It links
to `/letter/apply` and `/letter`, both of which the router sends to the
portal.

## Why the portal lives at `/letter`

- The brand spec says public pages have zero exit points. Keeping
  `wadibardawil.com/` on Lovable means the consulting landing stays
  focused on the practice; the newsletter has its own clear room at
  `/letter`.
- Auth cookies set by Supabase land on the apex domain, so once a member
  signs in at `/letter/sign-in` the session is valid across the whole
  `/letter/*` namespace.
- Reader URLs are shareable and read as "section of the same site"
  rather than a different property.

## Config to set in the portal

When you deploy the portal to Vercel:

```env
NEXT_PUBLIC_BASE_PATH=/letter
NEXT_PUBLIC_SITE_URL=https://wadibardawil.com
```

The Next.js config picks up `NEXT_PUBLIC_BASE_PATH` automatically. Auth
callbacks, sign-out, the language switcher, and every internal link all
respect it.

In local dev leave `NEXT_PUBLIC_BASE_PATH` blank and the portal serves
from `/` like a normal Next.js app.

## Supabase redirect URLs

Add both of these under Supabase → Auth → URL Configuration → Redirect
URLs (the second is required even if you set `Site URL`):

- `https://wadibardawil.com/letter/auth/callback`
- `http://localhost:3000/auth/callback` (for local dev)
