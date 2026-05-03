import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseAgent, type AgentDeps } from "./base-agent.js";
import type { AgentName } from "../types/enums.js";
import type { AgentInput } from "../types/agent-io.js";
import {
  StrategicAngleSchema,
  LocalizedContentSchema,
  type StrategicAngle,
  type LocalizedContent,
} from "../types/edition.js";
import { extractTextFromMessage, parseLlmJson } from "../utils/llm-json.js";

// ── Schemas ────────────────────────────────────────────────────────────────

const DesignerInputSchema = z.object({
  angle: StrategicAngleSchema,
  enContent: LocalizedContentSchema,
  /** Where to write generated images (e.g. drafts/2026-18/images/). */
  outputDir: z.string().min(1),
  /**
   * Filename for the hero image. The pipeline passes `<editionId>-hero.png`
   * so multiple editions co-exist in the same drafts/ directory without
   * collision. Defaults to "hero.png" when omitted.
   */
  heroFilename: z.string().min(1).optional(),
});
export type DesignerInput = z.infer<typeof DesignerInputSchema>;

const BilingualTextSchema = z.object({
  en: z.string().min(1),
  es: z.string().min(1),
});

const DesignerAssetSchema = z.object({
  kind: z.literal("hero"),
  /** Filesystem path of the generated image (or dryRun placeholder). */
  imagePath: z.string(),
  /** The full prompt sent to the image model. */
  prompt: z.string(),
  altText: BilingualTextSchema,
  caption: BilingualTextSchema,
});
export type DesignerAsset = z.infer<typeof DesignerAssetSchema>;

const DesignerOutputSchema = z.object({
  assets: z.array(DesignerAssetSchema).min(1),
  imageModel: z.string(),
});
export type DesignerOutput = z.infer<typeof DesignerOutputSchema>;

// ── Brand style tokens ─────────────────────────────────────────────────────

const BrandStyleTokensSchema = z.object({
  imageStyle: z.object({
    approach: z.string(),
    constraints: z.array(z.string()),
    preferences: z.array(z.string()),
    model: z.string(),
  }),
  layout: z.object({
    heroDimensions: z.object({ width: z.number(), height: z.number() }),
  }),
  captionVoice: z.object({ guidance: z.string() }),
});
type BrandStyleTokens = z.infer<typeof BrandStyleTokensSchema>;

function loadBrandStyleTokens(): BrandStyleTokens {
  const tokensPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "config",
    "brand-style-tokens.json",
  );
  return BrandStyleTokensSchema.parse(
    JSON.parse(readFileSync(tokensPath, "utf-8")),
  );
}

// ── Constants ──────────────────────────────────────────────────────────────

const PROMPT_COMPOSE_MODEL = "claude-sonnet-4-5";
const CAPTION_MODEL = "claude-sonnet-4-5";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
/** Notional output-token cost per generated image (see cost-tracker MODEL_PRICING). */
const GEMINI_TOKENS_PER_IMAGE = 1290;

// ── Gemini image gen ───────────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { mimeType: string; data: string };
      }>;
    };
  }>;
  error?: { message: string };
}

async function generateHeroImage(
  apiKey: string,
  imagePrompt: string,
  modelName: string,
): Promise<Buffer> {
  const url = `${GEMINI_ENDPOINT}/${modelName}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Gemini image gen failed (HTTP ${response.status}): ${text.slice(0, 500)}`,
    );
  }

  const data = (await response.json()) as GeminiResponse;
  if (data.error) {
    throw new Error(`Gemini image gen error: ${data.error.message}`);
  }

  const inline = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data,
  );
  if (!inline?.inlineData?.data) {
    throw new Error(
      "Gemini response did not contain inline image data — check that the configured model supports image generation.",
    );
  }
  return Buffer.from(inline.inlineData.data, "base64");
}

// ── Designer agent ─────────────────────────────────────────────────────────

export class DesignerAgent extends BaseAgent<DesignerInput, DesignerOutput> {
  readonly name: AgentName = "designer";
  readonly inputSchema = DesignerInputSchema;
  readonly outputSchema = DesignerOutputSchema;

  constructor(deps: AgentDeps) {
    super(deps);
  }

  protected async execute(
    payload: DesignerInput,
    context: AgentInput<DesignerInput>,
  ): Promise<DesignerOutput> {
    const tokens = loadBrandStyleTokens();
    const { angle, enContent, outputDir } = payload;
    const heroFilename = payload.heroFilename ?? "hero.png";

    const imagePrompt = await this.composeImagePrompt(angle, enContent, tokens);
    const imagePath = await this.renderHeroImage(
      imagePrompt,
      outputDir,
      tokens,
      context.editionId,
      heroFilename,
    );
    const { altText, caption } = await this.generateAltTextAndCaption(
      angle,
      enContent,
      tokens,
    );

    return {
      assets: [
        {
          kind: "hero",
          imagePath,
          prompt: imagePrompt,
          altText,
          caption,
        },
      ],
      imageModel: tokens.imageStyle.model,
    };
  }

  // ── Step 1: compose the image prompt ─────────────────────────────────────
  private async composeImagePrompt(
    angle: StrategicAngle,
    enContent: LocalizedContent,
    tokens: BrandStyleTokens,
  ): Promise<string> {
    const insight =
      enContent.sections.find((s) => s.type === "analysis")?.body ?? "";

    const systemPrompt = [
      `You compose a single image-generation prompt for a hero illustration on The Transformation Letter, an editorial newsletter for $5–100M owner-operators in the US-LATAM corridor. The prompt will be sent to ${tokens.imageStyle.model}.`,
      ``,
      `Brand visual language:`,
      `- Approach: ${tokens.imageStyle.approach}`,
      `- Preferences:`,
      ...tokens.imageStyle.preferences.map((p) => `  - ${p}`),
      `- Constraints (HARD — never produce these):`,
      ...tokens.imageStyle.constraints.map((c) => `  - ${c}`),
      `- Palette to evoke: deep navy, teal, ochre, cream, muted bronze. No bright primary colors. Matte finish.`,
      `- Aspect ratio: ${tokens.layout.heroDimensions.width}x${tokens.layout.heroDimensions.height} (16:9).`,
      ``,
      `Compose ONE prompt of 60–120 words. Anchor the visual in this issue's diagnostic — not the surface news. The image is an abstract editorial illustration that evokes the structural/process metaphor of the Insight, not a literal depiction.`,
      ``,
      `Output: only the prompt text. No preamble, no quotes, no labels.`,
    ].join("\n");

    const userPrompt = [
      `Issue headline: ${angle.headline}`,
      `Issue thesis: ${angle.thesis}`,
      `OS pillar: ${angle.osPillar}`,
      `People dimension challenge: ${angle.peopleAngle.challenge}`,
      ``,
      `Insight excerpt:`,
      insight.slice(0, 1500),
    ].join("\n");

    const stream = await this.deps.apiClients.anthropic.messages.stream({
      model: PROMPT_COMPOSE_MODEL,
      max_tokens: 400,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const message = await stream.finalMessage();
    this.costTracker.recordUsage(
      PROMPT_COMPOSE_MODEL,
      message.usage.input_tokens,
      message.usage.output_tokens,
    );
    return extractTextFromMessage(message.content).trim();
  }

  // ── Step 2: render the hero (or write a dryRun placeholder) ─────────────
  private async renderHeroImage(
    imagePrompt: string,
    outputDir: string,
    tokens: BrandStyleTokens,
    editionId: string,
    heroFilename: string,
  ): Promise<string> {
    mkdirSync(outputDir, { recursive: true });
    const imagePath = join(outputDir, heroFilename);

    if (this.deps.apiClients.dryRun) {
      // Write a sibling placeholder text file describing what would have been
      // generated. Keeps the run reviewable without spending image-gen $.
      const placeholderPath = imagePath.replace(/\.png$/, ".dryrun.txt");
      writeFileSync(
        placeholderPath,
        `[dryRun placeholder for ${editionId} hero]\n\nPrompt:\n${imagePrompt}\n`,
        "utf-8",
      );
      return placeholderPath;
    }

    const apiKey = this.deps.apiClients.geminiApiKey;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Designer requires it for hero image generation. Set DRY_RUN=true to skip image generation, or add the secret in repo Settings → Secrets and variables → Actions.",
      );
    }

    const imageBytes = await generateHeroImage(
      apiKey,
      imagePrompt,
      tokens.imageStyle.model,
    );
    writeFileSync(imagePath, imageBytes);
    this.costTracker.recordUsage(
      tokens.imageStyle.model,
      0,
      GEMINI_TOKENS_PER_IMAGE,
    );
    return imagePath;
  }

  // ── Step 3: alt-text + bilingual caption via Claude ──────────────────────
  private async generateAltTextAndCaption(
    angle: StrategicAngle,
    enContent: LocalizedContent,
    tokens: BrandStyleTokens,
  ): Promise<{
    altText: { en: string; es: string };
    caption: { en: string; es: string };
  }> {
    const systemPrompt = [
      `You write alt-text and caption pairs (EN + ES) for a hero image on The Transformation Letter — a bilingual newsletter for $5–100M owner-operators in the US-LATAM corridor.`,
      ``,
      `Caption voice: ${tokens.captionVoice.guidance}`,
      ``,
      `Alt-text rules:`,
      `- Describe the image's visual content for screen readers (≤ 140 chars).`,
      `- No marketing prose, no quotation, no caption-style — pure description.`,
      `- ES alt-text is a transcreation, not a literal translation.`,
      ``,
      `Caption rules:`,
      `- One sentence. Advisor voice. Present tense. Second-person where natural.`,
      `- Anchors the image to the issue's diagnostic — not a description of the picture.`,
      `- ES is transcreated from the angle, not literally translated from EN.`,
      ``,
      `Output valid JSON only — no preamble, no markdown wrapper:`,
      `{`,
      `  "altText": { "en": "...", "es": "..." },`,
      `  "caption": { "en": "...", "es": "..." }`,
      `}`,
    ].join("\n");

    const userPrompt = [
      `Issue headline: ${angle.headline}`,
      `Issue thesis: ${angle.thesis}`,
      `OS pillar: ${angle.osPillar}`,
      `People dimension challenge: ${angle.peopleAngle.challenge}`,
      `Subject line (EN): ${enContent.subject}`,
    ].join("\n");

    const stream = await this.deps.apiClients.anthropic.messages.stream({
      model: CAPTION_MODEL,
      max_tokens: 800,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const message = await stream.finalMessage();
    this.costTracker.recordUsage(
      CAPTION_MODEL,
      message.usage.input_tokens,
      message.usage.output_tokens,
    );

    const rawText = extractTextFromMessage(message.content);
    const parsed = parseLlmJson(rawText, "DesignerAgent.altTextAndCaption");
    return z
      .object({
        altText: BilingualTextSchema,
        caption: BilingualTextSchema,
      })
      .parse(parsed);
  }
}
