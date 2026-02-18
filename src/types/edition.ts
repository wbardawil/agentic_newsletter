import { z } from "zod";
import { EditionStatus, Language, EditionIdSchema } from "./enums.js";

/** Strategic angle selected by the Strategist agent. */
export const StrategicAngleSchema = z.object({
  headline: z.string().min(1),
  thesis: z.string().min(1),
  targetPersona: z.string(),
  relevanceToAudience: z.string(),
  suggestedSources: z.array(z.string().uuid()),
  talkingPoints: z.array(z.string()).min(1),
});
export type StrategicAngle = z.infer<typeof StrategicAngleSchema>;

/** A single content section within a newsletter edition. */
export const ContentSectionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["lead", "analysis", "spotlight", "quickTakes", "cta"]),
  heading: z.string(),
  body: z.string(),
  sourceRefs: z.array(z.string().uuid()),
});
export type ContentSection = z.infer<typeof ContentSectionSchema>;

/** Localized content for a single language variant. */
export const LocalizedContentSchema = z.object({
  language: Language,
  subject: z.string().min(1),
  preheader: z.string().max(150),
  sections: z.array(ContentSectionSchema).min(1),
});
export type LocalizedContent = z.infer<typeof LocalizedContentSchema>;

/** Quality validation result from the Validator agent. */
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  issues: z.array(
    z.object({
      severity: z.enum(["error", "warning", "info"]),
      section: z.string(),
      message: z.string(),
      suggestion: z.string().optional(),
    }),
  ),
  scores: z.object({
    voiceConsistency: z.number().min(0).max(100),
    factualAccuracy: z.number().min(0).max(100),
    readability: z.number().min(0).max(100),
    bilingualParity: z.number().min(0).max(100),
  }),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/** Record of a distribution action (email, social). */
export const DistributionRecordSchema = z.object({
  platform: z.enum(["beehiiv", "linkedin", "twitter"]),
  distributedAt: z.string().datetime(),
  externalId: z.string().optional(),
  status: z.enum(["sent", "scheduled", "failed"]),
  error: z.string().optional(),
});
export type DistributionRecord = z.infer<typeof DistributionRecordSchema>;

/** Performance metrics collected by the Analyst agent. */
export const PerformanceMetricsSchema = z.object({
  openRate: z.number().min(0).max(1).optional(),
  clickRate: z.number().min(0).max(1).optional(),
  subscribersDelta: z.number().int().optional(),
  socialImpressions: z.number().int().nonnegative().optional(),
  socialEngagements: z.number().int().nonnegative().optional(),
  collectedAt: z.string().datetime(),
});
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

/**
 * Complete newsletter edition record.
 * Accumulates data as it flows through the pipeline.
 *
 * Flat delivery fields (enBody, esBody, subjectEN, subjectES) are the
 * authoritative final copy used for Beehiiv delivery. The `content` array
 * holds the richer sectioned representation produced by the Writer agent.
 */
export const EditionSchema = z.object({
  /** Week-based edition identifier in YYYY-WW format (e.g. "2026-07"). */
  editionId: EditionIdSchema,
  runId: z.string().uuid(),
  editionNumber: z.number().int().positive(),
  status: EditionStatus,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),

  /** Rendered English body — full HTML/Markdown ready for delivery. */
  enBody: z.string().optional(),
  /** Rendered Spanish body — full HTML/Markdown ready for delivery. */
  esBody: z.string().optional(),
  /** Email subject line in English. */
  subjectEN: z.string().optional(),
  /** Email subject line in Spanish. */
  subjectES: z.string().optional(),
  /** UTC datetime when the edition should be published / was published. */
  publishDatetime: z.string().datetime().optional(),
  /**
   * Composite quality score 0–100 assigned by the Validator agent.
   * Must reach the configured threshold before human approval is requested.
   */
  qaScore: z.number().min(0).max(100).optional(),
  /** Email or username of the human who approved this edition. */
  approvalUser: z.string().optional(),
  /** SHA-256 hex digest of the canonical content payload (enBody + esBody). */
  contentHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "contentHash must be a SHA-256 hex digest")
    .optional(),

  angle: StrategicAngleSchema.optional(),
  content: z.array(LocalizedContentSchema).optional(),
  validation: ValidationResultSchema.optional(),
  distribution: z.array(DistributionRecordSchema).optional(),
  metrics: PerformanceMetricsSchema.optional(),
});
export type Edition = z.infer<typeof EditionSchema>;
