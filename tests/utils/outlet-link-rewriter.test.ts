import { describe, it, expect } from "vitest";
import {
  rewriteOutletLinks,
  rewriteContentOutletLinks,
} from "../../src/utils/outlet-link-rewriter.js";
import type { SourceBundle, SourceItem } from "../../src/types/source-bundle.js";
import type { LocalizedContent } from "../../src/types/edition.js";

function mkItem(url: string, outlet: string | undefined): SourceItem {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    sourceType: "rss",
    title: "t",
    url,
    publishedAt: "2026-04-20T00:00:00.000Z",
    ...(outlet !== undefined ? { outlet } : {}),
    summary: "s",
    verbatimFacts: ["f"],
    relevanceScore: 0.8,
    recencyHours: 5,
    tags: [],
    region: "us",
  };
}

function mkBundle(items: SourceItem[]): SourceBundle {
  return {
    runId: "00000000-0000-0000-0000-000000000001",
    editionId: "2026-17",
    scannedAt: "2026-04-20T00:00:00.000Z",
    items,
    totalSelected: items.length,
    metadata: { feedsScanned: 1, itemsConsidered: items.length, filterThreshold: 0.5 },
  };
}

describe("rewriteOutletLinks", () => {
  const bundle = mkBundle([
    mkItem("https://bloomberg.com/x", "Bloomberg"),
    mkItem("https://expansion.mx/y", "Expansión"),
  ]);

  it("rewrites [Read ->] with the outlet name when the URL is in the bundle (EN)", () => {
    const out = rewriteOutletLinks(
      "- **Strategy:** fact. **punch.** [Read ->](https://bloomberg.com/x)",
      bundle,
      "en",
    );
    expect(out).toContain("[Read in Bloomberg ->](https://bloomberg.com/x)");
  });

  it("rewrites [Leer ->] with 'en <outlet>' for the Spanish edition", () => {
    const out = rewriteOutletLinks(
      "- **Estrategia:** hecho. **remate.** [Leer ->](https://expansion.mx/y)",
      bundle,
      "es",
    );
    expect(out).toContain("[Leer en Expansión ->](https://expansion.mx/y)");
  });

  it("leaves the anchor untouched when the URL is not in the bundle", () => {
    const body = "- **Strategy:** fact. [Read ->](https://unknown.com/z)";
    const out = rewriteOutletLinks(body, bundle, "en");
    expect(out).toBe(body);
  });

  it("leaves the anchor untouched when the bundle item has no outlet", () => {
    const bundleNoOutlet = mkBundle([mkItem("https://anon.com/a", undefined)]);
    const body = "- **Strategy:** fact. [Read ->](https://anon.com/a)";
    const out = rewriteOutletLinks(body, bundleNoOutlet, "en");
    expect(out).toBe(body);
  });

  it("rewrites multiple links in the same body", () => {
    const body =
      "- **Strategy:** a. [Read ->](https://bloomberg.com/x)\n" +
      "- **Tech:** b. [Read ->](https://expansion.mx/y)\n" +
      "- **HC:** c. [Read ->](https://nope.com/z)";
    const out = rewriteOutletLinks(body, bundle, "en");
    expect(out).toContain("[Read in Bloomberg ->](https://bloomberg.com/x)");
    expect(out).toContain("[Read in Expansión ->](https://expansion.mx/y)");
    expect(out).toContain("[Read ->](https://nope.com/z)");
  });

  it("does not rewrite EN-style links when called with language='es'", () => {
    const body = "- **Strategy:** fact. [Read ->](https://bloomberg.com/x)";
    const out = rewriteOutletLinks(body, bundle, "es");
    expect(out).toBe(body);
  });

  it("does not rewrite links whose text is neither 'Read ->' nor 'Leer ->'", () => {
    const body = "See also [the primary source](https://bloomberg.com/x) for detail.";
    const out = rewriteOutletLinks(body, bundle, "en");
    expect(out).toBe(body);
  });

  it("rewrites [Leer] without the arrow (the ES Writer sometimes ships this shape)", () => {
    const body = "Details on the story [Leer](https://expansion.mx/y).";
    const out = rewriteOutletLinks(body, bundle, "es");
    expect(out).toContain("[Leer en Expansión ->](https://expansion.mx/y)");
  });

  it("rewrites [Read] without the arrow (symmetry with ES shape)", () => {
    const body = "Background: [Read](https://bloomberg.com/x).";
    const out = rewriteOutletLinks(body, bundle, "en");
    expect(out).toContain("[Read in Bloomberg ->](https://bloomberg.com/x)");
  });
});

describe("rewriteContentOutletLinks", () => {
  const bundle = mkBundle([mkItem("https://bloomberg.com/x", "Bloomberg")]);

  it("applies the rewrite to every section body", () => {
    const content: LocalizedContent = {
      language: "en",
      subject: "s",
      preheader: "p",
      sections: [
        {
          id: "a",
          type: "news",
          heading: "THE SIGNAL",
          body: "- **Strategy:** a. [Read ->](https://bloomberg.com/x)",
          sourceRefs: [],
        },
        {
          id: "b",
          type: "spotlight",
          heading: "THE FIELD REPORT",
          body: "Meta story. [Read ->](https://bloomberg.com/x)",
          sourceRefs: [],
        },
      ],
    };
    const out = rewriteContentOutletLinks(content, bundle, "en");
    expect(out.sections[0]?.body).toContain("[Read in Bloomberg ->]");
    expect(out.sections[1]?.body).toContain("[Read in Bloomberg ->]");
  });
});
