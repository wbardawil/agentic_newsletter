# TESTING

How to verify the pipeline works without subscribing 1,000 readers to a broken
draft. Three audiences: you-now (first run), you-in-a-month (regular check),
you-after-a-failure (debug).

## The 30-second smoke test (anytime)

Open phone. GitHub mobile app → Actions tab. Look at the last few runs of:
- **Weekly Draft** — should be green every Monday
- **Publish to Beehiiv** — green when you've shipped, no failed dispatches

If both are green, the pipeline is fine. If either is red, open the run logs
and read the `::error::` line — the workflows are written to fail loud.

That's it for the smoke test. The rest of this doc is for first-run setup,
deeper verification, and debugging.

---

## Tier 1 — Local code health (laptop required, ~30 seconds)

Before pushing any code change:

```sh
pnpm typecheck
pnpm test
```

Expect: 259/259 tests pass. Typecheck clean. If anything red, don't push —
read the test output.

These tests cover the agents, schemas, the email digest composer, the
approval token (HMAC sign/verify, expiry, tampering), and the orchestrator
state machine. They run with no network, no keys.

---

## Tier 2 — Dry-run the pipeline (laptop, ~30 seconds, no API spend)

To verify the digest composer works against your most recent draft:

```sh
pnpm digest:edition -- --edition $(date -u +%G-%V) --dry-run
```

Prints the email subject + plain-text body to stdout. No Resend call. Use
this to:
- Eyeball the output before sending
- Confirm a recent change to the digest didn't break rendering
- See what would have shipped if you re-ran

For the Designer agent dry-run (no Gemini API spend):

```sh
DRY_RUN=true ANTHROPIC_API_KEY=sk-... pnpm tsx -e '
  import { DesignerAgent } from "./src/agents/designer.js";
  // ... wire up minimal deps + call .run()
' # see tests/agents/designer.test.ts for the exact shape
```

In dryRun mode, the Designer writes `hero.dryrun.txt` with the prompt that
*would* have been sent to Gemini, plus generates real alt-text and captions.

---

## Tier 3 — GitHub Actions manual smoke test (phone or laptop)

The fastest way to catch a real-world break without waiting for Monday.

### A. Test the weekly cron

GitHub → Actions → **Weekly Draft** → Run workflow → leave edition blank → Run.

Within ~10 minutes, expect:
1. The run goes green
2. A new PR titled `Draft — Edition YYYY-WW` appears
3. (If Resend is configured) the digest email lands in your inbox

If any of those don't happen, the run logs say why. Common first-run causes:
- `ANTHROPIC_API_KEY` missing → fix in Settings → Secrets → Actions
- Anthropic transient outage → just re-run

### B. Test the manual publish path

After step A succeeds, decide whether the draft is good. Then:

GitHub → Actions → **Publish to Beehiiv** → Run workflow → enter the edition
ID (e.g. `2026-18`) → Run.

Expect:
1. Edition-ID regex passes
2. Quality gate passes (if your draft scored ≥ 70 and is valid)
3. Distributor creates a Beehiiv draft post
4. Amplifier emits social variants
5. Run goes green; `drafts/<id>-social.json` and `drafts/<id>-metrics.json`
   committed to main

The first time, most people hit "Beehiiv secret missing." Fix and re-run.

**Critical**: this creates a real Beehiiv post in **draft** status. It does
NOT send to subscribers automatically — Beehiiv requires you to schedule or
publish manually inside Beehiiv. So this is safe to test against your
production publication.

### C. Test the magic-link path (after deploying the Worker)

End-to-end test of phase 2:

```sh
# Locally, in the agentic_newsletter repo
APPROVAL_SIGNING_SECRET="<paste your secret>" \
  pnpm tsx -e '
    import { buildApprovalLink } from "./src/utils/approval-token.ts";
    console.log(buildApprovalLink(
      "https://transformation-letter-approval.<your-subdomain>.workers.dev",
      "2026-18",
      process.env.APPROVAL_SIGNING_SECRET,
    ));
  '
```

Open the printed URL on phone. Expect:
1. Worker page shows `Edition 2026-18 approved` within a second
2. Within a few seconds, a new run starts in **Publish to Beehiiv**
3. The run logs show `Source: repository_dispatch (email magic-link approval)`

If the Worker page shows `Invalid or expired link`:
- The signing secret in the Worker doesn't match the one in your shell

If the Worker page shows `GitHub dispatch failed`:
- The PAT in the Worker is missing or doesn't have Actions:write
- `wrangler tail` shows the GitHub API response

---

## Tier 4 — End-to-end weekly run (production, real spend)

This is the test that actually proves the laptop-free loop works.

**Friday before Monday's cron:**
1. Confirm all secrets are set: `ANTHROPIC_API_KEY`, optionally
   `RESEND_*`, `APPROVAL_*`, `BEEHIIV_*`
2. Confirm `WEEKLY_DRAFT_PAUSED` is **not** set (or set to anything other
   than `true`)
3. Confirm GitHub mobile push notifications are enabled for this repo

**Monday after 13:00 UTC:**
- [ ] Notification arrives on phone
- [ ] Email digest lands in inbox
- [ ] Email shows correct edition ID, headline, QA score
- [ ] Tap *Review on GitHub* — PR opens, EN + ES markdown render correctly
- [ ] Edit a sentence on phone via GitHub mobile editor (validates the
      edit-on-phone path)
- [ ] Tap *Approve and publish* (or merge + Run workflow if phase 1)
- [ ] Beehiiv draft created
- [ ] ✅ comment lands on the PR (when triggered via merge) or workflow
      shows green (when triggered via dispatch)

If all checked, the loop works.

---

## Failure mode tests (what to do when reality breaks the system)

### Drill 1: simulated cron failure

Temporarily break `ANTHROPIC_API_KEY`:
1. Settings → Secrets → edit `ANTHROPIC_API_KEY` → save with garbage value
2. Actions → Weekly Draft → Run workflow
3. Run fails (red)
4. Within ~30 seconds, an issue titled "🚨 Weekly draft cron failed" opens
   (this only fires on `schedule` triggers; for manual dispatch the run
   itself is the signal)
5. Restore the real key, re-run, confirm green

### Drill 2: low-quality draft refused

The quality gate is invisible until tested. To exercise it without
hand-editing scores: temporarily lower `QA_MIN_SCORE` in
`publish-to-beehiiv.yml` to 99 (essentially impossible to hit), trigger
publish, confirm the gate refuses with a clear error. Restore.

Or wait for the gate to refuse a real draft — it eventually will.

### Drill 3: expired magic link

Sign a token with `ttlSeconds: 1`:
```sh
pnpm tsx -e '
  import { signApprovalToken } from "./src/utils/approval-token.ts";
  const token = signApprovalToken({ editionId: "2026-18", ttlSeconds: 1 }, process.env.APPROVAL_SIGNING_SECRET);
  console.log(token);
'
```
Wait 2 seconds. Open `https://<your-worker>/approve?t=<expired token>`.
Expect: "Invalid or expired link" page.

### Drill 4: tampered magic link

Open the digest email. Find the magic link. Change ANY character in the
URL (other than the protocol). Tap it. Expect: "Invalid or expired link"
page. The HMAC catches it.

### Drill 5: pause for vacation

Settings → Variables → set `WEEKLY_DRAFT_PAUSED=true`. Wait until next
Monday. The workflow should run, log
`::notice::WEEKLY_DRAFT_PAUSED=true — skipping`, and exit green without
producing a draft. Delete the variable to resume.

---

## Cost / quota verification (monthly check, ~5 min)

Drift in any of these = surprise bill.

| Service | Where to check | Healthy weekly cost |
|---|---|---|
| Anthropic | console.anthropic.com → Usage | ~$0.50–2 per draft (Opus + Sonnet) |
| Gemini | aistudio.google.com → Usage (if Designer wired) | ~$0.04 per hero image |
| Resend | resend.com → Logs | < 100 emails/month, free tier |
| Cloudflare Workers | dash.cloudflare.com → Workers → Usage | < 100 requests/month, free tier |
| Beehiiv | beehiiv.com → Settings → Plan | Flat per-month, no per-issue cost |

`MAX_COST_PER_RUN_USD` in your env caps Anthropic spend per run at $5
default. If a run hits this, the agent throws a `CostLimitError` and the
workflow fails — investigate the prompt, don't just raise the cap.

---

## Key rotation drills (every 6 months)

### Rotate `APPROVAL_SIGNING_SECRET`

1. Generate new: `openssl rand -base64 48`
2. `wrangler secret put APPROVAL_SIGNING_SECRET --name transformation-letter-approval`
3. GitHub → Settings → Secrets → update `APPROVAL_SIGNING_SECRET`
4. **All previously-issued magic links stop working immediately** — drill 4
   above should now fail on any old link. Confirm.
5. Trigger a fresh weekly draft, confirm a new digest's link works

### Rotate `ANTHROPIC_API_KEY`

1. Generate new key in Anthropic console
2. Update GitHub secret
3. Run **Weekly Draft** → Run workflow manually to confirm
4. Revoke the old key in Anthropic console

### Rotate the GitHub PAT used by the Worker

1. Generate new fine-grained PAT (Actions:write on this repo)
2. `wrangler secret put GITHUB_TOKEN`
3. Trigger drill 3 (sign a fresh link, tap it). Expect the dispatch to
   succeed.
4. Revoke the old PAT in GitHub Settings → Developer settings

---

## What none of these tests catch

Be honest about gaps:

- **Subscriber experience** — Beehiiv draft status means nothing is sent.
  The first time you actually hit "send" in Beehiiv on a draft, watch
  open/click rates closely. Open and click on your phone first to confirm
  rendering.
- **Spam filtering** — drift over time. Periodically check the digest
  isn't landing in spam. SPF/DKIM/DMARC for the Resend sender domain is
  the real fix.
- **AI quality drift** — the validator catches structural problems (no
  reframe, missing People dimension) but cannot catch a sentence that's
  just *boring*. That's still your eyes.
- **Social posts before publishing** — the Amplifier runs at publish time.
  Bad social copy ships with the issue. Read the social variants in the
  publish run logs before considering the run "done."

The pipeline can be lights-out. The editorial judgement cannot.
