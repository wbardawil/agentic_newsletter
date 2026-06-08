/**
 * Signed review tokens for the email-driven editorial gate.
 *
 * Two token families live here:
 *
 * 1. Legacy approval tokens (decision: "approve") — backward compatible with
 *    the Cloudflare Worker and old one-click approve links.
 *
 * 2. Review tokens (ReviewDecision union) — granular decisions for image
 *    approve/reject and content approve/reject/section-reject. These land on
 *    `portal/app/review/route.ts` which handles the full review state machine.
 *
 * Both families share the same HMAC-SHA256 signing scheme:
 *   token = `<base64url(JSON-payload)>.<base64url(HMAC-SHA256)>`
 *
 * The portal verifier (`portal/lib/approval-token.ts`) is bytes-on-the-wire
 * identical, so any token minted here verifies there without changes.
 */

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

// ── Legacy approval types (backward compat) ───────────────────────────────

export type ApprovalDecision = "approve";

export interface ApprovalPayload {
  editionId: string;
  decision: ApprovalDecision;
  /** Unix epoch seconds. The token is rejected after this time. */
  exp: number;
  /** Random per-token value — defends against trivial token forgery via known-payload attacks. */
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
  /** Required when decision is "section_reject". */
  sectionType?: string;
  /** Unix epoch seconds. The token is rejected after this time. */
  exp: number;
  /** Random per-token value — defends against trivial token forgery. */
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

// ── Legacy token API ──────────────────────────────────────────────────────

export interface MintTokenInput {
  editionId: string;
  decision?: ApprovalDecision;
  /** TTL in seconds. Default 7 days. */
  ttlSeconds?: number;
  /** Override clock for tests. */
  nowSeconds?: number;
}

/**
 * Sign a legacy approval token with HMAC-SHA256.
 * Use `signReviewToken` for new granular decisions.
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
 * Verify a legacy approval token.
 * Returns the decoded payload or null.
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
 * Build the legacy magic-link URL for the old Worker endpoint.
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

// ── Review token API ──────────────────────────────────────────────────────

export interface ReviewMintInput {
  editionId: string;
  decision: ReviewDecision;
  /** Required when decision is "section_reject". */
  sectionType?: string;
  /** TTL in seconds. Default 7 days. */
  ttlSeconds?: number;
  /** Override clock for tests. */
  nowSeconds?: number;
}

/**
 * Sign a review token with HMAC-SHA256.
 *
 * The returned token is URL-safe and lands on `portal/app/review/route.ts`
 * via `GET /review?t=<token>`.
 */
export function signReviewToken(input: ReviewMintInput, secret: string): string {
  if (!secret) throw new Error("APPROVAL_SIGNING_SECRET is required");
  if (
    input.decision === "section_reject" &&
    !input.sectionType
  ) {
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

/**
 * Verify a review token.
 *
 * Returns the decoded payload on success, or null when the token is malformed,
 * the signature does not match, the token is expired, or the decision is unknown.
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

/**
 * Build the full review link URL for the portal `/review` endpoint.
 *
 * Example: `buildReviewLink("https://portal.example.com", { editionId: "2026-21",
 *   decision: "image_approve" }, secret)`
 * → `https://portal.example.com/review?t=<token>`
 */
export function buildReviewLink(
  baseUrl: string,
  input: ReviewMintInput,
  secret: string,
): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const token = signReviewToken(input, secret);
  return `${trimmed}/review?t=${encodeURIComponent(token)}`;
}
