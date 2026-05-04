/**
 * Send a draft digest email to the editor via Resend.
 *
 * Composes a phone-friendly HTML+text email from drafts/<edition>-draft.json,
 * including: edition metadata, Validator score, OS pillar, People dimension,
 * subject + preheader, the headline + thesis, top recommendations, and deep
 * links to the GitHub PR and the publish workflow_dispatch UI.
 *
 * This is the "email approval gate, phase 1" — the digest replaces having to
 * open GitHub manually. Approval still happens via the existing
 * workflow_dispatch (tap the "Publish to Beehiiv" link, paste the edition ID,
 * tap Run). Phase 2 will add a signed magic-link receiver for true one-click
 * approval.
 *
 * Usage:
 *   pnpm digest:edition -- --edition 2026-18                    (send live)
 *   pnpm digest:edition -- --edition 2026-18 --pr-url <url>     (include PR link)
 *   pnpm digest:edition -- --edition 2026-18 --dry-run          (print, don't send)
 *
 * Required env vars (live mode):
 *   RESEND_API_KEY          — from resend.com (free tier supports 100 emails/day)
 *   RESEND_FROM             — verified sender, e.g. "Drafts <drafts@yourdomain.com>"
 *                             For testing: "onboarding@resend.dev"
 *   RESEND_TO               — recipient address (your editor inbox)
 *   GITHUB_REPOSITORY       — set automatically inside GitHub Actions; defaults to
 *                             "wbardawil/agentic_newsletter" when run locally.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildApprovalLink } from "../utils/approval-token.js";

interface DraftAngle {
  headline: string;
  thesis: string;
  osPillar: string;
  peopleAngle?: { challenge: string; framework: string };
  quarterlyTheme: string;
}

interface DraftContent {
  language: string;
  subject: string;
  preheader: string;
  sections?: Array<{ type: string; heading: string; body: string }>;
}

interface DraftValidation {
  isValid: boolean;
  score: number;
  issues: Array<{ severity: string; section: string; message: string }>;
  recommendations: string[];
  wordCounts?: { total: number };
  shareableSentence?: string | null;
}

interface DraftJson {
  runId: string;
  editionId: string;
  angle: DraftAngle;
  enContent: DraftContent;
  esContent?: DraftContent | null;
  validation?: DraftValidation;
}

// ── Composition ──────────────────────────────────────────────────────────────

interface DigestLinks {
  prUrl: string | null;
  publishWorkflowUrl: string;
  reRunDraftUrl: string;
  /**
   * Phase-2 one-click approve link. Present only when both APPROVAL_BASE_URL
   * and APPROVAL_SIGNING_SECRET are set. When absent, the digest falls back
   * to the manual workflow_dispatch link.
   */
  approveUrl: string | null;
}

function buildLinks(
  editionId: string,
  prUrl: string | null,
  repo: string,
  approveBaseUrl: string | null,
  approveSecret: string | null,
): DigestLinks {
  const base = `https://github.com/${repo}`;
  const approveUrl =
    approveBaseUrl && approveSecret
      ? buildApprovalLink(approveBaseUrl, editionId, approveSecret)
      : null;
  return {
    prUrl,
    publishWorkflowUrl: `${base}/actions/workflows/publish-to-beehiiv.yml`,
    reRunDraftUrl: `${base}/actions/workflows/weekly-draft.yml`,
    approveUrl,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSubject(draft: DraftJson): string {
  const v = draft.validation;
  const score = v ? `${v.score}/100` : "no QA";
  const flag = v?.isValid === false ? "⚠️" : "✓";
  return `Draft — Edition ${draft.editionId} [${flag} ${score}]`;
}

export function renderDigestHtml(draft: DraftJson, links: DigestLinks): string {
  const a = draft.angle;
  const c = draft.enContent;
  const v = draft.validation;
  const recs = (v?.recommendations ?? []).slice(0, 3);

  const reviewBtn = links.prUrl
    ? `<a href="${escapeHtml(links.prUrl)}" style="display:inline-block;padding:12px 20px;background:#0F1A2B;color:#F4EFE6;text-decoration:none;border-radius:6px;font-weight:600;margin:4px 4px 4px 0;">Review draft on GitHub →</a>`
    : "";
  // When the approval Worker is configured, the primary CTA is one-click
  // approve. Fall back to the manual workflow_dispatch deep-link otherwise.
  const publishBtn = links.approveUrl
    ? `<a href="${escapeHtml(links.approveUrl)}" style="display:inline-block;padding:12px 20px;background:#C7892A;color:#0F1A2B;text-decoration:none;border-radius:6px;font-weight:700;margin:4px 4px 4px 0;">✓ Approve and publish →</a>`
    : `<a href="${escapeHtml(links.publishWorkflowUrl)}" style="display:inline-block;padding:12px 20px;background:#1F4E5F;color:#F4EFE6;text-decoration:none;border-radius:6px;font-weight:600;margin:4px 4px 4px 0;">Publish to Beehiiv when ready →</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(renderSubject(draft))}</title>
</head>
<body style="margin:0;padding:0;background:#F4EFE6;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#0F1A2B;">
<div style="max-width:640px;margin:0 auto;padding:24px 16px;">
  <p style="font-size:13px;color:#7A7466;margin:0 0 4px 0;letter-spacing:0.04em;text-transform:uppercase;">The Transformation Letter</p>
  <h1 style="font-family:'Cormorant Garamond',Garamond,serif;font-size:28px;line-height:1.2;margin:0 0 16px 0;">Draft ready — Edition ${escapeHtml(draft.editionId)}</h1>

  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-top:1px solid #C7892A;border-bottom:1px solid #C7892A;padding:12px 0;margin:16px 0;">
    <tr>
      <td style="padding:8px 0;font-size:14px;"><strong>QA score</strong></td>
      <td style="padding:8px 0;font-size:14px;text-align:right;">${v ? `${v.score}/100 ${v.isValid ? "✓ valid" : "⚠️ invalid"}` : "not run"}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;font-size:14px;"><strong>OS pillar</strong></td>
      <td style="padding:8px 0;font-size:14px;text-align:right;">${escapeHtml(a.osPillar)}</td>
    </tr>
    ${
      a.peopleAngle
        ? `<tr>
      <td style="padding:8px 0;font-size:14px;vertical-align:top;"><strong>People dimension</strong></td>
      <td style="padding:8px 0;font-size:14px;text-align:right;">${escapeHtml(a.peopleAngle.framework)}<br><span style="color:#7A7466;font-style:italic;">${escapeHtml(a.peopleAngle.challenge)}</span></td>
    </tr>`
        : ""
    }
    <tr>
      <td style="padding:8px 0;font-size:14px;"><strong>Total words</strong></td>
      <td style="padding:8px 0;font-size:14px;text-align:right;">${v?.wordCounts?.total ?? "?"}</td>
    </tr>
  </table>

  <h2 style="font-family:'Cormorant Garamond',Garamond,serif;font-size:22px;line-height:1.3;margin:24px 0 8px 0;color:#1F4E5F;">${escapeHtml(a.headline)}</h2>
  <p style="font-size:15px;line-height:1.55;color:#0F1A2B;margin:0 0 16px 0;">${escapeHtml(a.thesis)}</p>

  <p style="font-size:13px;color:#7A7466;margin:16px 0 4px 0;"><strong>Subject (EN):</strong> ${escapeHtml(c.subject)}</p>
  <p style="font-size:13px;color:#7A7466;margin:0 0 16px 0;"><strong>Preheader:</strong> ${escapeHtml(c.preheader)}</p>

  ${
    v?.shareableSentence
      ? `<blockquote style="border-left:3px solid #C7892A;padding:8px 16px;margin:16px 0;font-style:italic;color:#0F1A2B;background:#FFF;">${escapeHtml(v.shareableSentence)}</blockquote>`
      : ""
  }

  ${
    recs.length > 0
      ? `<h3 style="font-size:14px;margin:24px 0 8px 0;color:#7A7466;text-transform:uppercase;letter-spacing:0.04em;">Validator notes</h3>
  <ul style="margin:0 0 16px 0;padding-left:20px;font-size:14px;line-height:1.5;">
    ${recs.map((r) => `<li style="margin-bottom:6px;">${escapeHtml(r)}</li>`).join("")}
  </ul>`
      : ""
  }

  <div style="margin:32px 0;">
    ${reviewBtn}
    ${publishBtn}
  </div>

  <hr style="border:none;border-top:1px solid #C7892A;margin:24px 0;opacity:0.4;">
  <p style="font-size:12px;color:#7A7466;line-height:1.5;margin:0;">
    The draft is on the <code>drafts/${escapeHtml(draft.editionId)}</code> branch.
    Edit copy via the GitHub mobile editor and merge when the editorial is right.
    ${
      links.approveUrl
        ? `Tapping <strong>Approve and publish</strong> dispatches the Beehiiv publish workflow via a signed link valid for 7 days.`
        : `Publishing to Beehiiv is a deliberate manual action — tap "Publish to Beehiiv" above to open the workflow page, paste the edition ID, and tap Run.`
    }
  </p>
</div>
</body>
</html>`;
}

export function renderDigestText(draft: DraftJson, links: DigestLinks): string {
  const a = draft.angle;
  const c = draft.enContent;
  const v = draft.validation;
  const recs = (v?.recommendations ?? []).slice(0, 3);

  const lines: string[] = [];
  lines.push(`Draft ready — Edition ${draft.editionId}`);
  lines.push("");
  lines.push(
    `QA: ${v ? `${v.score}/100 (${v.isValid ? "valid" : "invalid"})` : "not run"}`,
  );
  lines.push(`OS pillar: ${a.osPillar}`);
  if (a.peopleAngle) {
    lines.push(`People: ${a.peopleAngle.framework} — ${a.peopleAngle.challenge}`);
  }
  if (v?.wordCounts) lines.push(`Total words: ${v.wordCounts.total}`);
  lines.push("");
  lines.push(`Headline: ${a.headline}`);
  lines.push(`Thesis:   ${a.thesis}`);
  lines.push("");
  lines.push(`Subject (EN): ${c.subject}`);
  lines.push(`Preheader:    ${c.preheader}`);
  if (v?.shareableSentence) {
    lines.push("");
    lines.push(`Shareable: "${v.shareableSentence}"`);
  }
  if (recs.length > 0) {
    lines.push("");
    lines.push("Validator notes:");
    for (const r of recs) lines.push(`  • ${r}`);
  }
  lines.push("");
  if (links.prUrl) lines.push(`Review:           ${links.prUrl}`);
  if (links.approveUrl) {
    lines.push(`Approve+publish:  ${links.approveUrl}`);
  } else {
    lines.push(`Publish workflow: ${links.publishWorkflowUrl}`);
  }
  lines.push("");
  lines.push("Editorial flow: edit on the PR branch via the GitHub mobile editor.");
  if (links.approveUrl) {
    lines.push("Tap Approve+publish to dispatch the Beehiiv publish workflow.");
    lines.push("The signed link is valid for 7 days.");
  } else {
    lines.push("Merge when the editorial is right. Publishing to Beehiiv stays manual");
    lines.push("until the email approval gate phase 2 is wired.");
  }
  return lines.join("\n");
}

// ── Resend ───────────────────────────────────────────────────────────────────

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export async function sendViaResend(
  apiKey: string,
  payload: ResendPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: string }> {
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Resend send failed (HTTP ${response.status}): ${text.slice(0, 500)}`,
    );
  }
  const json = (await response.json()) as { id?: string };
  if (!json.id) throw new Error("Resend response missing id field");
  return { id: json.id };
}

// ── CLI entry ────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  edition: string | undefined;
  prUrl: string | null;
  dryRun: boolean;
} {
  const get = (flag: string): string | undefined => {
    const idx = argv.findIndex((a, i) => argv[i - 1] === flag);
    return idx >= 0 ? argv[idx] : undefined;
  };
  return {
    edition: get("--edition"),
    prUrl: get("--pr-url") ?? null,
    dryRun: argv.includes("--dry-run"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args.edition) {
    console.error("Usage: pnpm digest:edition -- --edition YYYY-WW [--pr-url <url>] [--dry-run]");
    process.exit(2);
  }

  const draftPath = join(process.cwd(), "drafts", `${args.edition}-draft.json`);
  const draft = JSON.parse(readFileSync(draftPath, "utf-8")) as DraftJson;
  const repo = process.env["GITHUB_REPOSITORY"] ?? "wbardawil/agentic_newsletter";

  const approveBaseUrl = process.env["APPROVAL_BASE_URL"]?.trim() || null;
  const approveSecret = process.env["APPROVAL_SIGNING_SECRET"]?.trim() || null;
  if ((approveBaseUrl && !approveSecret) || (!approveBaseUrl && approveSecret)) {
    console.warn(
      "APPROVAL_BASE_URL and APPROVAL_SIGNING_SECRET must both be set to enable one-click approval. Falling back to the manual workflow_dispatch link.",
    );
  }
  const links = buildLinks(
    args.edition,
    args.prUrl,
    repo,
    approveBaseUrl,
    approveSecret,
  );

  const subject = renderSubject(draft);
  const html = renderDigestHtml(draft, links);
  const text = renderDigestText(draft, links);

  if (args.dryRun) {
    console.log(`Subject: ${subject}\n`);
    console.log(text);
    return;
  }

  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM"];
  const to = process.env["RESEND_TO"];
  if (!apiKey || !from || !to) {
    console.error(
      "Missing required env vars: RESEND_API_KEY, RESEND_FROM, RESEND_TO. " +
        "Use --dry-run to preview without sending.",
    );
    process.exit(1);
  }

  const result = await sendViaResend(apiKey, {
    from,
    to: [to],
    subject,
    html,
    text,
  });
  console.log(`Digest sent. Resend id: ${result.id}`);
}

const isCli =
  process.argv[1] && process.argv[1].endsWith("send-draft-digest.ts");
if (isCli) {
  main().catch((err) => {
    console.error("send-draft-digest failed:", err);
    process.exit(1);
  });
}
