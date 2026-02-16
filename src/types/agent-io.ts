import { z } from "zod";
import { AgentName } from "./enums.js";

/** Token usage and cost for a single agent call. */
export const CostEntrySchema = z.object({
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
});
export type CostEntry = z.infer<typeof CostEntrySchema>;

/**
 * Generic output envelope for every agent.
 * The `data` field is agent-specific — each agent narrows it with its own schema.
 */
export const AgentOutputSchema = z.object({
  agentName: AgentName,
  runId: z.string().uuid(),
  editionId: z.string().uuid(),
  timestamp: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  success: z.boolean(),
  error: z.string().optional(),
  cost: CostEntrySchema,
  data: z.unknown(),
});
export type AgentOutput<T = unknown> = Omit<
  z.infer<typeof AgentOutputSchema>,
  "data"
> & {
  data: T;
};

/**
 * Generic input envelope for every agent.
 * The `payload` field is agent-specific — each agent narrows it with its own schema.
 */
export const AgentInputSchema = z.object({
  runId: z.string().uuid(),
  editionId: z.string().uuid(),
  agentName: AgentName,
  payload: z.unknown(),
});
export type AgentInput<T = unknown> = Omit<
  z.infer<typeof AgentInputSchema>,
  "payload"
> & {
  payload: T;
};
