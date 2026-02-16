import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  AgentName,
  RunStatus,
  EditionStatus,
  Language,
  SourceType,
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
  AppConfigSchema,
} from "../../src/types/index.js";

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

describe("CostEntry", () => {
  it("validates a correct cost entry", () => {
    const entry = {
      model: "claude-sonnet-4-5-20250514",
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.01,
    };
    expect(CostEntrySchema.parse(entry)).toEqual(entry);
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

describe("AgentOutput", () => {
  it("validates a correct agent output", () => {
    const output = {
      agentName: "radar",
      runId: randomUUID(),
      editionId: randomUUID(),
      timestamp: new Date().toISOString(),
      durationMs: 1500,
      success: true,
      cost: {
        model: "claude-sonnet-4-5-20250514",
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.01,
      },
      data: { some: "data" },
    };
    expect(AgentOutputSchema.parse(output)).toBeDefined();
  });
});

describe("SourceItem", () => {
  const validItem = {
    id: randomUUID(),
    sourceType: "rss",
    title: "AI Trends 2026",
    url: "https://example.com/article",
    publishedAt: new Date().toISOString(),
    summary: "A summary of the article",
    relevanceScore: 0.85,
    tags: ["ai", "strategy"],
  };

  it("validates a correct source item", () => {
    expect(SourceItemSchema.parse(validItem)).toBeDefined();
  });

  it("rejects relevanceScore > 1", () => {
    expect(() =>
      SourceItemSchema.parse({ ...validItem, relevanceScore: 1.5 }),
    ).toThrow();
  });

  it("rejects empty title", () => {
    expect(() =>
      SourceItemSchema.parse({ ...validItem, title: "" }),
    ).toThrow();
  });
});

describe("SourceBundle", () => {
  it("requires at least one item", () => {
    expect(() =>
      SourceBundleSchema.parse({
        editionId: randomUUID(),
        scannedAt: new Date().toISOString(),
        totalScanned: 50,
        totalSelected: 0,
        items: [],
        metadata: { feedsScanned: 5, timeWindowHours: 24, filterCriteria: [] },
      }),
    ).toThrow();
  });
});

describe("StrategicAngle", () => {
  it("validates a correct strategic angle", () => {
    const angle = {
      headline: "AI Reshapes LATAM Supply Chains",
      thesis: "Executives must adapt their supply chain strategy now.",
      targetPersona: "COO at $20M manufacturing company",
      relevanceToAudience: "Direct impact on operational costs",
      suggestedSources: [randomUUID()],
      talkingPoints: ["Point 1", "Point 2"],
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

describe("ValidationResult", () => {
  it("validates a correct result with issues", () => {
    const result = {
      isValid: false,
      issues: [
        {
          severity: "warning",
          section: "lead",
          message: "Tone too casual",
          suggestion: "Use more formal language",
        },
      ],
      scores: {
        voiceConsistency: 85,
        factualAccuracy: 92,
        readability: 78,
        bilingualParity: 88,
      },
    };
    expect(ValidationResultSchema.parse(result)).toBeDefined();
  });

  it("rejects scores > 100", () => {
    expect(() =>
      ValidationResultSchema.parse({
        isValid: true,
        issues: [],
        scores: {
          voiceConsistency: 101,
          factualAccuracy: 92,
          readability: 78,
          bilingualParity: 88,
        },
      }),
    ).toThrow();
  });
});

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

describe("Edition", () => {
  it("validates a minimal early-pipeline edition", () => {
    const edition = {
      editionId: randomUUID(),
      runId: randomUUID(),
      editionNumber: 1,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(EditionSchema.parse(edition)).toBeDefined();
  });
});

describe("RunLedger", () => {
  it("validates a correct run ledger", () => {
    const ledger = {
      runId: randomUUID(),
      editionId: randomUUID(),
      status: "running",
      startedAt: new Date().toISOString(),
      triggeredBy: "manual",
      currentAgent: "radar",
      agentRuns: [
        {
          agentName: "radar",
          startedAt: new Date().toISOString(),
          retryCount: 0,
        },
      ],
      totalCostUsd: 0.05,
    };
    expect(RunLedgerSchema.parse(ledger)).toBeDefined();
  });

  it("rejects invalid triggeredBy", () => {
    expect(() =>
      RunLedgerSchema.parse({
        runId: randomUUID(),
        editionId: randomUUID(),
        status: "pending",
        startedAt: new Date().toISOString(),
        triggeredBy: "webhook",
        agentRuns: [],
        totalCostUsd: 0,
      }),
    ).toThrow();
  });
});

describe("AppConfig", () => {
  it("applies defaults for optional fields", () => {
    const config = AppConfigSchema.parse({
      anthropicApiKey: "sk-test",
      beehiivApiKey: "bh-test",
      beehiivPublicationId: "pub-test",
      feedlyApiKey: "fl-test",
    });
    expect(config.logLevel).toBe("info");
    expect(config.dryRun).toBe(false);
    expect(config.maxCostPerRunUsd).toBe(5.0);
    expect(config.defaultModel).toBe("claude-sonnet-4-5-20250514");
    expect(config.writerModel).toBe("claude-opus-4-6-20250415");
  });

  it("rejects missing required API keys", () => {
    expect(() => AppConfigSchema.parse({})).toThrow();
  });
});
