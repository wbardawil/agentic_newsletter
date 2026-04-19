import { randomUUID } from "node:crypto";
import type { PipelineState, PipelineStateMachine } from "./state-machine.js";
import type { BaseAgent } from "../agents/base-agent.js";
import type { AgentInput, AgentOutput } from "../types/agent-io.js";
import type { PipelineRun, RunLedger } from "../types/run-ledger.js";
import type { AgentName } from "../types/enums.js";
import type { Logger } from "../utils/logger.js";
import type { AppConfig } from "../types/config.js";
import type { SourceBundle } from "../types/source-bundle.js";
import type {
  StrategicAngle,
  LocalizedContent,
  ValidationResult,
  DistributionRecord,
} from "../types/edition.js";

export interface AgentRegistry {
  get(name: AgentName): BaseAgent;
}

/** Configuration for a single pipeline run. */
export interface RunOptions {
  runId: string;
  editionId: string;
  /** Radar scan configuration. */
  radarConfig?: { timeWindowHours: number; maxItems: number };
  /** UTC datetime for scheduled newsletter send. */
  scheduledAt?: string;
  /**
   * Called when the pipeline reaches the awaiting_approval gate.
   * Return true to approve and continue publishing, false to abort.
   * Defaults to auto-approve (useful for automated runs).
   */
  onApproval?: () => Promise<boolean>;
}

/** Accumulated intermediate outputs shared across pipeline stages. */
interface PipelineContext {
  bundle?: SourceBundle;
  angle?: StrategicAngle;
  enContent?: LocalizedContent;
  esContent?: LocalizedContent;
  validation?: ValidationResult;
  distributionRecords?: DistributionRecord[];
}

/**
 * Drives the PipelineStateMachine through the agent pipeline.
 *
 * For each non-terminal state:
 * 1. Gets the agent for the current state
 * 2. Builds AgentInput from accumulated data
 * 3. Calls agent.run(input)
 * 4. On success: stores output, transitions to next state
 * 5. On failure: transitions to "failed"
 * 6. Accumulates per-step cost in RunLedger entries
 *
 * At "awaiting_approval": pauses for external signal via onApproval callback.
 */
export class SupervisorLoop {
  constructor(
    private readonly stateMachine: PipelineStateMachine,
    private readonly agents: AgentRegistry,
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  async run(options: RunOptions): Promise<PipelineRun> {
    const { runId, editionId, radarConfig, scheduledAt, onApproval } = options;
    const startedAt = new Date().toISOString();
    const steps: RunLedger[] = [];
    const ctx: PipelineContext = {};

    const buildStep = (agentName: AgentName, output: AgentOutput): RunLedger => ({
      runId,
      editionId,
      stepId: randomUUID(),
      agentName,
      promptVersion: "1.0.0",
      voiceBibleVersion: "1.0.0",
      modelUsed: output.tokens ? "claude" : "none",
      tokenUsage: output.tokens ?? { input: 0, output: 0 },
      costUsd: output.cost.costUsd,
      status: output.success ? "running" : "failed",
      retryCount: 0,
      timestamps: {
        startedAt: output.timestamp,
        completedAt: new Date().toISOString(),
      },
    });

    while (!this.stateMachine.isTerminal()) {
      const state = this.stateMachine.getState();

      // ── Approval gate ───────────────────────────────────────────────────────
      if (state === "awaiting_approval") {
        this.logger.info("Pipeline awaiting approval", { runId, editionId });
        const approved = onApproval ? await onApproval() : true;
        if (!approved) {
          this.logger.info("Pipeline run rejected at approval gate", { runId, editionId });
          this.stateMachine.transition("failed");
          break;
        }
        this.stateMachine.transition("publishing");
        continue;
      }

      const agentName = this.stateMachine.getAgentForState();
      if (!agentName) {
        // Terminal or unhandled state
        break;
      }

      const agent = this.agents.get(agentName);
      const input = this.buildInput(state, agentName, runId, editionId, ctx, {
        radarConfig,
        scheduledAt,
      });

      if (!input) {
        this.logger.error(`Cannot build input for state ${state} — missing upstream data`, {
          runId,
          editionId,
          agentName,
        });
        this.stateMachine.transition("failed");
        break;
      }

      const output = await agent.run(input);
      steps.push(buildStep(agentName, output));

      if (!output.success) {
        this.logger.error(`Agent ${agentName} failed — transitioning to failed`, {
          runId,
          editionId,
          agentName,
          error: output.error,
        });
        this.stateMachine.transition("failed");
        break;
      }

      this.storeOutput(agentName, output.data, ctx);

      const nextState = this.nextStateFor(state);
      if (nextState) {
        this.stateMachine.transition(nextState);
      } else {
        break;
      }
    }

    const finalStatus = this.stateMachine.getState();
    const totalCostUsd = steps.reduce((sum, s) => sum + s.costUsd, 0);

    return {
      runId,
      editionId,
      status: finalStatus === "completed" ? "completed" : finalStatus === "failed" ? "failed" : "running",
      triggeredBy: "manual",
      startedAt,
      completedAt: new Date().toISOString(),
      currentAgent: this.stateMachine.getAgentForState(),
      steps,
      totalCostUsd,
    };
  }

  private buildInput(
    state: PipelineState,
    agentName: AgentName,
    runId: string,
    editionId: string,
    ctx: PipelineContext,
    opts: { radarConfig?: RunOptions["radarConfig"]; scheduledAt?: string | undefined },
  ): AgentInput | null {
    const base = { runId, editionId, agentName };

    switch (state) {
      case "scanning":
        return {
          ...base,
          payload: {
            timeWindowHours: opts.radarConfig?.timeWindowHours ?? 168,
            maxItems: opts.radarConfig?.maxItems ?? 20,
          },
        };

      case "strategizing":
        if (!ctx.bundle) return null;
        return { ...base, payload: ctx.bundle };

      case "writing":
        if (!ctx.angle || !ctx.bundle) return null;
        return {
          ...base,
          payload: { angle: ctx.angle, sources: ctx.bundle.items, language: "en" as const },
        };

      case "validating":
        if (!ctx.enContent || !ctx.angle) return null;
        return { ...base, payload: { content: ctx.enContent, angle: ctx.angle } };

      case "localizing":
        if (!ctx.enContent || !ctx.angle) return null;
        return {
          ...base,
          payload: { content: ctx.enContent, angle: ctx.angle, targetLanguage: "es" as const },
        };

      case "publishing":
        if (!ctx.enContent || !ctx.esContent) return null;
        return {
          ...base,
          payload: { enContent: ctx.enContent, esContent: ctx.esContent, scheduledAt: opts.scheduledAt },
        };

      case "amplifying":
        if (!ctx.enContent || !ctx.angle) return null;
        return {
          ...base,
          payload: {
            enContent: ctx.enContent,
            angle: ctx.angle,
            shareableSentence: ctx.validation?.shareableSentence ?? null,
          },
        };

      case "analyzing": {
        const beehiivPostIds = (ctx.distributionRecords ?? [])
          .filter((r) => r.platform === "beehiiv" && r.externalId)
          .map((r) => r.externalId as string);
        return { ...base, payload: { editionId, beehiivPostIds } };
      }

      default:
        return null;
    }
  }

  private storeOutput(agentName: AgentName, data: unknown, ctx: PipelineContext): void {
    switch (agentName) {
      case "radar":
        ctx.bundle = data as SourceBundle;
        break;
      case "strategist":
        ctx.angle = data as StrategicAngle;
        break;
      case "writer":
        ctx.enContent = data as LocalizedContent;
        break;
      case "validator":
        ctx.validation = data as ValidationResult;
        break;
      case "localizer":
        ctx.esContent = data as LocalizedContent;
        break;
      case "distributor":
        ctx.distributionRecords = data as DistributionRecord[];
        break;
    }
  }

  private nextStateFor(state: PipelineState): PipelineState | null {
    const map: Partial<Record<PipelineState, PipelineState>> = {
      scanning: "strategizing",
      strategizing: "writing",
      writing: "localizing",
      localizing: "validating",
      validating: "awaiting_approval",
      publishing: "amplifying",
      amplifying: "analyzing",
      analyzing: "completed",
    };
    return map[state] ?? null;
  }
}
