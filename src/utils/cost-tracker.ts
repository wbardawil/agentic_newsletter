import type { CostEntry } from "../types/agent-io.js";

/** USD per 1M tokens — update as Anthropic pricing changes. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 5.0, output: 25.0 },
  "claude-opus-4-7": { input: 5.0, output: 25.0 },
};

export interface CostTracker {
  recordUsage(model: string, inputTokens: number, outputTokens: number): void;
  getCurrentCost(): CostEntry;
  getTotalCost(): number;
  reset(): void;
}

export function createCostTracker(): CostTracker {
  let currentModel = "";
  let currentInputTokens = 0;
  let currentOutputTokens = 0;
  let currentCostUsd = 0;
  let totalCostUsd = 0;

  function calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      throw new Error(
        `Unknown model "${model}" — add it to MODEL_PRICING in cost-tracker.ts`,
      );
    }
    return (
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output
    );
  }

  return {
    recordUsage(model, inputTokens, outputTokens) {
      currentModel = model;
      currentInputTokens += inputTokens;
      currentOutputTokens += outputTokens;
      const cost = calculateCost(model, inputTokens, outputTokens);
      currentCostUsd += cost;
      totalCostUsd += cost;
    },

    getCurrentCost(): CostEntry {
      return {
        model: currentModel,
        inputTokens: currentInputTokens,
        outputTokens: currentOutputTokens,
        costUsd: currentCostUsd,
      };
    },

    getTotalCost(): number {
      return totalCostUsd;
    },

    reset() {
      currentModel = "";
      currentInputTokens = 0;
      currentOutputTokens = 0;
      currentCostUsd = 0;
    },
  };
}
