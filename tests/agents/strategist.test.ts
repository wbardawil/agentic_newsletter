import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { StrategistAgent } from "../../src/agents/strategist.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import type { SourceBundle } from "../../src/types/source-bundle.js";
import { makeDeps } from "../helpers/make-deps.js";

function makeBundle(): SourceBundle {
  const now = new Date().toISOString();
  return {
    editionId: "2026-07",
    scannedAt: now,
    totalScanned: 2,
    totalSelected: 2,
    items: [
      {
        id: randomUUID(),
        sourceType: "rss",
        title: "Family Business Succession in Latin America",
        url: "https://example.com/article-1",
        publishedAt: now,
        outlet: "Business Review",
        summary: "How mid-market family businesses in Mexico navigate leadership transitions.",
        verbatimFacts: [
          "70% of family businesses fail to survive the second generation.",
          "Succession planning starts 5–10 years before transition.",
          "Mexico's family business sector employs 70% of the workforce.",
        ],
        relevanceScore: 0.85,
        recencyHours: 12,
        tags: ["family business", "succession", "latam"],
        rawContent: "Full article content here.",
      },
      {
        id: randomUUID(),
        sourceType: "rss",
        title: "Operating Models for Distributed Teams",
        url: "https://example.com/article-2",
        publishedAt: now,
        outlet: "Harvard Business Review",
        summary: "New frameworks for owner-operators managing teams across borders.",
        verbatimFacts: [
          "Remote teams require 3x clearer decision frameworks.",
          "Documented operating models reduce escalation by 40%.",
          "Owner-operators lose 30% of time to unnecessary escalations.",
        ],
        relevanceScore: 0.9,
        recencyHours: 6,
        tags: ["operating model", "leadership", "mid-market"],
        rawContent: "More article content.",
      },
    ],
    metadata: {
      feedsScanned: 2,
      timeWindowHours: 168,
      filterCriteria: ["recency", "relevance-keyword-scoring"],
    },
  };
}

describe("StrategistAgent", () => {
  const deps = makeDeps();

  it("has the correct agent name", () => {
    const agent = new StrategistAgent(deps);
    expect(agent.name).toBe("strategist");
  });

  it("has input and output schemas defined", () => {
    const agent = new StrategistAgent(deps);
    expect(agent.inputSchema).toBeDefined();
    expect(agent.outputSchema).toBeDefined();
  });

  it("validates source bundle input", () => {
    const agent = new StrategistAgent(deps);
    expect(() => agent.inputSchema.parse(makeBundle())).not.toThrow();
  });

  it("rejects empty items array", () => {
    const agent = new StrategistAgent(deps);
    const bad = { ...makeBundle(), items: [] };
    expect(() => agent.inputSchema.parse(bad)).toThrow();
  });

  it("returns error when LLM is unavailable (no API key in tests)", async () => {
    const agent = new StrategistAgent(deps);
    const input: AgentInput<SourceBundle> = {
      runId: randomUUID(),
      editionId: "2026-07",
      agentName: "strategist",
      payload: makeBundle(),
    };
    const output = await agent.run(input);
    // In test env without a real API key, the LLM call fails
    expect(output.status).toBe("error");
  }, 10_000);
});
