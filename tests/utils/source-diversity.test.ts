import { describe, it, expect } from "vitest";
import { computeDistinctOutlets } from "../../src/utils/source-diversity.js";
import type { LocalizedContent } from "../../src/types/edition.js";
import type { SourceBundle } from "../../src/types/source-bundle.js";

function makeContent(sections: Array<{ body: string }>): LocalizedContent {
  return {
    language: "en",
    subject: "subject",
    preheader: "preheader",
    sections: sections.map((s, i) => ({
      id: `00000000-0000-0000-0000-00000000000${i}`,
      type: "news",
      heading: "heading",
      body: s.body,
      sourceRefs: [],
    })),
  };
}

function makeBundle(
  items: Array<{ url: string; outlet: string }>,
): SourceBundle {
  return {
    runId: "11111111-1111-1111-1111-111111111111",
    editionId: "2026-20",
    fetchedAt: "2026-04-20T00:00:00.000Z",
    items: items.map((it, i) => ({
      id: `22222222-2222-2222-2222-22222222222${i}`,
      url: it.url,
      title: `Title ${i}`,
      outlet: it.outlet,
      publishedAt: "2026-04-20T00:00:00.000Z",
      summary: "summary",
      verbatimFacts: ["fact1", "fact2", "fact3"],
      recencyHours: 24,
    })),
  };
}

describe("computeDistinctOutlets", () => {
  it("counts distinct outlets from markdown links matching the SourceBundle", () => {
    const content = makeContent([
      {
        body: "Some text. [Read](https://expansion.mx/a) and [Source](https://bloomberglinea.com/b)",
      },
      { body: "More. [Another](https://expansion.mx/c)" },
    ]);
    const bundle = makeBundle([
      { url: "https://expansion.mx/a", outlet: "Expansión" },
      { url: "https://bloomberglinea.com/b", outlet: "Bloomberg Línea" },
      { url: "https://expansion.mx/c", outlet: "Expansión" },
    ]);
    const { distinctOutlets, outletCount } = computeDistinctOutlets(content, bundle);
    expect(outletCount).toBe(2);
    expect(distinctOutlets).toEqual(["Bloomberg Línea", "Expansión"]);
  });

  it("falls back to the URL hostname when no bundle match exists", () => {
    const content = makeContent([
      {
        body: "[x](https://www.newsite.com/a) [y](https://other.org/b)",
      },
    ]);
    const bundle = makeBundle([]);
    const { distinctOutlets } = computeDistinctOutlets(content, bundle);
    expect(distinctOutlets).toEqual(["newsite.com", "other.org"]);
  });

  it("returns zero for a body with no markdown links", () => {
    const content = makeContent([{ body: "Plain prose with no links at all." }]);
    const bundle = makeBundle([]);
    const { outletCount } = computeDistinctOutlets(content, bundle);
    expect(outletCount).toBe(0);
  });

  it("prefers the bundle outlet over the hostname when both exist", () => {
    const content = makeContent([{ body: "[x](https://expansion.mx/article)" }]);
    const bundle = makeBundle([
      { url: "https://expansion.mx/article", outlet: "Expansión" },
    ]);
    const { distinctOutlets } = computeDistinctOutlets(content, bundle);
    expect(distinctOutlets).toEqual(["Expansión"]);
    expect(distinctOutlets).not.toContain("expansion.mx");
  });

  it("ignores malformed URLs without throwing", () => {
    const content = makeContent([
      { body: "[bad](https://) [good](https://expansion.mx/x)" },
    ]);
    const bundle = makeBundle([
      { url: "https://expansion.mx/x", outlet: "Expansión" },
    ]);
    const { outletCount } = computeDistinctOutlets(content, bundle);
    // Expansión from the good URL; malformed either matches nothing or
    // yields an empty host which we tolerate.
    expect(outletCount).toBeGreaterThanOrEqual(1);
    expect(outletCount).toBeLessThanOrEqual(2);
  });

  it("matches a URL that starts with a bundle URL (tracking params, etc.)", () => {
    const content = makeContent([
      {
        body: "[x](https://expansion.mx/article?utm_source=newsletter)",
      },
    ]);
    const bundle = makeBundle([
      { url: "https://expansion.mx/article", outlet: "Expansión" },
    ]);
    const { distinctOutlets } = computeDistinctOutlets(content, bundle);
    expect(distinctOutlets).toEqual(["Expansión"]);
  });
});
