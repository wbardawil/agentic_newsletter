import type { z } from "zod";
import type { AgentName } from "../types/enums.js";
import type { AgentInput, AgentOutput, CostEntry } from "../types/agent-io.js";
import type { Logger } from "../utils/logger.js";
import type { CostTracker } from "../utils/cost-tracker.js";
import { createCostTracker } from "../utils/cost-tracker.js";
import type { ApiClients } from "../utils/api-clients.js";
import { withRetry } from "../utils/retry.js";

export interface AgentDeps {
  logger: Logger;
  /** Shared cost tracker for overall pipeline totals. Not used for per-agent tracking. */
  costTracker: CostTracker;
  apiClients: ApiClients;
}

/**
 * Abstract base class for all pipeline agents.
 *
 * Subclasses declare their specific Zod schemas for input/output and implement
 * the `execute()` method. The `run()` method handles:
 * - Input validation
 * - Per-invocation cost tracking (fresh tracker each run — safe for concurrent agents)
 * - Max-cost enforcement (throws CostLimitError if exceeded)
 * - Exponential-backoff retry on transient failures (3 attempts, 1s/2s/4s)
 * - Output validation
 * - Timing and structured logging
 */
export abstract class BaseAgent<TInput = unknown, TOutput = unknown> {
  abstract readonly name: AgentName;
  abstract readonly inputSchema: z.ZodType<TInput>;
  abstract readonly outputSchema: z.ZodType<TOutput>;

  protected readonly logger: Logger;
  /**
   * Per-invocation cost tracker assigned at the start of each `run()` call.
   * Always valid inside `execute()`. Never shared between concurrent invocations.
   */
  protected costTracker!: CostTracker;

  constructor(protected readonly deps: AgentDeps) {
    this.logger = deps.logger;
  }

  async run(input: AgentInput<TInput>): Promise<AgentOutput<TOutput>> {
    const startTime = Date.now();
    this.inputSchema.parse(input.payload);

    // Fresh tracker per invocation — safe for concurrent agents on the same instance
    this.costTracker = createCostTracker();

    this.logger.info(`Agent ${this.name} starting`, {
      runId: input.runId,
      editionId: input.editionId,
      agentName: this.name,
    });

    let data: TOutput;
    try {
      data = await withRetry(() => this.execute(input.payload, input), {
        maxAttempts: 3,
        baseDelayMs: 1000,
        label: this.name,
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const cost = this.costTracker.getCurrentCost();
      const errorMessage = err instanceof Error ? err.message : String(err);

      this.logger.error(`Agent ${this.name} failed: ${errorMessage}`, {
        runId: input.runId,
        editionId: input.editionId,
        agentName: this.name,
      });

      return {
        agentName: this.name,
        runId: input.runId,
        editionId: input.editionId,
        timestamp: new Date().toISOString(),
        durationMs,
        success: false,
        error: errorMessage,
        status: "error",
        tokens: { input: 0, output: 0 },
        errors: [errorMessage],
        cost,
        // `data` is undefined on the error path. Callers must check `success`
        // before accessing `data` — the generic type cannot express this without
        // a full discriminated union refactor of AgentOutput<T>.
        data: undefined as unknown as TOutput,
      };
    }

    const durationMs = Date.now() - startTime;
    const cost: CostEntry = this.costTracker.getCurrentCost();

    // Enforce per-run cost cap AFTER execute so we have real numbers
    const maxCost = this.deps.apiClients.maxCostPerRunUsd;
    if (cost.costUsd > maxCost) {
      const msg =
        `Agent ${this.name} exceeded cost limit: ` +
        `$${cost.costUsd.toFixed(4)} > $${maxCost.toFixed(2)} (MAX_COST_PER_RUN_USD)`;
      this.logger.error(msg, { runId: input.runId, agentName: this.name });
      throw new Error(msg);
    }

    const validatedData = this.outputSchema.parse(data);

    this.logger.info(`Agent ${this.name} completed in ${durationMs}ms`, {
      runId: input.runId,
      editionId: input.editionId,
      agentName: this.name,
    });

    return {
      agentName: this.name,
      runId: input.runId,
      editionId: input.editionId,
      timestamp: new Date().toISOString(),
      durationMs,
      success: true,
      status: "success",
      tokens: { input: cost.inputTokens, output: cost.outputTokens },
      errors: [],
      cost,
      data: validatedData,
    };
  }

  protected abstract execute(
    payload: TInput,
    context: AgentInput<TInput>,
  ): Promise<TOutput>;
}
