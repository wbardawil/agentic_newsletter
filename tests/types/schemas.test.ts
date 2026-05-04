import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  AgentName,
  RunStatus,
  EditionStatus,
  Language,
  SourceType,
  EditionIdSchema,
  TokenUsageSchema,
  AgentOutputSchema,
  CostEntrySchema,
  SourceItemSchema,
  SourceBundleSchema,
  StrategicAngleSchema,
  ContentSectionSchema,
  LocalizedContentSchema,
  ValidationResultSchema,
  DistributionRecordSchema,
  PerformanceMetricsSchema,
  EditionSchema,
  AgentRunEntrySchema,
  RunLedgerSchema,
  PipelineRunSchema,
  AppConfigSchema,
} from "../../src/types/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EDITION_ID = "2026-07";

function makeStepTimestamps() {
  return { startedAt: new Date().toISOString() };
}

function makeTokenUsage() {
  return { input: 1000, output: 500 };
}

function makeCost() {
  return {
    model: "claude-sonnet-4-5-20250514",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.01,
  };
}

function makeSourceItem(overrides: object = {}) {
  return {
    id: randomUUID(),
    sourceType: "rss",
    title: "AI Trends 2026",
    url: "https://example.com/article",
    publishedAt: new Date().toISOString(),
    summary: "A summary of the article",
    verbatimFacts: [
      "Fact one from the article.",
      "Fact two from the article.",
      "Fact three from the article.",
    ],
    relevanceScore: 0.85,
    recencyHours: 6,
    tags: ["ai", "strategy"],
    region: "corridor",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

describe("Enums", () => {
  it("AgentName accepts valid values", () => {
    expect(AgentName.parse("radar")).toBe("radar");
    expect(AgentName.parse("writer")).toBe("writer");
    expect(AgentName.parse("supervisor")).toBe("supervisor");
  });

  it("AgentName rejects invalid values", () => {
    expect(() => AgentName.parse("unknown")).toThrow();
  });

  it("RunStatus accepts all lifecycle values", () => {
    for (const s of [
      "pending",
      "running",
      "awaiting_approval",
      "approved",
      "publishing",
      "published",
      "analyzing",
      "completed",
      "failed",
    ]) {
      expect(RunStatus.parse(s)).toBe(s);
    }
  });

  it("EditionStatus accepts all values", () => {
    for (const s of ["draft", "review", "approved", "scheduled", "sent", "failed"]) {
      expect(EditionStatus.parse(s)).toBe(s);
    }
  });

  it("Language accepts en and es", () => {
    expect(Language.parse("en")).toBe("en");
    expect(Language.parse("es")).toBe("es");
    expect(() => Language.parse("fr")).toThrow();
  });

  it("SourceType accepts valid values", () => {
    for (const s of ["rss", "api", "manual", "social"]) {
      expect(SourceType.parse(s)).toBe(s);
    }
  });
});

// ---------------------------------------------------------------------------
// EditionId
// ---------------------------------------------------------------------------

describe("EditionId", () => {
  it("accepts YYYY-WW format (no W prefix)", () => {
    expect(EditionIdSchema.parse("2026-07")).toBe("2026-07");
    expect(EditionIdSchema.parse("2025-01")).toBe("2025-01");
    expect(EditionIdSchema.parse("2026-52")).toBe("2026-52");
  });

  it("rejects YYYY-Www format (W prefix)", () => {
    expect(() => EditionIdSchema.parse("2026-W07")).toThrow();
    expect(() => EditionIdSchema.parse("2025-W01")).toThrow();
  });

  it("rejects UUID format", () => {
    expect(() => EditionIdSchema.parse(randomUUID())).toThrow();
  });

  it("rejects other free-form strings", () => {
    expect(() => EditionIdSchema.parse("W08-2026")).toThrow();
    expect(() => EditionIdSchema.parse("2026-7")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// TokenUsage
// ---------------------------------------------------------------------------

describe("TokenUsage", () => {
  it("validates correct token counts", () => {
    expect(TokenUsageSchema.parse({ input: 1000, output: 500 })).toEqual({
      input: 1000,
      output: 500,
    });
  });

  it("rejects negative input tokens", () => {
    expect(() => TokenUsageSchema.parse({ input: -1, output: 0 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// CostEntry
// ---------------------------------------------------------------------------

describe("CostEntry", () => {
  it("validates a correct cost entry", () => {
    expect(CostEntrySchema.parse(makeCost())).toEqual(makeCost());
  });

  it("rejects negative token counts", () => {
    expect(() =>
      CostEntrySchema.parse({
        model: "test",
        inputTokens: -1,
        outputTokens: 0,
        costUsd: 0,
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// AgentOutput
// ---------------------------------------------------------------------------

describe("AgentOutput", () => {
  it("validates a successful agent output with both success and status", () => {
    const output = {
      agentName: "radar",
      runId: randomUUID(),
      editionId: EDITION_ID,
      timestamp: new Date().toISOString(),
      durationMs: 1500,
      success: true,
      status: "success",
      tokens: makeTokenUsage(),
      cost: makeCost(),
      errors: [],
      data: { some: "data" },
    };
    expect(AgentOutputSchema.parse(output)).toBeDefined();
  });

  it("validates an error output with success=false and error string", () => {
    const output = {
      agentName: "writer",
      runId: randomUUID(),
      editionId: EDITION_ID,
      timestamp: new Date().toISOString(),
      durationMs: 200,
      success: false,
      error: "Timeout after 30s",
      status: "error",
      cost: makeCost(),
      errors: ["Timeout after 30s"],
      data: null,
    };
    expect(AgentOutputSchema.parse(output)).toBeDefined();
  });

  it("rejects missing success field", () => {
    expect(() =>
      AgentOutputSchema.parse({
        agentName: "radar",
        runId: randomUUID(),
        editionId: EDITION_ID,
        timestamp: new Date().toISOString(),
        durationMs: 100,
        status: "success",
        cost: makeCost(),
        data: null,
      }),
    ).toThrow();
  });

  it("rejects unknown status values", () => {
    expect(() =>
      AgentOutputSchema.parse({
        agentName: "radar",
        runId: randomUUID(),
        editionId: EDITION_ID,
        timestamp: new Date().toISOString(),
        durationMs: 100,
        success: true,
        status: "unknown",
        cost: makeCost(),
        data: null,
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// SourceItem
// ---------------------------------------------------------------------------

describe("SourceItem", () => {
  it("validates a correct source item", () => {
    expect(SourceItemSchema.parse(makeSourceItem())).toBeDefined();
  });

  it("rejects relevanceScore > 1", () => {
    expect(() =>
      SourceItemSchema.parse(makeSourceItem({ relevanceScore: 1.5 })),
    ).toThrow();
  });

  it("rejects empty title", () => {
    expect(() =>
      SourceItemSchema.parse(makeSourceItem({ title: "" })),
    ).toThrow();
  });

  it("rejects verbatimFacts with fewer than 3 items", () => {
    expect(() =>
      SourceItemSchema.parse(makeSourceItem({ verbatimFacts: ["Only one fact.", "Two facts."] })),
    ).toThrow();
  });

  it("rejects verbatimFacts with more than 7 items", () => {
    expect(() =>
      SourceItemSchema.parse(
        makeSourceItem({
          verbatimFacts: ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"],
        }),
      ),
    ).toThrow();
  });

  it("accepts verbatimFacts at the boundaries (3 and 7)", () => {
    expect(
      SourceItemSchema.parse(makeSourceItem({ verbatimFacts: ["A", "B", "C"] })),
    ).toBeDefined();
    expect(
      SourceItemSchema.parse(
        makeSourceItem({ verbatimFacts: ["A", "B", "C", "D", "E", "F", "G"] }),
      ),
    ).toBeDefined();
  });

  it("rejects negative recencyHours", () => {
    expect(() =>
      SourceItemSchema.parse(makeSourceItem({ recencyHours: -1 })),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// SourceBundle
// ---------------------------------------------------------------------------

describe("SourceBundle", () => {
  it("requires at least one item", () => {
    expect(() =>
      SourceBundleSchema.parse({
        editionId: EDITION_ID,
        scannedAt: new Date().toISOString(),
        totalScanned: 50,
        totalSelected: 0,
        items: [],
        metadata: { feedsScanned: 5, timeWindowHours: 24, filterCriteria: [] },
      }),
    ).toThrow();
  });

  it("validates a bundle with one valid item", () => {
    expect(
      SourceBundleSchema.parse({
        editionId: EDITION_ID,
        scannedAt: new Date().toISOString(),
        totalScanned: 50,
        totalSelected: 1,
        items: [makeSourceItem()],
        metadata: { feedsScanned: 5, timeWindowHours: 24, filterCriteria: ["ai"] },
      }),
    ).toBeDefined();
  });

  it("rejects invalid editionId format", () => {
    expect(() =>
      SourceBundleSchema.parse({
        editionId: randomUUID(),
        scannedAt: new Date().toISOString(),
        totalScanned: 1,
        totalSelected: 1,
        items: [makeSourceItem()],
        metadata: { feedsScanned: 1, timeWindowHours: 24, filterCriteria: [] },
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// StrategicAngle
// ---------------------------------------------------------------------------

describe("StrategicAngle", () => {
  it("validates a correct strategic angle", () => {
    const angle = {
      headline: "AI Reshapes LATAM Supply Chains",
      thesis: "Executives must adapt their supply chain strategy now.",
      targetPersona: "COO at $20M manufacturing company",
      relevanceToAudience: "Direct impact on operational costs",
      suggestedSources: [randomUUID()],
      talkingPoints: ["Point 1", "Point 2"],
      osPillar: "Strategy OS",
      peopleAngle: {
        challenge: "Leaders must commit before the supply-chain team reorganizes around the new strategy.",
        framework: "Kotter Step 1: Establish urgency",
      },
      quarterlyTheme: "The Machine",
    };
    expect(StrategicAngleSchema.parse(angle)).toBeDefined();
  });

  it("requires at least one talking point", () => {
    expect(() =>
      StrategicAngleSchema.parse({
        headline: "Test",
        thesis: "Test",
        targetPersona: "Test",
        relevanceToAudience: "Test",
        suggestedSources: [],
        talkingPoints: [],
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// LocalizedContent
// ---------------------------------------------------------------------------

describe("LocalizedContent", () => {
  it("validates a correct localized content", () => {
    const content = {
      language: "en",
      subject: "Weekly AI Briefing",
      preheader: "This week in AI for LATAM leaders",
      sections: [
        {
          id: randomUUID(),
          type: "lead",
          heading: "The Big Story",
          body: "## Lead\n\nContent here.",
          sourceRefs: [randomUUID()],
        },
      ],
    };
    expect(LocalizedContentSchema.parse(content)).toBeDefined();
  });

  it("rejects preheader longer than 150 chars", () => {
    expect(() =>
      LocalizedContentSchema.parse({
        language: "en",
        subject: "Test",
        preheader: "x".repeat(151),
        sections: [
          {
            id: randomUUID(),
            type: "lead",
            heading: "Test",
            body: "Test",
            sourceRefs: [],
          },
        ],
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ValidationResult
// ---------------------------------------------------------------------------

describe("ValidationResult", () => {
  const makeWordCounts = () => ({
    signal: 75,
    apertura: 95,
    insight: 440,
    fieldReport: 148,
    tool: 50,
    compass: 72,
    total: 880,
  });

  it("validates a passing result with no issues", () => {
    const result = {
      isValid: true,
      score: 100,
      issues: [],
      wordCounts: makeWordCounts(),
      shareableSentence: "The business you built is actually a job you created for yourself.",
      recommendations: ["Draft passes automated checks."],
    };
    expect(ValidationResultSchema.parse(result)).toBeDefined();
  });

  it("validates a failing result with error and warning issues", () => {
    const result = {
      isValid: false,
      score: 70,
      issues: [
        {
          rule: "rule-11-reframe",
          severity: "error",
          section: "insight",
          message: "No explicit reframe found.",
        },
        {
          rule: "word-count-apertura",
          severity: "warning",
          section: "apertura",
          message: "Apertura word count is 145 — target range is 70–130.",
          excerpt: undefined,
        },
      ],
      wordCounts: makeWordCounts(),
      shareableSentence: null,
      recommendations: ["1 error must be resolved before this draft is ready."],
    };
    expect(ValidationResultSchema.parse(result)).toBeDefined();
  });

  it("rejects score > 100", () => {
    expect(() =>
      ValidationResultSchema.parse({
        isValid: true,
        score: 101,
        issues: [],
        wordCounts: makeWordCounts(),
        shareableSentence: null,
        recommendations: [],
      }),
    ).toThrow();
  });

  it("rejects negative score", () => {
    expect(() =>
      ValidationResultSchema.parse({
        isValid: false,
        score: -1,
        issues: [],
        wordCounts: makeWordCounts(),
        shareableSentence: null,
        recommendations: [],
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// DistributionRecord
// ---------------------------------------------------------------------------

describe("DistributionRecord", () => {
  it("validates a correct distribution record", () => {
    const record = {
      platform: "beehiiv",
      distributedAt: new Date().toISOString(),
      externalId: "bh_12345",
      status: "sent",
    };
    expect(DistributionRecordSchema.parse(record)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PerformanceMetrics
// ---------------------------------------------------------------------------

describe("PerformanceMetrics", () => {
  it("validates with partial metrics", () => {
    const metrics = {
      openRate: 0.42,
      collectedAt: new Date().toISOString(),
    };
    expect(PerformanceMetricsSchema.parse(metrics)).toBeDefined();
  });

  it("rejects openRate > 1", () => {
    expect(() =>
      PerformanceMetricsSchema.parse({
        openRate: 1.5,
        collectedAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Edition
// ---------------------------------------------------------------------------

describe("Edition", () => {
  it("validates a minimal early-pipeline edition", () => {
    const edition = {
      editionId: EDITION_ID,
      runId: randomUUID(),
      editionNumber: 1,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(EditionSchema.parse(edition)).toBeDefined();
  });

  it("validates a fully-populated edition with renamed fields", () => {
    const edition = {
      editionId: EDITION_ID,
      runId: randomUUID(),
      editionNumber: 1,
      status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      enBody: "# AI Week\n\nEnglish body here.",
      esBody: "# Semana de IA\n\nSpanish body here.",
      subjectEN: "Your AI briefing for the week",
      subjectES: "Tu resumen de IA de la semana",
      publishDatetime: new Date().toISOString(),
      qaScore: 92,
      approvalUser: "editor@example.com",
      contentHash: "a".repeat(64),
    };
    expect(EditionSchema.parse(edition)).toBeDefined();
  });

  it("rejects qaScore > 100", () => {
    expect(() =>
      EditionSchema.parse({
        editionId: EDITION_ID,
        runId: randomUUID(),
        editionNumber: 1,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        qaScore: 101,
      }),
    ).toThrow();
  });

  it("rejects invalid contentHash format", () => {
    expect(() =>
      EditionSchema.parse({
        editionId: EDITION_ID,
        runId: randomUUID(),
        editionNumber: 1,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        contentHash: "not-a-hash",
      }),
    ).toThrow();
  });

  it("rejects invalid editionId format", () => {
    expect(() =>
      EditionSchema.parse({
        editionId: randomUUID(),
        runId: randomUUID(),
        editionNumber: 1,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// AgentRunEntry (restored with new optional fields)
// ---------------------------------------------------------------------------

describe("AgentRunEntry", () => {
  it("validates a minimal entry (original fields)", () => {
    const entry = {
      agentName: "radar",
      startedAt: new Date().toISOString(),
      retryCount: 0,
    };
    expect(AgentRunEntrySchema.parse(entry)).toBeDefined();
  });

  it("validates an entry with all new optional spec fields", () => {
    const entry = {
      agentName: "writer",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 3200,
      success: true,
      retryCount: 1,
      promptVersion: "2.1.0",
      voiceBibleVersion: "3.0.0",
      modelUsed: "claude-opus-4-6-20250415",
      tokenUsage: { input: 5000, output: 2000 },
      outputHash: "c".repeat(64),
      cost: makeCost(),
    };
    expect(AgentRunEntrySchema.parse(entry)).toBeDefined();
  });

  it("rejects invalid outputHash (not 64 hex chars)", () => {
    expect(() =>
      AgentRunEntrySchema.parse({
        agentName: "radar",
        startedAt: new Date().toISOString(),
        retryCount: 0,
        outputHash: "tooshort",
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// RunLedger (flat per-step record)
// ---------------------------------------------------------------------------

describe("RunLedger", () => {
  function makeRunLedger(overrides: object = {}) {
    return {
      runId: randomUUID(),
      editionId: EDITION_ID,
      stepId: randomUUID(),
      agentName: "radar",
      promptVersion: "1.2.0",
      voiceBibleVersion: "2.0.0",
      modelUsed: "claude-sonnet-4-5-20250514",
      tokenUsage: makeTokenUsage(),
      costUsd: 0.05,
      status: "running",
      retryCount: 0,
      timestamps: makeStepTimestamps(),
      ...overrides,
    };
  }

  it("validates a correct run ledger step", () => {
    expect(RunLedgerSchema.parse(makeRunLedger())).toBeDefined();
  });

  it("validates with optional outputHash and publishIdempotencyKey", () => {
    expect(
      RunLedgerSchema.parse(
        makeRunLedger({
          outputHash: "b".repeat(64),
          publishIdempotencyKey: "run-2026-07-distributor-1",
        }),
      ),
    ).toBeDefined();
  });

  it("rejects invalid outputHash (not 64 hex chars)", () => {
    expect(() =>
      RunLedgerSchema.parse(makeRunLedger({ outputHash: "tooshort" })),
    ).toThrow();
  });

  it("rejects negative costUsd", () => {
    expect(() =>
      RunLedgerSchema.parse(makeRunLedger({ costUsd: -1 })),
    ).toThrow();
  });

  it("rejects invalid editionId format", () => {
    expect(() =>
      RunLedgerSchema.parse(makeRunLedger({ editionId: randomUUID() })),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// PipelineRun (aggregate run record)
// ---------------------------------------------------------------------------

describe("PipelineRun", () => {
  it("validates an empty-steps pipeline run", () => {
    const run = {
      runId: randomUUID(),
      editionId: EDITION_ID,
      status: "running",
      triggeredBy: "manual",
      startedAt: new Date().toISOString(),
      steps: [],
      totalCostUsd: 0,
    };
    expect(PipelineRunSchema.parse(run)).toBeDefined();
  });

  it("rejects invalid triggeredBy", () => {
    expect(() =>
      PipelineRunSchema.parse({
        runId: randomUUID(),
        editionId: EDITION_ID,
        status: "pending",
        startedAt: new Date().toISOString(),
        triggeredBy: "webhook",
        steps: [],
        totalCostUsd: 0,
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// AppConfig
// ---------------------------------------------------------------------------

describe("AppConfig", () => {
  it("applies defaults for optional fields", () => {
    const config = AppConfigSchema.parse({
      anthropicApiKey: "sk-test",
    });
    expect(config.logLevel).toBe("info");
    expect(config.dryRun).toBe(false);
    expect(config.maxCostPerRunUsd).toBe(5.0);
    expect(config.defaultModel).toBe("claude-sonnet-4-5");
    expect(config.writerModel).toBe("claude-opus-4-7");
  });

  it("rejects missing required API keys", () => {
    expect(() => AppConfigSchema.parse({})).toThrow();
  });
});
