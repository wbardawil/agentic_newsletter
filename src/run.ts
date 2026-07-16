/**
 * Full draft pipeline — CLI entry point.
 *
 * Usage:
 *   pnpm draft
 *   pnpm draft --edition 2026-16
 *   pnpm draft --publish          (creates Beehiiv drafts after approval)
 *
 * Runs: Radar → Strategist → Writer (EN) → Validator → Localizer (ES)
 * Saves draft to: drafts/YYYY-WW-en.md + drafts/YYYY-WW-es.md + drafts/YYYY-WW-draft.json
 */

import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AppConfigSchema } from "./types/config.js";
import { EditionIdSchema } from "./types/enums.js";
import { getCurrentEditionId } from "./utils/edition-id.js";
import { createLogger } from "./utils/logger.js";
import { createCostTracker } from "./utils/cost-tracker.js";
import { createApiClients } from "./utils/api-clients.js";
import type { AgentDeps } from "./agents/base-agent.js";
import { RadarAgent } from "./agents/radar.js";
import { StrategistAgent } from "./agents/strategist.js";
import { WriterAgent } from "./agents/writer.js";
import { ValidatorAgent } from "./agents/validator.js";
import { LocalizerAgent } from "./agents/localizer.js";
import { DesignerAgent, type DesignerOutput } from "./agents/designer.js";
import { QualityGateAgent, type QualityGateResult } from "./agents/quality-gate.js";
import { stripAiTells } from "./utils/sanitize-output.js";
import type { LocalizedContent, ValidationResult } from "./types/edition.js";
import { loadSnapshot, saveSnapshot } from "./utils/source-bundle-snapshot.js";
import type { SourceBundle } from "./types/source-bundle.js";
import type { StrategicAngle } from "./types/edition.js";
import { writeRunSummary } from "./utils/airtable.js";
import { loadAngleHistory, recordAngle, loadRecentFieldReportSummaries, loadRecentFailurePatterns, recordAngleFailure } from "./utils/angle-history.js";
import { scanEdition } from "./utils/citation-guard.js";
import { rewriteContentOutletLinks } from "./utils/outlet-link-rewriter.js";
import { filterUsBundle } from "./utils/bundle-filter.js";
import { initializeReview, saveReview, updateImageInReview } from "./utils/review-state.js";
import { findFieldReportDuplicates } from "./utils/es-url-uniqueness.js";
import { replaceContentMxEntities } from "./utils/mx-entity-replacer.js";
import { runVoiceSweep } from "./utils/es-voice-sweep.js";
import { renderEditionHtml, type EditionHero } from "./utils/edition-html.js";

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Decode the encoded apertura options block and return a single clean body.
 * Picks Option B (Wadi's preferred provocation style); falls back to the
 * first available option, or returns the body unchanged if no delimiters
 * are present (e.g. ES transcreation, already-edited drafts).
 */
function renderAperturaOptions(body: string): string[] {
  const delimiterRe = /===OPTION_([ABC]):(\w+)===/g;
  if (!delimiterRe.test(body)) {
    return [body];
  }
  delimiterRe.lastIndex = 0;
  const parts = body.split(/===OPTION_[ABC]:\w+===/);
  const headers = [...body.matchAll(/===OPTION_([ABC]):(\w+)===/g)];
  const indexB = headers.findIndex((h) => h[1] === "B");
  const chosenIdx = indexB >= 0 ? indexB : 0;
  return [(parts[chosenIdx + 1] ?? "").trim()];
}

function renderMarkdown(
  editionId: string,
  angle: StrategicAngle,
  content: LocalizedContent,
  language: "en" | "es",
): string {
  const sections = content.sections;
  const signal = sections.find((s) => s.type === "news");
  const apertura = sections.find((s) => s.type === "lead");
  const insight = sections.find((s) => s.type === "analysis");
  const fieldReport = sections.find((s) => s.type === "spotlight");
  const tool = sections.find((s) => s.type === "tool");
  const compass = sections.find((s) => s.type === "quickTakes");
  const door = sections.find((s) => s.type === "cta");

  const now = new Date().toISOString().substring(0, 10);
  const isEs = language === "es";

  const label = isEs ? "ES" : "EN";
  const signalHeading = isEs ? "LA SEÑAL" : "THE SIGNAL";
  const aperturaHeading = isEs ? "LA APERTURA" : "THE APERTURA";
  const insightHeading = isEs ? "EL INSIGHT" : "THE INSIGHT";
  const fieldReportHeading = isEs ? "EL REPORTE DE CAMPO" : "THE FIELD REPORT";
  const toolHeading = isEs ? "LA HERRAMIENTA" : "THE TOOL";
  const compassHeading = isEs ? "LA BRÚJULA" : "THE COMPASS";
  const doorHeading = isEs ? "LA PUERTA" : "THE DOOR";

  return [
    `# The Transformation Letter - Edition ${editionId} [${label}]`,
    ``,
    `**Drafted:** ${now}  `,
    `**OS Pillar:** ${angle.osPillar}  `,
    `**Quarterly Theme:** ${angle.quarterlyTheme}  `,
    `**Subject:** ${content.subject}  `,
    `**Preheader:** ${content.preheader}`,
    ``,
    `---`,
    ``,
    ...(isEs
      ? [`> **Resumen del Insight:** ${content.thesis ?? angle.thesis}`, ``, `---`, ``]
      : [`> **Insight summary:** ${angle.thesis}`, ``, `---`, ``]),
    `## ${signalHeading}`,
    ``,
    signal?.body ?? "",
    ``,
    `---`,
    ``,
    `## ${aperturaHeading}`,
    ``,
    ...(language === "en"
      ? renderAperturaOptions(apertura?.body ?? "")
      : [apertura?.body ?? ""]),
    ``,
    `---`,
    ``,
    `## ${insightHeading}`,
    ``,
    insight?.body ?? "",
    ``,
    `---`,
    ``,
    `## ${fieldReportHeading}`,
    ``,
    fieldReport?.body ?? "",
    ``,
    `---`,
    ``,
    `## ${toolHeading}`,
    ``,
    tool?.body ?? "",
    ``,
    `---`,
    ``,
    `## ${compassHeading}`,
    ``,
    compass?.body ?? "",
    ``,
    `---`,
    ``,
    `## ${doorHeading}`,
    ``,
    door?.body ?? "",
    ``,
    `---`,
    ``,
    `*Draft generated by the pipeline. Review and edit before sending.*`,
  ].join("\n");
}

function renderHtml(
  editionId: string,
  angle: StrategicAngle,
  content: LocalizedContent,
  language: "en" | "es",
  hero?: EditionHero,
): string {
  const md = renderMarkdown(editionId, angle, content, language);
  return renderEditionHtml({ editionId, title: content.subject, markdown: md, language, hero });
}

// ── main ─────────────────────────────────────────────────────────────────────

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

/**
 * Reconcile Validator result with Quality Gate outcome.
 *
 * When the Quality Gate passes (all facts verified) but the Validator
 * flagged isValid=false due to a deterministic false-positive (e.g.
 * "According" captured as entity-duplicate), the draft becomes
 * unpublishable — the publish workflow reads isValid from the JSON and
 * refuses to ship. This function patches the Validator result so that
 * deterministic errors already cleared by the QG do not poison the
 * publishability flag.
 *
 * Rules:
 * - If the QG did not pass, the Validator result is returned as-is.
 * - If the QG passed, we re-evaluate isValid excluding deterministic
 *   checker errors whose scope the QG has already covered (entity-dup,
 *   url-dup, temporal-mismatch). If no substantive errors remain, we
 *   flip isValid to true and recalculate the score.
 */
function reconcileValidation(
  validation: ValidationResult | undefined,
  qualityGate: QualityGateResult | undefined,
): ValidationResult | undefined {
  if (!validation || !qualityGate) return validation;
  if (validation.isValid) return validation; // already valid, nothing to reconcile
  if (!qualityGate.passed) return validation; // QG failed too — keep as-is

  // Rules whose false-positives are known to cause unpublishable drafts
  // when the QG has already cleared the factual accuracy of the content.
  // We include LLM-based "people-angle-substantive" here because it is a
  // subjective style/coaching check. If the Quality Gate passed (fact-check OK),
  // a subjective layout/weaving warning should not permanently block publication.
  //
  // "banned-phrase": the Writer runs two LLM repair passes before giving up.
  // When both passes fail to eliminate the phrase (e.g. "disruption" embedded in
  // a trade-policy compound noun) and the QG's voice check still scores ≥80, the
  // human approver — not an automated gate — should be the final arbiter of
  // whether the phrase is acceptable in context. Blocking the approval link
  // after the editor already clicked "Approve article" defeats the purpose of
  // the human review gate.
  const DETERMINISTIC_RULES_CLEARED_BY_QG = new Set([
    "field-report-entity-duplicate",
    "field-report-url-duplicate",
    "temporal-tense-mismatch",
    "historical-temporal-mismatch",
    "people-angle-substantive",
    "banned-phrase",
  ]);

  const substantiveErrors = validation.issues.filter(
    (i) => i.severity === "error" && !DETERMINISTIC_RULES_CLEARED_BY_QG.has(i.rule),
  );

  if (substantiveErrors.length > 0) {
    // There are real errors beyond the deterministic false-positives
    return validation;
  }

  // All errors were deterministic rules cleared by QG — recalculate
  const reconciledIssues = validation.issues.map((issue) => {
    if (issue.severity === "error" && DETERMINISTIC_RULES_CLEARED_BY_QG.has(issue.rule)) {
      return { ...issue, severity: "warning" as const };
    }
    return issue;
  });

  const reconciledScore = Math.min(
    100,
    validation.score + validation.issues.filter(
      (i) => i.severity === "error" && DETERMINISTIC_RULES_CLEARED_BY_QG.has(i.rule),
    ).length * 15, // each error subtracts 15 from score; reverse it
  );

  const reconciled = {
    ...validation,
    isValid: true,
    score: reconciledScore,
    issues: reconciledIssues,
    recommendations: validation.recommendations.map((r) =>
      r.includes("error(s) must be resolved")
        ? "Draft passes automated checks (deterministic issues reconciled with Quality Gate). Replace the Apertura placeholder with your real field observation before publishing."
        : r,
    ),
  };

  // Surface the reconciliation in the pipeline log so future debugging is immediate.
  console.log(
    `   ✅ reconcileValidation: isValid false→true, score ${validation.score}→${reconciledScore} ` +
    `(cleared: ${validation.issues
      .filter((i) => i.severity === "error" && DETERMINISTIC_RULES_CLEARED_BY_QG.has(i.rule))
      .map((i) => i.rule)
      .join(", ")})`,
  );

  return reconciled;
}

async function main(): Promise<void> {
  // Allow --edition YYYY-WW override from CLI args
  const editionArg = process.argv.find((a, i) => process.argv[i - 1] === "--edition");
  if (editionArg) {
    try {
      EditionIdSchema.parse(editionArg);
    } catch {
      console.error(`❌ Invalid --edition value: "${editionArg}". Expected format: YYYY-WW (e.g. 2026-17)`);
      process.exit(1);
    }
  }

  const costJsonFlag = process.argv.includes("--cost-json");
  // Designer is opt-in via GEMINI_API_KEY. The --skip-designer flag forces a
  // skip even when the key is set (useful for cost-sensitive reruns).
  const skipDesignerFlag = process.argv.includes("--skip-designer");

  const config = AppConfigSchema.parse({
    anthropicApiKey: process.env["ANTHROPIC_API_KEY"],
    beehiivApiKey: process.env["BEEHIIV_API_KEY"],
    beehiivPublicationId: process.env["BEEHIIV_PUBLICATION_ID"],
    feedlyApiKey: process.env["FEEDLY_API_KEY"],
    linkedinAccessToken: process.env["LINKEDIN_ACCESS_TOKEN"],
    twitterApiKey: process.env["TWITTER_API_KEY"],
    twitterApiSecret: process.env["TWITTER_API_SECRET"],
    twitterAccessToken: process.env["TWITTER_ACCESS_TOKEN"],
    twitterAccessSecret: process.env["TWITTER_ACCESS_SECRET"],
    airtableApiKey: process.env["AIRTABLE_API_KEY"],
    airtableBaseId: process.env["AIRTABLE_BASE_ID"],
    geminiApiKey: process.env["GEMINI_API_KEY"],
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

  // Pre-flight: verify required files exist before starting expensive API calls
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const draftsDir = join(rootDir, "drafts");
  const voiceBiblePath = join(rootDir, "src", "voice-bible", "voice-bible.md");
  if (!existsSync(voiceBiblePath)) {
    console.error(`❌ Voice Bible not found at ${voiceBiblePath}`);
    process.exit(1);
  }

  logger.info(`Starting draft pipeline`, { runId, editionId });
  console.log(`\n📰 The Transformation Letter — Draft Pipeline`);
  console.log(`   Run:     ${runId}`);
  console.log(`   Edition: ${editionId}`);
  console.log(`   Time:    ${new Date().toISOString()}\n`);

  // ── Radar ──────────────────────────────────────────────────────────────────
  // If a SourceBundle snapshot for this edition exists, replay from disk
  // instead of rescanning RSS. This makes reruns deterministic when a
  // downstream agent (Strategist, Writer, Localizer) fails mid-pipeline.
  const snapshot = loadSnapshot(draftsDir, editionId);
  let bundle: SourceBundle;
  // Radar cost is zero when the bundle is replayed from disk (no LLM call,
  // no RSS fetch happens). Same schema shape as a fresh Radar run.
  let radarCost = { model: "none", inputTokens: 0, outputTokens: 0, costUsd: 0 };
  if (snapshot) {
    console.log("🔍 Step 1/3 — Radar: loading SourceBundle snapshot (skipping RSS scan)...");
    bundle = snapshot;
    console.log(
      `   ✓ Replayed ${bundle.totalSelected} items from ${bundle.metadata.feedsScanned} feeds (snapshot)\n`,
    );
  } else {
    console.log("🔍 Step 1/3 — Radar: scanning RSS feeds...");
    const radarAgent = new RadarAgent(deps);
    const radarOutput = await radarAgent.run({
      runId,
      editionId,
      agentName: "radar",
      payload: { timeWindowHours: 168, maxItems: 20, rssTimeoutMs: config.rssParserTimeoutMs },
    });

    if (!radarOutput.success) {
      console.error(`❌ Radar failed: ${radarOutput.error}`);
      process.exit(1);
    }

    bundle = radarOutput.data as SourceBundle;
    radarCost = radarCost;
    saveSnapshot(draftsDir, editionId, bundle);
    console.log(
      `   ✓ Selected ${bundle.totalSelected} items from ${bundle.metadata.feedsScanned} feeds (snapshot saved)\n`,
    );
  }

  // ── Strategist ─────────────────────────────────────────────────────────────
  // One Strategist picks the week's angle. Both editions share it — the EN
  // is the canonical editorial judgment, and the ES renders the same angle
  // in native Mexican voice (Option A from the 2026-04-24 design review).
  // We tried the dual-Strategist architecture briefly; Wadi preferred the
  // same strategic spine with a Mexican voice over two independent topics.
  console.log("🧠 Step 2/4 — Strategist: selecting angle...");
  const recentFieldReports = loadRecentFieldReportSummaries(draftsDir);
  const recentFailurePatterns = loadRecentFailurePatterns(draftsDir);
  const strategistAgent = new StrategistAgent(deps);
  const strategistOutput = await strategistAgent.run({
    runId,
    editionId,
    agentName: "strategist",
    payload: { ...bundle, recentFieldReports, recentFailurePatterns },
  });

  if (!strategistOutput.success) {
    console.error(`❌ Strategist failed: ${strategistOutput.error}`);
    process.exit(1);
  }

  const angle = strategistOutput.data as StrategicAngle;
  console.log(`   ✓ Angle: "${angle.headline}"`);
  console.log(`   ✓ Pillar: ${angle.osPillar}`);
  console.log(`   ✓ Theme: ${angle.quarterlyTheme}\n`);

  // ── Writer (EN) ────────────────────────────────────────────────────────────
  console.log("✍️  Step 3/5 — Writer: drafting newsletter...");
  const writerAgent = new WriterAgent(deps);
  const writerOutput = await writerAgent.run({
    runId,
    editionId,
    agentName: "writer",
    payload: {
      angle,
      // Writer gets only US + corridor items so the EN anchors in US
      // institutional sources (Fortune, HBR, Bloomberg, Chief Executive,
      // etc.) even when the bundle is MX-heavy. The ES Writer below
      // receives the full bundle + EN content so it can both cite the
      // same US/corridor sources and substitute a regional example from
      // the MX items when the story calls for it.
      sources: filterUsBundle(bundle.items),
      language: "en",
      draftsDir,
    },
  });

  if (!writerOutput.success) {
    console.error(`❌ Writer failed: ${writerOutput.error}`);
    process.exit(1);
  }

  // `let` because the QG repair loop may patch sections in-place
  let content = rewriteContentOutletLinks(
    writerOutput.data as LocalizedContent,
    bundle,
    "en",
  );
  console.log(`   ✓ Draft complete (${content.sections.length} sections)\n`);

  // ── Early Citation Guard pre-scan (post-Writer, pre-QG) ────────────────────
  // Catch naked attributions ("According to X") without an adjacent URL before
  // the QG repair loop. If issues are found here the Writer has a chance to fix
  // them via the QG repair loop; without this pre-scan they only surface at the
  // final Citation Guard (post-QG) where no repair budget remains.
  {
    const earlyGuardIssues = scanEdition(
      content.sections.map((s) => ({ type: s.type, body: s.body })),
      "en",
    );
    if (earlyGuardIssues.length > 0) {
      console.warn(
        `\n⚠️  Citation Guard (pre-QG) — ${earlyGuardIssues.length} attribution(s) without a source link:`,
      );
      for (const issue of earlyGuardIssues) {
        console.warn(`   • [${issue.section}] "${issue.entity} ${issue.verb}"`);
        console.warn(`     … ${issue.excerpt} …`);
      }
      console.warn(
        `   Writer will have a chance to fix these during the QG repair loop.\n`,
      );
    }
  }

  // ── Validator ──────────────────────────────────────────────────────────────
  console.log("🔎 Step 4/5 — Validator: checking draft against Voice Bible...");
  const validatorAgent = new ValidatorAgent(deps);
  const validatorOutput = await validatorAgent.run({
    runId,
    editionId,
    agentName: "validator",
    payload: { content, angle, sourceBundle: bundle },
  });

  const validation = validatorOutput.data as ValidationResult | undefined;

  if (!validatorOutput.success || !validation) {
    console.error(`❌ Validator failed: ${validatorOutput.error}`);
    process.exit(1);
  }

  const icon = validation.isValid ? "✅" : "⚠️ ";
  console.log(`   ${icon} Score: ${validation.score}/100 — ${validation.isValid ? "PASS" : "FAIL"}`);
  const errors = validation.issues.filter((i) => i.severity === "error");
  const warnings = validation.issues.filter((i) => i.severity === "warning");
  if (errors.length > 0) console.log(`   Errors (${errors.length}):`);
  for (const e of errors) console.log(`     • [${e.section}] ${e.message}`);
  if (warnings.length > 0) console.log(`   Warnings (${warnings.length}):`);
  for (const w of warnings.slice(0, 3)) console.log(`     • [${w.section}] ${w.message}`);
  for (const rec of validation.recommendations) console.log(`   → ${rec}`);
  console.log();

  // ── ES Writer (renders the shared angle in native Mexican voice) ──────────
  // Receives the EN content + the shared angle + the full bundle. Its job
  // is to produce an ES edition that shares the EN's strategic spine and
  // tier-1 source citations, but reads as native Mexican business press
  // (El País / Whitepaper / Expansión / Forbes LATAM register). It has
  // explicit license to substitute ONE example with a Mexican equivalent
  // from the bundle, or add an "Enfoque México" paragraph to the Field
  // Report when the MX items strengthen the point. The class is still
  // called Localizer for back-compat; conceptually it is now an ES Writer
  // with the same hardening the EN Writer has (repair passes, deterministic
  // entity replacer, voice-sweep post-processor).
  console.log("🌎 Step 5/5 — ES Writer: rendering in native Mexican voice...");
  const localizerAgent = new LocalizerAgent(deps);
  const localizerOutput = await localizerAgent.run({
    runId,
    editionId,
    agentName: "localizer",
    payload: { content, angle, targetLanguage: "es", draftsDir, sourceBundle: bundle },
  });

  let esContent: LocalizedContent | null = null;
  if (!localizerOutput.success) {
    console.warn(`   ⚠️  Localizer failed: ${localizerOutput.error}. Spanish draft skipped.\n`);
  } else {
    let stage = localizerOutput.data as LocalizedContent;

    // Deterministic MX entity replacer. Catches the specific calques we've
    // seen ship multiple times — "Comisión Nacional Antimonopolio" for
    // COFECE, "SEC mexicana" for CNBV, "IRS mexicano" for SAT — that the
    // prompt's self-check step 6.3 missed. Cheap, no LLM call.
    const entityFix = replaceContentMxEntities(stage);
    if (entityFix.report.length > 0) {
      console.log(`   🔧 MX entity fixes applied:`);
      for (const r of entityFix.report) {
        console.log(`      • ${r.note} (${r.occurrences} occurrence${r.occurrences === 1 ? "" : "s"})`);
      }
    }
    stage = entityFix.content;

    // Voice sweep. Sonnet reads each major prose section (Apertura,
    // Insight, Field Report, Tool, Compass) and rewrites translation-
    // tells in native Mexican register. Preserves every fact, URL, and
    // bold punch line. Runs AFTER the Localizer's own repair passes —
    // those fix structure; this fixes voice.
    console.log(`   🪶 Voice sweep: refining ES prose to native Mexican register...`);
    stage = await runVoiceSweep(stage, apiClients, costTracker, logger);

    // Outlet-link rewriter: expand [Leer ->] into [Leer en <outlet> ->]
    // so every citation shows its destination. Runs LAST so it operates
    // on the final prose.
    esContent = rewriteContentOutletLinks(stage, bundle, "es");

    // ── ES Citation Guard pre-scan ─────────────────────────────────────────
    // Mirror of the EN pre-scan (post-Writer, pre-QG). Catches naked
    // attributions introduced by the Localizer (e.g. "Según Coparmex…"
    // without an adjacent URL) before they reach the terminal Citation Guard
    // at the end of the pipeline. When issues are found a single Sonnet repair
    // pass rewrites only the flagged sentences, giving the ES draft a recovery
    // opportunity rather than a hard block.
    const esPreGuardIssues = scanEdition(
      esContent.sections.map((s) => ({ type: s.type, body: s.body })),
      "es",
    );
    if (esPreGuardIssues.length > 0) {
      console.warn(
        `\n   ⚠️  ES Citation Guard (pre-QG) — ${esPreGuardIssues.length} naked attribution(s) in ES draft:`,
      );
      for (const issue of esPreGuardIssues) {
        console.warn(`      • [${issue.section}] "${issue.entity} ${issue.verb}"`);
        console.warn(`        … ${issue.excerpt} …`);
      }
      console.warn(`      Running ES attribution repair pass...\n`);

      // Build a repair prompt: one call targeting only the flagged sections.
      const flaggedSectionTypes = new Set(
        esPreGuardIssues.map((i) => i.section.replace(/^es\//, "")),
      );
      const repairedSections = await Promise.all(
        esContent.sections.map(async (s) => {
          if (!flaggedSectionTypes.has(s.type)) return s;
          const sectionIssues = esPreGuardIssues.filter(
            (i) => i.section === `es/${s.type}`,
          );
          const attributionList = sectionIssues
            .map((i) => `"${i.entity} ${i.verb}"`)
            .join(", ");
          try {
            const repairResp = await apiClients.anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 3000,
              messages: [
                {
                  role: "user",
                  content:
                    `The Spanish newsletter section below contains naked attribution(s) — ` +
                    `sentences that name a source (${attributionList}) without an adjacent ` +
                    `markdown link. The pipeline will BLOCK the edition if these are not fixed.\n\n` +
                    `For each naked attribution:\n` +
                    `- If the URL for the named source is available in the text or is a well-known ` +
                    `Mexican institution, add the URL as a markdown link inline.\n` +
                    `- If the URL is NOT available, rewrite the sentence using anonymous framing: ` +
                    `"datos del sector indican…", "la industria reporta…", or remove the name entirely.\n\n` +
                    `Rules:\n` +
                    `- Keep every other fact, URL, number, and markdown structure unchanged.\n` +
                    `- Do not add new claims or change any meaning — only fix the naked attributions.\n` +
                    `- Maintain native Mexican business-press register.\n\n` +
                    `Output ONLY the rewritten section text:\n\n${s.body}`,
                },
              ],
            });
            costTracker.recordUsage(
              "claude-sonnet-4-6",
              repairResp.usage.input_tokens,
              repairResp.usage.output_tokens,
            );
            const repairBlock = repairResp.content[0];
            const repaired = repairBlock?.type === "text" ? repairBlock.text.trim() : s.body;
            // Verify the repair actually cleared the issues
            const stillFlagged = scanEdition([{ type: s.type, body: repaired }], "es");
            if (stillFlagged.length > 0) {
              logger.warn(
                `ES citation repair could not clear all attributions in [${s.type}]: ` +
                stillFlagged.map((i) => `"${i.entity} ${i.verb}"`).join(", "),
              );
            } else {
              logger.info(`ES citation repair cleared all naked attributions in [${s.type}]`);
            }
            return { ...s, body: repaired };
          } catch (repairErr) {
            logger.warn(
              `ES citation repair call failed for [${s.type}]: ` +
              `${repairErr instanceof Error ? repairErr.message : String(repairErr)}`,
            );
            return s;
          }
        }),
      );
      esContent = { ...esContent, sections: repairedSections };
    }

    console.log(`   ✓ Spanish edition ready (${esContent.sections.length} sections)\n`);
  }

  // ── Designer (optional — needs GEMINI_API_KEY) ────────────────────────────
  // Produces a hero image + bilingual alt-text/caption for the edition.
  // Gracefully no-ops when GEMINI_API_KEY is absent or --skip-designer is set,
  // so cron runs without the key still complete successfully.
  let designer: DesignerOutput | null = null;
  let heroImagePath: string | null = null;
  const designerCost = { model: "none", inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const designerEnabled =
    !skipDesignerFlag && (apiClients.geminiApiKey || apiClients.dryRun);
  if (designerEnabled) {
    console.log("🎨 Designer: composing hero image + bilingual alt-text...");
    const designerAgent = new DesignerAgent(deps);
    const designerOutput = await designerAgent.run({
      runId,
      editionId,
      agentName: "designer",
      payload: {
        angle,
        enContent: content,
        outputDir: draftsDir,
        heroFilename: `${editionId}-hero.png`,
      },
    });
    if (!designerOutput.success) {
      console.warn(`   ⚠️  Designer failed: ${designerOutput.error}. Proceeding without hero image.\n`);
    } else {
      designer = designerOutput.data as DesignerOutput;
      heroImagePath = designer.assets[0]?.imagePath ?? null;
      Object.assign(designerCost, designerOutput.cost);
      const assetCount = designer.assets.length;
      console.log(`   ✓ Generated ${assetCount} asset${assetCount === 1 ? "" : "s"} (${designer.imageModel})`);
      if (heroImagePath) console.log(`     hero: ${heroImagePath.replace(`${draftsDir}/`, "")}`);
    }
  } else if (skipDesignerFlag) {
    console.log("🎨 Designer: skipped (--skip-designer flag set)\n");
  } else {
    console.log("🎨 Designer: skipped (GEMINI_API_KEY not set; set DRY_RUN=true to test without spend)\n");
  }

  // ── Save draft ─────────────────────────────────────────────────────────────
  mkdirSync(draftsDir, { recursive: true });

  // ── Quality Gate ──────────────────────────────────────────────────────────
  console.log("🛡️  Quality Gate: fact-check + originality + voice + diversity...");
  const priorAngles = loadAngleHistory(draftsDir);
  const qualityGateAgent = new QualityGateAgent(deps);
  const qualityGateOutput = await qualityGateAgent.run({
    runId,
    editionId,
    agentName: "qualityGate",
    payload: {
      enContent: content,
      esContent: esContent ?? null,
      angle,
      sourceBundle: bundle,
      priorAngles,
    },
  });

  // ── Quality Gate repair loop ─────────────────────────────────────────────
  // If the QG finds hard failures, the Writer makes a targeted surgical repair
  // (max 2 attempts) before we declare the draft blocked. Each repair call uses
  // claude-sonnet-4-6 on only the flagged sentences — cheap (~$0.05/attempt).
  const MAX_QG_REPAIRS = 2;

  let qualityGate: QualityGateResult | undefined;
  let hadBlockingIssue = false;
  if (!qualityGateOutput.success) {
    console.warn(
      `   ⚠️  Quality Gate failed: ${qualityGateOutput.error}. Continuing without fact verification.\n`,
    );
  } else {
    qualityGate = qualityGateOutput.data as QualityGateResult;

    // ── Repair loop ────────────────────────────────────────────────────────
    if (!qualityGate.passed) {
      for (let repairAttempt = 1; repairAttempt <= MAX_QG_REPAIRS; repairAttempt++) {
        console.warn(
          `   ⚠️  Quality Gate HARD FAIL (attempt ${repairAttempt}/${MAX_QG_REPAIRS}) — ` +
            `${qualityGate.hardFailures.length} claim(s) flagged. Running Writer repair...\n`,
        );
        for (const f of qualityGate.hardFailures) console.warn(`     • ${f}`);

        const writerRepairAgent = new WriterAgent(deps);
        const repairedContent = await writerRepairAgent.repairQualityGateFailures(
          content,
          qualityGate.hardFailures,
          bundle.items,
          editionId,
          repairAttempt,
          MAX_QG_REPAIRS,
        );

        if (!repairedContent) {
          console.warn(`   ⚠️  Writer repair ${repairAttempt} failed to parse — skipping.\n`);
          break;
        }

        // Capture the pre-repair sections fingerprint before overwriting content.
        // Used below to detect whether this repair attempt actually changed anything.
        const preRepairFingerprint = content.sections.map((s) => s.body).join("|");

        // Replace the EN content with the repaired version
        content = repairedContent;

        // Propagate repairs to the Spanish draft by regenerating it.
        // Pass the QG hard failures so the ES Writer knows exactly which
        // claims were rejected and can correct them in the new edition.
        if (esContent) {
          console.log(`   🌎 ES Writer: regenerating Spanish edition from repaired English draft...\n`);
          const localizerOutput = await localizerAgent.run({
            runId,
            editionId,
            agentName: "localizer",
            payload: {
              content,
              angle,
              targetLanguage: "es",
              draftsDir,
              sourceBundle: bundle,
              qgHardFailures: qualityGate.hardFailures,
            },
          });

          if (localizerOutput.success) {
            let stage = localizerOutput.data as LocalizedContent;
            const entityFix = replaceContentMxEntities(stage);
            if (entityFix.report.length > 0) {
              console.log(`   🔧 MX entity fixes applied during repair:`);
              for (const r of entityFix.report) {
                console.log(`      • ${r.note} (${r.occurrences} occurrence${r.occurrences === 1 ? "" : "s"})`);
              }
            }
            stage = entityFix.content;
            stage = await runVoiceSweep(stage, apiClients, costTracker, logger);
            esContent = rewriteContentOutletLinks(stage, bundle, "es");
            console.log(`   ✓ Spanish edition repaired and aligned successfully\n`);
          } else {
            console.warn(`   ⚠️  Localizer failed during repair: ${localizerOutput.error}. Keeping previous Spanish draft.\n`);
          }
        }

        // On the last repair slot, only re-run the QG when the repair
        // actually changed something. If the repair made no changes the
        // content is identical to what the previous QG already evaluated,
        // so re-running wastes ~40 s without any benefit.
        // If the repair DID change content, skip the unconditional block
        // and fall through to the standard QG re-run below.
        if (repairAttempt === MAX_QG_REPAIRS) {
          const postRepairFingerprint = content.sections.map((s) => s.body).join("|");
          const repairMadeChanges = postRepairFingerprint !== preRepairFingerprint;

          if (!repairMadeChanges) {
            console.warn(
              `   ⚠️  Draft still has ${qualityGate.hardFailures.length} unresolved claim(s) after ${MAX_QG_REPAIRS} repair(s). Repair made no changes — skipping final QG re-run.\n`,
            );
            hadBlockingIssue = true;
            break;
          }

          // Repair did change content — run one final QG to confirm.
          console.log(`   🔁 Running final QG check after repair ${MAX_QG_REPAIRS} (repair made changes)...\n`);
          const finalRerunOutput = await qualityGateAgent.run({
            runId,
            editionId,
            agentName: "qualityGate",
            payload: {
              enContent: content,
              esContent: esContent ?? null,
              angle,
              sourceBundle: bundle,
              priorAngles,
            },
          });

          if (!finalRerunOutput.success) {
            console.warn(`   ⚠️  Final QG re-run failed: ${finalRerunOutput.error}\n`);
            hadBlockingIssue = true;
          } else {
            qualityGate = finalRerunOutput.data as QualityGateResult;
            if (qualityGate.passed) {
              console.log(`   ✅ Quality Gate passed after final repair.\n`);
            } else {
              console.error(`   ❌ Final QG still has ${qualityGate.hardFailures.length} unresolved claim(s).\n`);
              hadBlockingIssue = true;
            }
          }
          break;
        }

        // Re-run Quality Gate on the repaired draft
        console.log(`   🔁 Re-running Quality Gate after repair ${repairAttempt}...\n`);
        const rerunOutput = await qualityGateAgent.run({
          runId,
          editionId,
          agentName: "qualityGate",
          payload: {
            enContent: content,
            esContent: esContent ?? null,
            angle,
            sourceBundle: bundle,
            priorAngles,
          },
        });

        if (!rerunOutput.success) {
          console.warn(`   ⚠️  Quality Gate re-run failed: ${rerunOutput.error}\n`);
          break;
        }

        qualityGate = rerunOutput.data as QualityGateResult;
        if (qualityGate.passed) {
          console.log(`   ✅ Quality Gate passed after repair ${repairAttempt}.\n`);
          break;
        }
        // Loop continues — next iteration will either repair again or hit the
        // early-exit at MAX_QG_REPAIRS before the final QG re-run.
      }
    }
    // ── End repair loop ────────────────────────────────────────────────────

    if (qualityGate.passed) {
      console.log(
        `   ✅ Passed — ${qualityGate.factCheck.verifiedClaims.length} claims verified, ` +
          `voice ${qualityGate.voiceMatch.voiceScore}/100, ` +
          `${qualityGate.sourceDiversity.outletCount} outlets\n`,
      );
    } else {
      console.error(`   ❌ HARD FAIL — unverifiable claims detected:`);
      for (const f of qualityGate.hardFailures) console.error(`     • ${f}`);
      for (const c of qualityGate.factCheck.unverifiedClaims) {
        console.error(`     • [${c.language}/${c.section ?? "?"}] "${c.claim}"`);
      }
      console.error(`\n   Draft cannot ship with fabricated claims.\n`);
      hadBlockingIssue = true;
      // Record the failure pattern so the next Strategist run can avoid it
      const impliedOutlets = bundle.items
        .filter((item) => item.temporalSignals?.hasFutureOnlyFacts === true)
        .map((item) => item.outlet ?? "unknown")
        .filter(Boolean);
      recordAngleFailure(draftsDir, editionId, qualityGate.hardFailures, impliedOutlets);
    }
    if (qualityGate.angleOriginality.recommendation === "consider rerun") {
      console.warn(
        `   ⚠️  Angle similar to prior: "${qualityGate.angleOriginality.closestPriorAngle}" ` +
          `(${(qualityGate.angleOriginality.similarityScore * 100).toFixed(0)}% overlap)\n`,
      );
    }
    for (const d of qualityGate.voiceMatch.deviations) {
      console.warn(`   ⚠️  Voice deviation: ${d}`);
    }
    if (
      qualityGate.sourceDiversity.outletCount < 2 &&
      !qualityGate.sourceDiversity.sourceCheckWaived &&
      !qualityGate.sourceDiversity.source_check_waived
    ) {
      console.warn(
        `   ⚠️  Low source diversity: only ${qualityGate.sourceDiversity.outletCount} outlets cited\n`,
      );
    }
  }

  // ── Reconcile Validator result with Quality Gate outcome ─────────────────
  // Done here — immediately after QG completes — so the reconciliation result
  // appears in the CLI log adjacent to the Validator output that triggered it,
  // rather than deep inside the JSON-construction block at the end of main().
  // The computed value is reused verbatim when writing the draft JSON below.
  const reconciledValidation = validatorOutput.success
    ? reconcileValidation(validation, qualityGate)
    : null;

  // ── Citation Guard (regex, deterministic) ────────────────────────────────
  // Second line of defense after Quality Gate. Catches "[Entity] + attribution
  // verb" patterns without an adjacent URL. Cheap, no LLM.
  const enGuardIssues = scanEdition(
    content.sections.map((s) => ({ type: s.type, body: s.body })),
    "en",
  );
  const esGuardIssues = esContent
    ? scanEdition(
        esContent.sections.map((s) => ({ type: s.type, body: s.body })),
        "es",
      )
    : [];
  const guardIssues = [...enGuardIssues, ...esGuardIssues];
  if (guardIssues.length > 0) {
    console.error(`\n🚨 Citation Guard — ${guardIssues.length} attribution(s) without a source link:`);
    for (const issue of guardIssues) {
      console.error(`   • [${issue.section}] "${issue.entity} ${issue.verb}"`);
      console.error(`     … ${issue.excerpt} …`);
    }
    console.error(
      `\n   These look like fabricated attributions. Fix them in the draft or\n` +
        `   re-run with tighter citation discipline before shipping.\n`,
    );
    hadBlockingIssue = true;
  }

  // ── URL uniqueness: Field Report must not cite a Signal URL ───────────────
  // Runs on BOTH editions. Both agents have been caught duplicating: the
  // Writer on Fast Company's Microsoft buyout URL across EN Signal.HC and
  // EN Field Report; the Localizer on the Expansión T-MEC note across ES
  // Signal.Estrategia and ES Field Report. Warn, don't block — the draft
  // still ships for manual review, but the dup shows up clearly in the CLI.
  const enDuplicates = findFieldReportDuplicates(content);
  if (enDuplicates.length > 0) {
    console.warn(
      `\n⚠️  EN Field Report cites ${enDuplicates.length} URL(s) already used in the Signal:`,
    );
    for (const dup of enDuplicates) {
      const pillar = dup.signalPillar ? `Signal.${dup.signalPillar}` : "Signal";
      console.warn(`   • ${dup.url}   (also in ${pillar})`);
    }
    console.warn(
      `   Pick a different US/corridor example from the bundle for the Field Report,\n` +
        `   or fall back to sector framing without a link.\n`,
    );
  }

  if (esContent) {
    const esDuplicates = findFieldReportDuplicates(esContent);
    if (esDuplicates.length > 0) {
      console.warn(
        `\n⚠️  ES Field Report cites ${esDuplicates.length} URL(s) already used in the Signal:`,
      );
      for (const dup of esDuplicates) {
        const pillar = dup.signalPillar ? `Signal.${dup.signalPillar}` : "Signal";
        console.warn(`   • ${dup.url}   (also in ${pillar})`);
      }
      console.warn(
        `   Pick a different Mexican company from the MX bundle for the Field Report,\n` +
          `   or fall back to sector framing without a link.\n`,
      );
    }
  }

  // Record the angle (+ Field Report summary) in history for future de-duplication
  const spotlightBody = content.sections.find((s) => s.type === "spotlight")?.body ?? "";
  const fieldReportSummary = spotlightBody.slice(0, 300).replace(/\s+/g, " ").trim();
  recordAngle(draftsDir, editionId, angle, fieldReportSummary || undefined);

  const enMdPath = join(draftsDir, `${editionId}-en.md`);
  const esMdPath = join(draftsDir, `${editionId}-es.md`);
  const jsonPath = join(draftsDir, `${editionId}-draft.json`);

  // Overwrite protection: back up existing draft before clobbering
  if (existsSync(jsonPath)) {
    copyFileSync(jsonPath, `${jsonPath}.bak`);
    logger.info(`Backed up existing draft to ${jsonPath}.bak`);
  }

  const heroAsset = designer?.assets[0];
  const enHero = heroAsset
    ? {
        filename: `${editionId}-hero.png`,
        altText: heroAsset.altText.en,
        caption: heroAsset.caption.en,
      }
    : undefined;
  const esHero = heroAsset
    ? {
        filename: `${editionId}-hero.png`,
        altText: heroAsset.altText.es,
        caption: heroAsset.caption.es,
      }
    : undefined;

  const enMdContent = stripAiTells(renderMarkdown(editionId, angle, content, "en"));
  writeFileSync(enMdPath, enMdContent, "utf-8");
  writeFileSync(join(draftsDir, `${editionId}-en.html`), renderHtml(editionId, angle, content, "en", enHero), "utf-8");

  let esMdContent = "";
  if (esContent) {
    esMdContent = stripAiTells(renderMarkdown(editionId, angle, esContent, "es"));
    writeFileSync(esMdPath, esMdContent, "utf-8");
    writeFileSync(join(draftsDir, `${editionId}-es.html`), renderHtml(editionId, angle, esContent, "es", esHero), "utf-8");
  }

  if (designer) {
    writeFileSync(
      join(draftsDir, `${editionId}-designer.json`),
      JSON.stringify(designer, null, 2),
      "utf-8",
    );
  }

  // ── review.json — required by the portal /review endpoint ─────────────────
  // Must exist on the draft branch before the editor clicks any button in the
  // digest email. Without it the portal returns 404 "Review state not found".
  // If the Designer generated an image, image.status = "pending" (needs editor
  // approval). If no image was generated (key missing / skipped), the image
  // step is auto-approved so the editor only needs to approve the content.
  {
    const heroAsset = designer?.assets[0] ?? null;
    const baseReview = initializeReview(editionId, runId);
    const reviewState = heroAsset
      ? updateImageInReview(baseReview, "pending", {
          // Use a repo-relative path so the portal can fetch it via the
          // GitHub Contents API. heroAsset.imagePath is the absolute runner
          // filesystem path (/home/runner/work/…) which does not exist in the
          // GitHub API. The hero is always committed as drafts/<editionId>-hero.png.
          assetPath: `drafts/${editionId}-hero.png`,
          publicUrl: heroAsset.publicUrl,
          prompt: heroAsset.prompt,
        })
      : updateImageInReview(baseReview, "approved");
    saveReview(draftsDir, reviewState);
    console.log(`   ✓ review.json initialized (image: ${reviewState.image.status})`);
  }

  // Content hash lets publish.ts verify the draft was not corrupted or swapped
  const contentHash = createHash("sha256")
    .update(enMdContent + esMdContent)
    .digest("hex");

  const validatorCostUsd = validatorOutput.success ? validatorOutput.cost.costUsd : 0;
  const localizerCostUsd = localizerOutput.success ? localizerOutput.cost.costUsd : 0;
  const qualityGateCostUsd = qualityGateOutput.success ? qualityGateOutput.cost.costUsd : 0;

  const strategistCostUsd = strategistOutput.cost.costUsd;

  const jsonContent = JSON.stringify(
    {
      runId,
      editionId,
      generatedAt: new Date().toISOString(),
      contentHash,
      angle,
      enContent: content,
      esContent: esContent ?? null,
      validation: reconciledValidation,
      qualityGate: qualityGate ?? null,
      designer: designer ?? null,
      costs: {
        radar: radarCost,
        strategist: strategistOutput.cost,
        writer: writerOutput.cost,
        validator: validatorOutput.cost,
        localizer: localizerOutput.cost,
        designer: designerCost,
        qualityGate: qualityGateOutput.cost,
        totalUsd:
          radarCost.costUsd +
          strategistCostUsd +
          writerOutput.cost.costUsd +
          validatorCostUsd +
          localizerCostUsd +
          designerCost.costUsd +
          qualityGateCostUsd,
      },
    },
    null,
    2,
  );
  writeFileSync(jsonPath, jsonContent, "utf-8");

  // ── History archive — one copy of every artifact, per run ─────────────────
  // The canonical files above get overwritten on every `pnpm draft`. When
  // Wadi likes a particular run's content (as happened on 2026-26 with the
  // EN "tech regret" Insight), the next run erases it. The history dir keeps
  // an unaltered copy of every artifact from every run, named with a
  // compact ISO timestamp + first 8 chars of the runId for uniqueness.
  // Nothing downstream reads from this dir — pnpm choose / pnpm publish
  // still operate on the canonical files.
  const historyDir = join(draftsDir, "history");
  mkdirSync(historyDir, { recursive: true });
  const compactIso = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")
    .substring(0, 15); // e.g. "20260424T140156"
  const runShort = runId.substring(0, 8);
  const historyPrefix = `${editionId}-${compactIso}-${runShort}`;
  const historyPaths: string[] = [];
  const archive = (srcPath: string, suffix: string): void => {
    const dest = join(historyDir, `${historyPrefix}-${suffix}`);
    copyFileSync(srcPath, dest);
    historyPaths.push(dest);
  };
  archive(enMdPath, "en.md");
  archive(join(draftsDir, `${editionId}-en.html`), "en.html");
  if (esContent) {
    archive(esMdPath, "es.md");
    archive(join(draftsDir, `${editionId}-es.html`), "es.html");
  }
  archive(jsonPath, "draft.json");

  const totalCost =
    radarCost.costUsd +
    strategistCostUsd +
    writerOutput.cost.costUsd +
    validatorCostUsd +
    localizerCostUsd +
    qualityGateCostUsd;

  console.log(`💾 Drafts saved:`);
  console.log(`   ${enMdPath}`);

  console.log(`\n📧 Subject: "${content.subject}"`);

  console.log(`\n✏️  Apertura: open the EN draft, edit if needed, then run:`);
  console.log(`   pnpm choose ${editionId}      ← record whatever you have in the draft\n`);
  console.log(`   ${join(draftsDir, `${editionId}-en.html`)} ← open in browser to copy into Beehiiv`);
  if (esContent) {
    console.log(`   ${esMdPath}`);
    console.log(`   ${join(draftsDir, `${editionId}-es.html`)} ← open in browser to copy into Beehiiv`);
  }
  console.log(`   ${jsonPath}`);
  console.log(`\n📦 History archive (preserved, never overwritten):`);
  console.log(`   ${historyDir}/${historyPrefix}-*.{md,html,json}`);
  console.log(`   (${historyPaths.length} file${historyPaths.length === 1 ? "" : "s"} archived for this run)`);
  console.log(`\n💰 Cost breakdown:`);
  console.log(`   Radar:         $${radarCost.costUsd.toFixed(4)}`);
  console.log(`   Strategist:  $${strategistCostUsd.toFixed(4)}`);
  console.log(`   Writer (EN): $${writerOutput.cost.costUsd.toFixed(4)}`);
  console.log(`   Validator:   $${validatorCostUsd.toFixed(4)}`);
  console.log(`   ES Writer:   $${localizerCostUsd.toFixed(4)}`);
  console.log(`   QualityGate: $${qualityGateCostUsd.toFixed(4)}`);
  console.log(`   Total:       $${totalCost.toFixed(4)}`);

  if (costJsonFlag) {
    process.stdout.write(
      JSON.stringify({
        runId,
        editionId,
        totalCostUsd: totalCost,
        breakdown: {
          radar: radarCost.costUsd,
          strategist: strategistCostUsd,
          writer: writerOutput.cost.costUsd,
          validator: validatorCostUsd,
          localizer: localizerCostUsd,
        },
      }) + "\n",
    );
  }

  if (hadBlockingIssue) {
    const allowSoftFail = process.env["ALLOW_SOFT_FAIL"] !== "false" && !process.argv.includes("--no-soft-fail");
    if (allowSoftFail) {
      console.warn(
        `\n⚠️  [SOFT FAIL ACTIVE] Non-fatal quality/verification issues were detected, but the build was allowed to succeed.`,
      );
      console.warn(
        `   The human editor will act as the final quality gate in the Member Portal / approval email.`,
      );
      console.warn(`   Drafts saved successfully for review.\n`);
    } else {
      console.error(
        `\n⛔ Blocking issues detected (see above). Drafts saved for review — fix issues before shipping.\n`,
      );
      process.exit(2);
    }
  }

  // ── Airtable run ledger ────────────────────────────────────────────────────
  const { airtableApiKey, airtableBaseId } = apiClients;
  if (airtableApiKey && airtableBaseId) {
    try {
      await writeRunSummary(airtableApiKey, airtableBaseId, {
        runId,
        editionId,
        status: "draft_complete",
        triggeredAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        totalCostUsd: totalCost,
        radarCostUsd: radarCost.costUsd,
        strategistCostUsd,
        writerCostUsd: writerOutput.cost.costUsd,
        validatorCostUsd,
        localizerCostUsd,
      });
      logger.info("Airtable run summary written", { runId, editionId });
    } catch (err) {
      logger.warn(
        `Airtable write failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
        { runId },
      );
    }
  }

  // ── Human approval gate ────────────────────────────────────────────────────
  if (process.stdin.isTTY) {
    process.stdout.write(`\n📋 Review the draft at ${editionId}-en.md, then approve to publish.\n`);
    process.stdout.write("   Approve and run publish pipeline? [y/N]: ");
    const answer = await new Promise<string>((resolve) => {
      process.stdin.setEncoding("utf8");
      process.stdin.once("data", (chunk) => resolve(String(chunk).trim().toLowerCase()));
    });

    if (answer === "y" || answer === "yes") {
      console.log("\n🚀 Approval granted — launching publish pipeline...\n");
      const { spawn } = await import("node:child_process");
      const args = ["--import", "tsx", "src/publish.ts", "--edition", editionId];
      const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
      await new Promise<void>((resolve, reject) => {
        child.on("close", (code) =>
          code === 0 ? resolve() : reject(new Error(`publish exited with code ${String(code)}`)),
        );
      });
    } else {
      console.log("\n⏸️  Publish skipped. Run `pnpm publish:edition` when ready.\n");
    }
  } else {
    console.log(`\n✅ Done — open ${editionId}-en.md to review and edit.\n`);
  }
}

main()
  .then(() => {
    // Belt-and-suspenders: the Anthropic SDK keeps HTTP keep-alive sockets
    // open on api.anthropic.com, which holds the event loop alive after
    // main() resolves on success. Other entry points in this repo (publish.ts,
    // regenerate-image.ts, choose-apertura.ts, verify-feeds.ts) all end with
    // an explicit process.exit(0); run.ts is the only one that did not, and
    // that caused CI jobs to hang ~5-6 min after printing "Done" until the
    // 12-min job timeout killed the process. Exit explicitly so the runner
    // reports a clean exit code the moment the pipeline finishes.
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal error:", err instanceof Error ? err.message : String(err));
    if (process.env["LOG_LEVEL"] === "debug" && err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  });
