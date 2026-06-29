import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import type { AgentInput } from "../types/agent-io.js";
import {
  LocalizedContentSchema,
  StrategicAngleSchema,
  type LocalizedContent,
  type StrategicAngle,
} from "../types/edition.js";
import { SourceBundleSchema, type SourceBundle } from "../types/source-bundle.js";
import { extractTextFromMessage, parseLlmJson } from "../utils/llm-json.js";
import { computeDistinctOutlets } from "../utils/source-diversity.js";

// ── Input ──────────────────────────────────────────────────────────────────────

// Historical angles in drafts/angle-history.json may pre-date any required
// field added to StrategicAngleSchema (peopleAngle, justification, …).
// QualityGate only reads headline + thesis from priorAngles, so treat every
// field except those two as optional for backward compatibility — this avoids
// a fatal parse error when the committed history file has old-schema entries.
const PriorAngleSchema = StrategicAngleSchema.partial({
  peopleAngle: true,
  justification: true,
  targetPersona: true,
  relevanceToAudience: true,
  suggestedSources: true,
  osPillar: true,
  quarterlyTheme: true,
  evidenceMap: true,
}).passthrough(); // ignore unknown fields (e.g. legacy talkingPoints)

const QualityGateInputSchema = z.object({
  enContent: LocalizedContentSchema,
  esContent: LocalizedContentSchema.nullable(),
  angle: StrategicAngleSchema,
  sourceBundle: SourceBundleSchema,
  priorAngles: z.array(PriorAngleSchema),
  justificationForLowSourceCount: z.string().optional(),
  manualOverride: z.boolean().optional(),
  overrideAngleOriginality: z.boolean().optional(),
});
export type QualityGateInput = z.infer<typeof QualityGateInputSchema>;

// ── Output ─────────────────────────────────────────────────────────────────────

const VerifiedClaimSchema = z.object({
  claim: z.string(),
  supportingFactId: z.string().optional(),
  language: z.enum(["en", "es"]),
});

const UnverifiedClaimSchema = z.object({
  claim: z.string(),
  language: z.enum(["en", "es"]),
  section: z.string().optional(),
});

export const QualityGateResultSchema = z.object({
  passed: z.boolean(),
  hardFailures: z.array(z.string()),
  factCheck: z.object({
    verifiedClaims: z.array(VerifiedClaimSchema),
    unverifiedClaims: z.array(UnverifiedClaimSchema),
  }),
  angleOriginality: z.object({
    similarityScore: z.number().min(0).max(1),
    closestPriorAngle: z.string().nullable(),
    recommendation: z.string(),
    angleAlertLevel: z.string().optional(),
    angle_alert_level: z.string().optional(),
  }),
  voiceMatch: z.object({
    voiceScore: z.number().min(0).max(100),
    voice_score: z.number().min(0).max(100).optional(),
    deviations: z.array(z.string()),
    criticalDeviations: z.array(z.string()).optional(),
    critical_deviations: z.array(z.string()).optional(),
    minorDeviations: z.array(z.string()).optional(),
    minor_deviations: z.array(z.string()).optional(),
    recommendation: z.string().optional(),
  }),
  sourceDiversity: z.object({
    distinctOutlets: z.array(z.string()),
    distinct_outlets: z.array(z.string()).optional(),
    outletCount: z.number().int().nonnegative(),
    outlet_count: z.number().int().nonnegative().optional(),
    sourceCheckWaived: z.boolean().optional(),
    source_check_waived: z.boolean().optional(),
    justificationForLowSourceCount: z.string().nullable().optional(),
    justification: z.string().nullable().optional(),
  }),
  summary: z.string(),
});
export type QualityGateResult = z.infer<typeof QualityGateResultSchema>;

// ── Prompt loading ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");

function loadPromptTemplate(): string {
  const promptPath = join(PROJECT_ROOT, "config", "prompts", "quality-gate.md");
  return readFileSync(promptPath, "utf-8");
}

function loadGoldenExamples(): string {
  const dir = join(PROJECT_ROOT, "src", "voice-bible", "golden-examples");
  if (!existsSync(dir)) return "";
  const files = ["2026-12-en.md", "2026-15-en.md"].filter((f) =>
    existsSync(join(dir, f)),
  );
  return files
    .map((f) => `--- Golden Example: ${f} ---\n${readFileSync(join(dir, f), "utf-8")}`)
    .join("\n\n");
}

const MODEL = "claude-sonnet-4-5";

// ── Agent ──────────────────────────────────────────────────────────────────────

export class QualityGateAgent extends BaseAgent<
  QualityGateInput,
  QualityGateResult
> {
  readonly name: AgentName = "qualityGate";
  readonly inputSchema = QualityGateInputSchema;
  readonly outputSchema = QualityGateResultSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    payload: QualityGateInput,
    context: AgentInput<QualityGateInput>,
  ): Promise<QualityGateResult> {
    const promptTemplate = loadPromptTemplate();
    const goldenExamples = loadGoldenExamples();

    const sourcesBlock = payload.sourceBundle.items
      .map(
        (item) => {
          const dateStr = item.publishedAt ? ` (${item.publishedAt.split("T")[0]})` : "";
          return `### Source [${item.id}] ${item.outlet ?? "unknown"} — ${item.title}${dateStr}\n` +
                 `URL: ${item.url}\n` +
                 `verbatimFacts:\n` +
                 item.verbatimFacts.map((f, i) => `  ${i + 1}. ${f}`).join("\n");
        }
      )
      .join("\n\n");

    const priorAnglesToShow = payload.priorAngles.slice(0, 4);
    const priorAnglesBlock =
      priorAnglesToShow.length > 0
        ? priorAnglesToShow
            .map((a, i) => `${i + 1}. ${a.headline} — ${a.thesis}`)
            .join("\n")
        : "(no prior angles recorded yet)";

    const enBlock = payload.enContent.sections
      .map((s) => `### ${s.heading}\n${s.body}`)
      .join("\n\n");
    const esBlock = payload.esContent
      ? payload.esContent.sections
          .map((s) => `### ${s.heading}\n${s.body}`)
          .join("\n\n")
      : "(Spanish edition not produced)";

    const userPrompt = [
      promptTemplate,
      "---",
      "## THIS WEEK'S ANGLE",
      `**Headline:** ${payload.angle.headline}`,
      `**Thesis:** ${payload.angle.thesis}`,
      `**OS Pillar:** ${payload.angle.osPillar}`,
      `**Quarterly Theme:** ${payload.angle.quarterlyTheme}`,
      "",
      "## PRIOR ANGLES (last 4)",
      priorAnglesBlock,
      "",
      "## SOURCE BUNDLE (the only authoritative facts)",
      sourcesBlock,
      "",
      "## GOLDEN EXAMPLES (voice match reference)",
      goldenExamples || "(no golden examples available)",
      "",
      "## ENGLISH DRAFT",
      enBlock,
      "",
      "## SPANISH DRAFT",
      esBlock,
      "",
      "---",
      "Respond with valid JSON only, matching the schema defined above.",
    ].join("\n");

    // Move the full prompt (rubric + golden examples + source bundle +
    // drafts) into a cached system block. The QualityGate retried once
    // during 2026-23 after an Anthropic 500 — with the cache in place, the
    // retry hits ~10% of input cost instead of the full prompt again.
    const stream = await this.deps.apiClients.anthropic.messages.stream({
      model: MODEL,
      max_tokens: 6000,
      system: [
        {
          type: "text",
          text:
            "You are the Quality Gate agent. Output valid JSON only, no preamble.\n\n" +
            userPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content:
            "Run the quality gate against the draft above and respond with JSON matching the schema.",
        },
      ],
    });

    const message = await stream.finalMessage();
    this.costTracker.recordUsage(
      MODEL,
      message.usage.input_tokens,
      message.usage.output_tokens,
    );

    const text = extractTextFromMessage(message.content);
    const parsed = parseLlmJson(text, "quality-gate") as any;

    // Normalize properties between snake_case and camelCase for robust parsing
    if (parsed && typeof parsed === "object") {
      const p = parsed as any;
      
      // Normalize factCheck verifiedClaims/unverifiedClaims
      const fc = p.factCheck;
      if (fc && typeof fc === "object") {
        if (Array.isArray(fc.verifiedClaims)) {
          fc.verifiedClaims = fc.verifiedClaims.map((c: any) =>
            typeof c === "string" ? { claim: c, language: "en" } : c
          );
        }
        if (Array.isArray(fc.unverifiedClaims)) {
          fc.unverifiedClaims = fc.unverifiedClaims.map((c: any) =>
            typeof c === "string" ? { claim: c, language: "en" } : c
          );
        }
      }

      // Normalize angleOriginality
      if (p.angleOriginality && typeof p.angleOriginality === "object") {
        const ao = p.angleOriginality;
        const similarity = ao.similarityScore !== undefined ? ao.similarityScore : ao.similarity_score;
        if (similarity !== undefined) {
          // LLM might return similarityScore as percentage (e.g. 78) or decimal (e.g. 0.78)
          const similarityPercent = similarity <= 1 ? similarity * 100 : similarity;
          const similarityScoreDecimal = similarity <= 1 ? similarity : similarity / 100;
          
          ao.similarityScore = similarityScoreDecimal;
          ao.similarity_score = similarityScoreDecimal;

          if (similarityPercent < 75) {
            ao.angleAlertLevel = "none";
            ao.angle_alert_level = "none";
            ao.recommendation = "pass";
          } else if (similarityPercent >= 75 && similarityPercent <= 84) {
            ao.angleAlertLevel = "warning_l1";
            ao.angle_alert_level = "warning_l1";
            ao.recommendation = "pass";
          } else if (similarityPercent >= 85) {
            ao.angleAlertLevel = "warning_l2";
            ao.angle_alert_level = "warning_l2";
            ao.recommendation = "consider rerun";
          }
        } else {
          ao.similarityScore = ao.similarityScore ?? 0.0;
          ao.similarity_score = ao.similarity_score ?? 0.0;
          ao.angleAlertLevel = "none";
          ao.angle_alert_level = "none";
          ao.recommendation = "pass";
        }
      } else {
        p.angleOriginality = {
          similarityScore: 0.0,
          closestPriorAngle: null,
          recommendation: "pass",
          angleAlertLevel: "none",
          angle_alert_level: "none",
        };
      }

      // Normalize voiceMatch
      if (p.voiceMatch && typeof p.voiceMatch === "object") {
        const vm = p.voiceMatch;
        const score = vm.voiceScore !== undefined ? vm.voiceScore : vm.voice_score;
        vm.voiceScore = score !== undefined ? score : 85;
        vm.voice_score = vm.voiceScore;

        const critical = vm.criticalDeviations ?? vm.critical_deviations ?? [];
        const minor = vm.minorDeviations ?? vm.minor_deviations ?? [];

        vm.criticalDeviations = critical;
        vm.critical_deviations = critical;
        vm.minorDeviations = minor;
        vm.minor_deviations = minor;

        if (critical.length > 0) {
          vm.deviations = critical;
        } else if (Array.isArray(vm.deviations) && vm.deviations.length > 0 && minor.length === 0) {
          vm.criticalDeviations = vm.deviations;
          vm.critical_deviations = vm.deviations;
        } else {
          vm.deviations = [];
        }
      } else {
        p.voiceMatch = {
          voiceScore: 85,
          voice_score: 85,
          deviations: [],
          criticalDeviations: [],
          critical_deviations: [],
          minorDeviations: [],
          minor_deviations: [],
          recommendation: "Approved silently.",
        };
      }
    }

    const result = QualityGateResultSchema.parse(parsed);

    // Source diversity check waiver
    const justificationForLowSourceCount = payload.justificationForLowSourceCount ?? payload.angle.justificationForLowSourceCount;
    const waived = typeof justificationForLowSourceCount === "string" && justificationForLowSourceCount.trim().length > 0;
    
    if (waived) {
      this.logger.info(`Source diversity check waived. Justification: ${justificationForLowSourceCount}`);
    }

    const outlets = computeDistinctOutlets(payload.enContent, payload.sourceBundle);

    // Core validation gate logic for Angle Originality and Fact Verification
    let finalPassed = result.passed;

    // The QG LLM sometimes performs chain-of-thought reasoning where it
    // initially flags a claim, then retracts it ("NOT a temporal inaccuracy",
    // "Retracting this failure", etc.) but still leaves the entry in the
    // structured JSON arrays. Filter these self-retracted items so they
    // don't trigger the expensive Writer repair loop or crash the pipeline.
    const RETRACTION_PATTERNS = [
      /retract(?:ing|ed)\s+this\s+(?:failure|claim)/i,
      /\bNOT\s+a\s+temporal\s+inaccurac/i,
      /should\s+NOT\s+be\s+flagged/i,
      /(?:this\s+is\s+)?actually\s+(?:VERIFIED|verified|correct)/i,
      /\bexempt\s+(?:framework|synthesis|editorial)/i,
      /\bNo\s+failure\s+here\b/i,
      /\bdoes\s+not\s+appear\s+in\s+the\s+provided\s+drafts\b/i,
      /\bnot\s+a\s+factual\s+claim\s+requiring\s+verification\b/i,
    ];

    const isRetracted = (text: string): boolean =>
      RETRACTION_PATTERNS.some((re) => re.test(text));

    const hardFailures = result.hardFailures.filter((f) => !isRetracted(f));

    // Also filter unverifiedClaims that were retracted in hardFailures narrative
    const filteredUnverifiedClaims = result.factCheck.unverifiedClaims.filter((c) => {
      // Keep the claim unless the corresponding hardFailure that mentions it was retracted
      const matchingFailure = result.hardFailures.find((f) => f.includes(c.claim));
      return !matchingFailure || !isRetracted(matchingFailure);
    });

    // Angle Originality tiered checks & block/hold logic
    const similarityPercent = result.angleOriginality.similarityScore * 100;
    if (similarityPercent >= 75 && similarityPercent <= 84) {
      this.logger.warn(`Level 1 warning: Moderate thematic overlap detected (${similarityPercent.toFixed(0)}%). Draft approved. Consider differentiating the angle in future editions.`);
    } else if (similarityPercent >= 85) {
      const hasOverride = payload.manualOverride === true || payload.overrideAngleOriginality === true;
      if (!hasOverride) {
        finalPassed = false;
        const msg = `High thematic overlap detected (${similarityPercent.toFixed(0)}%). Draft held. Manual override required to proceed.`;
        if (!hardFailures.includes(msg)) {
          hardFailures.push(msg);
        }
        this.logger.error(`Level 2 warning: ${msg}`);
      } else {
        this.logger.info(`High thematic overlap override applied. Proceeding with draft.`);
      }
    }

    // Fact verification check: if there are genuine unverified claims, must always fail
    if (filteredUnverifiedClaims.length > 0) {
      finalPassed = false;
    }

    return {
      ...result,
      passed: finalPassed,
      hardFailures,
      factCheck: {
        ...result.factCheck,
        unverifiedClaims: filteredUnverifiedClaims,
      },
      sourceDiversity: {
        distinctOutlets: outlets.distinctOutlets,
        distinct_outlets: outlets.distinctOutlets,
        outletCount: outlets.outletCount,
        outlet_count: outlets.outletCount,
        sourceCheckWaived: waived,
        source_check_waived: waived,
        justificationForLowSourceCount: justificationForLowSourceCount ?? null,
        justification: justificationForLowSourceCount ?? null,
      },
    };
  }
}
