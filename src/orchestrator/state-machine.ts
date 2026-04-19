import type { AgentName } from "../types/enums.js";

export type PipelineState =
  | "pending"
  | "scanning"
  | "strategizing"
  | "writing"
  | "localizing"
  | "validating"
  | "awaiting_approval"
  | "publishing"
  | "amplifying"
  | "analyzing"
  | "completed"
  | "failed";

const TRANSITIONS: Record<PipelineState, readonly PipelineState[]> = {
  pending: ["scanning"],
  scanning: ["strategizing", "failed"],
  strategizing: ["writing", "failed"],
  writing: ["localizing", "failed"],
  localizing: ["validating", "failed"],
  validating: ["awaiting_approval", "failed"],
  awaiting_approval: ["publishing", "failed"],
  publishing: ["amplifying", "failed"],
  amplifying: ["analyzing", "failed"],
  analyzing: ["completed", "failed"],
  completed: [],
  failed: ["pending"],
};

const STATE_AGENT_MAP: Partial<Record<PipelineState, AgentName>> = {
  scanning: "radar",
  strategizing: "strategist",
  writing: "writer",
  localizing: "localizer",
  validating: "validator",
  publishing: "distributor",
  amplifying: "amplifier",
  analyzing: "analyst",
};

export class PipelineStateMachine {
  private state: PipelineState = "pending";

  getState(): PipelineState {
    return this.state;
  }

  canTransition(to: PipelineState): boolean {
    return TRANSITIONS[this.state].includes(to);
  }

  transition(to: PipelineState): void {
    if (!this.canTransition(to)) {
      throw new Error(
        `Invalid transition: ${this.state} -> ${to}`,
      );
    }
    this.state = to;
  }

  getAgentForState(): AgentName | undefined {
    return STATE_AGENT_MAP[this.state];
  }

  isTerminal(): boolean {
    return this.state === "completed" || this.state === "failed";
  }
}
