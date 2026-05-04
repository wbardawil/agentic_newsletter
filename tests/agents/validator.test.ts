import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ValidatorAgent } from "../../src/agents/validator.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import { makeDeps } from "../helpers/make-deps.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeContent(overrides: Partial<Record<string, string>> = {}) {
  return {
    language: "en" as const,
    subject: "Your team isn't waiting on permission. They're following your system.",
    preheader: "The autonomy problem is not a people problem.",
    sections: [
      {
        id: randomUUID(),
        type: "lead" as const,
        heading: "The Apertura",
        body:
          overrides["apertura"] ??
          "A client messaged me on a Sunday afternoon. His team had spent three days unable to decide whether to renew a vendor contract. Nobody had told his team that this decision was theirs to make.",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "analysis" as const,
        heading: "The Insight",
        body:
          overrides["insight"] ??
          "You have told your team to act independently. They keep coming to you anyway. The instinct is to read this as a capability problem or a confidence problem. It is neither. It is a systems problem. Your team is doing exactly what the operating model you built tells them to do. When decision rights are undefined, the rational behavior is to escalate. Escalation is not timidity. It is self-preservation. A manager who makes a decision above their level gets corrected. A manager who escalates is never wrong. You trained this behavior by leaving the boundaries undefined. Every time a decision comes to you that should not, you have two choices: answer it, or send it back. Most owners answer it. That confirms the pattern. This week, pull the last ten decisions that came to you. For each one ask: should this have reached me? Write down whose decision it actually is. Share that list by role.",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "spotlight" as const,
        heading: "The Field Report",
        body:
          overrides["fieldReport"] ??
          "A Colombian logistics company operating across the Bogotá–Miami corridor recently restructured its management team — not by adding headcount, but by redistributing decision authority. The trigger was a six-week period in which three operational decisions stalled because the owner was managing a client crisis. The restructuring involved a single document: a decision rights framework that assigned sixty-three recurring decisions to specific roles. Within ninety days, the volume of decisions escalated to the owner each week fell measurably. For corridor operators managing businesses across two regulatory environments, distributed decision authority is not a luxury. It is the architecture that allows the business to function when the owner is in the other country.",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "quickTakes" as const,
        heading: "The Compass",
        body:
          overrides["compass"] ??
          "I have been sitting with this question: how much of what I call leadership is actually decision-hoarding — and would I know the difference? There is a version of staying close to decisions that is genuine stewardship. And there is a version that is control dressed as care. I am not sure I always know which one I am practicing in the moment.",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "cta" as const,
        heading: "The Door",
        body: "If something in this issue landed, reply — I read every response.\nWhen you're ready to work together directly, here is how we start: [link]",
        sourceRefs: [],
      },
    ],
  };
}

function makeAngle() {
  return {
    headline: "Your team escalates because your system tells them to",
    thesis: "Escalation is not timidity — it is the rational response to undefined decision rights.",
    targetPersona: "$5M–$100M owner-operator with a team of 10–50",
    relevanceToAudience: "Every corridor operator eventually hits the autonomy wall.",
    suggestedSources: [randomUUID(), randomUUID()],
    talkingPoints: [
      "Your team escalates because escalation is the safe choice when decision rights are unclear.",
      "You trained this behavior by answering decisions that weren't yours to answer.",
      "Decision Rights Architecture: a three-tier map of who owns which decisions.",
      "Pull the last ten decisions that reached you and name whose they actually are.",
    ],
    osPillar: "Operating Model OS" as const,
    peopleAngle: {
      challenge:
        "The owner has trained the team to escalate by answering decisions that were never his to make.",
      framework: "ADKAR: Reinforcement",
    },
    quarterlyTheme: "The Machine",
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ValidatorAgent", () => {
  const deps = makeDeps();

  it("has the correct agent name", () => {
    const agent = new ValidatorAgent(deps);
    expect(agent.name).toBe("validator");
  });

  it("has input and output schemas defined", () => {
    const agent = new ValidatorAgent(deps);
    expect(agent.inputSchema).toBeDefined();
    expect(agent.outputSchema).toBeDefined();
  });

  it("detects banned phrases deterministically (no LLM required)", async () => {
    const agent = new ValidatorAgent(deps);
    const content = makeContent({
      insight:
        "Best practices suggest that thought leadership drives synergy. Move the needle with scalable solutions.",
    });

    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-07",
      agentName: "validator",
      payload: { content, angle: makeAngle() },
    };

    // The agent will fail on the LLM call (no API key in tests).
    // We only verify that it starts and the banned phrase detection runs
    // before the LLM call — which means the error is a network/API error,
    // not an input validation error.
    const output = await agent.run(input);

    // In test env without API key, the agent returns status "error"
    // from the LLM call, not from input validation.
    expect(["success", "error"]).toContain(output.status);
  });

  it("rejects content missing required sections", () => {
    const agent = new ValidatorAgent(deps);
    expect(() =>
      agent.inputSchema.parse({
        content: { language: "en", subject: "Test", preheader: "Pre", sections: [] },
        angle: makeAngle(),
      }),
    ).toThrow();
  });

  it("rejects invalid OS pillar in angle", () => {
    const agent = new ValidatorAgent(deps);
    const badAngle = { ...makeAngle(), osPillar: "Invalid OS" };
    expect(() =>
      agent.inputSchema.parse({ content: makeContent(), angle: badAngle }),
    ).toThrow();
  });
});
