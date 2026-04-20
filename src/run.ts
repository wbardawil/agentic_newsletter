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
import { QualityGateAgent, type QualityGateResult } from "./agents/quality-gate.js";
import type { LocalizedContent, ValidationResult } from "./types/edition.js";
import type { SourceBundle } from "./types/source-bundle.js";
import type { StrategicAngle } from "./types/edition.js";
import { writeRunSummary } from "./utils/airtable.js";
import { loadAngleHistory, recordAngle } from "./utils/angle-history.js";
import { scanEdition } from "./utils/citation-guard.js";

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Decode the encoded apertura options block and render as labeled sections.
 * If the body has no option delimiters (e.g. ES transcreation), return as-is.
 */
function renderAperturaOptions(body: string, editionId: string): string[] {
  const delimiterRe = /===OPTION_([ABC]):(\w+)===/g;
  if (!delimiterRe.test(body)) {
    // Single option or already edited — show as-is
    return [body];
  }
  delimiterRe.lastIndex = 0;
  const parts = body.split(/===OPTION_[ABC]:\w+===/);
  const headers = [...body.matchAll(/===OPTION_([ABC]):(\w+)===/g)];
  const lines: string[] = [
    `> **Pick one, edit it, then run:** \`pnpm choose ${editionId} A\` / \`B\` / \`C\` - or edit freely and run \`pnpm choose ${editionId}\``,
    ``,
  ];
  for (let i = 0; i < headers.length; i++) {
    const label = headers[i]![1]!;
    const style = headers[i]![2]!;
    const text = (parts[i + 1] ?? "").trim();
    lines.push(`### Option ${label} - ${style}`);
    lines.push(``);
    lines.push(text);
    lines.push(``);
  }
  return lines;
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
  const reviewNote = isEs
    ? `> ⚠️ REVISIÓN: Reemplaza esta apertura con tu observación real de campo de esta semana.`
    : `> ⚠️ WADI REVIEW: Replace this placeholder with your real field observation from this week.`;

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
      ? []
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
      ? renderAperturaOptions(apertura?.body ?? "", editionId)
      : [`> ⚠️ REVISIÓN: Verifica que esta transcreación conserve la intención de la apertura elegida en inglés.`, ``, apertura?.body ?? ""]),
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

function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;

  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith("# ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (line.startsWith("> ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    } else if (line === "---" || line === "***") {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("<hr>");
    } else if (line === "") {
      if (inList) { out.push("</ul>"); inList = false; }
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function renderHtml(
  editionId: string,
  angle: StrategicAngle,
  content: LocalizedContent,
  language: "en" | "es",
): string {
  const md = renderMarkdown(editionId, angle, content, language);
  const body = mdToHtml(md);
  return `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${content.subject}</title>
<style>
  body { font-family: Georgia, serif; max-width: 680px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.7; }
  h1 { font-size: 1.6rem; margin-bottom: 4px; }
  h2 { font-size: 1.2rem; text-transform: uppercase; letter-spacing: .08em; margin-top: 2.5rem; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 1rem; }
  p { margin: 1rem 0; }
  blockquote { border-left: 3px solid #888; margin: 1.5rem 0; padding-left: 1rem; color: #555; }
  hr { border: none; border-top: 1px solid #ddd; margin: 2rem 0; }
  ul { padding-left: 1.5rem; }
  li { margin: .4rem 0; }
  strong { font-weight: 700; }
</style>
</head>
<body>
${body}
</body>
</html>`;
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

  const bundle = radarOutput.data as SourceBundle;
  console.log(
    `   ✓ Selected ${bundle.totalSelected} items from ${bundle.metadata.feedsScanned} feeds\n`,
  );

  // ── Strategist ─────────────────────────────────────────────────────────────
  console.log("🧠 Step 2/3 — Strategist: selecting angle...");
  const strategistAgent = new StrategistAgent(deps);
  const strategistOutput = await strategistAgent.run({
    runId,
    editionId,
    agentName: "strategist",
    payload: bundle,
  });

  if (!strategistOutput.success) {
    console.error(`❌ Strategist failed: ${strategistOutput.error}`);
    process.exit(1);
  }

  const angle = strategistOutput.data as StrategicAngle;
  console.log(`   ✓ Angle: "${angle.headline}"`);
  console.log(`   ✓ Pillar: ${angle.osPillar}`);
  console.log(`   ✓ Theme: ${angle.quarterlyTheme}\n`);

  // ── Writer ─────────────────────────────────────────────────────────────────
  console.log("✍️  Step 3/4 — Writer: drafting newsletter...");
  const writerAgent = new WriterAgent(deps);
  const writerOutput = await writerAgent.run({
    runId,
    editionId,
    agentName: "writer",
    payload: {
      angle,
      sources: bundle.items,
      language: "en",
      draftsDir,
    },
  });

  if (!writerOutput.success) {
    console.error(`❌ Writer failed: ${writerOutput.error}`);
    process.exit(1);
  }

  const content = writerOutput.data as LocalizedContent;
  console.log(`   ✓ Draft complete (${content.sections.length} sections)\n`);

  // ── Validator ──────────────────────────────────────────────────────────────
  console.log("🔎 Step 4/5 — Validator: checking draft against Voice Bible...");
  const validatorAgent = new ValidatorAgent(deps);
  const validatorOutput = await validatorAgent.run({
    runId,
    editionId,
    agentName: "validator",
    payload: { content, angle },
  });

  const validation = validatorOutput.data as ValidationResult | undefined;

  if (!validatorOutput.success || !validation) {
    console.warn(`   ⚠️  Validator failed: ${validatorOutput.error}. Continuing without QA score.\n`);
  } else {
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
  }

  // ── Localizer ──────────────────────────────────────────────────────────────
  console.log("🌎 Step 5/5 — Localizer: transcreating to Spanish...");
  const localizerAgent = new LocalizerAgent(deps);
  const localizerOutput = await localizerAgent.run({
    runId,
    editionId,
    agentName: "localizer",
    payload: { content, angle, targetLanguage: "es" },
  });

  const esContent = localizerOutput.success
    ? (localizerOutput.data as LocalizedContent)
    : null;

  if (!localizerOutput.success || !esContent) {
    console.warn(`   ⚠️  Localizer failed: ${localizerOutput.error}. Spanish draft skipped.\n`);
  } else {
    console.log(`   ✓ Spanish edition ready (${esContent.sections.length} sections)\n`);
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

  let qualityGate: QualityGateResult | undefined;
  if (!qualityGateOutput.success) {
    console.warn(
      `   ⚠️  Quality Gate failed: ${qualityGateOutput.error}. Continuing without fact verification.\n`,
    );
  } else {
    qualityGate = qualityGateOutput.data as QualityGateResult;
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
      console.error(`\n   Draft cannot ship with fabricated claims. Aborting.\n`);
      process.exit(2);
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
    if (qualityGate.sourceDiversity.outletCount < 3) {
      console.warn(
        `   ⚠️  Low source diversity: only ${qualityGate.sourceDiversity.outletCount} outlets cited\n`,
      );
    }
  }

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
    process.exit(2);
  }

  // Record this angle in history for future originality checks
  recordAngle(draftsDir, editionId, angle);

  const enMdPath = join(draftsDir, `${editionId}-en.md`);
  const esMdPath = join(draftsDir, `${editionId}-es.md`);
  const jsonPath = join(draftsDir, `${editionId}-draft.json`);

  // Overwrite protection: back up existing draft before clobbering
  if (existsSync(jsonPath)) {
    copyFileSync(jsonPath, `${jsonPath}.bak`);
    logger.info(`Backed up existing draft to ${jsonPath}.bak`);
  }

  const enMdContent = renderMarkdown(editionId, angle, content, "en");
  writeFileSync(enMdPath, enMdContent, "utf-8");
  writeFileSync(join(draftsDir, `${editionId}-en.html`), renderHtml(editionId, angle, content, "en"), "utf-8");

  let esMdContent = "";
  if (esContent) {
    esMdContent = renderMarkdown(editionId, angle, esContent, "es");
    writeFileSync(esMdPath, esMdContent, "utf-8");
    writeFileSync(join(draftsDir, `${editionId}-es.html`), renderHtml(editionId, angle, esContent, "es"), "utf-8");
  }

  // Content hash lets publish.ts verify the draft was not corrupted or swapped
  const contentHash = createHash("sha256")
    .update(enMdContent + esMdContent)
    .digest("hex");

  const validatorCostUsd = validatorOutput.success ? validatorOutput.cost.costUsd : 0;
  const localizerCostUsd = localizerOutput.success ? localizerOutput.cost.costUsd : 0;
  const qualityGateCostUsd = qualityGateOutput.success ? qualityGateOutput.cost.costUsd : 0;

  const jsonContent = JSON.stringify(
    {
      runId,
      editionId,
      generatedAt: new Date().toISOString(),
      contentHash,
      angle,
      enContent: content,
      esContent: esContent ?? null,
      validation: validatorOutput.success ? validation : null,
      qualityGate: qualityGate ?? null,
      costs: {
        radar: radarOutput.cost,
        strategist: strategistOutput.cost,
        writer: writerOutput.cost,
        validator: validatorOutput.cost,
        localizer: localizerOutput.cost,
        qualityGate: qualityGateOutput.cost,
        totalUsd:
          radarOutput.cost.costUsd +
          strategistOutput.cost.costUsd +
          writerOutput.cost.costUsd +
          validatorCostUsd +
          localizerCostUsd +
          qualityGateCostUsd,
      },
    },
    null,
    2,
  );
  writeFileSync(jsonPath, jsonContent, "utf-8");

  const totalCost =
    radarOutput.cost.costUsd +
    strategistOutput.cost.costUsd +
    writerOutput.cost.costUsd +
    validatorCostUsd +
    localizerCostUsd +
    qualityGateCostUsd;

  console.log(`💾 Drafts saved:`);
  console.log(`   ${enMdPath}`);
  console.log(`\n✏️  Apertura: open the EN draft, pick your option, then run:`);
  console.log(`   pnpm choose ${editionId} A    ← record Option A`);
  console.log(`   pnpm choose ${editionId} B    ← record Option B`);
  console.log(`   pnpm choose ${editionId} C    ← record Option C`);
  console.log(`   pnpm choose ${editionId}      ← record whatever you edited\n`);
  console.log(`   ${join(draftsDir, `${editionId}-en.html`)} ← open in browser to copy into Beehiiv`);
  if (esContent) {
    console.log(`   ${esMdPath}`);
    console.log(`   ${join(draftsDir, `${editionId}-es.html`)} ← open in browser to copy into Beehiiv`);
  }
  console.log(`   ${jsonPath}`);
  console.log(`\n💰 Cost breakdown:`);
  console.log(`   Radar:      $${radarOutput.cost.costUsd.toFixed(4)}`);
  console.log(`   Strategist: $${strategistOutput.cost.costUsd.toFixed(4)}`);
  console.log(`   Writer:     $${writerOutput.cost.costUsd.toFixed(4)}`);
  console.log(`   Validator:  $${validatorCostUsd.toFixed(4)}`);
  console.log(`   Localizer:  $${localizerCostUsd.toFixed(4)}`);
  console.log(`   QualityGate:$${qualityGateCostUsd.toFixed(4)}`);
  console.log(`   Total:      $${totalCost.toFixed(4)}`);

  if (costJsonFlag) {
    process.stdout.write(
      JSON.stringify({
        runId,
        editionId,
        totalCostUsd: totalCost,
        breakdown: {
          radar: radarOutput.cost.costUsd,
          strategist: strategistOutput.cost.costUsd,
          writer: writerOutput.cost.costUsd,
          validator: validatorCostUsd,
          localizer: localizerCostUsd,
        },
      }) + "\n",
    );
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
        radarCostUsd: radarOutput.cost.costUsd,
        strategistCostUsd: strategistOutput.cost.costUsd,
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

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  if (process.env["LOG_LEVEL"] === "debug" && err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
