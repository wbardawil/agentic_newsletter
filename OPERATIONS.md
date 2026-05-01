# OPERATIONS

The whole point of this doc: you should never have to read code or remember
how the pipeline works. Just the loop, the three things only you can do, and
the recovery moves when something breaks.

---

## The weekly loop (no laptop required)

| When | What happens | What you do |
|---|---|---|
| **Monday 13:00 UTC** *(8am ET / 7am CT)* | GitHub Actions runs `pnpm draft`. A pull request titled `Draft — Edition YYYY-WW` opens on `drafts/YYYY-WW`. | GitHub mobile pushes a notification. |
| **Anytime that day** | You open the PR on phone. EN + ES drafts render as markdown. | Review. Comment to request changes, or commit edits via the GitHub mobile editor. |
| **When happy** | You tap **Merge**. | Quality gate verifies the draft scored ≥ 70 and Validator marked it valid. If yes → Beehiiv post created, social variants emitted. If no → publish refuses, ❌ comment on PR. |
| **Within a few minutes** | The PR receives a ✅ or ❌ comment with a link to the run logs. | Done — or, if ❌, see "Recovery moves" below. |

---

## The three things only you can do

1. **Decide if the draft is good enough.** Tap Merge or request changes.
2. **Edit copy on phone.** Use the GitHub mobile editor to fix the apertura, swap a Field Report, sharpen a sentence. Commit directly to the PR branch.
3. **Pause for vacation.** See "Pause this week" below.

Everything else — sourcing, drafting, translating, validating, publishing, cross-posting — runs on cron without you.

---

## Recovery moves (when something breaks)

### "I got a 🚨 Weekly draft cron failed issue"

The Monday cron failed before producing a draft. Most common causes, in order:

1. **`ANTHROPIC_API_KEY` revoked or missing.** Settings → Secrets and variables → Actions → check the secret is set. Re-paste from console.anthropic.com if needed.
2. **Anthropic API rate limit or outage.** Just re-run: Actions → Weekly Draft → Run workflow.
3. **A recent code change broke a prompt or schema.** Read the run logs. Revert the offending commit on `main`. Re-run.

After fixing: Actions → Weekly Draft → **Run workflow** → leave edition blank. Close the failure issue when the new run succeeds.

### "The PR got a ❌ Publish failed comment after I merged"

The merge was approved but distribution failed. Check:

1. **Beehiiv secret missing or wrong.** Most common on first run. Settings → Secrets → set `BEEHIIV_API_KEY` and `BEEHIIV_PUBLICATION_ID`.
2. **Quality gate refused** (score below 70 or Validator flagged errors). The run log says which. The fix is to commit edits to the merged content on `main`, then re-trigger.
3. **Beehiiv API transient error.** Just re-trigger.

To re-trigger: Actions → **Publish on Merge** → Run workflow → enter the edition ID (e.g. `2026-18`).

### "The draft is bad / I don't like it"

Don't merge. Comment on the PR with what to change, then either:
- Wait for next Monday's run (the apertura history feeds back into the Writer's voice)
- Or close the PR and run **Weekly Draft → Run workflow** to retry

---

## Knobs you can turn

All of these are settings you can change from phone via Settings → Secrets and variables → Actions.

| Knob | Where | Effect |
|---|---|---|
| **Pause weekly cron** | *Variables* → `WEEKLY_DRAFT_PAUSED = true` | Vacation mode. Cron skips silently until you set it back to `false` or delete the variable. Manual dispatch still works. |
| **Change schedule** | Edit `.github/workflows/weekly-draft.yml` line `cron:` | Use [crontab.guru](https://crontab.guru) to translate. Default `0 13 * * MON` = Mondays 13:00 UTC. |
| **Quality threshold** | Edit `.github/workflows/publish-on-merge.yml` env `QA_MIN_SCORE` | Default 70. Lower = more lenient gate. |

---

## First-time setup (one time only)

The first time the cron runs against a fresh repo, you need these secrets in **Settings → Secrets and variables → Actions → New repository secret**:

**Required for drafting:**
- `ANTHROPIC_API_KEY` — from console.anthropic.com

**Required for publishing (when you're ready to ship):**
- `BEEHIIV_API_KEY` — Beehiiv → Settings → API
- `BEEHIIV_PUBLICATION_ID` — visible in your Beehiiv URL

**Optional, expand reach when ready:**
- `LINKEDIN_ACCESS_TOKEN` — for LinkedIn cross-post
- `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET` — for X cross-post
- `FEEDLY_API_KEY` — supplemental Radar source
- `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` — for the run ledger

**Repository variables** (Settings → Secrets and variables → Actions → Variables tab):
- `WEEKLY_DRAFT_PAUSED` — only set this when you want to pause; default state is no variable

You also need the GitHub mobile app installed and notifications enabled for this repo. That's how the loop reaches your phone.

---

## What's not yet automated

These are the next building blocks; they don't change the loop above when added.

- **Designer agent** — hero/section imagery via Nano Banana. Drafts are text-only until then.
- **Email digest** — for now, GitHub PR notifications are the channel. A Resend integration would add an email path with rich formatting.
- **Source bundle expansion** — `pnpm verify:feeds` proposes 34 new RSS feeds; survivors need to be added to `src/agents/radar.ts`.

---

## When in doubt

- **Run logs**: GitHub repo → Actions tab. Every run is preserved.
- **The truth about the pipeline**: `CLAUDE.md` (architecture) + `src/voice-bible/voice-bible.md` (editorial spine).
- **Don't memorize. Don't manage. Read this file.**
