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
import { uploadEditionAsset } from "../utils/storage-client.js";

// ── Schemas ────────────────────────────────────────────────────────────────

const DesignerInputSchema = z.object({
  angle: StrategicAngleSchema,
  enContent: LocalizedContentSchema,
  /** Where to write generated images (e.g. drafts/). */
  outputDir: z.string().min(1),
  /**
   * Filename for the hero image. The pipeline passes `<editionId>-hero.png`
   * so multiple editions co-exist in the same drafts/ directory without
   * collision. Defaults to "hero.png" when omitted.
   */
  heroFilename: z.string().min(1).optional(),
  /**
   * Generation attempt number (1 = first, 2 = first regen, etc.).
   * When > 1, the prompt is composed to avoid repeating prior visual proposals.
   * Defaults to 1 when omitted.
   */
  attempt: z.number().int().positive().optional(),
  /**
   * Optional free-text reason the previous image was rejected by the editor.
   * Injected into the prompt composition so the new image avoids the same issues.
   */
  rejectionFeedback: z.string().optional(),
  /**
   * Prompts from prior attempts that were rejected.
   * Prevents the model from recycling the same visual concept across retries.
   * Defaults to [] when omitted.
   */
  rejectedPrompts: z.array(z.string()).optional(),
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
  /** Public URL after upload to Supabase Storage. Null when storage is unconfigured or in dryRun. */
  publicUrl: z.string().nullable(),
  /** The full prompt sent to the image model. */
  prompt: z.string(),
  altText: BilingualTextSchema,
  caption: BilingualTextSchema,
  /** Generation attempt number for audit trail. */
  attempt: z.number().int().positive(),
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

function loadVisualGuide(): string {
  const guidePath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "VISUAL-GUIDE.txt",
  );
  return readFileSync(guidePath, "utf-8").trim();
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

// ── Versioned filename helper ──────────────────────────────────────────────

/**
 * Insert a version suffix for attempt > 1.
 * "2026-21-hero.png" at attempt 2 → "2026-21-hero-v2.png"
 */
function versionedFilename(heroFilename: string, attempt: number): string {
  if (attempt <= 1) return heroFilename;
  const dotIdx = heroFilename.lastIndexOf(".");
  if (dotIdx === -1) return `${heroFilename}-v${attempt}`;
  return `${heroFilename.slice(0, dotIdx)}-v${attempt}${heroFilename.slice(dotIdx)}`;
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
    const attempt = payload.attempt ?? 1;
    const heroFilename = versionedFilename(
      payload.heroFilename ?? "hero.png",
      attempt,
    );

    const imagePrompt = await this.composeImagePrompt(
      angle,
      enContent,
      tokens,
      attempt,
      payload.rejectionFeedback,
      payload.rejectedPrompts ?? [],
    );

    const { imagePath, imageBytes } = await this.renderHeroImage(
      imagePrompt,
      outputDir,
      tokens,
      context.editionId,
      heroFilename,
    );

    const publicUrl = await this.uploadToStorage(
      imageBytes,
      context.editionId,
      attempt,
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
          publicUrl,
          prompt: imagePrompt,
          altText,
          caption,
          attempt,
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
    attempt: number,
    rejectionFeedback: string | undefined,
    rejectedPrompts: string[],
  ): Promise<string> {
    const insight =
      enContent.sections.find((s) => s.type === "analysis")?.body ?? "";
    const summaryInsight =
      enContent.sections.find((s) => s.type === "lead")?.body ?? "";

    const regenerationGuidance =
      attempt > 1
        ? [
            ``,
            `IMPORTANT — This is attempt ${attempt} (regeneration after rejection).`,
            rejectedPrompts.length > 0
              ? [
                  `The following prompts were REJECTED — do NOT recycle their composition, metaphor, or visual concept:`,
                  ...rejectedPrompts.map((p, i) => `  [Rejected ${i + 1}]: ${p}`),
                ].join("\n")
              : "",
            rejectionFeedback
              ? `Editor rejection reason: "${rejectionFeedback}". Address this issue explicitly.`
              : "",
            `Produce a fundamentally different visual concept — different structural metaphor, different spatial composition, different symbolic vocabulary.`,
          ]
            .filter(Boolean)
            .join("\n")
        : "";

    const visualGuide = loadVisualGuide();

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
      `[VISUAL GUIDE — Brand Reference]`,
      visualGuide,
      `[END VISUAL GUIDE]`,
      regenerationGuidance,
      ``,
      `Compose ONE prompt of 60–120 words. Anchor the visual in this issue's diagnostic — not the surface news. The image is an abstract editorial illustration that evokes the structural/process metaphor of the Insight, not a literal depiction.`,
      ``,
      `Output: only the prompt text. No preamble, no quotes, no labels.`,
    ]
      .filter((line) => line !== undefined)
      .join("\n");

    const userPrompt = [
      `Issue headline: ${angle.headline}`,
      `Issue thesis: ${angle.thesis}`,
      `OS pillar: ${angle.osPillar}`,
      `People dimension challenge: ${angle.peopleAngle.challenge}`,
      ``,
      `Story copy (use as narrative anchor for the image):`,
      `- Subject line: ${enContent.subject}`,
      `- Preheader: ${enContent.preheader}`,
      `- Summary insight: ${summaryInsight.slice(0, 400)}`,
      ``,
      `Full insight excerpt:`,
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
  ): Promise<{ imagePath: string; imageBytes: Buffer | null }> {
    mkdirSync(outputDir, { recursive: true });
    const imagePath = join(outputDir, heroFilename);

    if (this.deps.apiClients.dryRun) {
      const placeholderPath = imagePath.replace(/\.png$/, ".dryrun.txt");
      writeFileSync(
        placeholderPath,
        `[dryRun placeholder for ${editionId} hero]\n\nPrompt:\n${imagePrompt}\n`,
        "utf-8",
      );
      return { imagePath: placeholderPath, imageBytes: null };
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
    return { imagePath, imageBytes };
  }

  // ── Step 2b: upload to Supabase Storage (non-fatal) ──────────────────────
  private async uploadToStorage(
    imageBytes: Buffer | null,
    editionId: string,
    attempt: number,
  ): Promise<string | null> {
    if (!imageBytes) return null;

    const { supabaseUrl, supabaseServiceRoleKey } = this.deps.apiClients;
    if (!supabaseUrl || !supabaseServiceRoleKey) return null;

    try {
      return await uploadEditionAsset(
        supabaseUrl,
        supabaseServiceRoleKey,
        editionId,
        attempt,
        imageBytes,
      );
    } catch (err) {
      // Non-fatal: image is generated and saved locally; upload failure only
      // means no public URL yet. The review.json will have publicUrl = null.
      console.warn(
        `   ⚠️  Storage upload failed (edition-assets/${editionId}/hero-v${attempt}.png): ${String(err)}`,
      );
      return null;
    }
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
