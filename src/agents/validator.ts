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
import { extractTextFromMessage, parseLlmJson } from "../utils/llm-json.js";

const ValidatorInputSchema = z.object({
  content: LocalizedContentSchema,
  angle: StrategicAngleSchema,
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

// ── Banned phrases (deterministic, case-insensitive) ─────────────────────────

const BANNED_PHRASES: string[] = [
  "digital transformation",
  "leverage ai",
  "ai-powered",
  "disruptive",
  "disruption",
  "synergy",
  "synergies",
  "best practices",
  "low-hanging fruit",
  "move the needle",
  "scalable solution",
  "going forward",
  "value-add",
  "holistic approach",
  "thought leader",
  "thought leadership",
  "game-changer",
  "game changer",
  "circle back",
  "boil the ocean",
  "take it to the next level",
  "world-class",
];

// ── Compiled regex constants (not recreated per call) ─────────────────────────

const BULLET_RE = /^\s*[-*•]/m;
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+/;
// Word-boundary patterns built once from BANNED_PHRASES list (populated below)
let _bannedPhrasePatterns: RegExp[] | null = null;
function getBannedPhrasePatterns(): RegExp[] {
  if (_bannedPhrasePatterns) return _bannedPhrasePatterns;
  _bannedPhrasePatterns = BANNED_PHRASES.map(
    (phrase) =>
      new RegExp(
        `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i",
      ),
  );
  return _bannedPhrasePatterns;
}

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

function findBannedPhrases(text: string): string[] {
  const patterns = getBannedPhrasePatterns();
  return BANNED_PHRASES.filter((_, i) => patterns[i]?.test(text));
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

const LlmResponseSchema = z.object({
  hasExplicitReframe: z.boolean(),
  reframeExcerpt: z.string().nullable().optional(),
  misdiagnosisNamed: z.boolean(),
  misdiagnosisExcerpt: z.string().nullable().optional(),
  shareableSentence: z.string().nullable(),
  fieldReportIsIntelligence: z.boolean(),
  fieldReportNote: z.string().nullable().optional(),
  osPillarConsistent: z.boolean(),
  osPillarNote: z.string().nullable().optional(),
  compassIsGenuine: z.boolean(),
  compassNote: z.string().nullable().optional(),
  aperturaStartsMidThought: z.boolean(),
  aperturaNote: z.string().nullable().optional(),
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
      max_tokens: 1500,
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
    const llmData = LlmResponseSchema.parse(parseLlmJson(rawText, "ValidatorAgent"));

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

    if (!llmData.osPillarConsistent) {
      issues.push({
        rule: "os-pillar-consistency",
        severity: "error",
        section: "insight",
        message: `Declared OS pillar (${payload.angle.osPillar}) is inconsistent with the Insight content. ${llmData.osPillarNote ?? ""}`,
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
