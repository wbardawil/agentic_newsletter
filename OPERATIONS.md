# OPERATIONS

The whole point of this doc: you should never have to read code or remember
how the pipeline works. Just the loop, the things only you can do, and the
recovery moves when something breaks.

---

## The weekly loop (no laptop required)

| When | What happens | What you do |
|---|---|---|
| **Monday 13:00 UTC** *(8am ET / 7am CT)* | GitHub Actions runs `pnpm draft`. A pull request titled `Draft — Edition YYYY-WW` opens on `drafts/YYYY-WW`. | GitHub mobile pushes a notification. |
| **Anytime that week** | You open the PR on phone. EN + ES drafts render as markdown. | Review. Comment to request changes, or commit edits via the GitHub mobile editor. |
| **When the editorial is right** | You tap **Merge**. | The merge means *"editorial approved, drafts saved on main"* — nothing publishes yet. |
| **Email approval gate** *(coming next)* | A digest email arrives with the canonical draft + design assets. | Approve, edit, or reject from email. |
| **Final publish** | After email approval, you trigger publish from Actions tab → **Publish to Beehiiv** → Run workflow → enter edition ID. | Beehiiv post + LinkedIn + X. |

**Why publish is manual today**: the Designer agent (hero images, brand style) and the email approval gate are not yet built. Until they are, design and final approval happen outside this pipeline. **Merging the PR does not push to subscribers.** You explicitly trigger publish when ready.

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

**Optional, expand reach when ready:**
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
2. **Designer agent** — hero/section imagery via Nano Banana. Drafts are text-only until then.
3. **Email approval gate** — Resend digest with the draft + design assets, magic-link approval. Replaces the current "review on PR, then manually trigger publish" with "review by email, approve to publish."
4. **Auto-publish on email approval** — only after #3 is solid. Re-introduces a `pull_request: closed` or webhook trigger to the publish workflow, gated by the email approval signal.

Until #1–#3 are done, **Beehiiv publishing stays a manual workflow_dispatch action**.

---

## When in doubt

- **Run logs**: GitHub repo → Actions tab. Every run is preserved.
- **The truth about the pipeline**: `CLAUDE.md` (architecture) + `src/voice-bible/voice-bible.md` (editorial spine).
- **Don't memorize. Don't manage. Read this file.**
