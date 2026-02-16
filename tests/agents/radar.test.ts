import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { RadarAgent } from "../../src/agents/radar.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import { createLogger } from "../../src/utils/logger.js";
import { createCostTracker } from "../../src/utils/cost-tracker.js";

describe("RadarAgent", () => {
  const deps = {
    logger: createLogger("error"),
    costTracker: createCostTracker(),
  };

  it("has the correct agent name", () => {
    const agent = new RadarAgent(deps);
    expect(agent.name).toBe("radar");
  });

  it("has input and output schemas defined", () => {
    const agent = new RadarAgent(deps);
    expect(agent.inputSchema).toBeDefined();
    expect(agent.outputSchema).toBeDefined();
  });

  it("throws 'not implemented' when run", async () => {
    const agent = new RadarAgent(deps);
    const input: AgentInput<{ timeWindowHours: number; maxItems: number }> = {
      runId: randomUUID(),
      editionId: randomUUID(),
      agentName: "radar",
      payload: { timeWindowHours: 24, maxItems: 20 },
    };

    const output = await agent.run(input);
    expect(output.success).toBe(false);
    expect(output.error).toContain("not implemented");
  });
});
