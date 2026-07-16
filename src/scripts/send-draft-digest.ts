/**
 * Send a draft digest email to the editor via Resend.
 *
 * Composes a phone-friendly HTML+text email from drafts/<edition>-draft.json,
 * including:
 *   - Hero image preview + approve/reject image buttons (if designer ran)
 *   - Edition metadata, Validator score, OS pillar, People dimension
 *   - Subject + preheader, headline + thesis, top recommendations
 *   - Approve/reject article buttons + per-section rejection links
 *   - Deep links to GitHub PR and portal editor
 *
 * Usage:
 *   pnpm digest:edition -- --edition 2026-18
 *   pnpm digest:edition -- --edition 2026-18 --pr-url <url>
 *   pnpm digest:edition -- --edition 2026-18 --portal-base-url <url>
 *   pnpm digest:edition -- --edition 2026-18 --dry-run
 *
 * Required env vars (live mode):
 *   RESEND_API_KEY, RESEND_FROM, RESEND_TO
 *
 * Optional env vars:
 *   PORTAL_BASE_URL         — portal origin for "Edit in portal" deep-link
 *   APPROVAL_BASE_URL       — portal origin for review/approve links (/review, /approve)
 *   APPROVAL_SIGNING_SECRET — HMAC secret shared with portal
 */

import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildApprovalLink, buildReviewLink } from "../utils/approval-token.js";

// ── Interfaces ────────────────────────────────────────────────────────────────

interface DraftAngle {
  headline: string;
  thesis: string;
  osPillar: string;
  peopleAngle?: { challenge: string; framework: string };
  quarterlyTheme: string;
}

interface DraftSection {
  type: string;
  heading?: string;
  body: string;
}

interface DraftContent {
  language: string;
  subject: string;
  preheader: string;
  sections?: DraftSection[];
}

interface DraftValidation {
  isValid: boolean;
  score: number;
  issues: Array<{ severity: string; section: string; message: string }>;
  recommendations: string[];
  wordCounts?: { total: number };
  shareableSentence?: string | null;
}

interface DesignerAssetJson {
  kind: "hero";
  imagePath: string;
  publicUrl: string | null;
  prompt: string;
  altText: { en: string; es: string };
  caption: { en: string; es: string };
  attempt: number;
}

interface DesignerJson {
  assets: DesignerAssetJson[];
  imageModel: string;
}

interface ReviewJson {
  image: {
    status: string;
    attempt: number;
    assetPath: string | null;
    publicUrl: string | null;
  };
  content: { status: string };
}

interface DraftJson {
  runId: string;
  editionId: string;
  angle: DraftAngle;
  enContent: DraftContent;
  esContent?: DraftContent | null;
  validation?: DraftValidation;
  designer?: DesignerJson | null;
  review?: ReviewJson | null;
}

// ── Links ─────────────────────────────────────────────────────────────────────

export interface DigestLinks {
  prUrl: string | null;
  publishWorkflowUrl: string;
  reRunDraftUrl: string;
  /**
   * Legacy one-click approve link (decision: "approve").
   * Used when image/content review links are unavailable (backward compat).
   */
  approveUrl: string | null;
  editorUrl: string | null;
  /** New granular review links — present when APPROVAL_BASE_URL + SECRET are set. */
  imageApproveUrl?: string | null;
  imageRejectUrl?: string | null;
  contentApproveUrl?: string | null;
  contentRejectUrl?: string | null;
  sectionRejectUrls?: Record<string, string>;
}

const SECTION_LABELS: Record<string, string> = {
  lead: "Apertura",
  analysis: "Insight",
  spotlight: "Field Report",
  tool: "Tool",
  quickTakes: "Compass / Brújula",
  cta: "Door / Puerta",
};

function buildLinks(
  editionId: string,
  prUrl: string | null,
  repo: string,
  approveBaseUrl: string | null,
  approveSecret: string | null,
  portalBaseUrl: string | null,
): DigestLinks {
  const base = `https://github.com/${repo}`;

  // Legacy one-click approve (backward compat for old Worker endpoint)
  const approveUrl =
    approveBaseUrl && approveSecret
      ? buildApprovalLink(approveBaseUrl, editionId, approveSecret)
      : null;

  const editorUrl = portalBaseUrl
    ? `${portalBaseUrl.replace(/\/+$/, "")}/admin/drafts/${editionId}/edit`
    : null;

  // New granular review links
  let imageApproveUrl: string | null = null;
  let imageRejectUrl: string | null = null;
  let contentApproveUrl: string | null = null;
  let contentRejectUrl: string | null = null;
  const sectionRejectUrls: Record<string, string> = {};

  if (approveBaseUrl && approveSecret) {
    const reviewBase = { editionId, ttlSeconds: 7 * 24 * 60 * 60 };
    imageApproveUrl = buildReviewLink(approveBaseUrl, { ...reviewBase, decision: "image_approve" }, approveSecret);
    imageRejectUrl = buildReviewLink(approveBaseUrl, { ...reviewBase, decision: "image_reject" }, approveSecret);
    contentApproveUrl = buildReviewLink(approveBaseUrl, { ...reviewBase, decision: "content_approve" }, approveSecret);
    contentRejectUrl = buildReviewLink(approveBaseUrl, { ...reviewBase, decision: "content_reject" }, approveSecret);
    for (const sectionType of Object.keys(SECTION_LABELS)) {
      sectionRejectUrls[sectionType] = buildReviewLink(
        approveBaseUrl,
        { ...reviewBase, decision: "section_reject", sectionType },
        approveSecret,
      );
    }
  }

  return {
    prUrl,
    publishWorkflowUrl: `${base}/actions/workflows/publish-to-beehiiv.yml`,
    reRunDraftUrl: `${base}/actions/workflows/weekly-draft.yml`,
    approveUrl,
    editorUrl,
    imageApproveUrl,
    imageRejectUrl,
    contentApproveUrl,
    contentRejectUrl,
    sectionRejectUrls,
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

// ── Image block (rendered before the headline) ────────────────────────────────

function renderImageBlockHtml(
  designer: DesignerJson,
  links: DigestLinks,
  hasAttachment: boolean,
): string {
  const heroAsset = designer.assets[0];
  if (!heroAsset) return "";

  const attempt = heroAsset.attempt ?? 1;
  const publicUrl = heroAsset.publicUrl;

  const imgTag = publicUrl
    ? `<img src="${escapeHtml(publicUrl)}" alt="${escapeHtml(heroAsset.altText.en)}" style="width:100%;height:auto;border-radius:4px;display:block;margin:8px 0;">`
    : hasAttachment
    ? `<p style="font-size:13px;color:#7A7466;font-style:italic;margin:8px 0;">📎 Hero image adjunta en este correo.</p>`
    : "";

  const imageApproveBtn =
    links.imageApproveUrl
      ? `<a href="${escapeHtml(links.imageApproveUrl)}" style="display:inline-block;padding:10px 16px;background:#1F7A4A;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px;margin:4px 4px 4px 0;">✓ Aprobar imagen</a>`
      : "";
  const imageRejectBtn =
    links.imageRejectUrl
      ? `<a href="${escapeHtml(links.imageRejectUrl)}" style="display:inline-block;padding:10px 16px;background:#9B2335;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px;margin:4px 4px 4px 0;">✗ Rechazar imagen</a>`
      : "";

  return `
  <div style="background:#fff;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #C7892A;">
    <p style="font-size:11px;color:#7A7466;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:0.06em;">
      Hero image · ${escapeHtml(designer.imageModel)} · Intento ${attempt}
    </p>
    ${imgTag}
    <p style="font-size:13px;line-height:1.5;color:#0F1A2B;margin:8px 0 2px 0;font-style:italic;">${escapeHtml(heroAsset.caption.en)}</p>
    <p style="font-size:13px;line-height:1.5;color:#7A7466;margin:0 0 12px 0;font-style:italic;">${escapeHtml(heroAsset.caption.es)}</p>
    <div>${imageApproveBtn}${imageRejectBtn}</div>
  </div>`;
}

// ── Content action block ──────────────────────────────────────────────────────

function renderContentActionsHtml(
  draft: DraftJson,
  links: DigestLinks,
): string {
  if (!links.contentApproveUrl && !links.contentRejectUrl) return "";

  const contentApproveBtn =
    links.contentApproveUrl
      ? `<a href="${escapeHtml(links.contentApproveUrl)}" style="display:inline-block;padding:10px 16px;background:#C7892A;color:#0F1A2B;text-decoration:none;border-radius:6px;font-weight:700;font-size:14px;margin:4px 4px 4px 0;">✓ Aprobar artículo</a>`
      : "";
  const contentRejectBtn =
    links.contentRejectUrl
      ? `<a href="${escapeHtml(links.contentRejectUrl)}" style="display:inline-block;padding:10px 16px;background:#7A7466;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;margin:4px 4px 4px 0;">✗ Rechazar artículo</a>`
      : "";

  // Section-level reject links — only for sections that exist in the draft
  const existingSections = new Set(
    (draft.enContent.sections ?? []).map((s) => s.type),
  );
  const sectionBtns = Object.entries(SECTION_LABELS)
    .filter(([type]) => existingSections.has(type) && links.sectionRejectUrls?.[type])
    .map(
      ([type, label]) =>
        `<a href="${escapeHtml(links.sectionRejectUrls![type]!)}" style="display:inline-block;padding:6px 12px;background:#E8E2DA;color:#0F1A2B;text-decoration:none;border-radius:4px;font-size:12px;margin:3px 3px 3px 0;">✗ ${escapeHtml(label)}</a>`,
    )
    .join("");

  const sectionBlock =
    sectionBtns
      ? `<p style="font-size:12px;color:#7A7466;margin:12px 0 4px 0;text-transform:uppercase;letter-spacing:0.04em;">Rechazar sección específica</p>
    <div>${sectionBtns}</div>`
      : "";

  return `
  <div style="background:#FFF8F0;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #C7892A;">
    <p style="font-size:12px;color:#7A7466;margin:0 0 10px 0;text-transform:uppercase;letter-spacing:0.04em;">Decisiones sobre el artículo</p>
    <div>${contentApproveBtn}${contentRejectBtn}</div>
    ${sectionBlock}
  </div>`;
}

// ── Main HTML renderer ────────────────────────────────────────────────────────

export function renderDigestHtml(
  draft: DraftJson,
  links: DigestLinks,
  options?: { hasAttachment?: boolean },
): string {
  const a = draft.angle;
  const c = draft.enContent;
  const v = draft.validation;
  const recs = (v?.recommendations ?? []).slice(0, 3);
  const hasAttachment = options?.hasAttachment ?? false;

  // ── Image block (before headline) ──
  const hasReviewLinks = !!(links.imageApproveUrl || links.imageRejectUrl);
  const imageBlock =
    draft.designer && hasReviewLinks
      ? renderImageBlockHtml(draft.designer, links, hasAttachment)
      : "";

  // ── Content action block ──
  const contentActionsBlock = renderContentActionsHtml(draft, links);

  // Brand system (Wadi Bardawil): gunmetal #222831 canvas, panel #2C333E,
  // orange #FD4002 reserved for the one primary action. Inline styles + solid
  // hex throughout — email clients ignore <style> blocks and rgba is unreliable.
  const reviewBtn = links.prUrl
    ? `<a href="${escapeHtml(links.prUrl)}" style="display:inline-block;padding:12px 20px;background:#2C333E;color:#FFFFFF;text-decoration:none;border-radius:11px;border:1px solid #4E5866;font-weight:600;margin:4px 4px 4px 0;">Review draft on GitHub →</a>`
    : "";
  const editBtn = links.editorUrl
    ? `<a href="${escapeHtml(links.editorUrl)}" style="display:inline-block;padding:12px 20px;background:#2C333E;color:#FFFFFF;text-decoration:none;border-radius:11px;border:1px solid #4E5866;font-weight:600;margin:4px 4px 4px 0;">Edit in portal →</a>`
    : "";

  // When the new review system is in place (imageApproveUrl set), the
  // content decision block above replaces the old "Approve and publish" CTA.
  // Fall back to old button when no review links are configured.
  const publishBtn = !links.imageApproveUrl
    ? links.approveUrl
      ? `<a href="${escapeHtml(links.approveUrl)}" style="display:inline-block;padding:12px 20px;background:#FD4002;color:#FFFFFF;text-decoration:none;border-radius:11px;font-weight:700;margin:4px 4px 4px 0;">✓ Approve and publish →</a>`
      : `<a href="${escapeHtml(links.publishWorkflowUrl)}" style="display:inline-block;padding:12px 20px;background:#2C333E;color:#FFFFFF;text-decoration:none;border-radius:11px;border:1px solid #4E5866;font-weight:600;margin:4px 4px 4px 0;">Publish to Beehiiv when ready →</a>`
    : "";

  const displayFont = "Archivo,'Segoe UI',Arial,sans-serif";
  const bodyFont = "Manrope,'Segoe UI',Arial,sans-serif";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(renderSubject(draft))}</title>
</head>
<body style="margin:0;padding:0;background:#14171D;font-family:${bodyFont};color:#D3D9E1;">
<div style="max-width:640px;margin:0 auto;padding:24px 16px;background:#222831;">
  <p style="font-size:12px;color:#FD4002;margin:0 0 6px 0;letter-spacing:3px;text-transform:uppercase;font-weight:700;">The Transformation Letter</p>
  <div style="width:40px;height:4px;background:#FD4002;margin:0 0 14px 0;"></div>
  <h1 style="font-family:${displayFont};font-size:26px;font-weight:800;line-height:1.15;letter-spacing:-0.2px;margin:0 0 16px 0;color:#FFFFFF;">Draft ready — Edition ${escapeHtml(draft.editionId)}</h1>

  ${imageBlock}

  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-top:1px solid #4E5866;border-bottom:1px solid #4E5866;padding:12px 0;margin:16px 0;">
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#FFFFFF;"><strong>QA score</strong></td>
      <td style="padding:8px 0;font-size:14px;text-align:right;color:#D3D9E1;">${v ? `${v.score}/100 ${v.isValid ? "✓ valid" : "⚠️ invalid"}` : "not run"}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#FFFFFF;"><strong>OS pillar</strong></td>
      <td style="padding:8px 0;font-size:14px;text-align:right;color:#D3D9E1;">${escapeHtml(a.osPillar)}</td>
    </tr>
    ${
      a.peopleAngle
        ? `<tr>
      <td style="padding:8px 0;font-size:14px;vertical-align:top;color:#FFFFFF;"><strong>People dimension</strong></td>
      <td style="padding:8px 0;font-size:14px;text-align:right;color:#D3D9E1;">${escapeHtml(a.peopleAngle.framework)}<br><span style="color:#AEB6C2;font-style:italic;">${escapeHtml(a.peopleAngle.challenge)}</span></td>
    </tr>`
        : ""
    }
    <tr>
      <td style="padding:8px 0;font-size:14px;color:#FFFFFF;"><strong>Total words</strong></td>
      <td style="padding:8px 0;font-size:14px;text-align:right;color:#D3D9E1;">${v?.wordCounts?.total ?? "?"}</td>
    </tr>
  </table>

  <h2 style="font-family:${displayFont};font-size:21px;font-weight:800;line-height:1.25;letter-spacing:-0.2px;margin:24px 0 8px 0;color:#FFFFFF;">${escapeHtml(a.headline)}</h2>
  <p style="font-size:15px;line-height:1.55;color:#D3D9E1;margin:0 0 16px 0;">${escapeHtml(a.thesis)}</p>

  <p style="font-size:13px;color:#AEB6C2;margin:16px 0 4px 0;"><strong style="color:#FFFFFF;">Subject (EN):</strong> ${escapeHtml(c.subject)}</p>
  <p style="font-size:13px;color:#AEB6C2;margin:0 0 16px 0;"><strong style="color:#FFFFFF;">Preheader:</strong> ${escapeHtml(c.preheader)}</p>

  ${
    v?.shareableSentence
      ? `<blockquote style="border-left:3px solid #FD4002;padding:10px 16px;margin:16px 0;font-style:italic;color:#D3D9E1;background:#2C333E;border-radius:0 11px 11px 0;">${escapeHtml(v.shareableSentence)}</blockquote>`
      : ""
  }

  ${
    recs.length > 0
      ? `<h3 style="font-size:12px;margin:24px 0 8px 0;color:#FD4002;text-transform:uppercase;letter-spacing:2px;font-weight:700;">Validator notes</h3>
  <ul style="margin:0 0 16px 0;padding-left:20px;font-size:14px;line-height:1.5;color:#D3D9E1;">
    ${recs.map((r) => `<li style="margin-bottom:6px;">${escapeHtml(r)}</li>`).join("")}
  </ul>`
      : ""
  }

  ${contentActionsBlock}

  <div style="margin:32px 0;">
    ${reviewBtn}
    ${editBtn}
    ${publishBtn}
  </div>

  <hr style="border:none;border-top:1px solid #4E5866;margin:24px 0;">
  <p style="font-size:12px;color:#8A93A0;line-height:1.5;margin:0;">
    The draft is on the <code>drafts/${escapeHtml(draft.editionId)}</code> branch.
    ${
      links.editorUrl
        ? `Use <strong>Edit in portal</strong> for a side-by-side EN/ES surface that commits directly to the branch, or the GitHub mobile editor for quick tweaks.`
        : `Edit copy via the GitHub mobile editor and merge when the editorial is right.`
    }
    ${
      links.imageApproveUrl
        ? `Review the hero image first, then approve the article. Both approvals are required to publish. Signed links valid for 7 days.`
        : links.approveUrl
        ? `Tapping <strong style="color:#AEB6C2;">Approve and publish</strong> dispatches the Beehiiv publish workflow via a signed link valid for 7 days.`
        : `Publishing to Beehiiv is a deliberate manual action — tap "Publish to Beehiiv" above to open the workflow page, paste the edition ID, and tap Run.`
    }
  </p>
</div>
</body>
</html>`;
}

// ── Text renderer ─────────────────────────────────────────────────────────────

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

  if (draft.designer?.assets[0]) {
    const asset = draft.designer.assets[0];
    lines.push("");
    lines.push(`--- Hero image (intento ${asset.attempt ?? 1}) · ${draft.designer.imageModel} ---`);
    if (asset.publicUrl) lines.push(`Preview: ${asset.publicUrl}`);
    lines.push(`Caption EN: ${asset.caption.en}`);
    lines.push(`Caption ES: ${asset.caption.es}`);
    if (links.imageApproveUrl) lines.push(`Aprobar imagen:   ${links.imageApproveUrl}`);
    if (links.imageRejectUrl) lines.push(`Rechazar imagen:  ${links.imageRejectUrl}`);
  }

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
  if (links.contentApproveUrl) lines.push(`Aprobar artículo:  ${links.contentApproveUrl}`);
  if (links.contentRejectUrl) lines.push(`Rechazar artículo: ${links.contentRejectUrl}`);
  if (links.sectionRejectUrls && Object.keys(links.sectionRejectUrls).length > 0) {
    lines.push("Rechazar sección:");
    for (const [type, url] of Object.entries(links.sectionRejectUrls)) {
      const label = SECTION_LABELS[type] ?? type;
      lines.push(`  ${label}: ${url}`);
    }
  }
  lines.push("");
  if (links.prUrl) lines.push(`Review:           ${links.prUrl}`);
  if (links.editorUrl) lines.push(`Edit in portal:   ${links.editorUrl}`);
  if (!links.imageApproveUrl) {
    if (links.approveUrl) {
      lines.push(`Approve+publish:  ${links.approveUrl}`);
    } else {
      lines.push(`Publish workflow: ${links.publishWorkflowUrl}`);
    }
  }
  lines.push("");
  lines.push("Editorial flow: edit on the PR branch via the GitHub mobile editor.");
  if (links.imageApproveUrl) {
    lines.push("Approve the hero image first, then approve the article.");
    lines.push("Both approvals are required to publish. Signed links valid for 7 days.");
  } else if (links.approveUrl) {
    lines.push("Tap Approve+publish to dispatch the Beehiiv publish workflow.");
    lines.push("The signed link is valid for 7 days.");
  } else {
    lines.push("Merge when the editorial is right. Publishing to Beehiiv stays manual");
    lines.push("until the email approval gate phase 2 is wired.");
  }
  return lines.join("\n");
}

// ── Resend ────────────────────────────────────────────────────────────────────

interface ResendAttachment {
  filename: string;
  /** Base64-encoded file content. */
  content: string;
  contentType: string;
}

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: ResendAttachment[];
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

// ── CLI entry ─────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  edition: string | undefined;
  prUrl: string | null;
  portalBaseUrl: string | null;
  dryRun: boolean;
} {
  const get = (flag: string): string | undefined => {
    const idx = argv.findIndex((a, i) => argv[i - 1] === flag);
    return idx >= 0 ? argv[idx] : undefined;
  };
  return {
    edition: get("--edition"),
    prUrl: get("--pr-url") ?? null,
    portalBaseUrl: get("--portal-base-url") ?? null,
    dryRun: argv.includes("--dry-run"),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args.edition) {
    console.error("Usage: pnpm digest:edition -- --edition YYYY-WW [--pr-url <url>] [--dry-run]");
    process.exit(2);
  }
  const edition = args.edition;
  const draftsDir = join(process.cwd(), "drafts");

  // Load draft JSON
  const draftPath = join(draftsDir, `${edition}-draft.json`);
  const draft = JSON.parse(readFileSync(draftPath, "utf-8")) as DraftJson;

  // Load designer JSON if available
  const designerPath = join(draftsDir, `${edition}-designer.json`);
  if (!draft.designer && existsSync(designerPath)) {
    try {
      draft.designer = JSON.parse(readFileSync(designerPath, "utf-8")) as DesignerJson;
    } catch {
      // non-fatal
    }
  }

  // Load review JSON if available
  const reviewPath = join(draftsDir, `${edition}-review.json`);
  if (!draft.review && existsSync(reviewPath)) {
    try {
      draft.review = JSON.parse(readFileSync(reviewPath, "utf-8")) as ReviewJson;
    } catch {
      // non-fatal
    }
  }

  const repo = process.env["GITHUB_REPOSITORY"] ?? "wbardawil/agentic_newsletter";
  const approveBaseUrl = process.env["APPROVAL_BASE_URL"]?.trim() || null;
  const approveSecret = process.env["APPROVAL_SIGNING_SECRET"]?.trim() || null;
  if ((approveBaseUrl && !approveSecret) || (!approveBaseUrl && approveSecret)) {
    console.warn(
      "APPROVAL_BASE_URL and APPROVAL_SIGNING_SECRET must both be set to enable one-click approval.",
    );
  }
  const portalBaseUrl =
    args.portalBaseUrl ?? (process.env["PORTAL_BASE_URL"]?.trim() || null);
  const links = buildLinks(
    edition,
    args.prUrl,
    repo,
    approveBaseUrl,
    approveSecret,
    portalBaseUrl,
  );

  // Try to load local PNG for attachment
  const heroAsset = draft.designer?.assets[0];
  const attachments: ResendAttachment[] = [];
  if (heroAsset?.imagePath && existsSync(heroAsset.imagePath) && !heroAsset.imagePath.endsWith(".dryrun.txt")) {
    try {
      const imageBuffer = readFileSync(heroAsset.imagePath);
      const filename = `${edition}-hero.png`;
      attachments.push({
        filename,
        content: imageBuffer.toString("base64"),
        contentType: "image/png",
      });
    } catch {
      // non-fatal
    }
  }

  const subject = renderSubject(draft);
  const html = renderDigestHtml(draft, links, { hasAttachment: attachments.length > 0 });
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
    ...(attachments.length > 0 ? { attachments } : {}),
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
