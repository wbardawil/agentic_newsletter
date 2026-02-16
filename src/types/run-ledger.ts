import { z } from "zod";
import { AgentName, RunStatus } from "./enums.js";
import { CostEntrySchema } from "./agent-io.js";

/** A single agent execution record within a run. */
export const AgentRunEntrySchema = z.object({
  agentName: AgentName,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  success: z.boolean().optional(),
  error: z.string().optional(),
  cost: CostEntrySchema.optional(),
  retryCount: z.number().int().nonnegative(),
});
export type AgentRunEntry = z.infer<typeof AgentRunEntrySchema>;

/** Complete record of a single orchestration run. */
export const RunLedgerSchema = z.object({
  runId: z.string().uuid(),
  editionId: z.string().uuid(),
  status: RunStatus,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  triggeredBy: z.enum(["schedule", "manual", "retry"]),
  currentAgent: AgentName.optional(),
  agentRuns: z.array(AgentRunEntrySchema),
  totalCostUsd: z.number().nonnegative(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type RunLedger = z.infer<typeof RunLedgerSchema>;
