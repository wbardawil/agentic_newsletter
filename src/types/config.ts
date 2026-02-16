import { z } from "zod";

/** Validated application configuration derived from environment variables. */
export const AppConfigSchema = z.object({
  // Anthropic
  anthropicApiKey: z.string().min(1),
  defaultModel: z.string().default("claude-sonnet-4-5-20250514"),
  writerModel: z.string().default("claude-opus-4-6-20250415"),

  // Beehiiv
  beehiivApiKey: z.string().min(1),
  beehiivPublicationId: z.string().min(1),

  // Feedly
  feedlyApiKey: z.string().min(1),

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
  maxCostPerRunUsd: z.number().positive().default(5.0),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;
