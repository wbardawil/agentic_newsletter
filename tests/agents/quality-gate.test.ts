import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { QualityGateAgent } from "../../src/agents/quality-gate.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import { makeDeps } from "../helpers/make-deps.js";
import type { QualityGateInput } from "../../src/agents/quality-gate.js";
import { createFakeAnthropic } from "../helpers/fake-anthropic.js";

function makeAngle() {
  return {
    headline: "Why Your Best People Keep Your Business Broken",
    thesis:
      "The operating model rewards escalation because decision rights are undefined, not because the team lacks confidence.",
    targetPersona: "Mid-market CEO",
    relevanceToAudience: "High — affects daily decisions",
    suggestedSources: [],
    osPillar: "Operating Model OS" as const,
    peopleAngle: {
      challenge:
        "Decision-rights clarity only sticks when the owner stops re-absorbing decisions out of habit.",
      framework: "ADKAR: Ability",
    },
    quarterlyTheme: "The Machine",
    justification: {
      angleChoice: "test",
      osPillarChoice: "test",
      peopleAngleChoice: "test",
    },
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

  it("accepts priorAngles missing peopleAngle (backward compat with pre-Option-C history)", async () => {
    const agent = new QualityGateAgent(makeDeps());
    // Strip peopleAngle to simulate a historical entry written before the
    // Option C migration made the field required on StrategicAngleSchema.
    const { peopleAngle: _omit, ...legacyAngle } = makeAngle();
    void _omit;
    const input: AgentInput<QualityGateInput> = {
      runId: randomUUID(),
      editionId: "2026-17",
      agentName: "qualityGate",
      payload: {
        enContent: makeContent("en"),
        esContent: makeContent("es"),
        angle: makeAngle(),
        sourceBundle: makeBundle(),
        priorAngles: [legacyAngle as never],
      },
    };
    // Input parse must not throw on the legacy entry; downstream LLM call
    // will still error because no real Anthropic client — that's fine.
    const output = await agent.run(input);
    expect(output.status).toBe("error");
    expect(output.error).not.toMatch(/peopleAngle/);
    expect(output.error).not.toMatch(/payload/i);
  });

  it("accepts priorAngles missing justification (backward compat with pre-justification history)", async () => {
    const agent = new QualityGateAgent(makeDeps());
    // Simulate an angle-history.json entry written before justification was
    // required — e.g. the committed 2026-21 entry that had talkingPoints instead.
    const { justification: _omit, ...legacyAngle } = makeAngle();
    void _omit;
    const input: AgentInput<QualityGateInput> = {
      runId: randomUUID(),
      editionId: "2026-17",
      agentName: "qualityGate",
      payload: {
        enContent: makeContent("en"),
        esContent: makeContent("es"),
        angle: makeAngle(),
        sourceBundle: makeBundle(),
        priorAngles: [legacyAngle as never],
      },
    };
    const output = await agent.run(input);
    expect(output.status).toBe("error");
    // The error must come from the LLM call, NOT from input schema validation
    expect(output.error).not.toMatch(/justification/);
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

  describe("QualityGate flexibility implementation", () => {
    function depsWithFakeAnthropic(fake: ReturnType<typeof createFakeAnthropic>) {
      const base = makeDeps();
      return {
        ...base,
        apiClients: {
          ...base.apiClients,
          anthropic: fake as never,
        },
      };
    }

    it("Check 1: Angle Originality Level 1 warning (similarity 75% to 84%) approves the draft", async () => {
      const fake = createFakeAnthropic();
      fake.enqueue({
        text: JSON.stringify({
          passed: true,
          hardFailures: [],
          factCheck: { verifiedClaims: [], unverifiedClaims: [] },
          angleOriginality: {
            similarityScore: 0.78,
            closestPriorAngle: "An older angle",
            recommendation: "pass",
          },
          voiceMatch: {
            voiceScore: 88,
            deviations: [],
          },
          sourceDiversity: {
            distinctOutlets: ["HBR", "Bloomberg"],
            outletCount: 2,
          },
          summary: "Approved with moderate overlap",
        }),
      });

      const agent = new QualityGateAgent(depsWithFakeAnthropic(fake));
      const input: AgentInput<QualityGateInput> = {
        runId: randomUUID(),
        editionId: "2026-17",
        agentName: "qualityGate",
        payload: {
          enContent: makeContent("en"),
          esContent: null,
          angle: makeAngle(),
          sourceBundle: makeBundle(),
          priorAngles: [],
        },
      };

      const result = await agent.run(input);
      expect(result.status).toBe("success");
      const data = result.data as any;
      expect(data.passed).toBe(true);
      expect(data.angleOriginality.similarityScore).toBe(0.78);
      expect(data.angleOriginality.angleAlertLevel).toBe("warning_l1");
      expect(data.angleOriginality.angle_alert_level).toBe("warning_l1");
    });

    it("Check 1: Angle Originality Level 2 warning (similarity >= 85%) holds the draft", async () => {
      const fake = createFakeAnthropic();
      fake.enqueue({
        text: JSON.stringify({
          passed: true,
          hardFailures: [],
          factCheck: { verifiedClaims: [], unverifiedClaims: [] },
          angleOriginality: {
            similarityScore: 0.88,
            closestPriorAngle: "A very similar angle",
            recommendation: "consider rerun",
          },
          voiceMatch: {
            voiceScore: 90,
            deviations: [],
          },
          sourceDiversity: {
            distinctOutlets: ["HBR", "Bloomberg"],
            outletCount: 2,
          },
          summary: "Held for high overlap",
        }),
      });

      const agent = new QualityGateAgent(depsWithFakeAnthropic(fake));
      const input: AgentInput<QualityGateInput> = {
        runId: randomUUID(),
        editionId: "2026-17",
        agentName: "qualityGate",
        payload: {
          enContent: makeContent("en"),
          esContent: null,
          angle: makeAngle(),
          sourceBundle: makeBundle(),
          priorAngles: [],
        },
      };

      const result = await agent.run(input);
      expect(result.status).toBe("success");
      const data = result.data as any;
      expect(data.passed).toBe(false); // held!
      expect(data.hardFailures.length).toBeGreaterThan(0);
      expect(data.hardFailures[0]).toContain("High thematic overlap detected");
      expect(data.angleOriginality.angleAlertLevel).toBe("warning_l2");
      expect(data.angleOriginality.angle_alert_level).toBe("warning_l2");
    });

    it("Check 1: Angle Originality Level 2 allows override when manualOverride is passed", async () => {
      const fake = createFakeAnthropic();
      fake.enqueue({
        text: JSON.stringify({
          passed: true,
          hardFailures: [],
          factCheck: { verifiedClaims: [], unverifiedClaims: [] },
          angleOriginality: {
            similarityScore: 0.88,
            closestPriorAngle: "A very similar angle",
            recommendation: "consider rerun",
          },
          voiceMatch: {
            voiceScore: 90,
            deviations: [],
          },
          sourceDiversity: {
            distinctOutlets: ["HBR", "Bloomberg"],
            outletCount: 2,
          },
          summary: "Held for high overlap",
        }),
      });

      const agent = new QualityGateAgent(depsWithFakeAnthropic(fake));
      const input: AgentInput<QualityGateInput> = {
        runId: randomUUID(),
        editionId: "2026-17",
        agentName: "qualityGate",
        payload: {
          enContent: makeContent("en"),
          esContent: null,
          angle: makeAngle(),
          sourceBundle: makeBundle(),
          priorAngles: [],
          manualOverride: true, // override!
        },
      };

      const result = await agent.run(input);
      expect(result.status).toBe("success");
      const data = result.data as any;
      expect(data.passed).toBe(true); // overridden to pass!
    });

    it("Check 2: Voice Match classifies critical and minor deviations", async () => {
      const fake = createFakeAnthropic();
      fake.enqueue({
        text: JSON.stringify({
          passed: true,
          hardFailures: [],
          factCheck: { verifiedClaims: [], unverifiedClaims: [] },
          angleOriginality: {
            similarityScore: 0.1,
            closestPriorAngle: null,
            recommendation: "pass",
          },
          voiceMatch: {
            voice_score: 82,
            critical_deviations: ["Shift in formality level in paragraph 3."],
            minor_deviations: ["Vocabulary variation in section 2."],
            deviations: ["Shift in formality level in paragraph 3."],
            recommendation: "Revise paragraph 3.",
          },
          sourceDiversity: {
            distinctOutlets: ["HBR"],
            outletCount: 1,
          },
          summary: "deviations test",
        }),
      });

      const agent = new QualityGateAgent(depsWithFakeAnthropic(fake));
      const input: AgentInput<QualityGateInput> = {
        runId: randomUUID(),
        editionId: "2026-17",
        agentName: "qualityGate",
        payload: {
          enContent: makeContent("en"),
          esContent: null,
          angle: makeAngle(),
          sourceBundle: makeBundle(),
          priorAngles: [],
        },
      };

      const result = await agent.run(input);
      expect(result.status).toBe("success");
      const data = result.data as any;
      expect(data.voiceMatch.voiceScore).toBe(82);
      expect(data.voiceMatch.criticalDeviations).toEqual(["Shift in formality level in paragraph 3."]);
      expect(data.voiceMatch.critical_deviations).toEqual(["Shift in formality level in paragraph 3."]);
      expect(data.voiceMatch.minorDeviations).toEqual(["Vocabulary variation in section 2."]);
      expect(data.voiceMatch.minor_deviations).toEqual(["Vocabulary variation in section 2."]);
      expect(data.voiceMatch.deviations).toEqual(["Shift in formality level in paragraph 3."]); // only critical ones surfaced
    });

    it("Check 3: Source Diversity is waived when justificationForLowSourceCount is present", async () => {
      const fake = createFakeAnthropic();
      fake.enqueue({
        text: JSON.stringify({
          passed: true,
          hardFailures: [],
          factCheck: { verifiedClaims: [], unverifiedClaims: [] },
          angleOriginality: {
            similarityScore: 0.1,
            closestPriorAngle: null,
            recommendation: "pass",
          },
          voiceMatch: {
            voiceScore: 95,
            deviations: [],
          },
          sourceDiversity: {
            distinctOutlets: ["HBR"],
            outletCount: 1,
          },
          summary: "sources test",
        }),
      });

      const agent = new QualityGateAgent(depsWithFakeAnthropic(fake));
      const input: AgentInput<QualityGateInput> = {
        runId: randomUUID(),
        editionId: "2026-17",
        agentName: "qualityGate",
        payload: {
          enContent: makeContent("en"),
          esContent: null,
          angle: makeAngle(),
          sourceBundle: makeBundle(),
          priorAngles: [],
          justificationForLowSourceCount: "Single-source book summary format",
        },
      };

      const result = await agent.run(input);
      expect(result.status).toBe("success");
      const data = result.data as any;
      expect(data.sourceDiversity.sourceCheckWaived).toBe(true);
      expect(data.sourceDiversity.source_check_waived).toBe(true);
      expect(data.sourceDiversity.justification).toBe("Single-source book summary format");
    });
  });
});
