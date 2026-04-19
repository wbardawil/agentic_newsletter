import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import { Language } from "../types/enums.js";
import type { AgentInput } from "../types/agent-io.js";
import { SourceItemSchema, type SourceItem } from "../types/source-bundle.js";
import {
  StrategicAngleSchema,
  LocalizedContentSchema,
  type LocalizedContent,
} from "../types/edition.js";
import {
  loadVoiceBible,
  formatVoiceBibleForPrompt,
} from "../utils/voice-bible-loader.js";
import { extractTextFromMessage, parseLlmJson } from "../utils/llm-json.js";

const WriterInputSchema = z.object({
  angle: StrategicAngleSchema,
  sources: z.array(SourceItemSchema),
  language: Language,
});
type WriterInput = z.infer<typeof WriterInputSchema>;

const MODEL = "claude-opus-4-7";

/** Raw output shape that Claude produces — transformed to LocalizedContent. */
const WriterOutputSchema = z.object({
  agentName: z.literal("writer"),
  runId: z.string(),
  editionId: z.string(),
  osPillar: z.string(),
  subject: z.string().min(1),
  preheader: z.string().min(1),
  sections: z.object({
    apertura: z.string().min(1),
    insight: z.string().min(1),
    fieldReport: z.string().min(1),
    compass: z.string().min(1),
    door: z.string().min(1),
  }),
  wordCount: z.number().int().nonnegative(),
  reviewFlags: z.array(z.string()),
  insightSummary: z.string(),
});
type WriterOutput = z.infer<typeof WriterOutputSchema>;

function loadPromptTemplate(): string {
  const promptPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "config",
    "prompts",
    "writer.md",
  );
  return readFileSync(promptPath, "utf-8");
}

function buildSystemPrompt(
  context: AgentInput<WriterInput>,
  payload: WriterInput,
): string {
  const voiceBible = loadVoiceBible();
  const formattedVoiceBible = formatVoiceBibleForPrompt(voiceBible);

  const sourceMaterial = payload.sources
    .map(
      (item: SourceItem) =>
        `**${item.title}** (${item.outlet ?? "Unknown"}, ${(item.publishedAt ?? "").split("T")[0]})\n` +
        `URL: ${item.url}\n` +
        `Summary: ${item.summary}\n` +
        `Key facts:\n${item.verbatimFacts.map((f: string) => `  - ${f}`).join("\n")}`,
    )
    .join("\n\n---\n\n");

  const template = loadPromptTemplate();
  const now = new Date();

  return template
    .replace("{{runId}}", context.runId)
    .replace("{{editionId}}", context.editionId)
    .replace("{{currentDate}}", now.toISOString().substring(0, 10))
    .replace("{{osPillar}}", payload.angle.osPillar)
    .replace("{{quarterlyTheme}}", payload.angle.quarterlyTheme)
    .replace("{{voiceBible}}", formattedVoiceBible)
    .replace("{{input}}", sourceMaterial);
}


function transformToLocalizedContent(
  output: WriterOutput,
  language: "en" | "es",
): LocalizedContent {
  return {
    language,
    subject: output.subject,
    preheader: output.preheader,
    sections: [
      {
        id: randomUUID(),
        type: "lead",
        heading: "The Apertura",
        body: output.sections.apertura,
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "analysis",
        heading: "The Insight",
        body: output.sections.insight,
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "spotlight",
        heading: "The Field Report",
        body: output.sections.fieldReport,
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "quickTakes",
        heading: "The Compass",
        body: output.sections.compass,
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "cta",
        heading: "The Door",
        body: output.sections.door,
        sourceRefs: [],
      },
    ],
  };
}

export class WriterAgent extends BaseAgent<WriterInput, LocalizedContent> {
  readonly name: AgentName = "writer";
  readonly inputSchema = WriterInputSchema;
  readonly outputSchema = LocalizedContentSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    payload: WriterInput,
    context: AgentInput<WriterInput>,
  ): Promise<LocalizedContent> {
    const systemPrompt = buildSystemPrompt(context, payload);

    // Voice bible is the largest static section — cache it with ephemeral cache_control.
    // The system prompt is sent as a single block; caching saves cost on repeated runs.
    const stream = await this.deps.apiClients.anthropic.messages.stream({
      model: MODEL,
      max_tokens: 6000,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Write the complete draft for edition ${context.editionId}. Output valid JSON only — no preamble, no markdown wrapper.`,
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
    const parsed = parseLlmJson(rawText, "WriterAgent");
    const writerOutput = WriterOutputSchema.parse(parsed);

    if (writerOutput.reviewFlags.length > 0) {
      this.logger.info(
        `Writer review flags: ${writerOutput.reviewFlags.join("; ")}`,
      );
    }

    const language = payload.language === "en" ? "en" : "es";
    return transformToLocalizedContent(writerOutput, language);
  }
}
