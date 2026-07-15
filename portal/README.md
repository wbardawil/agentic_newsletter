# The Transformation Letter — Portal

A Next.js 15 + Supabase member portal modeled on Garry's List, sitting
alongside the multi-agent newsletter pipeline in `../src`.

In production it deploys under **wadibardawil.com/letter** alongside the
existing Lovable landing — see `deploy/README.md` for the end-to-end
setup (Cloudflare Worker or Vercel rewrites).

The portal covers six adjacent topics for one audience ($5–100M owner-operators
in the US-LATAM corridor): **business transformation**, **conscious capital**,
**family business**, **family office**, **AI**, and **technology**. Wadi
Bardawil anchors the transformation / AI / tech editions; family business,
family office, and conscious capital ride on named guest contributors.

## What's inside

| Surface | Path |
|---|---|
| Landing page (EN/ES) | `/` |
| Apply gate | `/apply` |
| Sign-in (magic link) | `/sign-in` |
| Member home | `/me` |
| Preferences (region, industry, pillars, language) | `/me/preferences` |
| Transformation AI chat (Anthropic streaming, grounded in archive + Voice Bible) | `/me/ask` |
| Bilingual archive — list & detail with EN/ES toggle | `/archive`, `/archive/[editionId]` |
| Member convenings + RSVP | `/convenings` |
| Publisher About | `/about` |
| Admin: application review queue | `/admin/applications` |
| Admin: draft editor (EN+ES, commits to GitHub branch) | `/admin/drafts/[edition]/edit` |
| Bilingual cookie | `POST /lang` |
| Sign-out | `POST /auth/sign-out` |

Under the production basePath every route becomes `/letter/<path>`
(e.g. `/letter/apply`, `/letter/me`, `/letter/about`). Next.js handles
the prefixing automatically for internal `<Link>`s; helpers in
`lib/site.ts` cover the few places we build absolute URLs by hand
(magic-link callbacks, redirect responses in Route Handlers).

The portal reads published editions from Supabase. The agent pipeline in
`../src` writes drafts; on publish, mirror the rendered EN/ES body and
metadata into the `editions` and `edition_sources` tables.

## Stack

- **Next.js 15** (App Router, RSC, Turbopack)
- **Supabase** — Postgres + Auth (magic link) + RLS
- **Tailwind v4** with the wadibardawil.com visual brand wired in via `app/globals.css` (`@theme`). The same tokens are mirrored in `../config/brand-style-tokens.json` so the agent pipeline's Designer agent stays visually in sync with the portal.
- **Anthropic SDK** (`claude-opus-4-7`) for the AI assistant
- **Zod** at every API boundary

## Setup

```bash
cd portal
pnpm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Var | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings → API (server only, never expose) |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` in dev, your deployed URL in prod |
| `ADMIN_EMAILS` | Comma-separated emails that get the `/admin` queue |
| `GITHUB_TOKEN` | Fine-grained PAT for the admin draft editor — see [Admin draft editor](#admin-draft-editor) |
| `GITHUB_REPO` | `owner/repo` of the agentic_newsletter repo (default `wbardawil/agentic_newsletter`) |
| `GITHUB_DRAFT_BRANCH_PREFIX` | Defaults to `drafts/`. The editor reads/writes `drafts/<edition>-en.md` and `drafts/<edition>-es.md` on `drafts/<edition>`. |

## Database

Run the SQL files in `supabase/migrations/` in order, either through the
Supabase SQL editor or the CLI:

```bash
supabase db push
# or apply by hand:
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_rls.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_seed.sql  # optional sample data
```

Schema:

- `members` — extends `auth.users` with profile + preferences (`topics_of_interest text[]`)
- `applications` — apply gate (anon insert, admin read/write); also captures `topics_of_interest`
- `editions` — published issues; carries `topic`, optional `pillar` (only for transformation), optional `byline` + `byline_role`
- `edition_sources` — citations for each issue
- `ai_conversations`, `ai_messages` — per-member chat history
- `convenings`, `convening_rsvps` — member events
- `is_admin()` SQL helper + RLS on every table

### Topic taxonomy

Source of truth: **`/portal/lib/topics.ts`**. The six topic IDs
(`business_transformation`, `conscious_capital`, `family_business`,
`family_office`, `artificial_intelligence`, `technology`) live there with their
EN/ES labels and a one-line blurb. The `editions.topic` column is plain text,
validated against this constant at write time — adding a new topic does not
require a schema migration.

`requiresOsPillar` flags which topics still demand an OS layer (just
`business_transformation` today). Other topics carry `pillar = NULL`.

A trigger on `auth.users` auto-provisions a `members` row the first time an
**approved** applicant signs in via magic link — so the apply gate is enforced
in SQL, not just in app code.

## Granting admin

After your own user exists in `members`, flip the flag once:

```sql
update public.members set is_admin = true where email = 'wadi@example.com';
```

Plus add the email to `ADMIN_EMAILS` so the Next.js middleware lets you into
`/admin/*` without round-tripping through RLS.

## Admin draft editor

`/admin/drafts/[edition]/edit` is a web editor for the weekly EN/ES `.md`
drafts. It loads the files from the `drafts/<edition>` branch via the GitHub
Contents API and commits edits back to the same branch — git remains source of
truth. The editor never touches the `editions` table in Supabase.

The digest email sent by the weekly cron (`pnpm digest:edition`) deep-links here
when `PORTAL_BASE_URL` is set as a repository secret.

### Auth model

1. `portal/middleware.ts` requires an authenticated session for any `/admin/*`
   route AND any `/api/admin/*` route. Not signed in → redirect to `/sign-in`.
2. Middleware then checks the user's email against `ADMIN_EMAILS`. Not on the
   list → redirect to `/me`.
3. The API route handlers re-check `ADMIN_EMAILS` themselves as
   defense-in-depth (matches the pattern in `app/api/admin/applications/route.ts`).

### GitHub token setup

1. github.com → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.
2. Repository access: **Only this repository** → `wbardawil/agentic_newsletter`.
3. Permissions: **Contents: read/write** only. No other scopes.
4. Expiration: 90 days. Set a calendar reminder to rotate.
5. Set `GITHUB_TOKEN` in Vercel **Production env only** — never Preview.
6. Mark as Sensitive in Vercel.

### Behaviour

- Both languages load in parallel and render in stacked panels (EN on top).
- Each panel has its own Save button. The Save flow PUTs to
  `/api/admin/drafts/[edition]` with `{language, content, sha}`.
- On 409 SHA_CONFLICT (someone else committed to the branch), the panel shows
  "Branch moved" with a Reload button. No in-browser merge — the user reloads
  to fetch the new buffer and re-applies edits.
- `beforeunload` guards against accidental navigation when any panel is dirty.
- Word counts use soft thresholds (gray <850, amber 850-1100, red >1100). The
  Validator runs in the next pipeline pass and is the actual gate.
- The QA score embedded in the digest email reflects pre-edit state. After
  large edits, treat the digest score as stale.

### Local development

```bash
cd portal
# Set GITHUB_TOKEN, GITHUB_REPO, ADMIN_EMAILS, NEXT_PUBLIC_SUPABASE_* in .env.local
pnpm install
pnpm dev
# Sign in as an ADMIN_EMAILS user, then navigate to:
# http://localhost:3000/admin/drafts/<existing-edition>/edit
```

The edition you target needs to exist on the `drafts/<edition>` branch in the
remote repo (which the weekly cron normally creates).

### Tests

```bash
cd portal
pnpm test
```

Covers the GitHub helper (10 cases — 404/401/403/409/422 mapping, retries,
base64 encoding) and the PUT API (7 cases — auth gates, Zod, SHA conflict,
default commit message).

## Wiring the agent pipeline → portal

This is **already wired**. `pnpm publish:edition` (in the parent repo) fans
each successfully-distributed edition into Supabase right after the Beehiiv
step, via `src/utils/portal-sync.ts` → `mirrorEditionToPortal()`:

- Upserts `editions` on `edition_id` (idempotent — re-running a publish
  updates the same row). `edition_number` is derived deterministically
  from the `YYYY-WW` id (`2026-19` → `202619`).
- `body_en` / `body_es` are rendered with the **same** renderer the
  Distributor uses for Beehiiv (`src/utils/edition-markdown.ts`), so the
  archive is byte-identical to the email subscribers receive.
- Replaces `edition_sources` for the edition from the Radar source-bundle
  snapshot (`drafts/{editionId}-sources.json`): `title`, `url`,
  `snippet` (source summary, truncated), `publisher` (outlet).
- `pillar` ← `angle.osPillar`; `quarterly_theme` ← `angle.quarterlyTheme`;
  `shareable_sentence_en` ← Validator's shareable sentence.

Enable it by setting `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the
**parent repo's** `.env`. If they're unset the mirror is skipped (logged,
non-fatal) and Beehiiv delivery is unaffected — email is never blocked by
the portal.

Known gaps (intentional, follow-ups):

- `topic` defaults to `business_transformation`. The Strategist does not
  yet declare a topic; once it does, pass it through `MirrorInput.topic`.
- `hero_image_url` is `null` — the hero is a local PNG; uploading it to
  Supabase Storage is a separate step.
- `byline` defaults to `NEWSLETTER_AUTHOR`. For guest-contributor topics,
  thread the contributor name through `MirrorInput.byline`.

## AI assistant — how it's grounded

`POST /api/ask` does the following per request:

1. Validates the caller has an `active` `members` row.
2. Persists the user turn to `ai_messages`.
3. Loads the Voice Bible (`../src/voice-bible/voice-bible.md`) once, caches in
   memory.
4. Calls `retrieveRelevantExcerpts()` — a simple keyword filter over
   `editions.body_*` / `subject_*`. Swap to pgvector when the archive grows.
5. Builds a system prompt from `lib/ai/prompt.ts` that pins the broader
   editorial mandate (six topics; OS sequence scoped to business
   transformation; People always-on across all topics; ADKAR / Kotter / 7S
   anchors named only when they sharpen the take).
6. Streams `claude-opus-4-7` back as Server-Sent Events: a `meta` event with
   sources, `token` events for the body, then `done`.
7. Persists the assistant turn with citations.

## Bilingual UI

- A `tl_lang` cookie holds the visitor's preferred language.
- `LangToggle` posts to `/lang` and reloads with the new cookie.
- All copy lives in `lib/i18n/dictionary.ts`. Add new strings there.
- Archive entries fall back gracefully: if a Spanish subject is missing it
  renders the English one and vice versa.

## Deploy

The portal is a straightforward Vercel deploy. Set the env vars from
`.env.example` in the project settings and point `NEXT_PUBLIC_SITE_URL` at
the production URL.

The Supabase project's **Auth → URL Configuration** needs `NEXT_PUBLIC_SITE_URL`
in the **Site URL** field and `${NEXT_PUBLIC_SITE_URL}/auth/callback` in the
**Redirect URLs** list, otherwise magic-link sign-in will fail.

## Brand assets

Drop `logo-horizontal.png`, `logo-icon.png`, `favicon.png`, and (later) `hero-transformation.jpg` into `/portal/public/`. See `public/README.md` for sizing notes and the one-line code change to swap `<BrandWordmark />` for the actual logo image once it's in place.

The visual system (palette, typography, layout principles) is wadibardawil.com:

- Dark-only mode. Backgrounds `#222831` (gunmetal), surfaces `#2C333E` (panel), text white, muted text `#98A0AD`. Archivo for headings, Manrope for body (Wadi Bardawil Brand System).
- Orange `#FD4002` is the **only** accent — reserved for CTAs and active states. Never decorative.
- System sans, 8 px radius, mobile-first, generous vertical padding (`py-28` to `py-32` on landing sections).
- Public pages have no nav menu. Member-only routes get a minimal internal nav.

## What's not in this scaffold yet

These are deliberately deferred — open them when you're ready:

- Beehiiv subscriber sync (members opted into ES vs EN list)
- Email templates for application decisions (use Resend; you already have it
  configured in the parent `.env`)
- pgvector retrieval for the AI assistant (replace the keyword retrieval in
  `lib/ai/retrieval.ts`)
- A `/admin/editions` view that ties into the agent run ledger
- Stripe for a paid tier (Garry's List is donation-driven; you may be too)
