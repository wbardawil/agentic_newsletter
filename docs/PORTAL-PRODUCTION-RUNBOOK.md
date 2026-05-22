# Portal Production Runbook

This runbook turns the currently documented and implemented portal setup into
an executable production checklist. It is grounded in the current repo state as
of 2026-05-21.

This document covers:

- portal hosting under `wadibardawil.com/letter`
- Supabase database and auth setup
- portal environment variables
- root-repo environment variables needed for portal sync and digest links
- GitHub Actions wiring that touches the portal
- the approval Worker used by the email approval gate

This document does not assume any infrastructure that is not already present in
the repo. Where the repo leaves a choice open, the runbook names that choice
explicitly.

---

## 1. Verified current state

These statements are true in the current repository:

- The portal is a Next.js 15 app in `portal/`.
- Production is intended to be served at `https://wadibardawil.com/letter`.
- The deploy docs support two routing strategies:
  - Cloudflare Worker in `portal/deploy/cloudflare-worker/`
  - Vercel rewrites in `portal/deploy/vercel-rewrites/`
- The portal root does not currently contain `vercel.json`, `netlify.toml`, or
  `wrangler.toml`.
- Supabase schema is versioned only as SQL migrations under
  `portal/supabase/migrations/`.
- There is no versioned `portal/supabase/config.toml`.
- There is no versioned Supabase Auth email template configuration in the repo.
- Portal publish sync exists in code, but the GitHub Actions publish workflow
  does not currently inject `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.
- There is no GitHub Actions workflow dedicated to deploying the portal.
- The approval receiver Worker exists in code under
  `workers/approval-receiver/`, but the deployed URL is not stored in the repo.

Primary source files:

- `portal/deploy/README.md`
- `portal/deploy/cloudflare-worker/README.md`
- `portal/deploy/cloudflare-worker/wrangler.toml`
- `portal/deploy/vercel-rewrites/README.md`
- `portal/deploy/vercel-rewrites/vercel.json`
- `portal/deploy/lovable/hero-snippet.html`
- `portal/next.config.ts`
- `portal/.env.example`
- `portal/supabase/migrations/0001_init.sql`
- `portal/supabase/migrations/0002_rls.sql`
- `portal/supabase/migrations/0003_seed.sql`
- `portal/lib/supabase/server.ts`
- `portal/lib/supabase/admin.ts`
- `portal/middleware.ts`
- `portal/app/sign-in/page.tsx`
- `portal/app/sign-in/form.tsx`
- `portal/app/auth/callback/route.ts`
- `src/utils/portal-sync.ts`
- `src/publish.ts`
- `.env.example`
- `.github/workflows/weekly-draft.yml`
- `.github/workflows/publish-to-beehiiv.yml`
- `workers/approval-receiver/README.md`

---

## 2. Production target

Reader-facing target URLs:

- `https://wadibardawil.com/`
- `https://wadibardawil.com/letter`
- `https://wadibardawil.com/letter/about`
- `https://wadibardawil.com/letter/apply`
- `https://wadibardawil.com/letter/sign-in`
- `https://wadibardawil.com/letter/archive`
- `https://wadibardawil.com/letter/me`
- `https://wadibardawil.com/letter/me/ask`
- `https://wadibardawil.com/letter/convenings`
- `https://wadibardawil.com/letter/admin/applications`

Portal hosting target:

- Vercel project with root directory `portal`
- `NEXT_PUBLIC_BASE_PATH=/letter`
- `NEXT_PUBLIC_SITE_URL=https://wadibardawil.com`

Auth callback target:

- `https://wadibardawil.com/letter/auth/callback`

Local dev auth callback target:

- `http://localhost:3000/auth/callback`

---

## 3. Decision required before deployment

Choose one of these two traffic-splitting strategies.

| Option | When to choose it | What changes outside the repo |
|---|---|---|
| Cloudflare Worker | Keep Lovable as the browser-facing apex origin and only route `/letter/*` to Vercel | Move DNS authority to Cloudflare, deploy the edge Worker |
| Vercel rewrites | Let Vercel own the apex and proxy non-portal traffic back to Lovable | Point apex domain at Vercel, apply the rewrite config |

Do not proceed to final cutover until this decision is made. The rest of the
runbook branches on that choice.

---

## 4. Accounts and access required

- Vercel access for the production project
- Supabase project admin access
- Domain/DNS access for `wadibardawil.com`
- Lovable project access to confirm the actual Lovable origin URL
- GitHub repo admin access for Actions secrets and variables
- Cloudflare account access if using either the portal router Worker or the
  approval receiver Worker
- Anthropic API access if `/me/ask` will be enabled in production

---

## 5. Portal environment variables

The portal app documents these variables in `portal/.env.example`.

| Variable | Required | Scope | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Required for browser and server Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public | Required for browser and server Supabase clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Required for admin routes and server-side admin access |
| `ANTHROPIC_API_KEY` | Only if `/me/ask` is enabled | Server only | Required by `POST /api/ask` |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public | `https://wadibardawil.com` in production |
| `NEXT_PUBLIC_BASE_PATH` | Yes for subpath deploy | Public | `/letter` in production |
| `ADMIN_EMAILS` | Yes for admin access | Server only | Comma-separated allowlist for `/admin/*` |
| `GITHUB_TOKEN` | Only if using portal draft editor | Server only secret | Documented as Production-only |
| `GITHUB_REPO` | Only if using portal draft editor | Server only | Defaults to `wbardawil/agentic_newsletter` |
| `GITHUB_DRAFT_BRANCH_PREFIX` | Optional | Server only | Defaults to `drafts/` |

Vercel production minimum if the full portal is being used:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL=https://wadibardawil.com`
- `NEXT_PUBLIC_BASE_PATH=/letter`
- `ADMIN_EMAILS=<comma-separated-admin-emails>`

Vercel production additional variables for optional surfaces:

- `ANTHROPIC_API_KEY` for Transformation AI
- `GITHUB_TOKEN` for `/admin/drafts/[edition]/edit`
- `GITHUB_REPO` if different from the default
- `GITHUB_DRAFT_BRANCH_PREFIX` if different from `drafts/`

Preview behavior currently documented by the repo:

- `GITHUB_TOKEN` should be set only in Production.
- No separate preview matrix is versioned for the other variables.

---

## 6. Root repo environment variables that affect the portal

The root `.env.example` documents these variables relevant to portal behavior:

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Optional overall, required for portal sync | Portal publish mirror from `src/publish.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional overall, required for portal sync | Service-role access for portal mirror |
| `PORTAL_BASE_URL` | Optional | Adds deep-link to portal draft editor in digest email |
| `APPROVAL_BASE_URL` | Optional | Base URL for approval receiver Worker |
| `APPROVAL_SIGNING_SECRET` | Optional | HMAC secret shared with approval receiver Worker |

Current root `.env` state in this workspace, without exposing values:

- Set: `ANTHROPIC_API_KEY`
- Set: `GEMINI_API_KEY`
- Set: `LOG_LEVEL`
- Set: `DRY_RUN`
- Set: `MAX_COST_PER_RUN_USD`
- Set: `LLM_TIMEOUT_MS`
- Set: `NEWSLETTER_AUTHOR`
- Set: `RSS_PARSER_TIMEOUT_MS`
- Not observed as set in the current root `.env`: `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `PORTAL_BASE_URL`, `APPROVAL_BASE_URL`,
  `APPROVAL_SIGNING_SECRET`

---

## 7. Supabase schema and database setup

Schema files present:

- `portal/supabase/migrations/0001_init.sql`
- `portal/supabase/migrations/0002_rls.sql`
- `portal/supabase/migrations/0003_seed.sql`

Migration order:

1. `0001_init.sql`
2. `0002_rls.sql`
3. `0003_seed.sql` only for local development or sample content

Schema summary:

- `members`: portal profile, preferences, status, `is_admin`
- `applications`: apply gate submissions
- `editions`: mirrored published issues
- `edition_sources`: per-edition source records
- `ai_conversations`, `ai_messages`: chat persistence
- `convenings`, `convening_rsvps`: member events and attendance

Production database setup procedure:

1. Create the Supabase project.
2. Obtain the project API URL, anon key, and service-role key.
3. Apply `0001_init.sql`.
4. Apply `0002_rls.sql`.
5. Do not apply `0003_seed.sql` in production.
6. After your own account has been created in `public.members`, elevate one or
   more admins with:

```sql
update public.members set is_admin = true where email = 'wadi@example.com';
```

7. Mirror those same admin emails into `ADMIN_EMAILS` in the portal runtime.

Important implementation detail:

- `0001_init.sql` creates `handle_new_user()` and a trigger on `auth.users`.
- A new `public.members` row is only created when the new auth user has an
  approved application matching the same email address.
- This means the membership gate is enforced in SQL, not only in app code.

---

## 8. Supabase Auth configuration

The repo documents Auth URL configuration, but does not version a Supabase
config file or email templates.

Required Auth dashboard settings:

- Site URL: `https://wadibardawil.com`
- Additional Redirect URL: `https://wadibardawil.com/letter/auth/callback`
- Additional Redirect URL for local development: `http://localhost:3000/auth/callback`

Observed application auth flow:

- Sign-in form calls `supabase.auth.signInWithOtp()`.
- The email redirect target is built as `${window.location.origin}${BASE_PATH}/auth/callback`.
- Callback route exchanges the code for a session and redirects to the `next`
  destination, defaulting to `/me`.
- `middleware.ts` protects member and admin routes.
- Admin access additionally requires the signed-in email to be listed in
  `ADMIN_EMAILS`.

What is not versioned in the repo:

- Supabase Auth email template copy or HTML
- any `config.toml` or CLI project binding for Supabase
- explicit preview callback URLs

---

## 9. Portal access control model

Member routes:

- `/me`
- `/archive`
- `/convenings`
- `/ask`

Admin routes:

- `/admin/*`
- `/api/admin/*`

Access rules currently implemented:

- `middleware.ts` redirects anonymous users to `/sign-in?next=...`.
- `middleware.ts` redirects signed-in non-admin emails away from `/admin/*` to
  `/me`.
- API handlers under `/api/admin/*` re-check `ADMIN_EMAILS`.
- RLS policies in `0002_rls.sql` enforce table-level access in Supabase.
- `public.is_admin()` reads `members.is_admin` to support admin RLS.
- Published editions are readable only to authenticated users who also have an
  `active` member row.
- The AI endpoint additionally checks `member.status === 'active'` in app code.

Operational consequence:

- Adding an admin requires both a DB change and a runtime env change.
- SQL only is not enough for admin UI access.
- `ADMIN_EMAILS` only is not enough for RLS-backed admin actions.

---

## 10. Vercel portal deployment

Base deployment steps common to both routing strategies:

1. Create or open the Vercel project for this repo.
2. Set the root directory to `portal`.
3. Configure the production environment variables listed in section 5.
4. Deploy once and record the Vercel deployment URL.
5. Use that Vercel URL as the portal origin if you choose the Cloudflare Worker
   routing strategy.

Minimum production env for a cutover without optional surfaces:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL=https://wadibardawil.com`
- `NEXT_PUBLIC_BASE_PATH=/letter`
- `ADMIN_EMAILS=<admin emails>`

Optional production env for full feature parity:

- `ANTHROPIC_API_KEY`
- `GITHUB_TOKEN`
- `GITHUB_REPO`
- `GITHUB_DRAFT_BRANCH_PREFIX`

Runtime behavior driven by `portal/next.config.ts`:

- `basePath` is taken from `NEXT_PUBLIC_BASE_PATH`.
- Remote images are allowed from `**.supabase.co` and `images.beehiiv.com`.
- There are no redirects or rewrites defined in `next.config.ts`.

---

## 11. Routing strategy A: Cloudflare Worker

Choose this if Lovable should remain the browser-facing apex site and only the
portal subtree should be proxied to Vercel.

Files:

- `portal/deploy/cloudflare-worker/README.md`
- `portal/deploy/cloudflare-worker/router.ts`
- `portal/deploy/cloudflare-worker/wrangler.toml`

Deployment steps:

1. Deploy the portal to Vercel and keep the Vercel URL.
2. Move DNS authority for `wadibardawil.com` to Cloudflare.
3. In `portal/deploy/cloudflare-worker/wrangler.toml`, set:
   - `PORTAL_ORIGIN=https://<vercel-deployment>`
   - `LOVABLE_ORIGIN=https://<actual-lovable-origin>`
4. Deploy the Worker with Wrangler from `portal/deploy/cloudflare-worker/`.
5. Verify that Cloudflare routes both `wadibardawil.com/*` and
   `www.wadibardawil.com/*` through the Worker.

Behavior implemented by `router.ts`:

- `/letter` and `/letter/*` are proxied to `PORTAL_ORIGIN`
- every other path is proxied to `LOVABLE_ORIGIN`
- cookies are forwarded so Supabase auth continues to work
- absolute redirects from either origin are rewritten back to the public origin

Operational dependency:

- this strategy cannot work until the registrar nameservers are updated to
  Cloudflare

---

## 12. Routing strategy B: Vercel rewrites

Choose this if Vercel should own the apex and proxy all non-portal traffic back
to Lovable.

Files:

- `portal/deploy/vercel-rewrites/README.md`
- `portal/deploy/vercel-rewrites/vercel.json`

Deployment steps:

1. Add `wadibardawil.com` and `www.wadibardawil.com` as Vercel domains.
2. Apply the rewrite template from `portal/deploy/vercel-rewrites/vercel.json`
   to the portal root as `portal/vercel.json`.
3. Replace the placeholder Lovable URL in that file with the actual Lovable
   origin.
4. Set `NEXT_PUBLIC_BASE_PATH=/letter` and
   `NEXT_PUBLIC_SITE_URL=https://wadibardawil.com` in the Vercel project.
5. Redeploy.

Important current-state note:

- The rewrite template exists, but `portal/vercel.json` does not currently
  exist at the project root.

---

## 13. Lovable landing integration

The repo includes a ready-to-paste newsletter hero snippet at:

- `portal/deploy/lovable/hero-snippet.html`

Use it on the Lovable landing page if you want the apex site to advertise the
newsletter and link into the portal.

The snippet:

- is standalone HTML intended for a Lovable HTML block
- links to `/letter/apply`
- links to `/letter`
- matches the portal brand direction already documented in the repo

---

## 14. Pipeline to portal sync

Sync implementation:

- `src/utils/portal-sync.ts`
- called from `src/publish.ts`

What it does:

- upserts the edition into `public.editions` by `edition_id`
- mirrors EN and ES bodies rendered with the same markdown renderer used by
  distribution
- replaces `public.edition_sources` from the Radar source bundle snapshot
- passes byline from `NEWSLETTER_AUTHOR`

Env required for sync at runtime:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Failure mode:

- non-fatal by design
- if either variable is missing, the portal mirror is skipped
- if the mirror throws, publish logs a warning and continues

Current GitHub Actions gap:

- `.github/workflows/publish-to-beehiiv.yml` does not currently inject
  `SUPABASE_URL`
- `.github/workflows/publish-to-beehiiv.yml` does not currently inject
  `SUPABASE_SERVICE_ROLE_KEY`
- unless those values are provided outside the versioned workflow, portal sync
  will not execute during GitHub-hosted publish runs

---

## 15. GitHub Actions and portal-related secrets

Weekly draft workflow behavior that touches the portal:

- `PORTAL_BASE_URL`, when set, adds an `Edit in portal` link in the digest
- `APPROVAL_BASE_URL` and `APPROVAL_SIGNING_SECRET`, when set together, switch
  the digest to one-click approval links

Publish workflow behavior that touches the portal:

- no direct portal deploy step exists
- no portal sync secrets are passed today

No portal deploy workflow is currently versioned in `.github/workflows/`.

---

## 16. Approval receiver Worker

Worker files:

- `workers/approval-receiver/README.md`
- `workers/approval-receiver/wrangler.toml`
- `workers/approval-receiver/src/index.ts`

Purpose:

- receives signed approval links from the digest email
- verifies the HMAC-signed token
- dispatches `repository_dispatch` with `event_type: edition_approved`
- triggers `.github/workflows/publish-to-beehiiv.yml`

Worker secrets required at deploy time:

- `APPROVAL_SIGNING_SECRET`
- `GITHUB_TOKEN`
- `GITHUB_REPO`

Root-repo secrets required after Worker deployment:

- `APPROVAL_SIGNING_SECRET`
- `APPROVAL_BASE_URL`

Current-state note:

- The code and deployment instructions exist.
- The repo does not store the active deployed Worker URL.
- `OPERATIONS.md` states phase 2 is deployed, but the repo alone cannot verify
  the current live deployment.

---

## 17. Cutover checklist

Before production cutover, confirm all of the following.

Infrastructure:

- portal Vercel project exists with root `portal`
- routing strategy has been chosen
- actual Lovable origin URL has been confirmed
- domain and DNS access is available

Supabase:

- `0001_init.sql` applied
- `0002_rls.sql` applied
- `0003_seed.sql` not applied in production
- Site URL set to `https://wadibardawil.com`
- redirect URL set to `https://wadibardawil.com/letter/auth/callback`
- admin users granted `is_admin = true`

Vercel env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL=https://wadibardawil.com`
- `NEXT_PUBLIC_BASE_PATH=/letter`
- `ADMIN_EMAILS`
- `ANTHROPIC_API_KEY` if AI is enabled
- `GITHUB_TOKEN` if portal draft editor is enabled

Root repo / Actions:

- `PORTAL_BASE_URL=https://wadibardawil.com/letter` if digest should deep-link
  into portal editing
- `APPROVAL_BASE_URL` and `APPROVAL_SIGNING_SECRET` if one-click approval is
  desired
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` available wherever
  `pnpm publish:edition` will run if portal sync is required during publish

Routing:

- Cloudflare Worker deployed and active, or
- Vercel rewrites applied at portal root and apex pointed at Vercel

---

## 18. Smoke tests after deployment

Run these after every production cutover.

Public routing:

- `https://wadibardawil.com/` loads the Lovable site
- `https://wadibardawil.com/letter` loads the portal landing
- `https://wadibardawil.com/letter/about` loads the portal about page
- `https://wadibardawil.com/letter/apply` loads the application form

Magic-link auth:

1. Open `https://wadibardawil.com/letter/sign-in`.
2. Request a magic link.
3. Complete the sign-in flow.
4. Confirm the callback lands on `/letter/me` or the requested `next` path.

Membership gate:

- sign in with an email that is not approved and confirm the account does not
  become an active member
- sign in with an approved member and confirm archive access works

Admin gate:

- sign in with an account listed in `ADMIN_EMAILS` and marked `is_admin = true`
- confirm `/letter/admin/applications` loads
- if the draft editor is enabled, open `/letter/admin/drafts/<edition>/edit`
  and confirm load succeeds

Portal mirror:

- publish a test edition through the normal publish path
- confirm a row is present or updated in `public.editions`
- confirm related rows are present in `public.edition_sources`
- if running publish from GitHub Actions, confirm the mirror was not skipped

Approval Worker:

- hit `<approval-worker-url>/health` and expect `ok`
- generate a signed approval link and confirm it starts the publish workflow

---

## 19. Open decisions and unresolved gaps

These are the remaining production decisions that the repo does not settle.

- Which routing strategy is the production standard: Cloudflare Worker or
  Vercel rewrites.
- What the actual Lovable origin URL is.
- Whether the portal draft editor is enabled in production from day one.
- Whether the AI assistant is enabled in production from day one.
- Whether portal sync must run from GitHub Actions or only from local/manual
  publish environments.
- What preview-domain callback policy should be used for Supabase Auth.
- Where the live approval Worker URL should be recorded for operators.

---

## 20. Related docs

- `portal/README.md`
- `portal/deploy/README.md`
- `OPERATIONS.md`
- `TESTING.md`
- `workers/approval-receiver/README.md`
