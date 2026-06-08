# OPERATIONS

The whole point of this doc: you should never have to read code or remember
how the pipeline works. Just the loop, the things only you can do, and the
recovery moves when something breaks.

---

## The weekly loop (no laptop required)

| When | What happens | What you do |
|---|---|---|
| **Monday 13:00 UTC** *(8am ET / 7am CT)* | GitHub Actions drafts EN + ES + hero image. A pull request opens on `drafts/YYYY-WW`. | GitHub mobile notification. |
| **Within ~2 minutes** | Digest email arrives: hero image preview, headline, thesis, QA score, and four buttons. | Open on phone. |
| **Step 1 — Review the image** | Tap **Aprobar imagen** if it's good. Or tap **Rechazar imagen** if it misses. Rejecting triggers a new image automatically (up to 5 attempts). | One tap. |
| **Step 2 — Review the article** | Tap **Aprobar artículo** after the image is approved. This publishes the edition to the newsroom with the hero image. | One tap. |
| **[Optional] Beehiiv distribution** | If you also want to push to Beehiiv email subscribers, run: Actions → **Publish to Beehiiv (optional)** → edition ID. | Manual action, not required. |

**The approval order is enforced:** Approving the article before the image is approved will show an error — approve the image first.

**Rejection paths:**
- **Rechazar imagen** → new hero generated automatically, new digest sent (~10 min)
- **Rechazar artículo** → full new draft generated with your feedback (~1.5 hours)
- **Rechazar sección** (Insight, Field Report, etc.) → full new draft with that section rewritten

---

## The things only you can do

1. **Approve or reject the hero image.** One tap from the digest email.
2. **Approve or reject the article** (after the image is approved). One tap.
3. **Provide rejection feedback** via the reject buttons. The more specific, the better the next attempt.
4. **Edit copy on phone** via the GitHub mobile editor on the PR branch before approving.
5. **Trigger Beehiiv distribution** (optional). Actions → Publish to Beehiiv → Run.
6. **Pause for vacation.** See Knobs below.

Everything else — sourcing, drafting, translating, validating, designing, uploading — runs automatically.

---

## Recovery moves (when something breaks)

### "I got a 🚨 Weekly draft cron failed issue"

The Monday cron failed before producing a draft. Causes, in order:

1. **`ANTHROPIC_API_KEY` revoked or missing.** Settings → Secrets → check and re-paste.
2. **`GEMINI_API_KEY` revoked or model deprecated.** Check `config/brand-style-tokens.json → imageStyle.model` is a valid model name. Set `DRY_RUN=true` temporarily to skip image generation and still get a draft.
3. **Anthropic API outage.** Re-run: Actions → Weekly Draft → Run workflow.
4. **Code change broke a schema.** Read run logs. Revert. Re-run.

Fix → Actions → Weekly Draft → **Run workflow** → leave edition blank → close the issue.

---

### "I didn't get the digest email"

1. One of `RESEND_API_KEY` / `RESEND_FROM` / `RESEND_TO` is missing — set all three secrets.
2. Sender not verified in Resend. Verify the domain or use `onboarding@resend.dev` for testing.
3. Email landed in spam. Add sender to contacts.
4. `APPROVAL_BASE_URL` or `APPROVAL_SIGNING_SECRET` missing — both must be set together for the image/article buttons to appear.

---

### "Image not approved — I tapped approve but got an error"

The portal `/review` endpoint could not verify the token. Causes:

1. **Token expired** (links last 7 days). Generate a new one — ask a developer to run the token generator script.
2. **`APPROVAL_SIGNING_SECRET` mismatch** between pipeline and portal. Must be the same value in both GitHub Secrets and Vercel env vars.
3. **review.json not on the draft branch.** The pipeline didn't finish correctly — re-run `weekly-draft.yml`.

---

### "Aprobar artículo shows 'Image approval required'"

You tapped "Aprobar artículo" before "Aprobar imagen". Tap "Aprobar imagen" first, then "Aprobar artículo".

---

### "Quality gate not met on article approval"

The draft didn't pass automated quality checks. This means the Validator found real issues (score < 70 or `isValid: false`).

Options:
1. Tap "Rechazar artículo" to trigger a new draft — the system will try again.
2. Or open the PR, edit the copy directly on the branch, then approve.

---

### "🖼️ Image regen limit reached — GitHub issue opened"

The hero image was rejected 5 times in a row. The system stopped and opened a GitHub issue. You have two choices:

**Option A — approve the best version you have:**
Open the digest email that came after the last regeneration and tap "Aprobar imagen".

**Option B — fresh start:**
Close the issue, then run: Actions → **Weekly Draft** → Run workflow → same edition ID. This starts a completely new draft cycle.

---

### "📝 Content regen limit reached — GitHub issue opened"

The article was rejected/rerun 3 times. Same two options as above:

**Option A** — open the latest PR, edit the copy you want, merge it, then approve from the email.
**Option B** — Actions → Weekly Draft → Run → same edition ID.

---

### "The article published but has no image"

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` were not set in the pipeline secrets when the draft ran, so the hero image was never uploaded to Supabase Storage.

Ask a developer to run the manual upload script and re-approve. Or set the Supabase secrets and re-run the draft.

---

### "Publish to Beehiiv failed"

1. **Review gate blocked it** — the edition's `review.json` doesn't have both approvals. Approve image + article via the email links first.
2. **Quality gate blocked it** — same as above, score < 70.
3. **`BEEHIIV_API_KEY` or `BEEHIIV_PUBLICATION_ID` missing.** Set in secrets.
4. **Beehiiv transient error.** Re-run the workflow.

---

## Knobs you can turn

All settable from phone via Settings → Secrets and variables → Actions.

| Knob | Where | Effect |
|---|---|---|
| **Pause weekly cron** | *Variables* → `WEEKLY_DRAFT_PAUSED = true` | Cron skips silently until you set it back. Manual dispatch still works. |
| **Change schedule** | Edit `weekly-draft.yml` line `cron:` | Default `0 13 * * MON` = Mondays 13:00 UTC. Use [crontab.guru](https://crontab.guru). |
| **Skip image generation** | `DRY_RUN=true` secret | Draft runs without calling Gemini. Useful if the Gemini key has issues. |
| **Regen limits** | `MAX_IMAGE_REGEN_ATTEMPTS` (default 5), `MAX_CONTENT_REGEN_ATTEMPTS` (default 3) | How many automatic retries before a human-intervention issue is opened. |
| **Quality threshold** | `QA_MIN_SCORE` in portal Vercel env | Default 70. Lower = more lenient. |

---

## First-time setup (one time only)

Secrets in **Settings → Secrets and variables → Actions → New repository secret**.

**Required for drafting:**
- `ANTHROPIC_API_KEY` — from console.anthropic.com

**Required for hero image generation:**
- `GEMINI_API_KEY` — from Google AI Studio (aistudio.google.com)
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings → API

**Required for the email approval gate:**
- `RESEND_API_KEY` — from resend.com (free tier: 100 emails/day)
- `RESEND_FROM` — verified sender address
- `RESEND_TO` — your editor inbox
- `APPROVAL_BASE_URL` — your deployed portal URL, e.g. `https://portal.yourdomain.com`
- `APPROVAL_SIGNING_SECRET` — random secret shared between pipeline and portal. Generate: `openssl rand -base64 48`. Set the **same value** in both GitHub Secrets and Vercel environment variables.

**Portal Vercel environment variables** (set in Vercel project settings):
- `NEXT_PUBLIC_SUPABASE_URL` — same as SUPABASE_URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project → API → anon key
- `SUPABASE_SERVICE_ROLE_KEY` — same as above
- `APPROVAL_SIGNING_SECRET` — same as GitHub secret
- `GITHUB_TOKEN` — fine-grained PAT with Contents: read/write on this repo
- `GITHUB_REPO` — owner/repo format

**Supabase Storage bucket** (one-time SQL):
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('edition-assets', 'edition-assets', true)
ON CONFLICT (id) DO NOTHING;
```

**Optional distribution:**
- `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` — for Beehiiv email distribution
- `LINKEDIN_ACCESS_TOKEN` — LinkedIn cross-post
- `TWITTER_API_KEY/SECRET`, `TWITTER_ACCESS_TOKEN/SECRET` — X cross-post
- `FEEDLY_API_KEY` — supplemental Radar source
- `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` — run ledger

**Repository variables** (Variables tab, not Secrets):
- `WEEKLY_DRAFT_PAUSED` — only set when you want to pause the cron

---

## The Cloudflare Worker (deprecated)

The `workers/approval-receiver/` directory contains the original approval Worker.
It is **no longer the primary path** — the portal handles all approvals now.

The Worker used to receive the magic-link tap and trigger Beehiiv publishing via
`repository_dispatch`. That role now belongs to `portal/app/review/route.ts`,
which handles granular decisions (image approve/reject, article approve/reject)
and publishes directly to Supabase.

**You can leave the Worker deployed** — it won't interfere. If you want to clean up,
set `APPROVAL_BASE_URL` to point to the portal URL instead of the Worker URL,
then undeploy the Worker at a time that feels right.

---

## When in doubt

- **Run logs:** GitHub repo → Actions tab.
- **Pipeline architecture:** `CLAUDE.md`
- **Editorial spine:** `src/voice-bible/voice-bible.md`
- **Testing and local simulation:** `TESTING.md`
- **Don't memorize. Don't manage. Read this file.**
