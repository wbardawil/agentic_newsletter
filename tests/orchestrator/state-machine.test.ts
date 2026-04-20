import { describe, it, expect } from "vitest";
import { PipelineStateMachine } from "../../src/orchestrator/state-machine.js";

describe("PipelineStateMachine", () => {
  it("starts in pending state", () => {
    const sm = new PipelineStateMachine();
    expect(sm.getState()).toBe("pending");
  });

  it("transitions through the happy path", () => {
    const sm = new PipelineStateMachine();
    const happyPath = [
      "scanning",
      "strategizing",
      "writing",
      "localizing",
      "validating",
      "awaiting_approval",
      "publishing",
      "amplifying",
      "analyzing",
      "completed",
    ] as const;

    for (const state of happyPath) {
      expect(sm.canTransition(state)).toBe(true);
      sm.transition(state);
      expect(sm.getState()).toBe(state);
    }
  });

  it("rejects invalid transitions", () => {
    const sm = new PipelineStateMachine();
    expect(sm.canTransition("completed")).toBe(false);
    expect(() => sm.transition("completed")).toThrow("Invalid transition");
  });

  it("allows transition to failed from any active state", () => {
    const activeStates = [
      "scanning",
      "strategizing",
      "writing",
      "localizing",
      "validating",
      "awaiting_approval",
      "publishing",
      "amplifying",
      "analyzing",
    ] as const;

    for (const startState of activeStates) {
      const sm = new PipelineStateMachine();
      sm.transition("scanning");

      // Get to the desired state
      const happyPath = activeStates.slice(
        0,
        activeStates.indexOf(startState),
      );
      for (const state of happyPath) {
        if (sm.getState() !== state) {
          sm.transition(state);
        }
      }
      if (sm.getState() !== startState) {
        sm.transition(startState);
      }

      expect(sm.canTransition("failed")).toBe(true);
      sm.transition("failed");
      expect(sm.getState()).toBe("failed");
    }
  });

  it("allows retry from failed back to pending", () => {
    const sm = new PipelineStateMachine();
    sm.transition("scanning");
    sm.transition("failed");
    expect(sm.canTransition("pending")).toBe(true);
    sm.transition("pending");
    expect(sm.getState()).toBe("pending");
  });

  it("completed is terminal", () => {
    const sm = new PipelineStateMachine();
    sm.transition("scanning");
    sm.transition("strategizing");
    sm.transition("writing");
    sm.transition("localizing");
    sm.transition("validating");
    sm.transition("awaiting_approval");
    sm.transition("publishing");
    sm.transition("amplifying");
    sm.transition("analyzing");
    sm.transition("completed");
    expect(sm.isTerminal()).toBe(true);
    expect(sm.canTransition("pending")).toBe(false);
  });

  it("maps states to correct agents", () => {
    const sm = new PipelineStateMachine();

    sm.transition("scanning");
    expect(sm.getAgentForState()).toBe("radar");

    sm.transition("strategizing");
    expect(sm.getAgentForState()).toBe("strategist");

    sm.transition("writing");
    expect(sm.getAgentForState()).toBe("writer");

    sm.transition("localizing");
    expect(sm.getAgentForState()).toBe("localizer");

    sm.transition("validating");
    expect(sm.getAgentForState()).toBe("validator");

    sm.transition("awaiting_approval");
    expect(sm.getAgentForState()).toBeUndefined();

    sm.transition("publishing");
    expect(sm.getAgentForState()).toBe("distributor");

    sm.transition("amplifying");
    expect(sm.getAgentForState()).toBe("amplifier");

    sm.transition("analyzing");
    expect(sm.getAgentForState()).toBe("analyst");
  });

  it("pending and completed have no agent mapping", () => {
    const sm = new PipelineStateMachine();
    expect(sm.getAgentForState()).toBeUndefined();
  });
});
