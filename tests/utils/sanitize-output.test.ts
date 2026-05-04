import { describe, it, expect } from "vitest";
import { stripAiTells } from "../../src/utils/sanitize-output.js";

describe("stripAiTells — em/en dashes", () => {
  it("replaces em-dashes with hyphens", () => {
    expect(stripAiTells("a — b — c")).toBe("a - b - c");
  });

  it("replaces en-dashes with hyphens", () => {
    expect(stripAiTells("a – b – c")).toBe("a - b - c");
  });

  it("leaves regular hyphens alone", () => {
    expect(stripAiTells("decision-rights map")).toBe("decision-rights map");
  });
});

describe("stripAiTells — nested markdown link flattening (2026-19 Tool URL bug)", () => {
  it("flattens [[text](innerUrl)](outerUrl) to [text](outerUrl)", () => {
    const input = "Find them at [[loom.com](http://loom.com)](https://www.loom.com)";
    expect(stripAiTells(input)).toBe("Find them at [loom.com](https://www.loom.com)");
  });

  it("flattens multiple nested links in the same string", () => {
    const input =
      "[[loom.com](http://loom.com)](https://www.loom.com) and [[notion.so](http://notion.so)](https://www.notion.so)";
    const expected =
      "[loom.com](https://www.loom.com) and [notion.so](https://www.notion.so)";
    expect(stripAiTells(input)).toBe(expected);
  });

  it("leaves a normal markdown link alone", () => {
    const input = "[Loom](https://www.loom.com)";
    expect(stripAiTells(input)).toBe("[Loom](https://www.loom.com)");
  });

  it("leaves adjacent (non-nested) links alone", () => {
    const input = "[A](https://a.com) and [B](https://b.com)";
    expect(stripAiTells(input)).toBe("[A](https://a.com) and [B](https://b.com)");
  });
});

describe("stripAiTells — internal section-label leak (2026-18 + 2026-19 bug)", () => {
  it('strips a "Sección: spotlight" line (Spanish, lowercase type)', () => {
    const input =
      "## EL REPORTE DE CAMPO\n\nSección: spotlight\n\nSpirit Airlines cesó operaciones...";
    const out = stripAiTells(input);
    expect(out).not.toContain("Sección: spotlight");
    expect(out).toContain("Spirit Airlines");
    expect(out).toContain("EL REPORTE DE CAMPO");
  });

  it('strips an English "Section: lead" line', () => {
    const input = "## THE APERTURA\n\nSection: lead\n\nThe story this week...";
    const out = stripAiTells(input);
    expect(out).not.toContain("Section: lead");
    expect(out).toContain("THE APERTURA");
    expect(out).toContain("The story");
  });

  it('strips a duplicate "## Spotlight" header beneath the real heading (2026-18 bug shape)', () => {
    const input =
      "## EL REPORTE DE CAMPO\n\n## Spotlight\n\nBerkshire Hathaway...";
    const out = stripAiTells(input);
    expect(out).not.toMatch(/^##\s+Spotlight\s*$/m);
    expect(out).toContain("EL REPORTE DE CAMPO");
    expect(out).toContain("Berkshire Hathaway");
  });

  it("collapses excess blank lines created by the strip", () => {
    const input =
      "## EL REPORTE DE CAMPO\n\nSección: spotlight\n\n\n\nSpirit Airlines";
    const out = stripAiTells(input);
    expect(out).not.toMatch(/\n{3,}/);
  });

  it('does NOT strip "Section: lead" appearing inside a sentence (only standalone lines)', () => {
    const input = "We use Section: lead to mark the opening.";
    expect(stripAiTells(input)).toBe(
      "We use Section: lead to mark the opening.",
    );
  });
});
