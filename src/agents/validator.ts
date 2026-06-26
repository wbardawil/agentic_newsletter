import { z } from "zod";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import type { AgentInput } from "../types/agent-io.js";
import {
  LocalizedContentSchema,
  StrategicAngleSchema,
  ValidationResultSchema,
  type ValidationResult,
  type ValidationIssue,
} from "../types/edition.js";
import { SourceBundleSchema } from "../types/source-bundle.js";
import { extractTextFromMessage, parseLlmJson } from "../utils/llm-json.js";
import { findBannedPhrases } from "../utils/banned-phrases.js";

const ValidatorInputSchema = z.object({
  content: LocalizedContentSchema,
  angle: StrategicAngleSchema,
  /** Optional source bundle — when provided, enables deterministic temporal accuracy checks. */
  sourceBundle: SourceBundleSchema.optional(),
});
type ValidatorInput = z.infer<typeof ValidatorInputSchema>;

const MODEL = "claude-sonnet-4-5";

// ── Word count targets ────────────────────────────────────────────────────────

interface WordCountTarget {
  errorMin: number;
  errorMax: number;
  warnMin: number;
  warnMax: number;
  label: string;
}

const WORD_COUNT_TARGETS: Record<string, WordCountTarget> = {
  signal: { errorMin: 50, errorMax: 240, warnMin: 95, warnMax: 185, label: "Signal" },
  apertura: { errorMin: 50, errorMax: 200, warnMin: 70, warnMax: 130, label: "Apertura" },
  insight: { errorMin: 300, errorMax: 650, warnMin: 380, warnMax: 520, label: "Insight" },
  fieldReport: { errorMin: 75, errorMax: 300, warnMin: 110, warnMax: 190, label: "Field Report" },
  tool: { errorMin: 20, errorMax: 120, warnMin: 30, warnMax: 80, label: "Tool" },
  compass: { errorMin: 30, errorMax: 150, warnMin: 55, warnMax: 95, label: "Compass" },
};

const TOTAL_WORD_TARGET = { warnMin: 950, warnMax: 1300 };

// ── Compiled regex constants (not recreated per call) ─────────────────────────

// Match a real markdown bullet: marker + whitespace + content.
// Without the `\s+\S` tail this matches italicized `*text*` lines and
// stray `-` dashes — false positives that fire "Bullet points not
// permitted" on legitimate Insight prose. The Writer's hasBulletPoints
// uses the same shape so both agents agree on what counts as a bullet.
const BULLET_RE = /^[ \t]*[-*•]\s+\S/m;
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+/;

// ── Helpers ───────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Apertura body is encoded as multiple options delimited by
 * `===OPTION_A:style===\n<body>` markers. The per-option word-count
 * budget must be checked against the longest individual option, not
 * the concatenated total — otherwise 3 × ~100-word options trigger a
 * false over-length error.
 */
function longestAperturaOptionWords(body: string): number {
  const delimiter = /===OPTION_[ABC]:\w+===/g;
  if (!delimiter.test(body)) return countWords(body);
  const parts = body.split(delimiter).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return 0;
  return Math.max(...parts.map(countWords));
}

function findLongSentences(text: string, maxWords = 25): string[] {
  return text
    .split(SENTENCE_SPLIT_RE)
    .filter((s) => countWords(s) > maxWords)
    .slice(0, 3);
}

function hasBulletPoints(text: string): boolean {
  return BULLET_RE.test(text);
}

function getSectionText(
  content: ValidatorInput["content"],
  sectionType: string,
): string {
  const section = content.sections.find((s) => s.type === sectionType);
  return section?.body ?? "";
}

function loadPromptTemplate(): string {
  const promptPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "config",
    "prompts",
    "validator.md",
  );
  return readFileSync(promptPath, "utf-8");
}

function buildPrompt(
  context: AgentInput<ValidatorInput>,
  payload: ValidatorInput,
  sections: Record<string, string>,
): string {
  const template = loadPromptTemplate();
  return template
    .replace("{{runId}}", context.runId)
    .replace("{{editionId}}", context.editionId)
    .replace("{{osPillar}}", payload.angle.osPillar)
    .replace("{{peopleAngleChallenge}}", payload.angle.peopleAngle.challenge)
    .replace("{{peopleAngleFramework}}", payload.angle.peopleAngle.framework)
    .replace("{{subject}}", payload.content.subject)
    .replace("{{preheader}}", payload.content.preheader)
    .replace("{{apertura}}", sections["apertura"] ?? "")
    .replace("{{insight}}", sections["insight"] ?? "")
    .replace("{{fieldReport}}", sections["fieldReport"] ?? "")
    .replace("{{compass}}", sections["compass"] ?? "");
}

// ── LLM response schema ───────────────────────────────────────────────────────

const LlmIssueSchema = z.object({
  rule: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  section: z.string(),
  message: z.string(),
  excerpt: z.string().optional(),
});

// The LLM returns a nested assessment-object format that mirrors the rubric
// structure. We parse it here and flatten to named booleans below.
const AssessmentItemSchema = z.object({
  assessment: z.enum(["Excellent", "Good", "Needs Improvement", "Fails"]),
  reasoning: z.string().nullable().optional(),
  recommendation: z.string().nullable().optional(),
});

const LlmResponseSchema = z.object({
  osPillarConsistency: AssessmentItemSchema,
  peopleAngleSubstance: AssessmentItemSchema,
  reframe: AssessmentItemSchema.extend({
    excerpt: z.string().nullable().optional(),
  }),
  misdiagnosis: AssessmentItemSchema.extend({
    excerpt: z.string().nullable().optional(),
  }),
  fieldReport: AssessmentItemSchema.extend({
    entityDistinct: z.boolean().optional(),
    entityDistinctNote: z.string().nullable().optional(),
  }),
  shareableSentence: AssessmentItemSchema.extend({
    sentence: z.string().nullable().optional(),
  }),
  compass: AssessmentItemSchema.optional(),
  apertura: AssessmentItemSchema.optional(),
  llmIssues: z.array(LlmIssueSchema).default([]),
});

// ── Scoring ───────────────────────────────────────────────────────────────────

function computeScore(issues: ValidationIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "error") score -= 15;
    else if (issue.severity === "warning") score -= 5;
    else score -= 1;
  }
  return Math.max(0, score);
}

// ── Deterministic temporal & entity checks ───────────────────────────────────

const PAST_TENSE_VERB_RE =
  /\b(acquired|launched|announced|completed|signed|closed|deployed|released|merged|purchased|sold|filed|opened|secured|raised|won|lost|hired|fired|appointed|resigned|achieved|delivered|shipped|published|reported|confirmed|established|formed|restructured)\b/i;

/**
 * For each source with hasFutureOnlyFacts=true, extract a name anchor from
 * the title (first 2-4 word capitalized sequence) and check whether that
 * anchor appears near a past-tense verb in the Insight or Field Report.
 * Returns issues when temporal mismatches are detected.
 */
function detectTemporalMismatch(
  insight: string,
  fieldReport: string,
  sourceBundle: z.infer<typeof SourceBundleSchema> | undefined,
): ValidationIssue[] {
  if (!sourceBundle) return [];

  const issues: ValidationIssue[] = [];
  const combinedText = `${insight}\n\n${fieldReport}`;

  for (const source of sourceBundle.items) {
    if (!source.temporalSignals?.hasFutureOnlyFacts) continue;

    // Extract company/entity anchor: first sequence of 1-3 capitalized words from title
    const titleMatch = source.title.match(/\b([A-Z][a-záéíóúüñA-Z&]{1,}(?:\s+[A-Z][a-záéíóúüñA-Z&]{1,}){0,2})\b/);
    if (!titleMatch) continue;
    const anchor = titleMatch[1]!;

    // Check if the anchor appears in the draft near a past-tense verb (within ±60 chars)
    const anchorRe = new RegExp(anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const anchorIdx = combinedText.search(anchorRe);
    if (anchorIdx === -1) continue;

    const window = combinedText.substring(Math.max(0, anchorIdx - 20), anchorIdx + anchor.length + 80);
    if (PAST_TENSE_VERB_RE.test(window)) {
      issues.push({
        rule: "temporal-tense-mismatch",
        severity: "error",
        section: insight.includes(anchor) ? "insight" : "fieldReport",
        message:
          `Temporal inaccuracy detected: "${anchor}" appears with a past-tense verb, ` +
          `but the source "${source.outlet ?? source.title}" describes a future event. ` +
          `Rewrite using future or conditional tense.`,
        excerpt: window.substring(0, 120),
      });
    }
  }

  // Additional Check: Look for historical data (e.g. "May peak" or "mayo") coupled with completed/present tenses which are common temporal pitfalls
  const historicalTimeMatch = combinedText.match(/\b(May|mayo|June|junio)\s+(peak|apex|pico|máximo|mencionó|señaló|reportó)\b.*\b(has|have|had|dropped|fallen|lost|caído|perdido)\b/i) ||
                         combinedText.match(/\b(has|have|had|dropped|fallen|lost|caído|perdido)\b.*\b(May|mayo|June|junio)\s+(peak|apex|pico|máximo|mencionó|señaló|reportó)\b/i);
  if (historicalTimeMatch) {
    issues.push({
      rule: "historical-temporal-mismatch",
      severity: "warning",
      section: "overall",
      message: "Potential temporal mismatch: Historical data (e.g., May peak or previous months) may be framed with completed verbs as if occurring this week. Ensure it is framed as a historical report reference rather than a current-week action.",
      excerpt: historicalTimeMatch[0].substring(0, 120),
    });
  }

  return issues;
}

/**
 * Deterministic check: extract the first significant entity from the Apertura
 * and verify it does not appear as the anchor in the Field Report.
 * Converts the existing LLM-only check into a pre-LLM fail-fast gate.
 */
function detectFieldReportEntityDuplicate(
  apertura: string,
  fieldReport: string,
): ValidationIssue | null {
  if (!apertura || !fieldReport) return null;

  // Use first 80 words of apertura for entity extraction
  const aperturaHead = apertura.split(/\s+/).slice(0, 80).join(" ");
  const capitalTokenRe = /\b([A-Z][a-záéíóúüñA-Z]{2,}(?:\s+[A-Z][a-záéíóúüñA-Z]{2,})?)\b/g;

  const aperturaEntities: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = capitalTokenRe.exec(aperturaHead)) !== null) {
    const token = m[1]!;
    // Exclude common non-entity capitalized words
    if (!["The", "This", "That", "When", "While", "Most", "Many", "Some", "These", "Those"].includes(token)) {
      aperturaEntities.push(token.toLowerCase());
    }
  }

  const fieldReportLower = fieldReport.toLowerCase();
  const overlap = aperturaEntities.filter(
    (e) => e.length > 4 && fieldReportLower.includes(e),
  );

  if (overlap.length === 0) return null;

  return {
    rule: "field-report-entity-duplicate",
    severity: "error",
    section: "fieldReport",
    message: `Field Report reuses the Apertura's primary entity ("${overlap[0]}"). The Field Report must anchor on a DIFFERENT company or event than the Apertura's hook.`,
    excerpt: overlap[0],
  };
}

// ── Validator agent ───────────────────────────────────────────────────────────

export class ValidatorAgent extends BaseAgent<ValidatorInput, ValidationResult> {
  readonly name: AgentName = "validator";
  readonly inputSchema = ValidatorInputSchema;
  readonly outputSchema = ValidationResultSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    payload: ValidatorInput,
    context: AgentInput<ValidatorInput>,
  ): Promise<ValidationResult> {
    const sections = {
      signal: getSectionText(payload.content, "news"),
      apertura: getSectionText(payload.content, "lead"),
      insight: getSectionText(payload.content, "analysis"),
      fieldReport: getSectionText(payload.content, "spotlight"),
      tool: getSectionText(payload.content, "tool"),
      compass: getSectionText(payload.content, "quickTakes"),
    };

    const wordCounts = {
      signal: countWords(sections["signal"]),
      apertura: longestAperturaOptionWords(sections["apertura"] ?? ""),
      insight: countWords(sections["insight"]),
      fieldReport: countWords(sections["fieldReport"]),
      tool: countWords(sections["tool"]),
      compass: countWords(sections["compass"]),
      total: 0,
    };
    wordCounts.total =
      wordCounts.signal +
      wordCounts.apertura +
      wordCounts.insight +
      wordCounts.fieldReport +
      wordCounts.tool +
      wordCounts.compass;

    // ── Deterministic checks ────────────────────────────────────────────────
    const issues: ValidationIssue[] = [];

    // Word counts per section
    for (const [key, targets] of Object.entries(WORD_COUNT_TARGETS)) {
      const count = wordCounts[key as keyof typeof wordCounts];
      if (count < targets.errorMin || count > targets.errorMax) {
        issues.push({
          rule: `word-count-${key}`,
          severity: "error",
          section: key,
          message: `${targets.label} word count is ${count} — expected ${targets.errorMin}–${targets.errorMax}.`,
        });
      } else if (count < targets.warnMin || count > targets.warnMax) {
        issues.push({
          rule: `word-count-${key}`,
          severity: "warning",
          section: key,
          message: `${targets.label} word count is ${count} — target range is ${targets.warnMin}–${targets.warnMax}.`,
        });
      }
    }

    // Total word count
    if (
      wordCounts.total < TOTAL_WORD_TARGET.warnMin ||
      wordCounts.total > TOTAL_WORD_TARGET.warnMax
    ) {
      issues.push({
        rule: "word-count-total",
        severity: "warning",
        section: "overall",
        message: `Total word count is ${wordCounts.total} — target range is ${TOTAL_WORD_TARGET.warnMin}–${TOTAL_WORD_TARGET.warnMax}.`,
      });
    }

    // Banned phrases
    const fullText = Object.values(sections).join("\n\n");
    const found = findBannedPhrases(fullText);
    for (const phrase of found) {
      issues.push({
        rule: "banned-phrase",
        severity: "error",
        section: "overall",
        message: `Banned phrase detected: "${phrase}". Remove and replace with original language.`,
        excerpt: phrase,
      });
    }

    // Bullet points in Insight (forbidden)
    if (hasBulletPoints(sections["insight"])) {
      issues.push({
        rule: "no-bullets-in-insight",
        severity: "error",
        section: "insight",
        message: "Bullet points are not permitted in the Insight section. Rewrite as prose.",
      });
    }

    // Temporal accuracy: detect past-tense claims about future-only sources
    const temporalIssues = detectTemporalMismatch(
      sections["insight"],
      sections["fieldReport"],
      payload.sourceBundle,
    );
    issues.push(...temporalIssues);

    // Field Report entity distinctness: deterministic pre-LLM gate
    const entityDuplicateIssue = detectFieldReportEntityDuplicate(
      sections["apertura"],
      sections["fieldReport"],
    );
    if (entityDuplicateIssue) issues.push(entityDuplicateIssue);

    // Long sentences in Insight
    const longSentences = findLongSentences(sections["insight"]);
    for (const sentence of longSentences) {
      issues.push({
        rule: "sentence-length",
        severity: "warning",
        section: "insight",
        message: `Sentence exceeds 25 words (${countWords(sentence)} words). Break it up.`,
        excerpt: sentence.substring(0, 120),
      });
    }

    // ── LLM checks ──────────────────────────────────────────────────────────
    const prompt = buildPrompt(context, payload, sections);

    // The Validator prompt is a mix of static rules (the rubric, the banned-
    // phrase rationale, the shareable-sentence test) and the draft sections
    // under review. Caching the full prompt as one system block benefits
    // retries within the 5-minute window; the cache prefix-matches as long
    // as the rules text stays fixed.
    const stream = await this.deps.apiClients.anthropic.messages.stream({
      model: MODEL,
      // The nested assessment format (8 rubric items × assessment + reasoning
      // + recommendation) easily exceeds 1500 tokens and truncates the JSON
      // mid-string, producing a malformed-JSON parse error. 4000 gives the
      // model room to close the object cleanly.
      max_tokens: 4000,
      system: [
        {
          type: "text",
          text: prompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: "Validate the draft above. Output valid JSON only, matching the schema defined in the instructions.",
        },
      ],
    });

    const message = await stream.finalMessage();
    this.costTracker.recordUsage(
      MODEL,
      message.usage.input_tokens,
      message.usage.output_tokens,
    );

    const rawText = extractTextFromMessage(message.content);
    const llmRaw = LlmResponseSchema.parse(parseLlmJson(rawText, "ValidatorAgent"));

    // Flatten nested assessment objects to named booleans used throughout.
    function passes(item: { assessment: string }): boolean {
      return item.assessment === "Excellent" || item.assessment === "Good";
    }
    const llmData = {
      hasExplicitReframe:       passes(llmRaw.reframe),
      reframeExcerpt:           llmRaw.reframe.excerpt ?? null,
      misdiagnosisNamed:        passes(llmRaw.misdiagnosis),
      misdiagnosisExcerpt:      llmRaw.misdiagnosis.excerpt ?? null,
      shareableSentence:        llmRaw.shareableSentence.sentence ?? null,
      fieldReportIsIntelligence: passes(llmRaw.fieldReport),
      fieldReportNote:          llmRaw.fieldReport.recommendation ?? null,
      // entityDistinct is explicit when provided; fall back to overall assessment
      fieldReportEntityDistinct: llmRaw.fieldReport.entityDistinct ?? passes(llmRaw.fieldReport),
      fieldReportEntityNote:    llmRaw.fieldReport.entityDistinctNote ?? null,
      osPillarConsistent:       passes(llmRaw.osPillarConsistency),
      osPillarNote:             llmRaw.osPillarConsistency.recommendation ?? null,
      peopleAngleSubstantive:   passes(llmRaw.peopleAngleSubstance),
      peopleAngleNote:          llmRaw.peopleAngleSubstance.recommendation ?? null,
      // compass/apertura are optional rubric items; default to pass if absent
      compassIsGenuine:         llmRaw.compass ? passes(llmRaw.compass) : true,
      compassNote:              llmRaw.compass?.recommendation ?? null,
      aperturaStartsMidThought: llmRaw.apertura ? passes(llmRaw.apertura) : true,
      aperturaNote:             llmRaw.apertura?.recommendation ?? null,
      llmIssues:                llmRaw.llmIssues,
    };

    // Convert LLM boolean checks to issues
    if (!llmData.hasExplicitReframe) {
      issues.push({
        rule: "rule-11-reframe",
        severity: "error",
        section: "insight",
        message:
          "No explicit reframe found. The Insight must state the conventional understanding, then name why it is wrong, then offer the correct frame.",
      });
    }

    if (!llmData.misdiagnosisNamed) {
      issues.push({
        rule: "rule-12-misdiagnosis",
        severity: "warning",
        section: "insight",
        message:
          "The misdiagnosis move is absent. Name what the reader has already tried and why it solved the wrong problem.",
      });
    }

    if (!llmData.fieldReportIsIntelligence) {
      issues.push({
        rule: "field-report-intelligence",
        severity: "warning",
        section: "fieldReport",
        message: `Field Report reads as news curation, not corridor intelligence. ${llmData.fieldReportNote ?? ""}`,
      });
    }

    if (!llmData.fieldReportEntityDistinct) {
      issues.push({
        rule: "field-report-entity-distinct",
        severity: "warning",
        section: "fieldReport",
        message: `Field Report reuses the Apertura's primary entity. The Field Report must anchor on a DIFFERENT company or event than the Apertura's hook. ${llmData.fieldReportEntityNote ?? ""}`,
      });
    }

    if (!llmData.osPillarConsistent) {
      issues.push({
        rule: "os-pillar-consistency",
        severity: "error",
        section: "insight",
        message: `Declared OS pillar (${payload.angle.osPillar}) is inconsistent with the Insight content. ${llmData.osPillarNote ?? ""}`,
      });
    }

    if (!llmData.peopleAngleSubstantive) {
      issues.push({
        rule: "people-angle-substantive",
        severity: "error",
        section: "insight",
        message: `People dimension is not substantively woven into the Insight. Declared challenge: "${payload.angle.peopleAngle.challenge}" (${payload.angle.peopleAngle.framework}). ${llmData.peopleAngleNote ?? ""}`,
      });
    }

    if (!llmData.compassIsGenuine) {
      issues.push({
        rule: "rule-7-compass",
        severity: "warning",
        section: "compass",
        message: `Compass question does not read as genuine. ${llmData.compassNote ?? ""}`,
      });
    }

    if (!llmData.aperturaStartsMidThought) {
      issues.push({
        rule: "rule-3-apertura",
        severity: "warning",
        section: "apertura",
        message: `Apertura opens with a thesis statement or summary rather than mid-thought. ${llmData.aperturaNote ?? ""}`,
      });
    }

    for (const issue of llmData.llmIssues) {
      issues.push(issue);
    }

    if (llmData.shareableSentence === null) {
      issues.push({
        rule: "rule-14-shareability",
        severity: "warning",
        section: "insight",
        message:
          "No shareable sentence identified (Rule 14). The Insight needs one sentence the reader would screenshot and forward.",
      });
    }

    // ── Score and pass/fail ─────────────────────────────────────────────────
    const score = computeScore(issues);
    const hasErrors = issues.some((i) => i.severity === "error");
    const isValid = !hasErrors && score >= 70;

    // ── Recommendations ─────────────────────────────────────────────────────
    const recommendations: string[] = [];

    if (llmData.shareableSentence) {
      recommendations.push(
        `Shareable sentence candidate (Rule 14): "${llmData.shareableSentence}"`,
      );
    }
    if (llmData.reframeExcerpt) {
      recommendations.push(`Reframe confirmed: "${llmData.reframeExcerpt}"`);
    }
    if (isValid) {
      recommendations.push(
        "Draft passes automated checks. Replace the Apertura placeholder with your real field observation before publishing.",
      );
    } else {
      const errorCount = issues.filter((i) => i.severity === "error").length;
      recommendations.push(
        `${errorCount} error(s) must be resolved before this draft is ready for review.`,
      );
    }

    return {
      isValid,
      score,
      issues,
      wordCounts,
      shareableSentence: llmData.shareableSentence,
      recommendations,
    };
  }
}
