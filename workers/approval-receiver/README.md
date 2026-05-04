# Approval Receiver — Cloudflare Worker

Phase 2 of the email approval gate. Receives the magic link tapped from the
digest email, verifies the signed token, and dispatches a `repository_dispatch`
event to GitHub. The publish workflow listens for `event_type: edition_approved`
and runs.

## What this gives you

Tap *Approve* in the digest email on phone → publish workflow runs in seconds.
No GitHub tab, no copy-paste of the edition ID.

## One-time deployment

You need a free Cloudflare account. Workers free tier is more than enough for
weekly use (100,000 requests/day).

### 1. Generate a signing secret

```sh
openssl rand -base64 48
```

Save the output — you'll paste it twice (once into Cloudflare, once into GitHub).

### 2. Generate a GitHub PAT for the Worker

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.

- Resource owner: your account / org
- Repository access: select repository → `wbardawil/agentic_newsletter`
- Permissions:
  - **Repository → Actions: Read and write** (required to POST `repository_dispatch`)
  - **Repository → Contents: Read** (recommended, lets the Worker validate the repo)
- Expiration: 1 year is fine

Copy the token (starts with `github_pat_...`). You won't see it again.

### 3. Deploy the Worker

From this directory:

```sh
pnpm install
pnpm wrangler login            # opens browser, one-time
pnpm wrangler secret put APPROVAL_SIGNING_SECRET   # paste the openssl output
pnpm wrangler secret put GITHUB_TOKEN              # paste the github_pat_...
pnpm wrangler secret put GITHUB_REPO               # paste: wbardawil/agentic_newsletter
pnpm wrangler deploy
```

Wrangler prints the deployed URL — typically
`https://transformation-letter-approval.<your-subdomain>.workers.dev`. Copy it.

### 4. Wire the digest sender

In the main repo (parent of `workers/`), add two GitHub Actions secrets:

- `APPROVAL_SIGNING_SECRET` — same value you put into the Worker
- `APPROVAL_BASE_URL` — the Worker URL from step 3 (no trailing slash)

The next weekly draft will embed magic links in the digest email.

## Verifying it works

```sh
curl https://transformation-letter-approval.<your-subdomain>.workers.dev/health
# → ok
```

For an end-to-end smoke test, sign a token from the main repo and hit the
Worker:

```sh
# from the agentic_newsletter repo
APPROVAL_SIGNING_SECRET="<same secret>" pnpm tsx -e '
  import { buildApprovalLink } from "./src/utils/approval-token.ts";
  const url = buildApprovalLink(
    "https://transformation-letter-approval.<your-subdomain>.workers.dev",
    "2026-18",
    process.env.APPROVAL_SIGNING_SECRET,
  );
  console.log(url);
'
```

Open the printed URL in a browser. You should see "Edition 2026-18 approved",
and the Publish workflow should kick off in GitHub Actions within seconds.

## Rotating the signing secret

If a token leaks (or you just want fresh entropy):

```sh
NEW=$(openssl rand -base64 48)
pnpm wrangler secret put APPROVAL_SIGNING_SECRET --name transformation-letter-approval
# Then update the GitHub Actions secret APPROVAL_SIGNING_SECRET with the same value.
```

All previously-issued tokens stop working immediately.

## Local development

```sh
pnpm wrangler dev    # serves at http://localhost:8787
```

Wrangler reads secrets from `.dev.vars` in this directory:

```
APPROVAL_SIGNING_SECRET=...
GITHUB_TOKEN=...
GITHUB_REPO=wbardawil/agentic_newsletter
```

Don't commit `.dev.vars` — it's in the repo's `.gitignore`.

## Logs

```sh
pnpm wrangler tail
```

Follow live invocations. Useful when debugging a failed dispatch.

## Why a Worker (and not a GitHub Action / serverless function elsewhere)

- **Free**, generous limits, no cold-start latency
- **Edge-deployed** — magic-link clicks resolve in <100ms globally
- **One file**, no framework, no server management
- Built-in **Web Crypto** for HMAC verification — no third-party libs

If Cloudflare ever stops working for you, the Worker can be ported to Vercel
Edge / Netlify Functions / AWS Lambda with mostly the same code — Web Crypto
is portable across runtimes.
