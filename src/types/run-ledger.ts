import { z } from "zod";
import { AgentName, RunStatus, EditionIdSchema, TokenUsageSchema } from "./enums.js";
import { CostEntrySchema } from "./agent-io.js";

/** Timestamps for a single ledger step. */
export const StepTimestampsSchema = z.object({
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type StepTimestamps = z.infer<typeof StepTimestampsSchema>;

/**
 * Per-step agent execution entry within a run.
 * Restored for backward compatibility; new optional fields added per spec.
 */
export const AgentRunEntrySchema = z.object({
  agentName: AgentName,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  success: z.boolean().optional(),
  error: z.string().optional(),
  cost: CostEntrySchema.optional(),
  retryCount: z.number().int().nonnegative(),
  /** Semver of the prompt template used for this step. */
  promptVersion: z.string().optional(),
  /** Semver of the voice-bible used for this step. */
  voiceBibleVersion: z.string().optional(),
  /** Model identifier used for inference. */
  modelUsed: z.string().optional(),
  /** Token counts for this step's primary LLM call. */
  tokenUsage: TokenUsageSchema.optional(),
  /** SHA-256 hex digest of the agent's serialised output payload. */
  outputHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});
export type AgentRunEntry = z.infer<typeof AgentRunEntrySchema>;

/**
 * Flat per-step audit record written for every agent invocation.
 * One RunLedger row is created each time an agent starts executing.
 */
export const RunLedgerSchema = z.object({
  /** UUID identifying the overall pipeline run. */
  runId: z.string().uuid(),
  /** Week-based edition identifier in YYYY-WW format. */
  editionId: EditionIdSchema,
  /** UUID uniquely identifying this step within the run. */
  stepId: z.string().uuid(),
  /** The agent executing this step. */
  agentName: AgentName,
  /** Semver string of the prompt template used. */
  promptVersion: z.string().min(1),
  /** Semver string of the voice-bible used for style validation. */
  voiceBibleVersion: z.string().min(1),
  /** Model identifier used for inference (e.g. "claude-sonnet-4-5-20250514"). */
  modelUsed: z.string().min(1),
  /** Input / output token breakdown. */
  tokenUsage: TokenUsageSchema,
  /** Total USD cost for this step. */
  costUsd: z.number().nonnegative(),
  /** Current lifecycle status of the overall run. */
  status: RunStatus,
  /** Number of retries attempted before this invocation succeeded (or failed). */
  retryCount: z.number().int().nonnegative(),
  /** Wall-clock timestamps for start and optional completion. */
  timestamps: StepTimestampsSchema,
  /** SHA-256 hex digest of the agent's serialised output payload. */
  outputHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  /**
   * Idempotency key for the Distributor's publish call.
   * Set only for steps that invoke the Beehiiv / social APIs.
   */
  publishIdempotencyKey: z.string().optional(),
});
export type RunLedger = z.infer<typeof RunLedgerSchema>;

/**
 * Aggregate view of an entire pipeline run, grouping all per-step ledger rows.
 * Used by the SupervisorLoop to track overall run state.
 */
export const PipelineRunSchema = z.object({
  runId: z.string().uuid(),
  editionId: EditionIdSchema,
  status: RunStatus,
  triggeredBy: z.enum(["schedule", "manual", "retry"]),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  currentAgent: AgentName.optional(),
  steps: z.array(RunLedgerSchema),
  totalCostUsd: z.number().nonnegative(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PipelineRun = z.infer<typeof PipelineRunSchema>;
