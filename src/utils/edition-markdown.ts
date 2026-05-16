import type { LocalizedContent } from "../types/edition.js";

/**
 * Renders a localized edition to the exact Markdown body that ships to
 * Beehiiv. Shared by the Distributor agent (email) and the portal mirror
 * (archive + AI grounding) so the published archive is byte-identical to
 * what subscribers receive.
 */
export function renderLocalizedToMarkdown(content: LocalizedContent): string {
  const get = (type: string) =>
    content.sections.find((s: { type: string }) => s.type === type)?.body ?? "";

  const headings: Record<string, string> = {
    lead: content.language === "es" ? "LA APERTURA" : "THE APERTURA",
    analysis: content.language === "es" ? "EL INSIGHT" : "THE INSIGHT",
    spotlight: content.language === "es" ? "EL REPORTE DE CAMPO" : "THE FIELD REPORT",
    quickTakes: content.language === "es" ? "LA BRÚJULA" : "THE COMPASS",
    cta: content.language === "es" ? "LA PUERTA" : "THE DOOR",
  };

  return [
    `## ${headings["lead"]}`,
    "",
    get("lead"),
    "",
    "---",
    "",
    `## ${headings["analysis"]}`,
    "",
    get("analysis"),
    "",
    "---",
    "",
    `## ${headings["spotlight"]}`,
    "",
    get("spotlight"),
    "",
    "---",
    "",
    `## ${headings["quickTakes"]}`,
    "",
    get("quickTakes"),
    "",
    "---",
    "",
    `## ${headings["cta"]}`,
    "",
    get("cta"),
  ].join("\n");
}
