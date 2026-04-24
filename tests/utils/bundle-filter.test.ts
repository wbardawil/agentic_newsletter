import { describe, it, expect } from "vitest";
import {
  filterUsBundle,
  filterMxBundle,
} from "../../src/utils/bundle-filter.js";
import type { SourceItem } from "../../src/types/source-bundle.js";

function mk(region: "us" | "mx" | "corridor", outlet: string): SourceItem {
  return {
    id: `00000000-0000-0000-0000-000000000000`,
    sourceType: "rss",
    title: `Title from ${outlet}`,
    url: `https://${outlet.toLowerCase().replace(/\s+/g, "")}.com/x`,
    publishedAt: "2026-04-20T00:00:00.000Z",
    outlet,
    summary: "s",
    verbatimFacts: ["f1", "f2", "f3"],
    relevanceScore: 0.8,
    recencyHours: 5,
    tags: [],
    region,
  };
}

describe("bundle filters", () => {
  const mixed = [
    mk("us", "WSJ"),
    mk("mx", "Expansión"),
    mk("corridor", "HBR"),
    mk("us", "Bloomberg"),
    mk("mx", "El Financiero"),
    mk("corridor", "MIT Sloan"),
  ];

  describe("filterUsBundle — for the EN Writer", () => {
    it("keeps US and corridor items, drops MX-only", () => {
      const filtered = filterUsBundle(mixed);
      expect(filtered.map((i) => i.outlet).sort()).toEqual(
        ["Bloomberg", "HBR", "MIT Sloan", "WSJ"].sort(),
      );
    });

    it("returns empty array when input has only MX items", () => {
      const onlyMx = [mk("mx", "A"), mk("mx", "B")];
      expect(filterUsBundle(onlyMx)).toEqual([]);
    });

    it("returns all items when there are no MX items", () => {
      const usAndCorridor = [mk("us", "A"), mk("corridor", "B")];
      expect(filterUsBundle(usAndCorridor)).toHaveLength(2);
    });
  });

  describe("filterMxBundle — for the ES Localizer", () => {
    it("keeps MX and corridor items, drops US-only", () => {
      const filtered = filterMxBundle(mixed);
      expect(filtered.map((i) => i.outlet).sort()).toEqual(
        ["El Financiero", "Expansión", "HBR", "MIT Sloan"].sort(),
      );
    });

    it("US and MX filters are disjoint on US-only and MX-only items", () => {
      // Corridor items appear in both (intentional — they serve both editions).
      const us = filterUsBundle(mixed);
      const mx = filterMxBundle(mixed);
      const usOnly = us.filter((i) => i.region === "us");
      const mxOnly = mx.filter((i) => i.region === "mx");
      const overlap = usOnly.filter((u) =>
        mxOnly.some((m) => m.outlet === u.outlet),
      );
      expect(overlap).toHaveLength(0);
    });

    it("corridor items appear in both filter outputs", () => {
      const us = filterUsBundle(mixed);
      const mx = filterMxBundle(mixed);
      const corridorInUs = us.filter((i) => i.region === "corridor");
      const corridorInMx = mx.filter((i) => i.region === "corridor");
      expect(corridorInUs.length).toBeGreaterThan(0);
      expect(corridorInMx.length).toBeGreaterThan(0);
      expect(corridorInUs.length).toBe(corridorInMx.length);
    });
  });
});
