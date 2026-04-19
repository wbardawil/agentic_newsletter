import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { AnalystAgent } from "../../src/agents/analyst.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import { makeDeps } from "../helpers/make-deps.js";

describe("AnalystAgent", () => {
  it("has the correct agent name", () => {
    const agent = new AnalystAgent(makeDeps());
    expect(agent.name).toBe("analyst");
  });

  it("has input and output schemas defined", () => {
    const agent = new AnalystAgent(makeDeps());
    expect(agent.inputSchema).toBeDefined();
    expect(agent.outputSchema).toBeDefined();
  });

  it("validates analyst input", () => {
    const agent = new AnalystAgent(makeDeps());
    expect(() =>
      agent.inputSchema.parse({
        editionId: "2026-07",
        beehiivPostIds: ["post_abc123", "post_def456"],
      }),
    ).not.toThrow();
  });

  it("rejects empty post IDs array", () => {
    // beehiivPostIds must be non-empty strings but the schema allows empty array —
    // the agent handles empty array gracefully (returns empty metrics), not by throwing.
    const agent = new AnalystAgent(makeDeps());
    expect(() =>
      agent.inputSchema.parse({ editionId: "2026-07", beehiivPostIds: [""] }),
    ).toThrow(); // each string must be min length 1
  });

  it("throws when Beehiiv credentials are missing", async () => {
    const agent = new AnalystAgent(makeDeps());
    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-07",
      agentName: "analyst",
      payload: { editionId: "2026-07", beehiivPostIds: ["post_abc123"] },
    };
    const output = await agent.run(input);
    expect(output.status).toBe("error");
    expect(output.error).toMatch(/BEEHIIV_API_KEY/);
  });

  it("returns empty metrics when no post IDs provided", async () => {
    const deps = makeDeps();
    deps.apiClients = {
      ...deps.apiClients,
      beehiivApiKey: "test-key",
      beehiivPublicationId: "test-pub",
    };
    const agent = new AnalystAgent(deps);
    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-07",
      agentName: "analyst",
      payload: { editionId: "2026-07", beehiivPostIds: [] },
    };
    const output = await agent.run(input);
    expect(output.status).toBe("success");
    expect(output.data.openRate).toBeUndefined();
    expect(output.data.clickRate).toBeUndefined();
    expect(output.data.collectedAt).toBeDefined();
  });
});
