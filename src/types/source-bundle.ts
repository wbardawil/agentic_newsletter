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
   * 3–10 verbatim sentences or data points lifted directly from the source.
   * Used by Writer and Validator agents to anchor claims in real content.
   * Tier-1 sources may supply up to 10 facts for richer evidence depth.
   */
  verbatimFacts: z.array(z.string().min(1)).min(3).max(10),
  /** Normalised relevance to the target audience — 0.0 (irrelevant) to 1.0 (perfect fit). */
  relevanceScore: z.number().min(0).max(1),
  /** How many hours ago the article was published relative to scan time. */
  recencyHours: z.number().nonnegative(),
  tags: z.array(z.string()),
  rawContent: z.string().optional(),
  /**
   * Regional anchor for the item. Propagated from `FeedConfig.region` at
   * Radar-construction time (mapping: global→corridor, us→us, latam→mx).
   * Used by the Localizer to author Signal/FieldReport/Compass from
   * MX-relevant items rather than transcreating the EN versions wholesale.
   * "corridor" means the item is usable by either edition.
   */
  region: z.enum(["us", "mx", "corridor"]),
  /**
   * Editorial tier of the source feed (1 = strategy/insight, 2 = news, 3 = niche).
   * Propagated from FeedConfig.tier. Optional for backward compatibility.
   */
  sourceReliabilityTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  /**
   * Temporal signals derived from verbatimFacts at Radar time.
   * Helps downstream agents (Writer, Validator) avoid temporal inaccuracy errors.
   * Optional for backward compatibility with pre-existing source bundles.
   */
  temporalSignals: z
    .object({
      /** True when ALL verbatimFacts use future-tense constructions. */
      hasFutureOnlyFacts: z.boolean(),
      /** True when verbatimFacts mix past/present facts with future-tense projections. */
      hasMixedTense: z.boolean(),
      /** Indices (0-based) of verbatimFacts that are future-tense projections. */
      futureFactIndices: z.array(z.number().int().nonnegative()),
    })
    .optional(),
  /**
   * High-level claim types detected in verbatimFacts.
   * Guides the Writer on what kinds of assertions are safe to make from this source.
   * Optional for backward compatibility.
   */
  claimTypes: z
    .array(z.enum(["statistic", "event", "quote", "projection", "pattern"]))
    .optional(),
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
