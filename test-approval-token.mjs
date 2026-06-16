#!/usr/bin/env node
/**
 * Quick script to generate a test approval token for local testing.
 *
 * Usage:
 *   node test-approval-token.mjs 2026-18
 *   node test-approval-token.mjs 2026-18 content_approve
 */

import { createHmac, randomBytes } from "node:crypto";

function base64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signToken(editionId, decision, secret) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = 7 * 24 * 60 * 60;
  const payload = {
    editionId,
    decision,
    exp: now + ttl,
    nonce: randomBytes(12).toString("hex"),
  };

  const body = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest();
  return `${body}.${base64url(sig)}`;
}

const secret = process.env.APPROVAL_SIGNING_SECRET || "test-secret-key-12345678";
const editionId = process.argv[2] || "2026-18";
const decision = process.argv[3] || "approve";

const token = signToken(editionId, decision, secret);
const baseUrl = process.env.PORTAL_BASE_URL || "http://localhost:3000";

if (decision === "approve") {
  console.log(`\n✓ Approval token for ${editionId}:\n`);
  console.log(`${baseUrl}/approve?t=${encodeURIComponent(token)}\n`);
} else {
  console.log(`\n✓ Review token (${decision}) for ${editionId}:\n`);
  console.log(`${baseUrl}/review?t=${encodeURIComponent(token)}\n`);
}
