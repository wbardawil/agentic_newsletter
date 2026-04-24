import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { LocalizerAgent } from "../../src/agents/localizer.js";
import { QualityGateAgent } from "../../src/agents/quality-gate.js";
import { ValidatorAgent } from "../../src/agents/validator.js";
import type { AgentInput } from "../../src/types/agent-io.js";
import type {
  LocalizedContent,
  StrategicAngle,
  ValidationResult,
} from "../../src/types/edition.js";
import type { SourceBundle } from "../../src/types/source-bundle.js";
import { createFakeAnthropic } from "../helpers/fake-anthropic.js";
import { makeDeps } from "../helpers/make-deps.js";

/**
 * Integration smoke tests that wire real agents to a fake Anthropic client
 * and verify the critical coordination invariants the unit tests cannot
 * catch. These are the bugs that have actually shipped in past editions:
 *
 * - ES `thesis` field populated so the "Resumen del Insight" render block
 *   does not leak English
 * - QualityGate's `sourceDiversity` reflects the deterministic computation,
 *   not whatever the LLM happened to say
 * - Validator's score and word counts come from the in-code computation,
 *   not the LLM's approximation
 */

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeAngle(): StrategicAngle {
  return {
    headline: "Your AI is a witness, not a tool",
    thesis:
      "AI exposes the operating model you have rather than the one you think you have.",
    targetPersona: "$5M–$100M owner-operator",
    relevanceToAudience:
      "Every corridor operator running an AI rollout hits this wall.",
    suggestedSources: [randomUUID()],
    talkingPoints: ["AI amplifies strategy clarity that is already documented."],
    osPillar: "Operating Model OS",
    quarterlyTheme: "The Machine",
  };
}

function makeEnContent(): LocalizedContent {
  return {
    language: "en",
    subject: "Your AI is a witness, not a tool",
    preheader: "The tool is doing exactly what you asked. That is the problem.",
    sections: [
      {
        id: randomUUID(),
        type: "news",
        heading: "The Signal",
        body:
          "*This week: the week's pattern.*\n\n" +
          "- **Strategy:** Something happened. [Read ->](https://expansion.mx/a)\n" +
          "- **Operating Models:** Something else. [Read ->](https://bloomberglinea.com/b)\n" +
          "- **Technology:** A third thing. [Read ->](https://elfinanciero.com.mx/c)\n" +
          "- **Human Capital:** A fourth. [Read ->](https://expansion.mx/d)",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "lead",
        heading: "The Apertura",
        body: "===OPTION_A:observation===\nA client told me...\n===OPTION_B:provocation===\nThe most...\n===OPTION_C:pattern===\nFour calls...",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "analysis",
        heading: "The Insight",
        body:
          "You deployed the AI. Your team uses it. Nothing moved. The instinct is to blame the model. That is not the problem. The tool is reading the operating model you have. Most advisors call this a data problem. It is a source-of-truth problem.",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "spotlight",
        heading: "The Field Report",
        body: "Apple confirmed this week according to [Expansión](https://expansion.mx/apple) that Tim Cook steps down.",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "tool",
        heading: "The Tool",
        body: "**The Source of Truth Map** — a one-page document.",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "quickTakes",
        heading: "The Compass",
        body: "**Watch for this week:** which AI your team quietly stopped using.",
        sourceRefs: [],
      },
      {
        id: randomUUID(),
        type: "cta",
        heading: "The Door",
        body: "If something landed, reply.",
        sourceRefs: [],
      },
    ],
  };
}

function makeBundle(): SourceBundle {
  return {
    editionId: "2026-20",
    scannedAt: "2026-04-20T12:00:00.000Z",
    totalScanned: 100,
    totalSelected: 4,
    items: [
      {
        id: randomUUID(),
        sourceType: "rss",
        title: "A",
        url: "https://expansion.mx/a",
        publishedAt: "2026-04-20T10:00:00.000Z",
        outlet: "Expansión",
        summary: "s",
        verbatimFacts: ["f1", "f2", "f3"],
        relevanceScore: 0.9,
        recencyHours: 2,
        tags: ["corridor"],
        region: "corridor",
      },
      {
        id: randomUUID(),
        sourceType: "rss",
        title: "B",
        url: "https://bloomberglinea.com/b",
        publishedAt: "2026-04-20T10:00:00.000Z",
        outlet: "Bloomberg Línea",
        summary: "s",
        verbatimFacts: ["f1", "f2", "f3"],
        relevanceScore: 0.9,
        recencyHours: 2,
        tags: ["corridor"],
        region: "corridor",
      },
      {
        id: randomUUID(),
        sourceType: "rss",
        title: "C",
        url: "https://elfinanciero.com.mx/c",
        publishedAt: "2026-04-20T10:00:00.000Z",
        outlet: "El Financiero",
        summary: "s",
        verbatimFacts: ["f1", "f2", "f3"],
        relevanceScore: 0.9,
        recencyHours: 2,
        tags: ["corridor"],
        region: "corridor",
      },
      {
        id: randomUUID(),
        sourceType: "rss",
        title: "D",
        url: "https://expansion.mx/d",
        publishedAt: "2026-04-20T10:00:00.000Z",
        outlet: "Expansión",
        summary: "s",
        verbatimFacts: ["f1", "f2", "f3"],
        relevanceScore: 0.9,
        recencyHours: 2,
        tags: ["corridor"],
        region: "corridor",
      },
    ],
    metadata: {
      feedsScanned: 52,
      timeWindowHours: 168,
      filterCriteria: ["corridor"],
    },
  };
}

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

// ── Tests ─────────────────────────────────────────────────────────────────────

/**
 * The ES Writer (Localizer class) receives BOTH pools of items and the
 * completed EN edition. The US+corridor pool grounds the citations (same
 * tier-1 sources as EN); the MX pool is the optional regional-touch pool
 * for a Field Report substitution or an "Enfoque México" paragraph. This
 * test verifies the prompt actually exposes both pools distinctly.
 */
describe("pipeline smoke — ES Writer receives both EN+US/corridor bundle and MX bundle", () => {
  it("exposes US+corridor items in the en_edition_bundle block and MX items in mx_source_items", async () => {
    const fake = createFakeAnthropic();
    fake.enqueue({
      text: JSON.stringify({
        language: "es",
        subject: "Su IA no es herramienta",
        preheader: "preheader",
        thesis: "tesis",
        sections: makeEnContent().sections.map((s) => ({
          ...s,
          heading: s.heading,
          body: "stub",
        })),
      }),
    });

    const deps = depsWithFakeAnthropic(fake);
    const agent = new LocalizerAgent(deps);
    const mixedBundle: SourceBundle = {
      ...makeBundle(),
      items: [
        { ...makeBundle().items[0]!, region: "mx", outlet: "Expansión MX" },
        { ...makeBundle().items[1]!, region: "corridor", outlet: "Bloomberg" },
        { ...makeBundle().items[2]!, region: "us", outlet: "WSJ" },
      ],
    };
    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-20",
      agentName: "localizer",
      payload: {
        content: makeEnContent(),
        angle: makeAngle(),
        targetLanguage: "es",
        draftsDir: "/tmp/nonexistent-drafts-for-test",
        sourceBundle: mixedBundle,
      },
    };
    await agent.run(input);

    const promptArgs = fake.promptsReceived[0] as { system?: Array<{ text: string }> };
    const promptText = promptArgs.system?.[0]?.text ?? "";
    // Both pools appear in the prompt, in different blocks.
    expect(promptText).toContain("<en_edition_bundle>");
    expect(promptText).toContain("<mx_source_items>");
    // US+corridor outlets live in the en_edition_bundle block.
    expect(promptText).toContain("Bloomberg");
    expect(promptText).toContain("WSJ");
    // MX outlets live in the mx_source_items block.
    expect(promptText).toContain("Expansión MX");
    expect(promptText).toContain('region="mx"');
    expect(promptText).toContain('region="us"');
    expect(promptText).toContain('region="corridor"');
  });

  it("marks each bundle as empty with a clear message when no items of that region exist", async () => {
    const fake = createFakeAnthropic();
    fake.enqueue({
      text: JSON.stringify({
        language: "es",
        subject: "subject",
        preheader: "preheader",
        thesis: "tesis",
        sections: makeEnContent().sections.map((s) => ({
          ...s,
          body: "stub",
        })),
      }),
    });

    const deps = depsWithFakeAnthropic(fake);
    const agent = new LocalizerAgent(deps);
    // US-only bundle → en_edition_bundle has the items, mx_source_items is empty.
    const usOnlyBundle: SourceBundle = {
      ...makeBundle(),
      items: makeBundle().items.map((it) => ({ ...it, region: "us" as const })),
    };
    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-20",
      agentName: "localizer",
      payload: {
        content: makeEnContent(),
        angle: makeAngle(),
        targetLanguage: "es",
        draftsDir: "/tmp/nonexistent-drafts-for-test",
        sourceBundle: usOnlyBundle,
      },
    };
    await agent.run(input);

    const promptArgs = fake.promptsReceived[0] as { system?: Array<{ text: string }> };
    const promptText = promptArgs.system?.[0]?.text ?? "";
    expect(promptText).toContain("MX items: no items available this week.");
  });
});

describe("pipeline smoke — LocalizerAgent populates `thesis`", () => {
  it("returns ES LocalizedContent with a non-empty thesis field", async () => {
    const fake = createFakeAnthropic();
    // A realistic Localizer response including the thesis field (the ES
    // transcreation of angle.thesis). Before PR #15 added this field, the
    // render pass fell back to angle.thesis (English) and leaked into the ES
    // "Resumen del Insight" block. This test asserts the field is produced.
    fake.enqueue({
      text: JSON.stringify({
        language: "es",
        subject: "Su IA no es herramienta",
        preheader: "La herramienta hace exactamente lo que usted le pidió.",
        thesis:
          "La IA no produce claridad estratégica: amplifica la que ya existe en su Strategy OS.",
        sections: [
          {
            id: randomUUID(),
            type: "news",
            heading: "LA SEÑAL",
            body: "*Esta semana: la semana.*\n\n- **Estrategia:** X. [Leer ->](https://expansion.mx/a)",
            sourceRefs: [],
          },
          {
            id: randomUUID(),
            type: "lead",
            heading: "LA APERTURA",
            body: "Un cliente me reenvió una captura.",
            sourceRefs: [],
          },
          {
            id: randomUUID(),
            type: "analysis",
            heading: "EL INSIGHT",
            body: "Usted desplegó la IA. Nada se movió.",
            sourceRefs: [],
          },
          {
            id: randomUUID(),
            type: "spotlight",
            heading: "EL REPORTE DE CAMPO",
            body: "Apple confirmó.",
            sourceRefs: [],
          },
          {
            id: randomUUID(),
            type: "tool",
            heading: "LA HERRAMIENTA",
            body: "**El Mapa de Fuente Única**",
            sourceRefs: [],
          },
          {
            id: randomUUID(),
            type: "quickTakes",
            heading: "LA BRÚJULA",
            body: "**Observe esta semana:** X.",
            sourceRefs: [],
          },
          {
            id: randomUUID(),
            type: "cta",
            heading: "LA PUERTA",
            body: "Si algo de este número resonó contigo, respóndeme.",
            sourceRefs: [],
          },
        ],
      }),
    });

    const deps = depsWithFakeAnthropic(fake);
    const agent = new LocalizerAgent(deps);
    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-20",
      agentName: "localizer",
      payload: {
        content: makeEnContent(),
        angle: makeAngle(),
        targetLanguage: "es",
        draftsDir: "/tmp/nonexistent-drafts-for-test",
        sourceBundle: makeBundle(),
      },
    };

    const output = await agent.run(input);
    expect(output.status).toBe("success");
    const data = output.data as LocalizedContent;
    expect(data.language).toBe("es");
    expect(data.thesis).toBeTruthy();
    expect(data.thesis?.length).toBeGreaterThan(10);
    // Guards against English leakage — ES should not begin with common English openers
    expect(data.thesis ?? "").not.toMatch(/^(The|When a|A business|An owner)/i);
  });
});

describe("pipeline smoke — QualityGate overrides LLM sourceDiversity", () => {
  it("computes sourceDiversity deterministically regardless of the LLM's count", async () => {
    const fake = createFakeAnthropic();
    // The LLM hallucinates "only 1 outlet" but the actual EN draft cites three.
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
        voiceMatch: { voiceScore: 85, deviations: [] },
        sourceDiversity: { distinctOutlets: ["wrong-outlet"], outletCount: 1 },
        summary: "fine",
      }),
    });

    const deps = depsWithFakeAnthropic(fake);
    const agent = new QualityGateAgent(deps);
    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-20",
      agentName: "qualityGate",
      payload: {
        enContent: makeEnContent(),
        esContent: null,
        angle: makeAngle(),
        sourceBundle: makeBundle(),
        priorAngles: [],
      },
    };

    const output = await agent.run(input);
    expect(output.status).toBe("success");
    const data = output.data as {
      sourceDiversity: { distinctOutlets: string[]; outletCount: number };
    };
    // The deterministic override counts Expansión (twice), Bloomberg Línea,
    // and El Financiero → 3 distinct outlets regardless of what the LLM said.
    expect(data.sourceDiversity.outletCount).toBe(3);
    expect(data.sourceDiversity.distinctOutlets).toEqual(
      expect.arrayContaining(["Expansión", "Bloomberg Línea", "El Financiero"]),
    );
    expect(data.sourceDiversity.distinctOutlets).not.toContain("wrong-outlet");
  });
});

describe("pipeline smoke — Validator word counts come from code, not LLM", () => {
  it("computes wordCounts deterministically and attaches them to the result", async () => {
    const fake = createFakeAnthropic();
    // The LLM only produces the qualitative judgements; word counts are set in
    // the agent by counting tokens in each section.
    fake.enqueue({
      text: JSON.stringify({
        hasExplicitReframe: true,
        reframeExcerpt: "Most advisors call this a data problem. It is a source-of-truth problem.",
        misdiagnosisNamed: true,
        misdiagnosisExcerpt: "Most advisors call this a data problem.",
        shareableSentence: "The AI is not failing. The AI is exposing.",
        fieldReportIsIntelligence: true,
        fieldReportNote: null,
        osPillarConsistent: true,
        osPillarNote: null,
        compassIsGenuine: true,
        compassNote: null,
        aperturaStartsMidThought: true,
        aperturaNote: null,
        llmIssues: [],
      }),
    });

    const deps = depsWithFakeAnthropic(fake);
    const agent = new ValidatorAgent(deps);
    const input: AgentInput<unknown> = {
      runId: randomUUID(),
      editionId: "2026-20",
      agentName: "validator",
      payload: { content: makeEnContent(), angle: makeAngle() },
    };

    const output = await agent.run(input);
    expect(output.status).toBe("success");
    const data = output.data as ValidationResult;
    // Counts are produced in code — they must be positive integers that
    // correspond to the fixture content. These would be zero if the count
    // were coming from the (mocked) LLM.
    expect(data.wordCounts.signal).toBeGreaterThan(0);
    expect(data.wordCounts.insight).toBeGreaterThan(0);
    expect(data.wordCounts.total).toBe(
      data.wordCounts.signal +
        data.wordCounts.apertura +
        data.wordCounts.insight +
        data.wordCounts.fieldReport +
        data.wordCounts.tool +
        data.wordCounts.compass,
    );
    // Score is computed from issue count, starting at 100
    expect(data.score).toBeGreaterThanOrEqual(0);
    expect(data.score).toBeLessThanOrEqual(100);
    // The fake consumed exactly one LLM call (no repair, no retry)
    expect(fake.calls()).toBe(1);
  });
});
