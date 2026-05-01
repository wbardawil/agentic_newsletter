import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { AmplifierAgent } from "../../src/agents/amplifier.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import { makeDeps } from "../helpers/make-deps.js";

function makeContent() {
  return {
    language: "en" as const,
    subject: "Your team isn't waiting on permission. They're following your system.",
    preheader: "The autonomy problem is not a people problem.",
    sections: [
      { id: randomUUID(), type: "lead" as const, heading: "The Apertura", body: "Opening paragraph.", sourceRefs: [] },
      { id: randomUUID(), type: "analysis" as const, heading: "The Insight", body: "Analysis body with insight and framework.", sourceRefs: [] },
      { id: randomUUID(), type: "spotlight" as const, heading: "The Field Report", body: "Field report content.", sourceRefs: [] },
      { id: randomUUID(), type: "quickTakes" as const, heading: "The Compass", body: "Compass section.", sourceRefs: [] },
      { id: randomUUID(), type: "cta" as const, heading: "The Door", body: "Reply to this email.", sourceRefs: [] },
    ],
  };
}

function makeAngle() {
  return {
    headline: "Your team escalates because your system tells them to",
    thesis: "Escalation is the rational response to undefined decision rights.",
    targetPersona: "$5M–$100M owner-operator",
    relevanceToAudience: "Every corridor operator hits the autonomy wall.",
    suggestedSources: [randomUUID()],
    talkingPoints: ["Decision rights architecture reduces escalation."],
    osPillar: "Operating Model OS" as const,
    peopleAngle: {
      challenge:
        "The owner must stop being available to escalations that should not reach him.",
      framework: "ADKAR: Reinforcement",
    },
    quarterlyTheme: "The Machine",
  };
}

describe("AmplifierAgent", () => {
  const deps = makeDeps();

  it("has the correct agent name", () => {
    const agent = new AmplifierAgent(deps);
    expect(agent.name).toBe("amplifier");
  });

  it("has input and output schemas defined", () => {
    const agent = new AmplifierAgent(deps);
    expect(agent.inputSchema).toBeDefined();
    expect(agent.outputSchema).toBeDefined();
  });

  it("validates amplifier input", () => {
    const agent = new AmplifierAgent(deps);
    expect(() =>
      agent.inputSchema.parse({
        enContent: makeContent(),
        angle: makeAngle(),
        shareableSentence: null,
      }),
    ).not.toThrow();
  });

  it("rejects input missing enContent", () => {
    const agent = new AmplifierAgent(deps);
    expect(() =>
      agent.inputSchema.parse({ angle: makeAngle(), shareableSentence: null }),
    ).toThrow();
  });

  it("returns error when LLM unavailable (no API key in tests)", async () => {
    const agent = new AmplifierAgent(deps);
    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-07",
      agentName: "amplifier",
      payload: { enContent: makeContent(), angle: makeAngle(), shareableSentence: null },
    };
    const output = await agent.run(input);
    expect(output.status).toBe("error");
  }, 10_000);
});
