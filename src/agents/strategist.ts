import { z } from "zod";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import type { AgentInput } from "../types/agent-io.js";
import { SourceBundleSchema, type SourceBundle } from "../types/source-bundle.js";
import {
  StrategicAngleSchema,
  type StrategicAngle,
  type OsPillar,
} from "../types/edition.js";
import { extractTextFromMessage, parseLlmJson } from "../utils/llm-json.js";

const StrategistInputSchema = SourceBundleSchema;
type StrategistInput = SourceBundle;

const MODEL = "claude-sonnet-4-5";

interface QuarterInfo {
  quarter: number;
  theme: string;
  description: string;
}

function getQuarterInfo(date: Date): QuarterInfo {
  const month = date.getMonth(); // 0-indexed
  if (month <= 2) {
    return {
      quarter: 1,
      theme: "The Bottleneck",
      description:
        "naming the real constraint — helping owners recognize that they are the primary obstacle to what they are trying to build",
    };
  } else if (month <= 5) {
    return {
      quarter: 2,
      theme: "The Machine",
      description:
        "building the operating model that runs without the owner — moving from diagnosis to architecture",
    };
  } else if (month <= 8) {
    return {
      quarter: 3,
      theme: "Systems That Serve",
      description:
        "technology in its right place — deploying systems that serve people after the strategy and operating model are clear",
    };
  } else {
    return {
      quarter: 4,
      theme: "The Long Game",
      description:
        "transformation as a leadership commitment, not a project — what it takes to sustain the commitment over time",
    };
  }
}

function loadPromptTemplate(): string {
  const promptPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "config",
    "prompts",
    "strategist.md",
  );
  return readFileSync(promptPath, "utf-8");
}

function buildPrompt(
  bundle: SourceBundle,
  context: AgentInput<StrategistInput>,
  quarterInfo: QuarterInfo,
): string {
  const template = loadPromptTemplate();
  const now = new Date();

  const sourceSummary = bundle.items
    .map(
      (item, i) =>
        `[${i + 1}] ID: ${item.id}\nOutlet: ${item.outlet ?? "Unknown"}\nTitle: ${item.title}\nURL: ${item.url}\nPublished: ${item.publishedAt}\nSummary: ${item.summary}\nKey facts:\n${item.verbatimFacts.map((f) => `  - ${f}`).join("\n")}`,
    )
    .join("\n\n---\n\n");

  return template
    .replace("{{runId}}", context.runId)
    .replace("{{editionId}}", context.editionId)
    .replace("{{currentDate}}", now.toISOString().substring(0, 10))
    .replace("{{currentQuarter}}", `Q${quarterInfo.quarter}`)
    .replace(/\{\{quarterlyTheme\}\}/g, quarterInfo.theme)
    .replace("{{quarterlyThemeDescription}}", quarterInfo.description)
    .replace("{{input}}", sourceSummary);
}


export class StrategistAgent extends BaseAgent<StrategistInput, StrategicAngle> {
  readonly name: AgentName = "strategist";
  readonly inputSchema: z.ZodType<StrategistInput> = StrategistInputSchema;
  readonly outputSchema = StrategicAngleSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    payload: StrategistInput,
    context: AgentInput<StrategistInput>,
  ): Promise<StrategicAngle> {
    const quarterInfo = getQuarterInfo(new Date());
    const prompt = buildPrompt(payload, context, quarterInfo);

    const stream = await this.deps.apiClients.anthropic.messages.stream({
      model: MODEL,
      max_tokens: 2000,
      system: prompt,
      messages: [
        {
          role: "user",
          content:
            "Analyze the source bundle and select the strategic angle for this week's edition. Output valid JSON only.",
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
    const parsed = parseLlmJson(rawText, "StrategistAgent");
    return StrategicAngleSchema.parse(parsed);
  }
}
