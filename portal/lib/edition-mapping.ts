/**
 * Edition mapping — pure functions that turn an approved draft into the
 * Supabase `editions` + `edition_sources` row shapes.
 *
 * ⚠️ KEEP IN SYNC with the pipeline source of truth:
 *   - `src/utils/portal-sync.ts`     (buildEditionRow, buildSourceRows, editionNumberFromId, normalizeTopic)
 *   - `src/utils/edition-markdown.ts` (renderLocalizedToMarkdown)
 *
 * These are replicated (not imported) because the portal deploys standalone on
 * Vercel and cannot reach `../src`. The logic is intentionally byte-identical so
 * an edition published from the portal matches one published by `pnpm publish:edition`.
 */

import type { EditionRow, EditionSourceRow } from "@/lib/supabase/types";

export type EditionInsert = Omit<EditionRow, "id">;
export type EditionSourceInsert = Omit<EditionSourceRow, "id">;

const VALID_TOPICS = [
  "business_transformation",
  "conscious_capital",
  "family_business",
  "family_office",
  "artificial_intelligence",
  "technology",
 ] as const;
export type PortalTopic = (typeof VALID_TOPICS)[number];

// ── input shapes (subset of the pipeline types we actually read) ─────────────

export interface ContentSection {
  type: string;
  heading?: string;
  body: string;
}

export interface LocalizedContent {
  language: "en" | "es";
  subject: string;
  preheader?: string;
  sections: ContentSection[];
}

export interface StrategicAngleLite {
  osPillar?: string | null;
  quarterlyTheme?: string | null;
}

export interface SourceItemLite {
  title: string;
  url: string;
  summary?: string;
  outlet?: string;
}

export interface MirrorInput {
  editionId: string;
  angle: StrategicAngleLite;
  enContent: LocalizedContent;
  esContent: LocalizedContent;
  shareableSentence: string | null;
  sources?: SourceItemLite[] | undefined;
  /** ISO datetime stamped when the edition is published. */
  publishedAt: string;
  isPublished: boolean;
  /** Topic is not yet declared by the Strategist; defaults to business_transformation. */
  topic?: string | undefined;
  byline?: string | null | undefined;
  bylineRole?: string | null | undefined;
  /** Public URL of the approved hero image (from Supabase Storage). */
  heroImageUrl?: string | null | undefined;
}

// ── pure helpers ─────────────────────────────────────────────────────────────

/** "2026-19" → 202619. Deterministic, unique, monotonic per ISO week. */
export function editionNumberFromId(editionId: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(editionId);
  if (!m) {
    throw new Error(`Invalid editionId "${editionId}" — expected YYYY-WW`);
  }
  return Number(m[1]) * 100 + Number(m[2]);
}

export function normalizeTopic(topic: string | undefined): PortalTopic {
  return (VALID_TOPICS as readonly string[]).includes(topic ?? "")
    ? (topic as PortalTopic)
    : "business_transformation";
}

/**
 * Render a localized edition to the exact Markdown body that ships to Beehiiv.
 * Mirror of `src/utils/edition-markdown.ts` so the portal archive is identical
 * to what subscribers receive.
 */
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
  sections: ContentSection[],
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
 * Render a localized edition to the exact Markdown body that ships to Beehiiv.
 * Mirror of `src/utils/edition-markdown.ts` so the portal archive is identical
 * to what subscribers receive.
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

/** Pure mapping — unit-testable without any network. */
export function buildEditionRow(input: MirrorInput): EditionInsert {
  return {
    edition_id: input.editionId,
    edition_number: editionNumberFromId(input.editionId),
    published_at: input.isPublished ? input.publishedAt : null,
    subject_en: input.enContent.subject,
    subject_es: input.esContent.subject,
    body_en: renderLocalizedToMarkdown(input.enContent),
    body_es: renderLocalizedToMarkdown(input.esContent),
    hero_image_url: input.heroImageUrl ?? null,
    topic: normalizeTopic(input.topic),
    pillar: (input.angle.osPillar ?? null) as EditionInsert["pillar"],
    quarterly_theme: input.angle.quarterlyTheme ?? null,
    shareable_sentence_en: input.shareableSentence,
    shareable_sentence_es: null,
    byline: input.byline ?? null,
    byline_role: input.bylineRole ?? null,
    is_published: input.isPublished,
  };
}

export function buildSourceRows(
  editionDbId: string,
  items: SourceItemLite[],
): EditionSourceInsert[] {
  return items.map((s) => ({
    edition_id: editionDbId,
    title: s.title,
    url: s.url,
    snippet: s.summary ? s.summary.slice(0, 600) : null,
    publisher: s.outlet ?? null,
  }));
}
