import type { CostEntry } from "../types/agent-io.js";

/** USD per 1M tokens — update as Anthropic pricing changes. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 0.8, output: 4.0 },
  "claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 5.0, output: 25.0 },
  "claude-opus-4-7": { input: 5.0, output: 25.0 },
  // Gemini image-gen models are billed per image, not per token. We record
  // each generated image as ~1290 output tokens so the run-cost cap still
  // applies meaningfully. Tune output rate if Gemini pricing shifts.
  "gemini-2.5-flash-image-preview": { input: 0.3, output: 31.0 },
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

  const warnedModels = new Set<string>();

  function calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const pricing = MODEL_PRICING[model];
    if (!pricing) {
      // WARN instead of throw. An unknown model used to propagate up through
      // recordUsage → repair pass → agent.execute → BaseAgent retry loop,
      // costing a full Opus re-run for every attempt. Log once per unseen
      // model; return 0 cost. Auditor can still catch missing pricing from
      // the warning line in the run log.
      if (!warnedModels.has(model)) {
        warnedModels.add(model);
        console.warn(
          `[cost-tracker] Unknown model "${model}" — cost recorded as $0. ` +
            `Add it to MODEL_PRICING in src/utils/cost-tracker.ts to restore accurate accounting.`,
        );
      }
      return 0;
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
