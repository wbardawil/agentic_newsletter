import { z } from "zod";
import { SourceType } from "./enums.js";

/** A single source item curated by the Radar agent. */
export const SourceItemSchema = z.object({
  id: z.string().uuid(),
  sourceType: SourceType,
  title: z.string().min(1),
  url: z.string().url(),
  publishedAt: z.string().datetime(),
  author: z.string().optional(),
  outlet: z.string().optional(),
  summary: z.string(),
  relevanceScore: z.number().min(0).max(1),
  tags: z.array(z.string()),
  rawContent: z.string().optional(),
});
export type SourceItem = z.infer<typeof SourceItemSchema>;

/** A curated collection of sources for one edition — output of the Radar agent. */
export const SourceBundleSchema = z.object({
  editionId: z.string().uuid(),
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
