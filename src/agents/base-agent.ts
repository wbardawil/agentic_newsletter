import type { z } from "zod";
import type { AgentName } from "../types/enums.js";
import type { AgentInput, AgentOutput, CostEntry } from "../types/agent-io.js";
import type { Logger } from "../utils/logger.js";
import type { CostTracker } from "../utils/cost-tracker.js";

export interface AgentDeps {
  logger: Logger;
  costTracker: CostTracker;
}

/**
 * Abstract base class for all pipeline agents.
 *
 * Subclasses declare their specific Zod schemas for input/output and implement
 * the `execute()` method. The `run()` method handles input validation, timing,
 * cost tracking, output validation, and wrapping in the standard AgentOutput envelope.
 */
export abstract class BaseAgent<TInput = unknown, TOutput = unknown> {
  abstract readonly name: AgentName;
  abstract readonly inputSchema: z.ZodType<TInput>;
  abstract readonly outputSchema: z.ZodType<TOutput>;

  protected readonly logger: Logger;
  protected readonly costTracker: CostTracker;

  constructor(protected readonly deps: AgentDeps) {
    this.logger = deps.logger;
    this.costTracker = deps.costTracker;
  }

  async run(input: AgentInput<TInput>): Promise<AgentOutput<TOutput>> {
    const startTime = Date.now();

    this.inputSchema.parse(input.payload);
    this.costTracker.reset();

    this.logger.info(`Agent ${this.name} starting`, {
      runId: input.runId,
      editionId: input.editionId,
      agentName: this.name,
    });

    let data: TOutput;
    try {
      data = await this.execute(input.payload, input);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const cost = this.costTracker.getCurrentCost();
      const errorMessage =
        err instanceof Error ? err.message : String(err);

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
        status: "error",
        tokens: { input: 0, output: 0 },
        errors: [errorMessage],
        cost,
        data: undefined as unknown as TOutput,
      };
    }

    const durationMs = Date.now() - startTime;
    const cost: CostEntry = this.costTracker.getCurrentCost();
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
