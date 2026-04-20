import { z } from "zod";
import { SourceType, EditionIdSchema } from "./enums.js";

/**
 * A single source item curated by the Radar agent.
 * Each item includes verbatim facts extracted from the article to prevent
 * hallucination and enable fact-checking downstream.
 */
export const SourceItemSchema = z.object({
  id: z.string().uuid(),
  sourceType: SourceType,
  /** Headline or title of the article / post. */
  title: z.string().min(1),
  /** Canonical URL of the source. */
  url: z.string().url(),
  /** ISO-8601 date-time when the article was originally published. */
  publishedAt: z.string().datetime(),
  author: z.string().optional(),
  outlet: z.string().optional(),
  summary: z.string(),
  /**
   * 3–7 verbatim sentences or data points lifted directly from the source.
   * Used by Writer and Validator agents to anchor claims in real content.
   */
  verbatimFacts: z.array(z.string().min(1)).min(3).max(7),
  /** Normalised relevance to the target audience — 0.0 (irrelevant) to 1.0 (perfect fit). */
  relevanceScore: z.number().min(0).max(1),
  /** How many hours ago the article was published relative to scan time. */
  recencyHours: z.number().nonnegative(),
  tags: z.array(z.string()),
  rawContent: z.string().optional(),
});
export type SourceItem = z.infer<typeof SourceItemSchema>;

/** A curated collection of sources for one edition — output of the Radar agent. */
export const SourceBundleSchema = z.object({
  editionId: EditionIdSchema,
  scannedAt: z.string().datetime(),
  totalScanned: z.number().int().nonnegative(),
  totalSelected: z.number().int().nonnegative(),
  items: z.array(SourceItemSchema).min(1),
  metadata: z.object({
    feedsScanned: z.number().int().nonnegative(),
    timeWindowHours: z.number().positive(),
    filterCriteria: z.array(z.string()),
  }),
});
export type SourceBundle = z.infer<typeof SourceBundleSchema>;
