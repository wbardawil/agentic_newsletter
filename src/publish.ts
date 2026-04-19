/**
 * Publish pipeline — CLI entry point.
 *
 * Usage:
 *   pnpm publish:edition                         (publishes latest draft as Beehiiv drafts)
 *   pnpm publish:edition --edition 2026-17       (specific edition)
 *   pnpm publish:edition --schedule 2026-04-22T09:00:00Z
 *   pnpm publish:edition --metrics               (collect stats for a previously sent edition)
 *
 * Requires drafts/YYYY-WW-draft.json produced by `pnpm draft`.
 * Runs: Distributor → Amplifier → (optional) Analyst
 * Saves: drafts/YYYY-WW-social.json + drafts/YYYY-WW-metrics.json
 */

import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AppConfigSchema } from "./types/config.js";
import { getCurrentEditionId } from "./utils/edition-id.js";
import { createLogger } from "./utils/logger.js";
import { createCostTracker } from "./utils/cost-tracker.js";
import { createApiClients } from "./utils/api-clients.js";
import type { AgentDeps } from "./agents/base-agent.js";
import { DistributorAgent } from "./agents/distributor.js";
import { AmplifierAgent } from "./agents/amplifier.js";
import { AnalystAgent } from "./agents/analyst.js";
import {
  LocalizedContentSchema,
  StrategicAngleSchema,
  ValidationResultSchema,
  DistributionRecordSchema,
  type LocalizedContent,
  type StrategicAngle,
  type DistributionRecord,
} from "./types/edition.js";
import { EditionIdSchema } from "./types/enums.js";
import { z } from "zod";
import type { SocialPost } from "./agents/amplifier.js";

// ── helpers ──────────────────────────────────────────────────────────────────

interface DraftJson {
  runId: string;
  editionId: string;
  /** SHA-256 hex of enMdContent + esMdContent — set by run.ts, verified here. */
  contentHash?: string;
  angle: unknown;
  enContent: unknown;
  esContent: unknown;
  validation?: unknown;
}

function loadDraft(
  draftsDir: string,
  editionId: string,
): {
  runId: string;
  angle: StrategicAngle;
  enContent: LocalizedContent;
  esContent: LocalizedContent | null;
  shareableSentence: string | null;
} {
  const jsonPath = join(draftsDir, `${editionId}-draft.json`);
  if (!existsSync(jsonPath)) {
    throw new Error(
      `Draft not found: ${jsonPath}\nRun \`pnpm draft\` first to generate the draft.`,
    );
  }

  const raw = JSON.parse(readFileSync(jsonPath, "utf-8")) as DraftJson;

  // Verify the markdown files haven't been corrupted or swapped since draft generation
  if (raw.contentHash) {
    const enMdPath = join(draftsDir, `${editionId}-en.md`);
    const esMdPath = join(draftsDir, `${editionId}-es.md`);
    const enMd = existsSync(enMdPath) ? readFileSync(enMdPath, "utf-8") : "";
    const esMd = existsSync(esMdPath) ? readFileSync(esMdPath, "utf-8") : "";
    const actualHash = createHash("sha256").update(enMd + esMd).digest("hex");
    if (actualHash !== raw.contentHash) {
      throw new Error(
        `Draft content integrity check failed for edition ${editionId}.\n` +
        "The markdown files may have been edited after the draft was generated.\n" +
        "Re-run `pnpm draft` to regenerate, or delete the .md files and re-run.",
      );
    }
  }

  const angle = StrategicAngleSchema.parse(raw.angle);
  const enContent = LocalizedContentSchema.parse(raw.enContent);
  const esContent = raw.esContent
    ? LocalizedContentSchema.parse(raw.esContent)
    : null;

  let shareableSentence: string | null = null;
  if (raw.validation) {
    try {
      const v = ValidationResultSchema.parse(raw.validation);
      shareableSentence = v.shareableSentence;
    } catch {
      // validation data missing or invalid — not fatal
    }
  }

  return { runId: raw.runId, angle, enContent, esContent, shareableSentence };
}

function formatSocialPosts(posts: SocialPost[]): string {
  const linkedin = posts.filter((p) => p.platform === "linkedin");
  const twitter = posts.filter((p) => p.platform === "twitter");
  const lines: string[] = [];

  lines.push("# Social Posts\n");

  lines.push("## LinkedIn\n");
  for (const [i, post] of linkedin.entries()) {
    lines.push(`### Post ${i + 1}${post.angle ? ` — ${post.angle}` : ""}\n`);
    lines.push(post.content);
    lines.push("");
  }

  lines.push("## X / Twitter\n");
  for (const [i, post] of twitter.entries()) {
    lines.push(`### Tweet ${i + 1} (${post.content.length} chars)\n`);
    lines.push(post.content);
    lines.push("");
  }

  return lines.join("\n");
}

// Graceful shutdown on SIGTERM/SIGINT (e.g. docker stop, Ctrl-C)
let _shuttingDown = false;
const _shutdown = (signal: string) => {
  if (_shuttingDown) return;
  _shuttingDown = true;
  console.error(`\n${signal} received — shutting down gracefully...`);
  process.exit(130);
};
process.on("SIGTERM", () => _shutdown("SIGTERM"));
process.on("SIGINT", () => _shutdown("SIGINT"));

// ── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv;
  const editionArg = args.find((a, i) => args[i - 1] === "--edition");
  const scheduleArg = args.find((a, i) => args[i - 1] === "--schedule");
  const metricsOnly = args.includes("--metrics");

  if (editionArg) {
    try {
      EditionIdSchema.parse(editionArg);
    } catch {
      console.error(`❌ Invalid --edition value: "${editionArg}". Expected format: YYYY-WW (e.g. 2026-17)`);
      process.exit(1);
    }
  }

  const config = AppConfigSchema.parse({
    anthropicApiKey: process.env["ANTHROPIC_API_KEY"],
    beehiivApiKey: process.env["BEEHIIV_API_KEY"],
    beehiivPublicationId: process.env["BEEHIIV_PUBLICATION_ID"],
    feedlyApiKey: process.env["FEEDLY_API_KEY"],
    linkedinAccessToken: process.env["LINKEDIN_ACCESS_TOKEN"],
    twitterApiKey: process.env["TWITTER_API_KEY"],
    twitterApiSecret: process.env["TWITTER_API_SECRET"],
    airtableApiKey: process.env["AIRTABLE_API_KEY"],
    airtableBaseId: process.env["AIRTABLE_BASE_ID"],
    logLevel: process.env["LOG_LEVEL"],
    dryRun: process.env["DRY_RUN"] === "true",
    maxCostPerRunUsd: (() => {
      const raw = process.env["MAX_COST_PER_RUN_USD"];
      if (!raw) return undefined;
      const n = Number(raw);
      if (isNaN(n)) throw new Error(`Invalid MAX_COST_PER_RUN_USD: "${raw}" is not a number`);
      return n;
    })(),
  });

  const logger = createLogger(config.logLevel);
  const costTracker = createCostTracker();
  const apiClients = createApiClients(config);
  const deps: AgentDeps = { logger, costTracker, apiClients };

  const runId = randomUUID();
  const editionId = getCurrentEditionId(editionArg);
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const draftsDir = join(rootDir, "drafts");
  mkdirSync(draftsDir, { recursive: true });

  console.log(`\n📮 The Transformation Letter — Publish Pipeline`);
  console.log(`   Run:     ${runId}`);
  console.log(`   Edition: ${editionId}`);
  if (scheduleArg) console.log(`   Scheduled: ${scheduleArg}`);
  console.log(`   Time:    ${new Date().toISOString()}\n`);

  // ── Load draft ─────────────────────────────────────────────────────────────
  const { angle, enContent, esContent, shareableSentence } = loadDraft(
    draftsDir,
    editionId,
  );

  // ── Metrics-only mode ──────────────────────────────────────────────────────
  if (metricsOnly) {
    const metricsPath = join(draftsDir, `${editionId}-metrics.json`);
    const distributionPath = join(draftsDir, `${editionId}-distribution.json`);

    if (!existsSync(distributionPath)) {
      console.error(
        `❌ No distribution record found at ${distributionPath}\nRun without --metrics first.`,
      );
      process.exit(1);
    }

    let distRecords: DistributionRecord[];
    try {
      distRecords = z.array(DistributionRecordSchema).parse(
        JSON.parse(readFileSync(distributionPath, "utf-8")),
      );
    } catch (err) {
      console.error(`❌ Failed to load distribution record: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    const beehiivIds = distRecords
      .filter((r) => r.platform === "beehiiv" && r.externalId)
      .map((r) => r.externalId as string);

    console.log(`📊 Collecting metrics for ${beehiivIds.length} Beehiiv posts...`);
    const analystAgent = new AnalystAgent(deps);
    const analystOutput = await analystAgent.run({
      runId,
      editionId,
      agentName: "analyst",
      payload: { editionId, beehiivPostIds: beehiivIds },
    });

    if (!analystOutput.success) {
      console.error(`❌ Analyst failed: ${analystOutput.error}`);
      process.exit(1);
    }

    writeFileSync(metricsPath, JSON.stringify(analystOutput.data, null, 2), "utf-8");
    const m = analystOutput.data;
    console.log(`\n📈 Metrics collected:`);
    if (m.openRate != null) console.log(`   Open rate:  ${(m.openRate * 100).toFixed(1)}%`);
    if (m.clickRate != null) console.log(`   Click rate: ${(m.clickRate * 100).toFixed(1)}%`);
    console.log(`   Saved: ${metricsPath}\n`);
    return;
  }

  // ── Distributor ────────────────────────────────────────────────────────────
  if (!esContent) {
    console.error("❌ Spanish edition missing from draft. Re-run `pnpm draft` first.");
    process.exit(1);
  }

  console.log("📧 Step 1/2 — Distributor: creating Beehiiv posts...");
  const distributorAgent = new DistributorAgent(deps);
  const distributorOutput = await distributorAgent.run({
    runId,
    editionId,
    agentName: "distributor",
    payload: {
      enContent,
      esContent,
      scheduledAt: scheduleArg,
    },
  });

  if (!distributorOutput.success) {
    console.error(`❌ Distributor failed: ${distributorOutput.error}`);
    process.exit(1);
  }

  const distributionRecords = distributorOutput.data;
  const failed = distributionRecords.filter((r) => r.status === "failed");
  const succeeded = distributionRecords.filter((r) => r.status !== "failed");

  for (const r of succeeded) {
    const label = scheduleArg ? "scheduled" : "created";
    console.log(`   ✓ Beehiiv post ${label}: ${r.externalId ?? "unknown"}`);
  }
  for (const r of failed) {
    console.warn(`   ⚠️  Beehiiv post failed: ${r.error ?? "unknown error"}`);
  }

  const distributionPath = join(draftsDir, `${editionId}-distribution.json`);
  writeFileSync(
    distributionPath,
    JSON.stringify(distributionRecords, null, 2),
    "utf-8",
  );

  // ── Amplifier ──────────────────────────────────────────────────────────────
  console.log("\n📣 Step 2/2 — Amplifier: generating social posts...");
  const amplifierAgent = new AmplifierAgent(deps);
  const amplifierOutput = await amplifierAgent.run({
    runId,
    editionId,
    agentName: "amplifier",
    payload: { enContent, angle, shareableSentence: shareableSentence ?? null },
  });

  if (!amplifierOutput.success) {
    console.warn(`   ⚠️  Amplifier failed: ${amplifierOutput.error}. Social posts skipped.`);
  } else {
    const posts = amplifierOutput.data.posts;
    const linkedin = posts.filter((p) => p.platform === "linkedin").length;
    const twitter = posts.filter((p) => p.platform === "twitter").length;
    console.log(`   ✓ ${linkedin} LinkedIn posts, ${twitter} X posts generated`);

    const socialJsonPath = join(draftsDir, `${editionId}-social.json`);
    const socialMdPath = join(draftsDir, `${editionId}-social.md`);
    writeFileSync(socialJsonPath, JSON.stringify(amplifierOutput.data, null, 2), "utf-8");
    writeFileSync(socialMdPath, formatSocialPosts(posts), "utf-8");
    console.log(`   📄 ${socialMdPath}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const amplifierCostUsd = amplifierOutput.success ? amplifierOutput.cost.costUsd : 0;
  console.log(`\n💰 Cost breakdown:`);
  console.log(`   Distributor: $0.0000 (API calls only)`);
  console.log(`   Amplifier:   $${amplifierCostUsd.toFixed(4)}`);
  console.log(`   Total:       $${amplifierCostUsd.toFixed(4)}`);

  if (failed.length > 0) {
    console.warn(`\n⚠️  ${failed.length} distribution(s) failed — check logs above.`);
  } else {
    const action = scheduleArg ? "scheduled" : "created as drafts";
    console.log(
      `\n✅ Done — ${succeeded.length} Beehiiv post(s) ${action}. Review social posts in ${editionId}-social.md\n`,
    );
  }

  console.log(`💡 To collect metrics 48h after send:`);
  console.log(`   pnpm publish:edition --edition ${editionId} --metrics\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  if (process.env["LOG_LEVEL"] === "debug" && err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
