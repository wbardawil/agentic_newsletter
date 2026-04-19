import { z } from "zod";

/** Validated application configuration derived from environment variables. */
export const AppConfigSchema = z.object({
  // Anthropic
  anthropicApiKey: z.string().min(1),
  defaultModel: z.string().default("claude-sonnet-4-5"),
  writerModel: z.string().default("claude-opus-4-7"),

  // Beehiiv (required for distribution — optional in Phase 2 draft mode)
  beehiivApiKey: z.string().optional(),
  beehiivPublicationId: z.string().optional(),

  // Feedly (optional — Radar uses direct RSS in Phase 2)
  feedlyApiKey: z.string().optional(),

  // Social (optional)
  linkedinAccessToken: z.string().optional(),
  twitterApiKey: z.string().optional(),
  twitterApiSecret: z.string().optional(),

  // Airtable (optional)
  airtableApiKey: z.string().optional(),
  airtableBaseId: z.string().optional(),

  // App
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  dryRun: z.boolean().default(false),
  /** Hard cap on total USD spend per pipeline run. */
  maxCostPerRunUsd: z.number().positive().default(5.0),

  // Publishing
  /** Display name used as post author in Beehiiv. */
  newsletterAuthor: z.string().min(1).default("Wadi Bardawil"),
  /** Per-feed timeout for the RSS parser (ms). */
  rssParserTimeoutMs: z.number().positive().int().default(12000),
  /** Timeout for LLM API calls in ms (applies to all Anthropic requests). */
  llmTimeoutMs: z.number().positive().int().default(120_000),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;
