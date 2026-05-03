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

// Historical angles in drafts/angle-history.json may pre-date the peopleAngle
// requirement (Option C migration). QualityGate only reads headline + thesis
// from priorAngles, so loosen the field for backward compatibility — this
// avoids a fatal parse error on the first post-migration run while keeping
// the current angle strictly validated.
const PriorAngleSchema = StrategicAngleSchema.partial({ peopleAngle: true });

const QualityGateInputSchema = z.object({
  enContent: LocalizedContentSchema,
  esContent: LocalizedContentSchema.nullable(),
  angle: StrategicAngleSchema,
  sourceBundle: SourceBundleSchema,
  priorAngles: z.array(PriorAngleSchema),
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
    recommendation: z.enum(["pass", "consider rerun"]),
  }),
  voiceMatch: z.object({
    voiceScore: z.number().min(0).max(100),
    deviations: z.array(z.string()),
  }),
  sourceDiversity: z.object({
    distinctOutlets: z.array(z.string()),
    outletCount: z.number().int().nonnegative(),
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
        (item) =>
          `### Source [${item.id}] ${item.outlet ?? "unknown"} — ${item.title}\n` +
          `URL: ${item.url}\n` +
          `verbatimFacts:\n` +
          item.verbatimFacts.map((f, i) => `  ${i + 1}. ${f}`).join("\n"),
      )
      .join("\n\n");

    const priorAnglesBlock =
      payload.priorAngles.length > 0
        ? payload.priorAngles
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
      "## PRIOR ANGLES (last 8)",
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
    const parsed = parseLlmJson(text, "quality-gate") as unknown;
    const result = QualityGateResultSchema.parse(parsed);

    // Source diversity is a pure URL-parse, not a judgment call. Override the
    // LLM's count with the deterministic computation so we do not silently
    // ship an LLM miscount.
    return {
      ...result,
      sourceDiversity: computeDistinctOutlets(payload.enContent, payload.sourceBundle),
    };
  }
}
