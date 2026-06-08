# TESTING

How to verify the pipeline works without subscribing 1,000 readers to a broken
draft. Three audiences: you-now (first run), you-in-a-month (regular check),
you-after-a-failure (debug).

---

## The 30-second smoke test (anytime)

GitHub mobile → Actions tab. Check the last few runs of:
- **Weekly Draft** — green every Monday
- **Publish to Beehiiv (optional)** — green when you've shipped

If both are green, the pipeline is fine. If either is red, open the logs and
read the `::error::` line — the workflows fail loud.

---

## Tier 1 — Local code health (~30 seconds)

```bash
pnpm typecheck      # must be clean
pnpm test           # 319 tests, 0 failures

cd portal
pnpm typecheck      # portal clean too
../node_modules/.bin/vitest.CMD run   # 80 portal tests
```

These run with no network, no API keys. If anything is red, don't push.

---

## Tier 2 — Dry-run pipeline locally (no API spend)

### 2a. Generate a draft with placeholder image

```bash
# PowerShell
$env:DRY_RUN="true"; pnpm draft -- --edition 2026-99
```

Expect:
- `drafts/2026-99-draft.json` — draft content
- `drafts/2026-99-hero.dryrun.txt` — image prompt (no Gemini call)
- `drafts/2026-99-review.json` — `image.status: "pending"`, `content.status: "pending"`
- `drafts/2026-99-designer.json` — real alt-text + captions (Claude was called)

### 2b. Preview digest email in terminal

```bash
$env:APPROVAL_BASE_URL="http://localhost:3000"
$env:APPROVAL_SIGNING_SECRET="test-secret"
pnpm digest:edition -- --edition 2026-99 --dry-run
```

Confirm the output contains:
- `--- Hero image (intento 1)` block
- `Aprobar imagen: http://localhost:3000/review?t=...`
- `Aprobar artículo: http://localhost:3000/review?t=...`
- Section rejection links (Insight, Field Report, etc.)

### 2c. Test image regeneration

```bash
$env:DRY_RUN="true"
pnpm regenerate-image -- --edition 2026-99 --feedback "Too abstract"
```

Expect `review.json` to have `image.attempt: 2` and the rejected prompt in `rejectedPrompts[]`.

### 2d. Test rejection feedback flow

```powershell
# Create a rejection file
'{"editionId":"2026-99","type":"content_reject","reason":"Test rejection","sections":[],"createdAt":"2026-06-07T00:00:00Z"}' | Out-File drafts\2026-99-rejection.json -Encoding utf8

# Run draft — should detect the rejection file
$env:DRY_RUN="true"; pnpm draft -- --edition 2026-99
```

Look for in the output:
```
⚠️  Rerun mode — rejection feedback loaded:
    Reason: "Test rejection"
ℹ️  Review state reset for rerun (content attempt 2)
```

---

## Tier 3 — Portal approval flow simulation

Requires the portal running locally at `http://localhost:3000`.

### Setup

```bash
cd portal
# portal/.env.local must have: APPROVAL_SIGNING_SECRET, GITHUB_TOKEN, GITHUB_REPO, SUPABASE_*
pnpm dev
```

Push the test draft to a GitHub branch so the portal can read it:
```bash
git checkout -b drafts/2026-99
git add drafts/2026-99-*.json
git commit -m "test: E2E approval flow"
git push origin drafts/2026-99
git checkout main
```

### Generate test tokens

```bash
node -e "
require('dotenv/config');
const {buildReviewLink} = require('./src/utils/approval-token.js');
const base = process.env.APPROVAL_BASE_URL || 'http://localhost:3000';
const secret = process.env.APPROVAL_SIGNING_SECRET || 'test-secret';
const id = '2026-99';
console.log('image_approve:   ', buildReviewLink(base, {editionId:id, decision:'image_approve'}, secret));
console.log('content_approve: ', buildReviewLink(base, {editionId:id, decision:'content_approve'}, secret));
console.log('image_reject:    ', buildReviewLink(base, {editionId:id, decision:'image_reject'}, secret));
console.log('content_reject:  ', buildReviewLink(base, {editionId:id, decision:'content_reject'}, secret));
"
```

### Run each scenario

| URL to open | Expected result |
|---|---|
| `image_approve` link | "Imagen aprobada ✓" page |
| `image_approve` again | Same page (idempotent) |
| `content_approve` before `image_approve` | HTTP 422 "Image approval required first" |
| `image_approve` then `content_approve` | "Edición publicada ✓" + edition appears in Supabase |
| `image_reject` | "Imagen rechazada — regenerando" or "regeneración pendiente" |
| `content_reject` | "Artículo rechazado — generando nuevo draft" |
| Expired token (ttlSeconds: -1) | HTTP 401 "Invalid or expired link" |
| Tampered token (change any char) | HTTP 401 |
| Wrong secret | HTTP 401 |

### Verify Supabase after content_approve

```sql
SELECT edition_id, is_published, hero_image_url, published_at
FROM editions
WHERE edition_id = '2026-99';
```

`is_published` should be `true`. `hero_image_url` is null if Storage wasn't configured,
non-null if it was.

---

## Tier 4 — GitHub Actions manual test

### A. Test the weekly cron manually

Actions → **Weekly Draft** → Run workflow → leave edition blank.

Within ~10 minutes, expect:
1. Run goes green
2. PR opened `Draft — Edition YYYY-WW`
3. Digest email lands (if Resend configured) with image preview + decision buttons
4. `review.json` exists on the draft branch with `image.status: "pending"`

### B. Test the full approval loop

After Tier A succeeds:
1. Open the digest email on phone
2. Tap **Aprobar imagen** → browser shows "Imagen aprobada ✓"
3. Tap **Aprobar artículo** → browser shows "Edición publicada ✓"
4. Visit the newsroom — edition appears with hero image

### C. Test image rejection loop

After Tier A:
1. Tap **Rechazar imagen**
2. Expect: page "regenerando" + `regenerate-image.yml` workflow starts
3. After ~10 min, new digest email arrives with "intento 2" image
4. Tap **Aprobar imagen** on the new email

### D. Test Beehiiv distribution (after portal publish)

```bash
gh workflow run publish-to-beehiiv.yml -f edition=<id>
```

Expect: run passes review gate, creates Beehiiv draft post (not sent to subscribers yet).

---

## Failure mode drills

### Drill: regen limit

```bash
# Set limit to 2, then attempt 3 regenerations
$env:MAX_IMAGE_REGEN_ATTEMPTS="2"

# With review.json showing attempt=2:
pnpm regenerate-image -- --edition 2026-99
# Expect: exit 1 with "Image regen limit reached"
```

### Drill: expired token

```bash
node -e "
require('dotenv/config');
const {signReviewToken} = require('./src/utils/approval-token.js');
const token = signReviewToken(
  {editionId:'2026-99', decision:'image_approve', ttlSeconds:-1},
  process.env.APPROVAL_SIGNING_SECRET || 'test-secret'
);
console.log('http://localhost:3000/review?t=' + encodeURIComponent(token));
"
```
Open URL → expect "Invalid or expired link".

### Drill: tampered token

Take any valid review link and change one character in the token query param.
Open it → expect "Invalid or expired link".

### Drill: publish without approvals

```bash
# review.json has image.status = "pending"
pnpm publish:edition -- --edition 2026-99
# Expect: "Image not approved for edition 2026-99"
```

### Drill: pause cron

Settings → Variables → `WEEKLY_DRAFT_PAUSED=true`. Trigger Weekly Draft manually.
Expect: run logs `WEEKLY_DRAFT_PAUSED=true — skipping`. Remove variable to resume.

---

## Cost verification (monthly)

| Service | Where | Healthy weekly cost |
|---|---|---|
| Anthropic | console.anthropic.com → Usage | ~$0.60–1.20 per draft |
| Gemini | aistudio.google.com → Usage | ~$0.04 per hero image |
| Resend | resend.com → Logs | < 100 emails/month (free tier) |
| Supabase | project dashboard | Storage + DB reads within free tier |
| Beehiiv | Settings → Plan | Flat monthly, no per-issue cost |

`MAX_COST_PER_RUN_USD=5.00` (in `.env`) caps Anthropic spend per run.

---

## Key rotation (every 6 months)

### Rotate `APPROVAL_SIGNING_SECRET`

1. Generate: `openssl rand -base64 48`
2. Update in GitHub Secrets AND Vercel portal env vars (both must match)
3. All previous digest email links become invalid immediately — confirm with the expired-token drill
4. Trigger a fresh weekly draft and confirm new links work

### Rotate `ANTHROPIC_API_KEY`

1. New key from console.anthropic.com
2. Update GitHub Secret
3. `pnpm draft -- --edition <id>` locally to confirm
4. Revoke old key in Anthropic console

### Rotate `GEMINI_API_KEY`

1. New key from aistudio.google.com
2. Update GitHub Secret
3. `pnpm draft -- --edition <id>` locally to confirm image generation

---

## What tests don't catch

- **Subscriber experience** — Beehiiv draft ≠ sent. Read it in Beehiiv before hitting Send.
- **Spam filtering** — test sending to your own inbox. SPF/DKIM/DMARC on the Resend sender domain is the real fix.
- **AI quality drift** — the Validator catches structure, not boredom. That's still your eyes.
- **Social copy quality** — read the social variants in the publish run before calling it done.

The pipeline can be lights-out. The editorial judgement cannot.
