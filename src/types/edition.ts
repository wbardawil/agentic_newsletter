import { z } from "zod";
import { EditionStatus, Language, EditionIdSchema } from "./enums.js";

/** The three layers of the Business Transformation OS. */
export const OsPillarSchema = z.enum([
  "Strategy OS",
  "Operating Model OS",
  "Technology OS",
]);
export type OsPillar = z.infer<typeof OsPillarSchema>;

/** Strategic angle selected by the Strategist agent. */
export const StrategicAngleSchema = z.object({
  headline: z.string().min(1),
  thesis: z.string().min(1),
  targetPersona: z.string(),
  relevanceToAudience: z.string(),
  suggestedSources: z.array(z.string().uuid()),
  talkingPoints: z.array(z.string()).min(1),
  /** Which OS layer this issue's Insight lives in. */
  osPillar: OsPillarSchema,
  /** Quarterly narrative theme (e.g. "The Machine"). */
  quarterlyTheme: z.string().min(1),
});
export type StrategicAngle = z.infer<typeof StrategicAngleSchema>;

/** A single content section within a newsletter edition. */
export const ContentSectionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["news", "lead", "analysis", "spotlight", "tool", "quickTakes", "cta"]),
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

/** A single issue found during validation. */
export const ValidationIssueSchema = z.object({
  /** Short identifier linking the issue to a Voice Bible rule (e.g. "rule-11-reframe"). */
  rule: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  section: z.string(),
  message: z.string(),
  /** The exact excerpt from the draft that triggered this issue, if applicable. */
  excerpt: z.string().optional(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/** Quality validation result from the Validator agent. */
export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  /** Composite quality score 0–100. Errors subtract 15; warnings subtract 5; infos subtract 1. */
  score: z.number().min(0).max(100),
  issues: z.array(ValidationIssueSchema),
  wordCounts: z.object({
    signal: z.number().int().nonnegative(),
    apertura: z.number().int().nonnegative(),
    insight: z.number().int().nonnegative(),
    fieldReport: z.number().int().nonnegative(),
    tool: z.number().int().nonnegative(),
    compass: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  /** The single most shareable sentence identified in the Insight section, or null if none qualifies. */
  shareableSentence: z.string().nullable(),
  /** High-level notes for the human reviewer. */
  recommendations: z.array(z.string()),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/** Record of a distribution action (email, social). */
export const DistributionRecordSchema = z.object({
  platform: z.enum(["beehiiv", "linkedin", "twitter"]),
  distributedAt: z.string().datetime(),
  externalId: z.string().optional(),
  /** draft = created in Beehiiv but not yet scheduled/sent */
  status: z.enum(["draft", "sent", "scheduled", "failed"]),
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
