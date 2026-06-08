/**
 * Image regeneration pipeline — CLI entry point.
 *
 * Triggered by the portal /review endpoint when the editor rejects an image.
 * Runs only the DesignerAgent (not the full draft pipeline) using the existing
 * draft content and the rejection history from review.json.
 *
 * Usage:
 *   pnpm regenerate-image -- --edition 2026-21
 *   pnpm regenerate-image -- --edition 2026-21 --feedback "Too abstract"
 *
 * Required env:
 *   ANTHROPIC_API_KEY   — Claude for prompt composition + alt-text/caption
 *   GEMINI_API_KEY      — Gemini for image generation
 *
 * Optional env:
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — upload to Storage for publicUrl
 *   MAX_IMAGE_REGEN_ATTEMPTS                 — default 5
 *   GITHUB_TOKEN + GITHUB_REPOSITORY        — create issue when limit exceeded
 *   RESEND_*                                 — resend digest after regeneration
 *   APPROVAL_BASE_URL + APPROVAL_SIGNING_SECRET — sign links in resent digest
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AppConfigSchema } from "./types/config.js";
import { EditionIdSchema } from "./types/enums.js";
import { createLogger } from "./utils/logger.js";
import { createCostTracker } from "./utils/cost-tracker.js";
import { createApiClients } from "./utils/api-clients.js";
import type { AgentDeps } from "./agents/base-agent.js";
import { DesignerAgent } from "./agents/designer.js";
import { StrategicAngleSchema, LocalizedContentSchema } from "./types/edition.js";
import { ReviewStateSchema } from "./types/review.js";
import {
  loadReview,
  saveReview,
  updateImageInReview,
} from "./utils/review-state.js";
import { createImageRegenLimitIssue } from "./utils/github-issues.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { edition: string | undefined; feedback: string | null } {
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  return {
    edition: get("--edition"),
    feedback: get("--feedback") ?? null,
  };
}

function maxImageRegenAttempts(): number {
  const raw = Number(process.env["MAX_IMAGE_REGEN_ATTEMPTS"]);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!args.edition) {
    console.error("Usage: pnpm regenerate-image -- --edition YYYY-WW [--feedback '<reason>']");
    process.exit(2);
  }

  try {
    EditionIdSchema.parse(args.edition);
  } catch {
    console.error(`❌ Invalid --edition value: "${args.edition}". Expected format: YYYY-WW`);
    process.exit(1);
  }

  const editionId = args.edition;
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const draftsDir = join(rootDir, "drafts");

  console.log(`\n🖼️  The Transformation Letter — Image Regeneration`);
  console.log(`   Edition: ${editionId}`);
  console.log(`   Time:    ${new Date().toISOString()}\n`);

  // ── Load config ──────────────────────────────────────────────────────────────
  const config = AppConfigSchema.parse({
    anthropicApiKey: process.env["ANTHROPIC_API_KEY"],
    geminiApiKey: process.env["GEMINI_API_KEY"],
    supabaseUrl: process.env["SUPABASE_URL"],
    supabaseServiceRoleKey: process.env["SUPABASE_SERVICE_ROLE_KEY"],
    logLevel: process.env["LOG_LEVEL"],
    dryRun: process.env["DRY_RUN"] === "true",
  });

  const logger = createLogger(config.logLevel);
  const costTracker = createCostTracker();
  const apiClients = createApiClients(config);
  const deps: AgentDeps = { logger, costTracker, apiClients };
  const runId = randomUUID();

  // ── Load draft.json ──────────────────────────────────────────────────────────
  const draftPath = join(draftsDir, `${editionId}-draft.json`);
  if (!existsSync(draftPath)) {
    console.error(`❌ Draft not found: ${draftPath}`);
    process.exit(1);
  }
  const draftRaw = JSON.parse(readFileSync(draftPath, "utf-8"));
  const angle = StrategicAngleSchema.parse(draftRaw.angle);
  const enContent = LocalizedContentSchema.parse(draftRaw.enContent);

  // ── Load review.json ─────────────────────────────────────────────────────────
  const currentReview = loadReview(draftsDir, editionId);
  if (!currentReview) {
    console.error(`❌ No review.json found for ${editionId}. Run pnpm draft first.`);
    process.exit(1);
  }

  const currentAttempt = currentReview.image.attempt;
  const nextAttempt = currentAttempt + 1;
  const max = maxImageRegenAttempts();

  // ── Check limit ──────────────────────────────────────────────────────────────
  if (currentAttempt >= max) {
    console.error(
      `❌ Image regen limit reached for ${editionId}: attempt ${currentAttempt}/${max}.\n` +
      `   A human editor must intervene. Attempting to create GitHub issue...`,
    );
    const token = process.env["GITHUB_TOKEN"];
    const repo = process.env["GITHUB_REPOSITORY"] ?? process.env["GITHUB_REPO"] ?? "";
    if (token && repo) {
      await createImageRegenLimitIssue(repo, token, editionId, currentAttempt, max);
    }
    process.exit(1);
  }

  console.log(`   Attempt: ${nextAttempt}/${max}`);
  if (args.feedback) console.log(`   Feedback: "${args.feedback}"`);
  if (currentReview.image.rejectedPrompts.length > 0) {
    console.log(`   Rejected prompts: ${currentReview.image.rejectedPrompts.length}`);
  }

  // ── Run Designer ─────────────────────────────────────────────────────────────
  console.log("\n🎨 Designer: composing new hero image...");
  mkdirSync(draftsDir, { recursive: true });

  const designerAgent = new DesignerAgent(deps);
  const designerOutput = await designerAgent.run({
    runId,
    editionId,
    agentName: "designer",
    payload: {
      angle,
      enContent,
      outputDir: draftsDir,
      heroFilename: `${editionId}-hero.png`,
      attempt: nextAttempt,
      rejectionFeedback: args.feedback ?? currentReview.image.rejectionReason ?? undefined,
      rejectedPrompts: currentReview.image.rejectedPrompts,
    },
  });

  if (!designerOutput.success) {
    console.error(`❌ Designer failed: ${designerOutput.error}`);
    process.exit(1);
  }

  const designer = designerOutput.data;
  const heroAsset = designer.assets[0]!;
  console.log(`   ✓ Generated asset (${designer.imageModel})`);
  console.log(`     hero: ${heroAsset.imagePath}`);
  if (heroAsset.publicUrl) console.log(`     url:  ${heroAsset.publicUrl}`);

  // ── Save designer.json (versioned) ──────────────────────────────────────────
  const designerJsonPath = join(draftsDir, `${editionId}-designer.json`);
  writeFileSync(designerJsonPath, JSON.stringify(designer, null, 2), "utf-8");

  // ── Update review.json ───────────────────────────────────────────────────────
  const rejectionNote = args.feedback ?? currentReview.image.rejectionReason ?? null;
  const updatedReview = updateImageInReview(currentReview, "pending", {
    assetPath: heroAsset.imagePath,
    publicUrl: heroAsset.publicUrl,
    prompt: heroAsset.prompt,
    attempt: nextAttempt,
    ...(rejectionNote ? { rejectionReason: rejectionNote } : {}),
  });
  saveReview(draftsDir, updatedReview);
  console.log(`\n   ✓ review.json updated (image.attempt: ${nextAttempt}, status: pending)`);

  // ── Cost summary ─────────────────────────────────────────────────────────────
  const cost = costTracker.getCurrentCost();
  console.log(`\n💰 Cost: $${cost.costUsd.toFixed(4)}`);
  console.log(`\n✅ Done — new hero image at attempt ${nextAttempt}. Digest will be resent by the workflow.\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
