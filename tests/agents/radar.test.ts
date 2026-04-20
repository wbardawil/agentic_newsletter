import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { AgentInput } from "../../src/types/agent-io.js";
import { makeDeps } from "../helpers/make-deps.js";

// Mock rss-parser before importing RadarAgent so every parseURL call throws.
// Guarantees the "no feeds reachable" code path without depending on network.
vi.mock("rss-parser", () => {
  return {
    default: class MockParser {
      async parseURL(_url: string): Promise<never> {
        throw new Error("Mocked network failure — test isolated from real feeds");
      }
    },
  };
});

const { RadarAgent } = await import("../../src/agents/radar.js");

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
      payload: { timeWindowHours: 24, maxItems: 20, rssTimeoutMs: 100 },
    };

    const output = await agent.run(input);
    expect(output.status).toBe("error");
  }, 15_000);
});
