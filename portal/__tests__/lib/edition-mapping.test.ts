import { describe, it, expect } from "vitest";

import {
  editionNumberFromId,
  normalizeTopic,
  renderLocalizedToMarkdown,
  buildEditionRow,
  buildSourceRows,
  type LocalizedContent,
  type MirrorInput,
} from "@/lib/edition-mapping";

function localized(language: "en" | "es"): LocalizedContent {
  return {
    language,
    subject: language === "en" ? "EN subject" : "ES subject",
    sections: [
      { type: "lead", body: `${language}-lead` },
      { type: "analysis", body: `${language}-analysis` },
      { type: "spotlight", body: `${language}-spotlight` },
      { type: "quickTakes", body: `${language}-compass` },
      { type: "cta", body: `${language}-door` },
    ],
  };
}

describe("editionNumberFromId", () => {
  it("maps YYYY-WW to YYYYWW", () => {
    expect(editionNumberFromId("2026-19")).toBe(202619);
    expect(editionNumberFromId("2026-01")).toBe(202601);
  });

  it("throws on malformed ids", () => {
    expect(() => editionNumberFromId("2026-W1")).toThrow();
    expect(() => editionNumberFromId("bad")).toThrow();
  });
});

describe("normalizeTopic", () => {
  it("passes through valid topics", () => {
    expect(normalizeTopic("family_office")).toBe("family_office");
    expect(normalizeTopic("technology")).toBe("technology");
  });

  it("defaults unknown/undefined to business_transformation", () => {
    expect(normalizeTopic(undefined)).toBe("business_transformation");
    expect(normalizeTopic("nope")).toBe("business_transformation");
  });
});

describe("renderLocalizedToMarkdown", () => {
  it("uses English section headings", () => {
    const md = renderLocalizedToMarkdown(localized("en"));
    expect(md).toContain("## THE APERTURA");
    expect(md).toContain("## THE INSIGHT");
    expect(md).toContain("## THE FIELD REPORT");
    expect(md).toContain("## THE COMPASS");
    expect(md).toContain("## THE DOOR");
    expect(md).toContain("en-analysis");
  });

  it("uses Spanish section headings", () => {
    const md = renderLocalizedToMarkdown(localized("es"));
    expect(md).toContain("## LA APERTURA");
    expect(md).toContain("## EL INSIGHT");
    expect(md).toContain("## EL REPORTE DE CAMPO");
    expect(md).toContain("## LA BRÚJULA");
    expect(md).toContain("## LA PUERTA");
  });

  it("leaves missing sections as empty bodies (no crash)", () => {
    const md = renderLocalizedToMarkdown({ language: "en", subject: "s", sections: [{ type: "lead", body: "only-lead" }] });
    expect(md).toContain("only-lead");
    expect(md).toContain("## THE INSIGHT");
  });
});

describe("buildEditionRow", () => {
  const base: MirrorInput = {
    editionId: "2026-19",
    angle: { osPillar: "Technology OS", quarterlyTheme: "The Machine" },
    enContent: localized("en"),
    esContent: localized("es"),
    shareableSentence: "A shareable line.",
    publishedAt: "2026-05-30T00:00:00.000Z",
    isPublished: true,
    byline: "Wadi Bardawil",
  };

  it("maps the core fields", () => {
    const row = buildEditionRow(base);
    expect(row.edition_id).toBe("2026-19");
    expect(row.edition_number).toBe(202619);
    expect(row.subject_en).toBe("EN subject");
    expect(row.subject_es).toBe("ES subject");
    expect(row.pillar).toBe("Technology OS");
    expect(row.quarterly_theme).toBe("The Machine");
    expect(row.topic).toBe("business_transformation");
    expect(row.shareable_sentence_en).toBe("A shareable line.");
    expect(row.shareable_sentence_es).toBeNull();
    expect(row.is_published).toBe(true);
    expect(row.published_at).toBe("2026-05-30T00:00:00.000Z");
    expect(row.body_en).toContain("## THE APERTURA");
    expect(row.body_es).toContain("## LA APERTURA");
  });

  it("maps shareable_sentence_es from the ES edition's native sentence", () => {
    const row = buildEditionRow({
      ...base,
      esContent: { ...localized("es"), shareableSentence: "Una línea compartible nativa." },
    });
    expect(row.shareable_sentence_es).toBe("Una línea compartible nativa.");
    expect(row.shareable_sentence_en).toBe("A shareable line.");
  });

  it("keeps shareable_sentence_es null when the ES edition has no native sentence", () => {
    const row = buildEditionRow({ ...base, esContent: { ...localized("es"), shareableSentence: null } });
    expect(row.shareable_sentence_es).toBeNull();
  });

  it("nulls published_at when not published", () => {
    const row = buildEditionRow({ ...base, isPublished: false });
    expect(row.published_at).toBeNull();
    expect(row.is_published).toBe(false);
  });

  it("passes heroImageUrl through to hero_image_url", () => {
    const url = "https://project.supabase.co/storage/v1/object/public/edition-assets/2026-19/hero-v1.png";
    const row = buildEditionRow({ ...base, heroImageUrl: url });
    expect(row.hero_image_url).toBe(url);
  });

  it("keeps hero_image_url null when heroImageUrl is omitted", () => {
    const row = buildEditionRow(base);
    expect(row.hero_image_url).toBeNull();
  });

  it("keeps hero_image_url null when heroImageUrl is explicitly null", () => {
    const row = buildEditionRow({ ...base, heroImageUrl: null });
    expect(row.hero_image_url).toBeNull();
  });
});

describe("buildSourceRows", () => {
  it("maps source items and truncates long summaries to 600 chars", () => {
    const long = "x".repeat(900);
    const rows = buildSourceRows("edition-db-id", [
      { title: "T1", url: "https://a.example", summary: long, outlet: "Outlet" },
      { title: "T2", url: "https://b.example" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ edition_id: "edition-db-id", title: "T1", url: "https://a.example", publisher: "Outlet" });
    expect(rows[0]?.snippet?.length).toBe(600);
    expect(rows[1]).toMatchObject({ title: "T2", snippet: null, publisher: null });
  });
});
