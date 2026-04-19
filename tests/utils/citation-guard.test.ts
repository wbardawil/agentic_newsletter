import { describe, it, expect } from "vitest";
import { scanSection, scanEdition } from "../../src/utils/citation-guard.js";

describe("citation-guard", () => {
  it("flags attribution without any citation (EN)", () => {
    const body = "Grupo Elektra documented how executive impersonation fraud affects the mid-market.";
    const issues = scanSection(body, "en/fieldReport");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.entity).toBe("Grupo Elektra");
    expect(issues[0]!.verb.toLowerCase()).toBe("documented");
  });

  it("flags Spanish 'ha documentado' pattern", () => {
    const body = "Grupo Elektra ha documentado públicamente cómo el fraude afecta al mercado medio.";
    const issues = scanSection(body, "es/fieldReport");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.entity).toBe("Grupo Elektra");
  });

  it("flags 'Según <Entity>' without a link nearby", () => {
    const body = "Según Bimbo, el 42% de las PyMEs están expuestas a este tipo de fraude.";
    const issues = scanSection(body, "es/insight");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.entity).toBe("Bimbo");
  });

  it("does NOT flag when a markdown link is nearby", () => {
    const body =
      "According to [Fast Company](https://fastcompany.com/article), Apple reported a 12% increase in revenue.";
    const issues = scanSection(body, "en/fieldReport");
    expect(issues).toHaveLength(0);
  });

  it("does NOT flag OS pillar names (allowed entities)", () => {
    const body =
      "The Operating Model OS documented here is not a new concept; Strategy OS reveals something adjacent.";
    const issues = scanSection(body, "en/insight");
    expect(issues).toHaveLength(0);
  });

  it("does NOT flag generic 'you' + verb patterns", () => {
    const body = "You have told your team. They keep coming to you anyway.";
    const issues = scanSection(body, "en/insight");
    expect(issues).toHaveLength(0);
  });

  it("deduplicates multiple identical flags in the same section", () => {
    const body =
      "Grupo Elektra documented X. Later, Grupo Elektra documented Y again. And Grupo Elektra documented Z.";
    const issues = scanSection(body, "es/fieldReport");
    expect(issues).toHaveLength(1);
  });

  it("scanEdition aggregates issues across all sections and languages", () => {
    const sections = [
      { type: "insight", body: "Some clean prose about systems thinking." },
      { type: "fieldReport", body: "Cemex announced major changes last quarter." },
    ];
    const issues = scanEdition(sections, "es");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.section).toBe("es/fieldReport");
  });

  it("handles empty sections gracefully", () => {
    expect(scanSection("", "en/insight")).toHaveLength(0);
    expect(scanEdition([], "en")).toHaveLength(0);
  });
});
