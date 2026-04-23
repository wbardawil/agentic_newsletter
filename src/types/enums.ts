import { z } from "zod";

/** Edition identifier in ISO week format YYYY-WW (e.g. "2026-07"). */
export const EditionIdSchema = z
  .string()
  .regex(
    /^\d{4}-(0[1-9]|[1-4]\d|5[0-3])$/,
    "editionId must be in YYYY-WW format (e.g. '2026-07')",
  );
export type EditionId = z.infer<typeof EditionIdSchema>;

/** Per-step execution status stored in the run ledger. */
export const StepStatus = z.enum(["pending", "running", "success", "error", "skipped"]);
export type StepStatus = z.infer<typeof StepStatus>;

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

/** Token usage breakdown for a single agent invocation. */
export const TokenUsageSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
