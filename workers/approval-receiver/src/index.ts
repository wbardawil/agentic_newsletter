/**
 * Approval Receiver — Cloudflare Worker.
 *
 * Receives the magic link tapped from the digest email, verifies the signed
 * token, and dispatches a `repository_dispatch` event to GitHub. The publish
 * workflow (publish-to-beehiiv.yml) listens for `event_type: edition_approved`
 * and runs.
 *
 * Routes:
 *   GET  /                — health check ("ok")
 *   GET  /approve?t=...   — verify token + dispatch + return success page
 *
 * Bindings (set via wrangler secret put):
 *   APPROVAL_SIGNING_SECRET  — same secret the digest sender uses to sign
 *   GITHUB_TOKEN             — fine-grained PAT with repository:write +
 *                              actions:read on the target repo
 *   GITHUB_REPO              — "<owner>/<repo>", e.g. "wbardawil/agentic_newsletter"
 *
 * Bytes-on-the-wire compatibility: this verifier uses Web Crypto SubtleCrypto
 * for HMAC-SHA256 verification. The digest sender uses Node's createHmac.
 * Both produce identical signatures for identical (secret, body) inputs.
 */

export interface Env {
  APPROVAL_SIGNING_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
}

interface ApprovalPayload {
  editionId: string;
  decision: "approve";
  exp: number;
  nonce: string;
}

// ── helpers ───────────────────────────────────────────────────────────────

function base64urlDecode(s: string): Uint8Array {
  const padLength = (4 - (s.length % 4)) % 4;
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyToken(
  token: string,
  secret: string,
): Promise<ApprovalPayload | null> {
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];

  let sigBytes: Uint8Array;
  try {
    sigBytes = base64urlDecode(sig);
  } catch {
    return null;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signedData = new TextEncoder().encode(body);
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, signedData);
  if (!ok) return null;

  let payload: ApprovalPayload;
  try {
    const decoded = new TextDecoder().decode(base64urlDecode(body));
    payload = JSON.parse(decoded) as ApprovalPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.editionId !== "string" ||
    typeof payload.exp !== "number" ||
    typeof payload.nonce !== "string" ||
    payload.decision !== "approve"
  ) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) return null;

  return payload;
}

async function dispatchEditionApproved(
  editionId: string,
  env: Env,
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "transformation-letter-approval-receiver",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: "edition_approved",
      client_payload: { edition: editionId, source: "email-magic-link" },
    }),
  });
  const text = await response.text();
  return { ok: response.ok, status: response.status, body: text.slice(0, 500) };
}

// ── HTML responses ────────────────────────────────────────────────────────

function htmlResponse(
  status: number,
  title: string,
  message: string,
  detail?: string,
): Response {
  const safeTitle = title.replace(/</g, "&lt;");
  const safeMessage = message.replace(/</g, "&lt;");
  const safeDetail = (detail ?? "").replace(/</g, "&lt;");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<style>
body { margin: 0; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; background: #F4EFE6; color: #0F1A2B; }
.box { max-width: 480px; margin: 64px auto; padding: 32px; background: #FFF; border-radius: 12px; box-shadow: 0 1px 3px rgba(15,26,43,0.06); }
h1 { font-family: "Cormorant Garamond", Garamond, serif; font-size: 24px; margin: 0 0 8px 0; color: #0F1A2B; }
p { font-size: 15px; line-height: 1.6; color: #1F4E5F; margin: 12px 0 0 0; }
.detail { margin-top: 16px; padding: 12px; background: #F4EFE6; border-radius: 6px; font-family: ui-monospace, monospace; font-size: 12px; color: #7A7466; word-break: break-word; }
</style>
</head>
<body>
<div class="box">
<h1>${safeTitle}</h1>
<p>${safeMessage}</p>
${safeDetail ? `<div class="detail">${safeDetail}</div>` : ""}
</div>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ── entry ─────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname !== "/approve") {
      return htmlResponse(404, "Not found", "This page does not exist.");
    }

    const token = url.searchParams.get("t");
    if (!token) {
      return htmlResponse(
        400,
        "Missing token",
        "The approval link is incomplete. Re-open the digest email and tap the button again.",
      );
    }

    const payload = await verifyToken(token, env.APPROVAL_SIGNING_SECRET);
    if (!payload) {
      return htmlResponse(
        401,
        "Invalid or expired link",
        "This approval link cannot be verified. It may have expired (links last 7 days), or the signing secret may have rotated.",
      );
    }

    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
      return htmlResponse(
        500,
        "Worker not configured",
        "GITHUB_TOKEN or GITHUB_REPO is not set on the Worker. The token was valid, but no dispatch happened.",
      );
    }

    const result = await dispatchEditionApproved(payload.editionId, env);
    if (!result.ok) {
      return htmlResponse(
        502,
        "GitHub dispatch failed",
        `The token verified, but GitHub returned ${result.status} when dispatching the publish workflow. Re-trigger via Actions → Publish to Beehiiv → Run workflow.`,
        result.body,
      );
    }

    return htmlResponse(
      200,
      `Edition ${payload.editionId} approved`,
      "The publish workflow has been triggered. You'll receive a notification when it finishes — typically within a few minutes. You can close this tab.",
    );
  },
};
