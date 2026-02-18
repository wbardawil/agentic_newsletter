import { z } from "zod";
import { AgentName, RunStatus } from "./enums.js";

/** YYYY-Www edition identifier, e.g. "2026-W08". */
export const EditionIdSchema = z
  .string()
  .regex(/^\d{4}-W\d{2}$/, "Edition ID must be in YYYY-Www format (e.g. 2026-W08)");

/** Token usage breakdown for a single agent invocation. */
export const TokenUsageSchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/** Timestamps for a single ledger step. */
export const StepTimestampsSchema = z.object({
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type StepTimestamps = z.infer<typeof StepTimestampsSchema>;

/**
 * Flat per-step audit record written for every agent invocation.
 * One RunLedger row is created each time an agent starts executing.
 */
export const RunLedgerSchema = z.object({
  /** UUID identifying the overall pipeline run. */
  runId: z.string().uuid(),
  /** Week-based edition identifier in YYYY-Www format. */
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
