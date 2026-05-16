import { describe, it, expect } from "vitest";
import {
  editionNumberFromId,
  buildEditionRow,
  buildSourceRows,
  type MirrorInput,
} from "../../src/utils/portal-sync.js";
import type { LocalizedContent, StrategicAngle } from "../../src/types/edition.js";
import type { SourceItem } from "../../src/types/source-bundle.js";

function localized(language: "en" | "es", subject: string): LocalizedContent {
  return {
    language,
    subject,
    preheader: "ph",
    sections: [
      { id: crypto.randomUUID(), type: "lead", heading: "L", body: "lead body", sourceRefs: [] },
      { id: crypto.randomUUID(), type: "analysis", heading: "A", body: "insight body", sourceRefs: [] },
    ],
  };
}

const angle: StrategicAngle = {
  headline: "H",
  thesis: "T",
  targetPersona: "owner",
  relevanceToAudience: "r",
  suggestedSources: [],
  talkingPoints: ["tp"],
  osPillar: "Operating Model OS",
  peopleAngle: { challenge: "c", framework: "ADKAR: Desire" },
  quarterlyTheme: "The Machine",
};

const baseInput: MirrorInput = {
  editionId: "2026-19",
  angle,
  enContent: localized("en", "EN subject"),
  esContent: localized("es", "ES subject"),
  shareableSentence: "The one shareable line.",
  publishedAt: "2026-05-08T09:00:00.000Z",
  isPublished: true,
  byline: "Wadi Bardawil",
};

describe("editionNumberFromId", () => {
  it("derives a unique monotonic integer from YYYY-WW", () => {
    expect(editionNumberFromId("2026-19")).toBe(202619);
    expect(editionNumberFromId("2026-01")).toBe(202601);
    expect(editionNumberFromId("2027-01")).toBeGreaterThan(editionNumberFromId("2026-53"));
  });
  it("rejects malformed ids", () => {
    expect(() => editionNumberFromId("2026/19")).toThrow();
    expect(() => editionNumberFromId("bad")).toThrow();
  });
});

describe("buildEditionRow", () => {
  it("maps angle + content into the editions row", () => {
    const row = buildEditionRow(baseInput);
    expect(row.edition_id).toBe("2026-19");
    expect(row.edition_number).toBe(202619);
    expect(row.subject_en).toBe("EN subject");
    expect(row.subject_es).toBe("ES subject");
    expect(row.pillar).toBe("Operating Model OS");
    expect(row.quarterly_theme).toBe("The Machine");
    expect(row.shareable_sentence_en).toBe("The one shareable line.");
    expect(row.body_en).toContain("THE APERTURA");
    expect(row.body_es).toContain("LA APERTURA");
    expect(row.is_published).toBe(true);
    expect(row.published_at).toBe("2026-05-08T09:00:00.000Z");
  });

  it("defaults topic to business_transformation and clears published_at when unpublished", () => {
    const row = buildEditionRow({ ...baseInput, isPublished: false, topic: "bogus" });
    expect(row.topic).toBe("business_transformation");
    expect(row.published_at).toBeNull();
    expect(row.is_published).toBe(false);
  });

  it("accepts a valid explicit topic", () => {
    const row = buildEditionRow({ ...baseInput, topic: "family_office" });
    expect(row.topic).toBe("family_office");
  });
});

describe("buildSourceRows", () => {
  it("maps SourceItems to edition_sources rows and truncates long snippets", () => {
    const items: SourceItem[] = [
      {
        id: crypto.randomUUID(),
        sourceType: "news",
        title: "A title",
        url: "https://example.com/a",
        publishedAt: "2026-05-01T00:00:00.000Z",
        outlet: "Fortune",
        summary: "x".repeat(900),
        verbatimFacts: ["f1", "f2", "f3"],
        relevanceScore: 0.9,
        recencyHours: 12,
        tags: [],
        region: "us",
      },
    ];
    const rows = buildSourceRows("edition-db-id", items);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.edition_id).toBe("edition-db-id");
    expect(rows[0]!.title).toBe("A title");
    expect(rows[0]!.publisher).toBe("Fortune");
    expect(rows[0]!.snippet!.length).toBe(600);
  });
});
