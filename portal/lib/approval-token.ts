/**
 * Approval + review token verification — server-only.
 *
 * Ported from `src/utils/approval-token.ts` (the digest signer). Bytes-on-the-wire
 * identical: same base64url encoding and HMAC-SHA256 over the payload body, so a
 * token minted by `send-draft-digest.ts` verifies here without changes.
 *
 * Two token families:
 * - `verifyApprovalToken`: legacy "approve" tokens → used by `/approve` route (backward compat).
 * - `verifyReviewToken`: granular review decisions → used by `/review` route.
 *
 * The shared secret is APPROVAL_SIGNING_SECRET — the same value configured for
 * the digest sender. Set it in the portal (Vercel) Production env only.
 */

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

if (typeof window !== "undefined") {
  throw new Error("portal/lib/approval-token.ts is server-only and must not be imported from client components.");
}

// ── Legacy types ──────────────────────────────────────────────────────────

export type ApprovalDecision = "approve";

export interface ApprovalPayload {
  editionId: string;
  decision: ApprovalDecision;
  /** Unix epoch seconds. The token is rejected after this time. */
  exp: number;
  /** Random per-token value — defends against trivial known-payload forgery. */
  nonce: string;
}

// ── Review decision types ─────────────────────────────────────────────────

export type ReviewDecision =
  | "image_approve"
  | "image_reject"
  | "content_approve"
  | "content_reject"
  | "section_reject";

const VALID_REVIEW_DECISIONS: readonly ReviewDecision[] = [
  "image_approve",
  "image_reject",
  "content_approve",
  "content_reject",
  "section_reject",
];

export interface ReviewTokenPayload {
  editionId: string;
  decision: ReviewDecision;
  /** Present when decision is "section_reject". */
  sectionType?: string;
  /** Unix epoch seconds. */
  exp: number;
  /** Random per-token nonce. */
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

/** YYYY-WW, matching the pipeline's EditionIdSchema (weeks 01–53). */
const EDITION_ID_RE = /^\d{4}-(0[1-9]|[1-4]\d|5[0-3])$/;

// ── Legacy approval token verifier ───────────────────────────────────────

/**
 * Verify a legacy approval token (decision: "approve").
 *
 * Returns the decoded payload on success, or null when the token is malformed,
 * the signature does not match, the token is expired, or the editionId is not a
 * well-formed YYYY-WW value.
 *
 * Used by `/approve` route for backward compatibility.
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
    !EDITION_ID_RE.test(payload.editionId) ||
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

// ── Review token signer (used by digest + tests) ─────────────────────────

export interface ReviewMintInput {
  editionId: string;
  decision: ReviewDecision;
  sectionType?: string;
  ttlSeconds?: number;
  nowSeconds?: number;
}

/**
 * Sign a review token with HMAC-SHA256.
 * Mirrors `src/utils/approval-token.ts:signReviewToken` byte-for-byte.
 */
export function signReviewToken(input: ReviewMintInput, secret: string): string {
  if (!secret) throw new Error("APPROVAL_SIGNING_SECRET is required");
  if (input.decision === "section_reject" && !input.sectionType) {
    throw new Error("sectionType is required for section_reject decisions");
  }

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttl = input.ttlSeconds ?? 7 * 24 * 60 * 60;
  const payload: ReviewTokenPayload = {
    editionId: input.editionId,
    decision: input.decision,
    exp: now + ttl,
    nonce: randomBytes(12).toString("hex"),
    ...(input.sectionType ? { sectionType: input.sectionType } : {}),
  };

  const body = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest();
  return `${body}.${base64url(sig)}`;
}

// ── Review token verifier ─────────────────────────────────────────────────

/**
 * Verify a review token (granular ReviewDecision).
 *
 * Returns the decoded payload or null.
 * Enforces that `sectionType` is present when `decision === "section_reject"`.
 *
 * Used by `/review` route.
 */
export function verifyReviewToken(
  token: string,
  secret: string,
  nowSeconds?: number,
): ReviewTokenPayload | null {
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

  let payload: ReviewTokenPayload;
  try {
    const decoded = fromBase64url(body).toString("utf-8");
    payload = JSON.parse(decoded) as ReviewTokenPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.editionId !== "string" ||
    !EDITION_ID_RE.test(payload.editionId) ||
    typeof payload.exp !== "number" ||
    typeof payload.nonce !== "string" ||
    !VALID_REVIEW_DECISIONS.includes(payload.decision)
  ) {
    return null;
  }

  if (payload.decision === "section_reject" && !payload.sectionType) {
    return null;
  }

  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  if (payload.exp < now) return null;

  return payload;
}
