import { z } from "zod";

/** The 9 agents in the newsletter pipeline. */
export const AgentName = z.enum([
  "supervisor",
  "radar",
  "strategist",
  "writer",
  "localizer",
  "validator",
  "qualityGate",
  "distributor",
  "amplifier",
  "analyst",
]);
export type AgentName = z.infer<typeof AgentName>;

/** Run lifecycle status. */
export const RunStatus = z.enum([
  "pending",
  "running",
  "awaiting_approval",
  "approved",
  "publishing",
  "published",
  "analyzing",
  "completed",
  "failed",
]);
export type RunStatus = z.infer<typeof RunStatus>;

/** Edition lifecycle status. */
export const EditionStatus = z.enum([
  "draft",
  "review",
  "approved",
  "scheduled",
  "sent",
  "failed",
]);
export type EditionStatus = z.infer<typeof EditionStatus>;

/** Supported newsletter languages. */
export const Language = z.enum(["en", "es"]);
export type Language = z.infer<typeof Language>;

/** Source types the Radar agent can ingest. */
export const SourceType = z.enum(["rss", "api", "manual", "social"]);
export type SourceType = z.infer<typeof SourceType>;

/** YYYY-WW edition identifier, e.g. "2026-07". */
export const EditionIdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Edition ID must be in YYYY-WW format (e.g. 2026-07)");

/** Token usage breakdown for a single agent invocation. */
export const TokenUsageSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
