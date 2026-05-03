import { describe, it, expect } from "vitest";
import {
  signApprovalToken,
  verifyApprovalToken,
  buildApprovalLink,
} from "../../src/utils/approval-token.js";

const SECRET = "test-secret-do-not-use-in-prod-min-32-chars-please";

describe("signApprovalToken / verifyApprovalToken", () => {
  it("round-trips a payload", () => {
    const token = signApprovalToken(
      { editionId: "2026-18", nowSeconds: 1_700_000_000 },
      SECRET,
    );
    const payload = verifyApprovalToken(token, SECRET, 1_700_000_001);
    expect(payload).not.toBeNull();
    expect(payload?.editionId).toBe("2026-18");
    expect(payload?.decision).toBe("approve");
    expect(payload?.exp).toBeGreaterThan(1_700_000_000);
    expect(payload?.nonce).toMatch(/^[0-9a-f]{24}$/);
  });

  it("produces URL-safe tokens (no +, /, or trailing =)", () => {
    const token = signApprovalToken({ editionId: "2026-18" }, SECRET);
    expect(token).not.toMatch(/[+/=]/);
    expect(token).toContain(".");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signApprovalToken({ editionId: "2026-18" }, SECRET);
    const result = verifyApprovalToken(token, "wrong-secret-at-least-32-chars-please-x");
    expect(result).toBeNull();
  });

  it("rejects a token whose body has been tampered with", () => {
    const token = signApprovalToken({ editionId: "2026-18" }, SECRET);
    const [body, sig] = token.split(".");
    // Re-encode a different editionId with the original signature
    const tamperedBody = Buffer.from(
      JSON.stringify({ editionId: "9999-01", decision: "approve", exp: 9_999_999_999, nonce: "x" }),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const tampered = `${tamperedBody}.${sig}`;
    expect(verifyApprovalToken(tampered, SECRET)).toBeNull();
    void body;
  });

  it("rejects an expired token", () => {
    const token = signApprovalToken(
      { editionId: "2026-18", ttlSeconds: 60, nowSeconds: 1_000_000 },
      SECRET,
    );
    // 2 minutes later
    const result = verifyApprovalToken(token, SECRET, 1_000_120);
    expect(result).toBeNull();
  });

  it("accepts a token at the exact expiry boundary", () => {
    const token = signApprovalToken(
      { editionId: "2026-18", ttlSeconds: 60, nowSeconds: 1_000_000 },
      SECRET,
    );
    // exactly at exp — `exp < now` so equal is still valid
    expect(verifyApprovalToken(token, SECRET, 1_000_060)).not.toBeNull();
    // one second past
    expect(verifyApprovalToken(token, SECRET, 1_000_061)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyApprovalToken("", SECRET)).toBeNull();
    expect(verifyApprovalToken("not-a-token", SECRET)).toBeNull();
    expect(verifyApprovalToken("a.b.c", SECRET)).toBeNull();
    expect(verifyApprovalToken(".missing-body", SECRET)).toBeNull();
    expect(verifyApprovalToken("missing-sig.", SECRET)).toBeNull();
  });

  it("rejects when the body is not valid JSON", () => {
    const sig = "x".repeat(43);
    const garbageBody = "not-json-base64";
    expect(verifyApprovalToken(`${garbageBody}.${sig}`, SECRET)).toBeNull();
  });

  it("throws when signing with an empty secret", () => {
    expect(() => signApprovalToken({ editionId: "2026-18" }, "")).toThrow();
  });

  it("returns null when verifying with an empty secret", () => {
    const token = signApprovalToken({ editionId: "2026-18" }, SECRET);
    expect(verifyApprovalToken(token, "")).toBeNull();
  });

  it("two consecutive tokens have different nonces", () => {
    const a = signApprovalToken({ editionId: "2026-18" }, SECRET);
    const b = signApprovalToken({ editionId: "2026-18" }, SECRET);
    expect(a).not.toBe(b);
  });
});

describe("buildApprovalLink", () => {
  it("produces a correct URL with a verifiable token", () => {
    const url = buildApprovalLink(
      "https://approve.example.workers.dev",
      "2026-18",
      SECRET,
    );
    expect(url).toMatch(/^https:\/\/approve\.example\.workers\.dev\/approve\?t=/);
    const token = decodeURIComponent(url.split("?t=")[1]!);
    const payload = verifyApprovalToken(token, SECRET);
    expect(payload?.editionId).toBe("2026-18");
  });

  it("strips trailing slashes from base URL", () => {
    const url = buildApprovalLink(
      "https://approve.example.workers.dev/",
      "2026-18",
      SECRET,
    );
    expect(url).not.toContain(".workers.dev//");
  });
});
