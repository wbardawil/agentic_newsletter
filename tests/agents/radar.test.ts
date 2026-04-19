import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { RadarAgent } from "../../src/agents/radar.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import { makeDeps } from "../helpers/make-deps.js";

describe("RadarAgent", () => {
  const deps = makeDeps();

  it("has the correct agent name", () => {
    const agent = new RadarAgent(deps);
    expect(agent.name).toBe("radar");
  });

  it("has input and output schemas defined", () => {
    const agent = new RadarAgent(deps);
    expect(agent.inputSchema).toBeDefined();
    expect(agent.outputSchema).toBeDefined();
  });

  it("returns an error when no RSS feeds are reachable", async () => {
    const agent = new RadarAgent(deps);
    const input: AgentInput<{ timeWindowHours: number; maxItems: number; rssTimeoutMs: number }> = {
      runId: randomUUID(),
      editionId: "2026-07",
      agentName: "radar",
      // Short per-feed timeout so all feeds fail fast; withRetry still fires 3× but delays = 3s
      payload: { timeWindowHours: 24, maxItems: 20, rssTimeoutMs: 200 },
    };

    // In a test environment without network access the agent will fail gracefully.
    const output = await agent.run(input);
    expect(output.status).toBe("error");
  }, 15_000);
});
