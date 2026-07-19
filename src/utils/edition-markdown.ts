import type { LocalizedContent } from "../types/edition.js";

const SUPERSCRIPTS: Record<number, string> = {
  1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵",
  6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", 0: "⁰"
};

function toSuperscript(num: number): string {
  return String(num)
    .split("")
    .map((char) => SUPERSCRIPTS[Number(char)] || char)
    .join("");
}

export function transformInlineLinksToFootnotes(
  sections: Array<{ type: string; body: string }>,
  language: "en" | "es"
): { body: string; footnotesMarkdown: string } {
  const footnoteUrls: string[] = [];
  const footnoteMap = new Map<string, { index: number; publication: string }>();

  const cleanAnchorText = (text: string): string => {
    return text
      .replace(/^\b(according to|según|segun|de acuerdo con|de acuerdo a|the|el|la|los|las|a|un|una)\s+/gi, "")
      .replace(/\s+\b(reports|reports that|found|found that|noted|noted that|stated|stated that|dijo|declaró|informó|reportó|anunció|afirmó|confirmó|reveló|publicó|demostró|admitió|ha documentado|ha reportado|ha anunciado|ha declarado|ha confirmado|ha publicado|ha afirmado)\b.*$/gi, "")
      .trim();
  };

  const processedSections = sections.map((s) => {
    // Skip the Signal (news) and CTA (cta) links from converting to footnotes
    if (s.type === "news" || s.type === "cta") {
      return s;
    }

    let body = s.body;
    const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

    body = body.replace(markdownLinkRegex, (match, anchor, url) => {
      if (url.includes("wadibardawil.com") || url.includes("instagram.com") || url.includes("wa.me") || url.includes("ig.me")) {
        return match;
      }

      let ref = footnoteMap.get(url);
      if (!ref) {
        footnoteUrls.push(url);
        const index = footnoteUrls.length;
        const publication = cleanAnchorText(anchor);
        ref = { index, publication };
        footnoteMap.set(url, ref);
      }

      const superscript = toSuperscript(ref.index);
      return `${anchor} [${superscript}](${url})`;
    });

    return { ...s, body };
  });

  const get = (type: string) =>
    processedSections.find((s) => s.type === type)?.body ?? "";

  const headings: Record<string, string> = {
    lead: language === "es" ? "LA APERTURA" : "THE APERTURA",
    analysis: language === "es" ? "EL INSIGHT" : "THE INSIGHT",
    spotlight: language === "es" ? "EL REPORTE DE CAMPO" : "THE FIELD REPORT",
    quickTakes: language === "es" ? "LA BRÚJULA" : "THE COMPASS",
    cta: language === "es" ? "LA PUERTA" : "THE DOOR",
  };

  const bodyMarkdown = [
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

  let footnotesMarkdown = "";
  if (footnoteUrls.length > 0) {
    const title = language === "es" ? "Fuentes" : "Sources";
    const items = footnoteUrls
      .map((url) => {
        const ref = footnoteMap.get(url)!;
        return `${ref.index}. [${ref.publication}](${url})`;
      })
      .join("\n");

    footnotesMarkdown = [
      "---",
      "",
      `### ${title}`,
      "",
      items
    ].join("\n");
  }

  return { body: bodyMarkdown, footnotesMarkdown };
}

/**
 * Renders a localized edition to the exact Markdown body that ships to
 * Beehiiv. Shared by the Distributor agent (email) and the portal mirror
 * (archive + AI grounding) so the published archive is byte-identical to
 * what subscribers receive.
 */
export function renderLocalizedToMarkdown(content: LocalizedContent): string {
  const { body, footnotesMarkdown } = transformInlineLinksToFootnotes(
    content.sections,
    content.language
  );

  if (footnotesMarkdown) {
    return body + "\n\n" + footnotesMarkdown;
  }
  return body;
}
