import { describe, it, expect } from "vitest";
import { createCostTracker } from "../../src/utils/cost-tracker.js";

describe("createCostTracker", () => {
  it("starts with zero cost", () => {
    const tracker = createCostTracker();
    expect(tracker.getTotalCost()).toBe(0);
    expect(tracker.getCurrentCost().costUsd).toBe(0);
  });

  it("records usage and calculates cost for known models", () => {
    const tracker = createCostTracker();
    // claude-sonnet-4-5: $3/1M input, $15/1M output
    tracker.recordUsage("claude-sonnet-4-5", 1_000_000, 100_000);

    const cost = tracker.getCurrentCost();
    expect(cost.model).toBe("claude-sonnet-4-5");
    expect(cost.inputTokens).toBe(1_000_000);
    expect(cost.outputTokens).toBe(100_000);
    // $3.00 input + $1.50 output = $4.50
    expect(cost.costUsd).toBeCloseTo(4.5, 2);
  });

  it("records zero cost for unknown models", () => {
    const tracker = createCostTracker();
    tracker.recordUsage("unknown-model", 1000, 500);

    expect(tracker.getCurrentCost().costUsd).toBe(0);
  });

  it("accumulates across multiple calls", () => {
    const tracker = createCostTracker();
    tracker.recordUsage("claude-sonnet-4-5", 500_000, 50_000);
    tracker.recordUsage("claude-sonnet-4-5", 500_000, 50_000);

    const cost = tracker.getCurrentCost();
    expect(cost.inputTokens).toBe(1_000_000);
    expect(cost.outputTokens).toBe(100_000);
    expect(cost.costUsd).toBeCloseTo(4.5, 2);
  });

  it("reset clears current but not total", () => {
    const tracker = createCostTracker();
    tracker.recordUsage("claude-sonnet-4-5", 1_000_000, 100_000);

    const totalBefore = tracker.getTotalCost();
    tracker.reset();

    expect(tracker.getCurrentCost().costUsd).toBe(0);
    expect(tracker.getCurrentCost().inputTokens).toBe(0);
    expect(tracker.getTotalCost()).toBeCloseTo(totalBefore, 5);
  });

  it("total accumulates across resets", () => {
    const tracker = createCostTracker();
    tracker.recordUsage("claude-sonnet-4-5", 1_000_000, 0);
    tracker.reset();
    tracker.recordUsage("claude-sonnet-4-5", 1_000_000, 0);

    // $3.00 + $3.00 = $6.00
    expect(tracker.getTotalCost()).toBeCloseTo(6.0, 2);
    // Only second batch in current
    expect(tracker.getCurrentCost().costUsd).toBeCloseTo(3.0, 2);
  });

  it("handles claude-opus-4-6 pricing", () => {
    const tracker = createCostTracker();
    // claude-opus-4-6: $5/1M input, $25/1M output
    tracker.recordUsage("claude-opus-4-6", 100_000, 10_000);

    // $0.50 input + $0.25 output = $0.75
    expect(tracker.getCurrentCost().costUsd).toBeCloseTo(0.75, 2);
  });
});
