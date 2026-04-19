import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { DistributorAgent } from "../../src/agents/distributor.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import { makeDeps } from "../helpers/make-deps.js";

function makeContent(language: "en" | "es" = "en") {
  return {
    language,
    subject: `Test subject (${language})`,
    preheader: `Test preheader (${language})`,
    sections: [
      { id: randomUUID(), type: "lead" as const, heading: "Apertura", body: "Opening.", sourceRefs: [] },
      { id: randomUUID(), type: "analysis" as const, heading: "Insight", body: "Analysis.", sourceRefs: [] },
      { id: randomUUID(), type: "spotlight" as const, heading: "Field Report", body: "Field.", sourceRefs: [] },
      { id: randomUUID(), type: "quickTakes" as const, heading: "Compass", body: "Takes.", sourceRefs: [] },
      { id: randomUUID(), type: "cta" as const, heading: "Door", body: "CTA.", sourceRefs: [] },
    ],
  };
}

describe("DistributorAgent", () => {
  it("has the correct agent name", () => {
    const agent = new DistributorAgent(makeDeps());
    expect(agent.name).toBe("distributor");
  });

  it("has input and output schemas defined", () => {
    const agent = new DistributorAgent(makeDeps());
    expect(agent.inputSchema).toBeDefined();
    expect(agent.outputSchema).toBeDefined();
  });

  it("validates distributor input", () => {
    const agent = new DistributorAgent(makeDeps());
    expect(() =>
      agent.inputSchema.parse({ enContent: makeContent("en"), esContent: makeContent("es") }),
    ).not.toThrow();
  });

  it("rejects invalid scheduledAt format", () => {
    const agent = new DistributorAgent(makeDeps());
    expect(() =>
      agent.inputSchema.parse({
        enContent: makeContent("en"),
        esContent: makeContent("es"),
        scheduledAt: "not-a-date",
      }),
    ).toThrow();
  });

  it("throws when Beehiiv credentials are missing", async () => {
    // makeDeps() has beehiivApiKey: undefined
    const agent = new DistributorAgent(makeDeps());
    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-07",
      agentName: "distributor",
      payload: { enContent: makeContent("en"), esContent: makeContent("es") },
    };
    const output = await agent.run(input);
    expect(output.status).toBe("error");
    expect(output.error).toMatch(/BEEHIIV_API_KEY/);
  });

  it("returns draft records in dry-run mode (skips API calls)", async () => {
    const deps = makeDeps();
    // Provide credentials + dry-run
    deps.apiClients = {
      ...deps.apiClients,
      beehiivApiKey: "test-key",
      beehiivPublicationId: "test-pub",
      dryRun: true,
    };
    const agent = new DistributorAgent(deps);
    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-07",
      agentName: "distributor",
      payload: { enContent: makeContent("en"), esContent: makeContent("es") },
    };
    const output = await agent.run(input);
    expect(output.status).toBe("success");
    expect(output.data).toHaveLength(2);
    expect(output.data[0].externalId).toBe("dry-run-en");
    expect(output.data[1].externalId).toBe("dry-run-es");
  });
});
