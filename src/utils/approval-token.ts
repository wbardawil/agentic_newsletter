/**
 * Signed approval tokens for the email-driven publish gate.
 *
 * The digest sender (Node) signs a token containing { editionId, decision,
 * exp, nonce } using HMAC-SHA256 with a shared secret. The token is embedded
 * in a magic link that the editor taps from the digest email. A Cloudflare
 * Worker verifies the token and dispatches a GitHub repository_dispatch
 * event, which triggers the publish workflow.
 *
 * The Worker uses Web Crypto (`workers/approval-receiver/src/index.ts`) for
 * verification — bytes-on-the-wire are identical, so any HMAC-SHA256
 * implementation interoperates given the same secret and input.
 *
 * Token format: `<base64url(JSON-payload)>.<base64url(HMAC)>`
 */

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

export type ApprovalDecision = "approve";

export interface ApprovalPayload {
  editionId: string;
  decision: ApprovalDecision;
  /** Unix epoch seconds. The token is rejected after this time. */
  exp: number;
  /** Random per-token value — defends against trivial token forgery via known-payload attacks. */
  nonce: string;
}

// ── encoding helpers ──────────────────────────────────────────────────────

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  const padLength = (4 - (s.length % 4)) % 4;
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  return Buffer.from(padded, "base64");
}

// ── public API ────────────────────────────────────────────────────────────

export interface MintTokenInput {
  editionId: string;
  decision?: ApprovalDecision;
  /** TTL in seconds. Default 7 days. */
  ttlSeconds?: number;
  /** Override clock for tests. */
  nowSeconds?: number;
}

/**
 * Sign an approval token with HMAC-SHA256.
 *
 * The returned string is URL-safe and around 200 chars long — fits in any
 * email link. Pass it as `?t=<token>` to the receiver's /approve endpoint.
 */
export function signApprovalToken(input: MintTokenInput, secret: string): string {
  if (!secret) throw new Error("APPROVAL_SIGNING_SECRET is required");

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds ?? 7 * 24 * 60 * 60;
  const payload: ApprovalPayload = {
    editionId: input.editionId,
    decision: input.decision ?? "approve",
    exp: now + ttl,
    nonce: randomBytes(12).toString("hex"),
  };

  const body = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest();
  return `${body}.${base64url(sig)}`;
}

/**
 * Verify an approval token.
 *
 * Returns the decoded payload on success, or null when the token is malformed,
 * the signature does not match, or the token is expired.
 *
 * Used in tests; the production verifier is the Cloudflare Worker (Web Crypto).
 */
export function verifyApprovalToken(
  token: string,
  secret: string,
  nowSeconds?: number,
): ApprovalPayload | null {
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];

  const expectedSig = createHmac("sha256", secret).update(body).digest();
  let actualSig: Buffer;
  try {
    actualSig = fromBase64url(sig);
  } catch {
    return null;
  }
  if (expectedSig.length !== actualSig.length) return null;
  if (!timingSafeEqual(expectedSig, actualSig)) return null;

  let payload: ApprovalPayload;
  try {
    const decoded = fromBase64url(body).toString("utf-8");
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

  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  if (payload.exp < now) return null;

  return payload;
}

/**
 * Build the full magic-link URL for the digest email.
 *
 * The Worker is expected to expose POST/GET /approve?t=<token>. The base URL
 * is whatever the editor deployed the Worker at (e.g.
 * https://approve.transformationletter.workers.dev).
 */
export function buildApprovalLink(
  baseUrl: string,
  editionId: string,
  secret: string,
): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const token = signApprovalToken({ editionId }, secret);
  return `${trimmed}/approve?t=${encodeURIComponent(token)}`;
}
