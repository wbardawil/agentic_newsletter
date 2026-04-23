import { describe, it, expect } from "vitest";
import { scanSection, scanEdition, scanSignalBullets } from "../../src/utils/citation-guard.js";

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

  describe("sentence-start articles are not entities", () => {
    it("does NOT flag 'Un documento' in Spanish prose (Un + documento collision)", () => {
      // "documento" appears in ATTRIBUTION_VERBS as the unaccented fallback
      // for "documentó". When a sentence starts with "Un documento...", the
      // capitalized "Un" must be treated as an article, not an entity.
      const body =
        "Sus próximas reglas de gobierno. Un documento compartido más un resumen con IA le gana velocidad a un equipo sin él.";
      expect(scanSection(body, "es/tool")).toHaveLength(0);
    });

    it("does NOT flag 'Una empresa' at sentence start", () => {
      const body = "El problema es estructural. Una empresa documentó este patrón y lo compartió.";
      expect(scanSection(body, "es/insight")).toHaveLength(0);
    });

    it("does NOT flag 'The reader said' at sentence start (English article)", () => {
      const body = "The reader said the tool was working as designed.";
      expect(scanSection(body, "en/insight")).toHaveLength(0);
    });

    it("does NOT flag 'An executive announced' at sentence start", () => {
      const body = "An executive announced the restructuring on Monday.";
      expect(scanSection(body, "en/fieldReport")).toHaveLength(0);
    });

    it("STILL flags a real attribution after a sentence-starting article", () => {
      // The article at sentence start must not swallow a legitimate attribution
      // that follows elsewhere in the section. Uses "ha documentado" (which
      // ends in 'o', a \w char) rather than "documentó" because \b + accented
      // chars has a pre-existing quirk in the regex engine (tracked in
      // docs/IMPROVEMENT-BACKLOG.md — scope of this fix is articles only).
      const body =
        "Un documento compartido ayuda. Grupo Elektra ha documentado el patrón en su reporte.";
      const issues = scanSection(body, "es/fieldReport");
      expect(issues).toHaveLength(1);
      expect(issues[0]!.entity).toBe("Grupo Elektra");
    });
  });

  describe("scanSignalBullets", () => {
    it("flags a bullet missing a link", () => {
      const body = "- Fed holds rates steady — operators have a refinancing window.";
      const issues = scanSignalBullets(body, "en/news");
      expect(issues).toHaveLength(1);
      expect(issues[0]!.verb).toBe("(missing link)");
    });

    it("does NOT flag a bullet that has a link", () => {
      const body = "- Fed holds rates steady — operators have a refinancing window. [Read →](https://reuters.com/article)";
      const issues = scanSignalBullets(body, "en/news");
      expect(issues).toHaveLength(0);
    });

    it("flags only the bullets missing links in a mixed set", () => {
      const body = [
        "- Bullet one with link. [Read →](https://example.com/1)",
        "- Bullet two missing link.",
        "- Bullet three with link. [Read →](https://example.com/3)",
      ].join("\n");
      const issues = scanSignalBullets(body, "en/news");
      expect(issues).toHaveLength(1);
      expect(issues[0]!.excerpt).toContain("Bullet two");
    });

    it("scanEdition routes news sections through scanSignalBullets", () => {
      const sections = [
        { type: "news", body: "- Missing link bullet.\n- Also missing." },
        { type: "analysis", body: "Clean prose with no attributions." },
      ];
      const issues = scanEdition(sections, "en");
      expect(issues).toHaveLength(2);
      expect(issues.every((i) => i.section === "en/news")).toBe(true);
    });

    it("returns empty for an empty signal body", () => {
      expect(scanSignalBullets("", "en/news")).toHaveLength(0);
    });

    it("does NOT flag an italicized preamble line starting with *", () => {
      const body = [
        "*This week: AI amplifies whatever structure already exists - the best pull ahead, the rest fall behind.*",
        "",
        "- **Strategy:** fact + implication. [Read →](https://example.com/1)",
        "- **Operating Models:** fact + implication. [Read →](https://example.com/2)",
      ].join("\n");
      const issues = scanSignalBullets(body, "en/news");
      expect(issues).toHaveLength(0);
    });

    describe("multi-line Pattern A bullets", () => {
      // After the 2026-04-23 Signal upgrade, each bullet spans three lines:
      // bullet marker + fact, bold punch line on a new line, then the
      // [Read ->](url) on its own line. The bullet block must be treated
      // as one unit when checking for the link.
      it("does NOT flag a three-layer bullet where the link is on its own line", () => {
        const body = [
          "*This week: four patterns.*",
          "",
          "- **Strategy:** Mexican footwear imports from China fell 62% in early 2026.",
          "  **Strategy is the discipline of deciding which trade-regime assumptions are contracts.**",
          "  [Read →](https://example.com/strategy)",
        ].join("\n");
        const issues = scanSignalBullets(body, "en/news");
        expect(issues).toHaveLength(0);
      });

      it("flags a three-layer bullet that is missing its link on every line", () => {
        const body = [
          "- **Strategy:** Mexican footwear imports fell 62%.",
          "  **Strategy is discipline.**",
          "  [Read →](https://example.com/ok)",
          "- **Operating Models:** Something happened.",
          "  **The operating model is what survives.**",
          // no link on any of the three lines of this block
        ].join("\n");
        const issues = scanSignalBullets(body, "en/news");
        expect(issues).toHaveLength(1);
        expect(issues[0]!.excerpt).toContain("Operating Models");
      });

      it("flags only the blocks missing a link in a mixed Pattern A set", () => {
        const body = [
          "- **Strategy:** Fact one.",
          "  **Claim one.**",
          "  [Read →](https://example.com/1)",
          "- **Operating Models:** Fact two.",
          "  **Claim two.**",
          // no link
          "- **Technology:** Fact three.",
          "  **Claim three.**",
          "  [Read →](https://example.com/3)",
        ].join("\n");
        const issues = scanSignalBullets(body, "en/news");
        expect(issues).toHaveLength(1);
        expect(issues[0]!.excerpt).toContain("Operating Models");
      });
    });
  });
});
