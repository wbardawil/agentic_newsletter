# OPERATIONS

The whole point of this doc: you should never have to read code or remember
how the pipeline works. Just the loop, the things only you can do, and the
recovery moves when something breaks.

---

## The weekly loop (no laptop required)

| When | What happens | What you do |
|---|---|---|
| **Monday 13:00 UTC** *(8am ET / 7am CT)* | GitHub Actions runs `pnpm draft`. A pull request titled `Draft — Edition YYYY-WW` opens on `drafts/YYYY-WW`. | GitHub mobile pushes a notification. |
| **Within ~1 minute** | If Resend is configured, a digest email lands in your inbox with the EN headline + thesis, QA score, OS pillar, People dimension, top 3 Validator notes, and two buttons: *Review on GitHub* + *Approve and publish* (or *Publish to Beehiiv* if the Worker isn't deployed). | Open the email on phone. Decide whether to review on GitHub or approve directly. |
| **Anytime that week** | You tap *Review on GitHub* (or open the PR directly). EN + ES drafts render as markdown. | Comment to request changes, or commit edits via the GitHub mobile editor. |
| **When the editorial is right** | You tap **Merge**. | The merge means *"editorial approved, drafts saved on main"* — nothing publishes yet. |
| **Final publish** | Tap *Approve and publish* in the email (one tap when the Worker is deployed). Or fall back to Actions tab → **Publish to Beehiiv** → Run workflow → paste edition ID. | Beehiiv post + LinkedIn + X. |

**The two states of the publish gate:**

- **Phase 1 (Resend only)**: digest email shows a *Publish to Beehiiv* button that opens the workflow page on phone. You paste the edition ID and tap Run.
- **Phase 2 (Resend + approval Worker)**: digest email shows an *Approve and publish* button that runs the publish workflow in one tap. Signed with HMAC, valid for 7 days.

**In both states, merging the PR does not push to subscribers.** Publishing requires the explicit approve action.

---

## The things only you can do

1. **Decide if the editorial is good enough.** Tap Merge or request changes on the PR.
2. **Edit copy on phone.** Use the GitHub mobile editor to fix the apertura, swap a Field Report, sharpen a sentence. Commit directly to the PR branch.
3. **Approve final design + copy** *(once the email gate is built)*. Until then: review the merged content on `main`, design assets externally, then trigger publish.
4. **Trigger Beehiiv publish.** Manual until further notice. Actions → Publish to Beehiiv → Run workflow → edition ID.
5. **Pause for vacation.** See "Knobs" below.

Everything else — sourcing, drafting, translating, validating, social copy — runs on cron without you.

---

## Recovery moves (when something breaks)

### "I got a 🚨 Weekly draft cron failed issue"

The Monday cron failed before producing a draft. Most common causes, in order:

1. **`ANTHROPIC_API_KEY` revoked or missing.** Settings → Secrets and variables → Actions → check the secret is set. Re-paste from console.anthropic.com if needed.
2. **Anthropic API rate limit or outage.** Re-run: Actions → Weekly Draft → Run workflow.
3. **A recent code change broke a prompt or schema.** Read the run logs. Revert the offending commit on `main`. Re-run.

After fixing: Actions → Weekly Draft → **Run workflow** → leave edition blank. Close the failure issue when the new run succeeds.

### "The PR opened but I didn't get the digest email"

The digest is a best-effort step — the cron does not fail when email isn't configured. Causes, in order:

1. **One of `RESEND_API_KEY` / `RESEND_FROM` / `RESEND_TO` is missing.** The workflow logs `::notice::Resend not fully configured`. Set all three secrets.
2. **Sender not verified in Resend.** For production you must verify a domain in Resend → Domains. For testing use `RESEND_FROM=onboarding@resend.dev`.
3. **Email landed in spam.** Check the spam folder. Add the sender to your contacts to retrain.
4. **Resend quota hit (100/day on free tier).** Unlikely for weekly cadence, but check Resend → Logs.

### "Publish to Beehiiv failed when I triggered it"

1. **Quality gate refused** (score below 70 or Validator flagged errors). The run log says which. Fix the editorial on `main` (commit a copy fix), then re-run **Publish to Beehiiv**.
2. **Beehiiv secret missing or wrong.** Settings → Secrets → set `BEEHIIV_API_KEY` and `BEEHIIV_PUBLICATION_ID`.
3. **Draft not on main.** Did you actually merge the weekly draft PR? The publish job reads `drafts/<id>-draft.json` from `main`.
4. **Beehiiv API transient error.** Re-run.

### "The draft is bad / I don't like it"

Don't merge. Comment on the PR with what to change, then either:
- Commit a fix directly to the branch from the GitHub mobile editor
- Or close the PR and run **Weekly Draft → Run workflow** to retry from scratch

---

## Knobs you can turn

All settable from phone via Settings → Secrets and variables → Actions.

| Knob | Where | Effect |
|---|---|---|
| **Pause weekly cron** | *Variables* → `WEEKLY_DRAFT_PAUSED = true` | Vacation mode. Cron skips silently until you set it back to `false` or delete the variable. Manual dispatch still works. |
| **Change schedule** | Edit `.github/workflows/weekly-draft.yml` line `cron:` | Use [crontab.guru](https://crontab.guru) to translate. Default `0 13 * * MON` = Mondays 13:00 UTC. |
| **Quality threshold** | Edit `.github/workflows/publish-to-beehiiv.yml` env `QA_MIN_SCORE` | Default 70. Lower = more lenient publish gate. |

---

## First-time setup (one time only)

Secrets in **Settings → Secrets and variables → Actions → New repository secret**:

**Required for drafting:**
- `ANTHROPIC_API_KEY` — from console.anthropic.com

**Required to publish to Beehiiv** (when you trigger publish):
- `BEEHIIV_API_KEY` — Beehiiv → Settings → API
- `BEEHIIV_PUBLICATION_ID` — visible in your Beehiiv URL

**For the email digest (phase 1 of the email approval gate):**
- `RESEND_API_KEY` — from resend.com. Free tier sends 100 emails/day, enough for the weekly digest.
- `RESEND_FROM` — verified sender. For testing: `onboarding@resend.dev`. For production: a verified address on a domain you own (Resend → Domains).
- `RESEND_TO` — your editor inbox (the address that gets the weekly digest).

**For one-click magic-link approval (phase 2; optional):**
- `APPROVAL_BASE_URL` — your deployed Cloudflare Worker URL, e.g. `https://transformation-letter-approval.<your-subdomain>.workers.dev`
- `APPROVAL_SIGNING_SECRET` — random secret shared between the digest sender and the Worker. Generate with `openssl rand -base64 48`. Set the **same value** as a Worker secret via `wrangler secret put APPROVAL_SIGNING_SECRET`.

Both phase-2 secrets must be set together. See [workers/approval-receiver/README.md](workers/approval-receiver/README.md) for the one-time Worker deployment (free Cloudflare account; ~10 minutes).

**Optional, expand reach when ready:**
- `GEMINI_API_KEY` — Google Gemini, used by the Designer agent for hero image generation. Required only when Designer is wired into the cron. Until then, set `DRY_RUN=true` to skip image generation if you exercise the Designer manually.
- `LINKEDIN_ACCESS_TOKEN` — LinkedIn cross-post
- `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET` — X cross-post
- `FEEDLY_API_KEY` — supplemental Radar source
- `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` — run ledger

**Repository variables** (Variables tab):
- `WEEKLY_DRAFT_PAUSED` — only set this when you want to pause

You also need the GitHub mobile app installed with notifications enabled for this repo. That's how the loop reaches your phone.

---

## What's not yet automated

These are the next building blocks. The order matters: editorial quality first, then design, then approval, then publishing automation.

1. **Source bundle expansion** — `pnpm verify:feeds` proposes 34 new RSS feeds; survivors get added to `src/agents/radar.ts`. Improves editorial quality at the input layer.
2. **Designer agent wired into the weekly cron** — `src/agents/designer.ts` exists and has tests, but is not yet called from `src/run.ts`. When wired, every draft PR will include a hero image rendered to `drafts/<edition>/images/hero.png`, alt-text + captions in EN/ES, and an editable image prompt — all reviewable inline on phone via the GitHub PR.
3. **Email approval gate phase 2 — DEPLOYED.** Signed magic link in the digest triggers a Cloudflare Worker, which dispatches `repository_dispatch: edition_approved`, which auto-runs the publish workflow. To activate: deploy the Worker per `workers/approval-receiver/README.md`, then set `APPROVAL_BASE_URL` + `APPROVAL_SIGNING_SECRET` in repo secrets.

Until #1–#3 are done, **Beehiiv publishing stays a manual workflow_dispatch action**.

---

## When in doubt

- **Run logs**: GitHub repo → Actions tab. Every run is preserved.
- **The truth about the pipeline**: `CLAUDE.md` (architecture) + `src/voice-bible/voice-bible.md` (editorial spine).
- **Don't memorize. Don't manage. Read this file.**
