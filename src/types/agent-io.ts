import { z } from "zod";
import { AgentName, TokenUsageSchema } from "./enums.js";

/** Per-call cost details stored alongside token usage. */
export const CostEntrySchema = z.object({
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
});
export type CostEntry = z.infer<typeof CostEntrySchema>;

/**
 * Generic output envelope returned by every agent.
 *
 * Backward-compat fields (`success`, `error`) are kept alongside the newer
 * enum-based `status`, optional `tokens`, and `errors` array.
 */
export const AgentOutputSchema = z.object({
  agentName: AgentName,
  runId: z.string().uuid(),
  editionId: z.string(),
  timestamp: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  /** Boolean outcome — kept for backward compatibility. */
  success: z.boolean(),
  /** Error message string — kept for backward compatibility. */
  error: z.string().optional(),
  /** Explicit execution status enum. */
  status: z.enum(["success", "error", "retrying"]),
  /** Token breakdown for the primary LLM invocation. */
  tokens: TokenUsageSchema.optional(),
  /** Cost breakdown for this agent invocation. */
  cost: CostEntrySchema,
  /** Ordered error messages — empty on success. */
  errors: z.array(z.string()).optional(),
  data: z.unknown(),
});
export type AgentOutput<T = unknown> = Omit<
  z.infer<typeof AgentOutputSchema>,
  "data"
> & {
  data: T;
};

/**
 * Generic input envelope consumed by every agent.
 * The `payload` field is agent-specific — each agent narrows it with its own schema.
 */
export const AgentInputSchema = z.object({
  runId: z.string().uuid(),
  editionId: z.string(),
  agentName: AgentName,
  payload: z.unknown(),
});
export type AgentInput<T = unknown> = Omit<
  z.infer<typeof AgentInputSchema>,
  "payload"
> & {
  payload: T;
};
