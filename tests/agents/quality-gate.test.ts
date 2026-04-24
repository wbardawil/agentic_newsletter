import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { QualityGateAgent } from "../../src/agents/quality-gate.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import { makeDeps } from "../helpers/make-deps.js";
import type { QualityGateInput } from "../../src/agents/quality-gate.js";

function makeAngle() {
  return {
    headline: "Why Your Best People Keep Your Business Broken",
    thesis:
      "The operating model rewards escalation because decision rights are undefined, not because the team lacks confidence.",
    targetPersona: "Mid-market CEO",
    relevanceToAudience: "High — affects daily decisions",
    suggestedSources: [],
    talkingPoints: ["escalation is rational", "clarity replaces courage"],
    osPillar: "Operating Model OS" as const,
    quarterlyTheme: "The Machine",
  };
}

function makeContent(language: "en" | "es") {
  return {
    language,
    subject:
      language === "en"
        ? "Your team is following the system you built"
        : "Tu equipo sigue el sistema que construiste",
    preheader:
      language === "en"
        ? "The autonomy problem is not a people problem."
        : "El problema de autonomía no es un problema de personas.",
    sections: [
      {
        id: randomUUID(),
        type: "lead" as const,
        heading: "APERTURA",
        body: "A client messaged me on a Sunday. His team had spent three days unable to decide whether to renew a vendor contract. Nobody had told his team that this decision was theirs to make.",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "analysis" as const,
        heading: "INSIGHT",
        body: "You told them to act independently. They keep coming to you. The issue is not capability. It is the operating model.",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "spotlight" as const,
        heading: "FIELD REPORT",
        body: "According to [HBR](https://hbr.org/x), mid-market CEOs spend 40% of their time on escalated decisions.",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "quickTakes" as const,
        heading: "COMPASS",
        body: "What have I trained my team to bring me by keeping the boundary undefined?",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "cta" as const,
        heading: "DOOR",
        body: "If something landed, reply — I read every response.",
        sourceRefs: [],
      },
    ],
  };
}

function makeBundle() {
  return {
    editionId: "2026-17",
    scannedAt: new Date().toISOString(),
    totalScanned: 5,
    totalSelected: 1,
    items: [
      {
        id: randomUUID(),
        sourceType: "rss" as const,
        title: "Why Mid-Market CEOs Drown in Decisions",
        url: "https://hbr.org/x",
        publishedAt: new Date().toISOString(),
        outlet: "HBR",
        summary: "A piece on decision rights in mid-market firms.",
        verbatimFacts: [
          "Mid-market CEOs spend 40% of their time on escalated decisions.",
          "Decision rights ambiguity is the single largest predictor of CEO burnout in this segment.",
          "Firms that publish explicit decision rights see 23% faster decision velocity within six months.",
        ],
        relevanceScore: 0.9,
        recencyHours: 24,
        tags: [],
        region: "corridor",
      },
    ],
    metadata: {
      feedsScanned: 1,
      timeWindowHours: 168,
      filterCriteria: ["relevance"],
    },
  };
}

describe("QualityGateAgent", () => {
  it("has the correct agent name", () => {
    const agent = new QualityGateAgent(makeDeps());
    expect(agent.name).toBe("qualityGate");
  });

  it("has input and output schemas defined", () => {
    const agent = new QualityGateAgent(makeDeps());
    expect(agent.inputSchema).toBeDefined();
    expect(agent.outputSchema).toBeDefined();
  });

  it("validates input payload shape", async () => {
    const agent = new QualityGateAgent(makeDeps());
    const input: AgentInput<QualityGateInput> = {
      runId: randomUUID(),
      editionId: "2026-17",
      agentName: "qualityGate",
      payload: {
        enContent: makeContent("en"),
        esContent: makeContent("es"),
        angle: makeAngle(),
        sourceBundle: makeBundle(),
        priorAngles: [],
      },
    };
    const output = await agent.run(input);
    // Without a live LLM, we expect error — but input validation must pass first.
    expect(output.status).toBe("error");
    expect(output.error).not.toMatch(/payload/i);
  });

  it("rejects missing sourceBundle", async () => {
    const agent = new QualityGateAgent(makeDeps());
    const input = {
      runId: randomUUID(),
      editionId: "2026-17",
      agentName: "qualityGate",
      payload: {
        enContent: makeContent("en"),
        esContent: null,
        angle: makeAngle(),
        // missing sourceBundle
        priorAngles: [],
      },
    } as unknown as AgentInput<QualityGateInput>;
    await expect(agent.run(input)).rejects.toThrow();
  });
});
