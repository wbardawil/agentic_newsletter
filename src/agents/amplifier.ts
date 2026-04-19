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
  type LocalizedContent,
} from "../types/edition.js";

const AmplifierInputSchema = z.object({
  enContent: LocalizedContentSchema,
  angle: StrategicAngleSchema,
  /** The shareable sentence identified by the Validator, if available. */
  shareableSentence: z.string().nullable().optional(),
});
type AmplifierInput = z.infer<typeof AmplifierInputSchema>;

const SocialPostSchema = z.object({
  platform: z.enum(["linkedin", "twitter"]),
  /** The rhetorical angle used for this post (LinkedIn only). */
  angle: z.string().optional(),
  content: z.string().min(1),
  /** Optional scheduled send time (ISO 8601 UTC). */
  scheduledAt: z.string().datetime().optional(),
});
export type SocialPost = z.infer<typeof SocialPostSchema>;

const AmplifierOutputSchema = z.object({
  posts: z.array(SocialPostSchema).min(1),
});
export type AmplifierOutput = z.infer<typeof AmplifierOutputSchema>;

const MODEL = "claude-sonnet-4-5";

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadPromptTemplate(): string {
  const promptPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "config",
    "prompts",
    "amplifier.md",
  );
  return readFileSync(promptPath, "utf-8");
}

function getSectionBody(content: LocalizedContent, type: string): string {
  return content.sections.find((s) => s.type === type)?.body ?? "";
}

function buildPrompt(
  context: AgentInput<AmplifierInput>,
  payload: AmplifierInput,
): string {
  const { enContent, angle, shareableSentence } = payload;
  const template = loadPromptTemplate();

  return template
    .replace("{{runId}}", context.runId)
    .replace("{{editionId}}", context.editionId)
    .replace("{{subject}}", enContent.subject)
    .replace("{{osPillar}}", angle.osPillar)
    .replace("{{quarterlyTheme}}", angle.quarterlyTheme)
    .replace("{{insight}}", getSectionBody(enContent, "analysis"))
    .replace("{{apertura}}", getSectionBody(enContent, "lead"))
    .replace("{{shareableSentence}}", shareableSentence ?? "(none identified)");
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const brace = text.indexOf("{");
  if (brace !== -1) return text.slice(brace);
  return text.trim();
}

function enforceTwitterLimit(posts: SocialPost[]): SocialPost[] {
  return posts.map((post) => {
    if (post.platform !== "twitter") return post;
    if (post.content.length <= 280) return post;
    // Truncate at last word boundary before 277 chars and add "…"
    const truncated = post.content.slice(0, 277).replace(/\s+\S*$/, "");
    return { ...post, content: truncated + "…" };
  });
}

// ── Amplifier agent ───────────────────────────────────────────────────────────

export class AmplifierAgent extends BaseAgent<AmplifierInput, AmplifierOutput> {
  readonly name: AgentName = "amplifier";
  readonly inputSchema = AmplifierInputSchema;
  readonly outputSchema = AmplifierOutputSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    payload: AmplifierInput,
    context: AgentInput<AmplifierInput>,
  ): Promise<AmplifierOutput> {
    const prompt = buildPrompt(context, payload);

    const stream = await this.deps.apiClients.anthropic.messages.stream({
      model: MODEL,
      max_tokens: 4000,
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

    const validated = AmplifierOutputSchema.parse(parsed);
    const posts = enforceTwitterLimit(validated.posts);

    this.logger.info("Amplifier posts generated", {
      runId: context.runId,
      linkedin: posts.filter((p) => p.platform === "linkedin").length,
      twitter: posts.filter((p) => p.platform === "twitter").length,
    });

    return { posts };
  }
}
