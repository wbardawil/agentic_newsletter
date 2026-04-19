import { z } from "zod";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import { Language } from "../types/enums.js";
import type { AgentInput } from "../types/agent-io.js";
import {
  LocalizedContentSchema,
  StrategicAngleSchema,
  type LocalizedContent,
} from "../types/edition.js";

const LocalizerInputSchema = z.object({
  content: LocalizedContentSchema,
  angle: StrategicAngleSchema,
  targetLanguage: Language,
});
type LocalizerInput = z.infer<typeof LocalizerInputSchema>;

const MODEL = "claude-sonnet-4-5";

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadPromptTemplate(): string {
  const promptPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "config",
    "prompts",
    "localizer.md",
  );
  return readFileSync(promptPath, "utf-8");
}

function getSectionBody(content: LocalizedContent, type: string): string {
  return content.sections.find((s) => s.type === type)?.body ?? "";
}

function getSectionId(content: LocalizedContent, type: string): string {
  return content.sections.find((s) => s.type === type)?.id ?? randomUUID();
}

function buildPrompt(
  context: AgentInput<LocalizerInput>,
  payload: LocalizerInput,
): string {
  const { content, angle } = payload;
  const template = loadPromptTemplate();

  return template
    .replace("{{runId}}", context.runId)
    .replace("{{editionId}}", context.editionId)
    .replace("{{osPillar}}", angle.osPillar)
    .replace("{{quarterlyTheme}}", angle.quarterlyTheme)
    .replace("{{subjectEN}}", content.subject)
    .replace("{{preheaderEN}}", content.preheader)
    .replace("{{apertura}}", getSectionBody(content, "lead"))
    .replace("{{insight}}", getSectionBody(content, "analysis"))
    .replace("{{fieldReport}}", getSectionBody(content, "spotlight"))
    .replace("{{compass}}", getSectionBody(content, "quickTakes"))
    .replace("{{aperturaId}}", getSectionId(content, "lead"))
    .replace("{{insightId}}", getSectionId(content, "analysis"))
    .replace("{{fieldReportId}}", getSectionId(content, "spotlight"))
    .replace("{{compassId}}", getSectionId(content, "quickTakes"))
    .replace("{{doorId}}", getSectionId(content, "cta"));
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const brace = text.indexOf("{");
  if (brace !== -1) return text.slice(brace);
  return text.trim();
}

// ── Localizer agent ───────────────────────────────────────────────────────────

export class LocalizerAgent extends BaseAgent<LocalizerInput, LocalizedContent> {
  readonly name: AgentName = "localizer";
  readonly inputSchema = LocalizerInputSchema;
  readonly outputSchema = LocalizedContentSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    payload: LocalizerInput,
    context: AgentInput<LocalizerInput>,
  ): Promise<LocalizedContent> {
    const prompt = buildPrompt(context, payload);

    const stream = await this.deps.apiClients.anthropic.messages.stream({
      model: MODEL,
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });

    const message = await stream.finalMessage();
    this.costTracker.recordUsage(
      MODEL,
      message.usage.input_tokens,
      message.usage.output_tokens,
    );

    const rawText =
      message.content.find((b) => b.type === "text")?.text ?? "{}";
    const parsed = JSON.parse(extractJson(rawText)) as unknown;

    return LocalizedContentSchema.parse(parsed);
  }
}
