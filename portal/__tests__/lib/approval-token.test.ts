import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";

import { verifyApprovalToken, verifyReviewToken } from "@/lib/approval-token";

// Mirror of src/utils/approval-token.ts signing — proves the portal verifier
// is bytes-on-the-wire compatible with the digest signer.
function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sign(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const body = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest();
  return `${body}.${base64url(sig)}`;
}

const SECRET = "test-secret-value";
const FUTURE = Math.floor(Date.now() / 1000) + 3600;
const PAST = Math.floor(Date.now() / 1000) - 3600;

// ── Legacy verifyApprovalToken ────────────────────────────────────────────────

describe("verifyApprovalToken (legacy)", () => {
  it("verifies a well-formed, unexpired token", () => {
    const token = sign({ editionId: "2026-19", decision: "approve", exp: FUTURE, nonce: "abc123" }, SECRET);
    const payload = verifyApprovalToken(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.editionId).toBe("2026-19");
    expect(payload?.decision).toBe("approve");
  });

  it("rejects a tampered signature", () => {
    const token = sign({ editionId: "2026-19", decision: "approve", exp: FUTURE, nonce: "abc" }, SECRET);
    const [body] = token.split(".");
    const forged = `${body}.${"A".repeat(43)}`;
    expect(verifyApprovalToken(forged, SECRET)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = sign({ editionId: "2026-19", decision: "approve", exp: FUTURE, nonce: "abc" }, "other-secret");
    expect(verifyApprovalToken(token, SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = sign({ editionId: "2026-19", decision: "approve", exp: PAST, nonce: "abc" }, SECRET);
    expect(verifyApprovalToken(token, SECRET)).toBeNull();
  });

  it("rejects a malformed edition id", () => {
    const token = sign({ editionId: "not-an-edition", decision: "approve", exp: FUTURE, nonce: "abc" }, SECRET);
    expect(verifyApprovalToken(token, SECRET)).toBeNull();
  });

  it("rejects a non-approve decision", () => {
    const token = sign({ editionId: "2026-19", decision: "reject", exp: FUTURE, nonce: "abc" }, SECRET);
    expect(verifyApprovalToken(token, SECRET)).toBeNull();
  });

  it("rejects review decisions (image_approve, etc.)", () => {
    for (const decision of ["image_approve", "image_reject", "content_approve", "content_reject"]) {
      const token = sign({ editionId: "2026-19", decision, exp: FUTURE, nonce: "abc" }, SECRET);
      expect(verifyApprovalToken(token, SECRET)).toBeNull();
    }
  });

  it("rejects when no secret is configured", () => {
    const token = sign({ editionId: "2026-19", decision: "approve", exp: FUTURE, nonce: "abc" }, SECRET);
    expect(verifyApprovalToken(token, "")).toBeNull();
  });

  it("rejects structurally invalid tokens", () => {
    expect(verifyApprovalToken("garbage", SECRET)).toBeNull();
    expect(verifyApprovalToken("a.b.c", SECRET)).toBeNull();
  });
});

// ── verifyReviewToken ─────────────────────────────────────────────────────────

describe("verifyReviewToken", () => {
  it("verifies image_approve", () => {
    const token = sign({ editionId: "2026-21", decision: "image_approve", exp: FUTURE, nonce: "xyz" }, SECRET);
    const payload = verifyReviewToken(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.decision).toBe("image_approve");
    expect(payload?.editionId).toBe("2026-21");
  });

  it("verifies image_reject", () => {
    const token = sign({ editionId: "2026-21", decision: "image_reject", exp: FUTURE, nonce: "xyz" }, SECRET);
    expect(verifyReviewToken(token, SECRET)?.decision).toBe("image_reject");
  });

  it("verifies content_approve", () => {
    const token = sign({ editionId: "2026-21", decision: "content_approve", exp: FUTURE, nonce: "xyz" }, SECRET);
    expect(verifyReviewToken(token, SECRET)?.decision).toBe("content_approve");
  });

  it("verifies content_reject", () => {
    const token = sign({ editionId: "2026-21", decision: "content_reject", exp: FUTURE, nonce: "xyz" }, SECRET);
    expect(verifyReviewToken(token, SECRET)?.decision).toBe("content_reject");
  });

  it("verifies section_reject with sectionType", () => {
    const token = sign({ editionId: "2026-21", decision: "section_reject", sectionType: "analysis", exp: FUTURE, nonce: "xyz" }, SECRET);
    const payload = verifyReviewToken(token, SECRET);
    expect(payload?.decision).toBe("section_reject");
    expect(payload?.sectionType).toBe("analysis");
  });

  it("rejects section_reject without sectionType", () => {
    const token = sign({ editionId: "2026-21", decision: "section_reject", exp: FUTURE, nonce: "xyz" }, SECRET);
    expect(verifyReviewToken(token, SECRET)).toBeNull();
  });

  it("rejects the legacy 'approve' decision", () => {
    const token = sign({ editionId: "2026-19", decision: "approve", exp: FUTURE, nonce: "abc" }, SECRET);
    expect(verifyReviewToken(token, SECRET)).toBeNull();
  });

  it("rejects unknown decisions", () => {
    const token = sign({ editionId: "2026-21", decision: "super_approve", exp: FUTURE, nonce: "xyz" }, SECRET);
    expect(verifyReviewToken(token, SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = sign({ editionId: "2026-21", decision: "image_approve", exp: PAST, nonce: "xyz" }, SECRET);
    expect(verifyReviewToken(token, SECRET)).toBeNull();
  });

  it("rejects a malformed edition id", () => {
    const token = sign({ editionId: "bad", decision: "image_approve", exp: FUTURE, nonce: "xyz" }, SECRET);
    expect(verifyReviewToken(token, SECRET)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = sign({ editionId: "2026-21", decision: "image_approve", exp: FUTURE, nonce: "xyz" }, SECRET);
    const [body] = token.split(".");
    expect(verifyReviewToken(`${body}.${"A".repeat(43)}`, SECRET)).toBeNull();
  });

  it("rejects when no secret is configured", () => {
    const token = sign({ editionId: "2026-21", decision: "image_approve", exp: FUTURE, nonce: "xyz" }, SECRET);
    expect(verifyReviewToken(token, "")).toBeNull();
  });

  it("type isolation: review token is rejected by verifyApprovalToken", () => {
    const token = sign({ editionId: "2026-21", decision: "image_approve", exp: FUTURE, nonce: "xyz" }, SECRET);
    expect(verifyApprovalToken(token, SECRET)).toBeNull();
  });
});
