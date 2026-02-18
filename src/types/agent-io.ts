import { z } from "zod";
import { AgentName } from "./enums.js";
import { TokenUsageSchema } from "./run-ledger.js";

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
 * - `status`  — explicit outcome; avoids boolean ambiguity.
 * - `tokens`  — raw token counts for the agent's primary LLM call.
 * - `cost`    — cost breakdown (model + tokens → USD).
 * - `errors`  — ordered list of error messages; empty on success.
 * - `data`    — agent-specific payload; each agent narrows it with its own schema.
 */
export const AgentOutputSchema = z.object({
  agentName: AgentName,
  runId: z.string().uuid(),
  editionId: z.string(),
  timestamp: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  /** Explicit execution status. */
  status: z.enum(["success", "error", "retrying"]),
  /** Token breakdown for the primary LLM invocation. */
  tokens: TokenUsageSchema,
  /** Cost breakdown for this agent invocation. */
  cost: CostEntrySchema,
  /** Ordered error messages — empty array on success. */
  errors: z.array(z.string()),
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
