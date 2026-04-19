import type { PipelineStateMachine } from "./state-machine.js";
import type { BaseAgent } from "../agents/base-agent.js";
import type { RunLedger } from "../types/run-ledger.js";
import type { AgentName } from "../types/enums.js";
import type { Logger } from "../utils/logger.js";
import type { AppConfig } from "../types/config.js";

export interface AgentRegistry {
  get(name: AgentName): BaseAgent;
}

/**
 * Drives the PipelineStateMachine through the agent pipeline.
 *
 * For each non-terminal state:
 * 1. Gets the agent for the current state
 * 2. Builds AgentInput from accumulated data
 * 3. Calls agent.run(input)
 * 4. On success: stores output, transitions to next state
 * 5. On failure: retries up to maxRetries, then transitions to "failed"
 * 6. Accumulates cost in RunLedger
 *
 * At "awaiting_approval": pauses for external signal (webhook/polling).
 */
export class SupervisorLoop {
  constructor(
    private readonly stateMachine: PipelineStateMachine,
    private readonly agents: AgentRegistry,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  async run(): Promise<RunLedger> {
    throw new Error("SupervisorLoop.run() not implemented");
  }
}
