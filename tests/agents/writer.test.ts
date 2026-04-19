import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { WriterAgent } from "../../src/agents/writer.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import { makeDeps } from "../helpers/make-deps.js";

function makeAngle() {
  return {
    headline: "Your team escalates because your system tells them to",
    thesis: "Escalation is the rational response to undefined decision rights.",
    targetPersona: "$5M–$100M owner-operator",
    relevanceToAudience: "Every corridor operator hits the autonomy wall.",
    suggestedSources: [randomUUID()],
    talkingPoints: ["Decision rights architecture reduces escalation by 40%."],
    osPillar: "Operating Model OS" as const,
    quarterlyTheme: "The Machine",
  };
}

function makeSources() {
  const now = new Date().toISOString();
  return [
    {
      id: randomUUID(),
      sourceType: "rss" as const,
      title: "Operating Models for Mid-Market Companies",
      url: "https://example.com/article",
      publishedAt: now,
      outlet: "HBR",
      summary: "Decision rights frameworks reduce management overhead.",
      verbatimFacts: [
        "Documented decision rights reduce escalation by 40%.",
        "Owner-operators spend 30% of time on unnecessary approvals.",
        "Clear RACI frameworks cut meeting overhead by 25%.",
      ],
      relevanceScore: 0.9,
      recencyHours: 10,
      tags: ["operating model"],
      rawContent: "Article content.",
    },
  ];
}

describe("WriterAgent", () => {
  const deps = makeDeps();

  it("has the correct agent name", () => {
    const agent = new WriterAgent(deps);
    expect(agent.name).toBe("writer");
  });

  it("has input and output schemas defined", () => {
    const agent = new WriterAgent(deps);
    expect(agent.inputSchema).toBeDefined();
    expect(agent.outputSchema).toBeDefined();
  });

  it("validates writer input", () => {
    const agent = new WriterAgent(deps);
    expect(() =>
      agent.inputSchema.parse({
        angle: makeAngle(),
        sources: makeSources(),
        language: "en",
      }),
    ).not.toThrow();
  });

  it("rejects unsupported language", () => {
    const agent = new WriterAgent(deps);
    expect(() =>
      agent.inputSchema.parse({
        angle: makeAngle(),
        sources: makeSources(),
        language: "fr",
      }),
    ).toThrow();
  });

  it("rejects sources with insufficient verbatimFacts", () => {
    const agent = new WriterAgent(deps);
    const badSource = { ...makeSources()[0], verbatimFacts: ["only one fact"] };
    expect(() =>
      agent.inputSchema.parse({ angle: makeAngle(), sources: [badSource], language: "en" }),
    ).toThrow();
  });

  it("returns error when LLM unavailable (no API key in tests)", async () => {
    const agent = new WriterAgent(deps);
    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-07",
      agentName: "writer",
      payload: { angle: makeAngle(), sources: makeSources(), language: "en" },
    };
    const output = await agent.run(input);
    expect(output.status).toBe("error");
  }, 10_000);
});
