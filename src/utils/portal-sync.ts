/**
 * Portal mirror — fans an approved edition into Supabase so it powers the
 * member archive AND the Transformation AI's grounding. Beehiiv remains
 * the email delivery rail; this is the membership/archive/AI copy.
 *
 * Non-fatal by contract: publish.ts must never crash because the mirror
 * failed. Configure with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (the
 * service-role key bypasses RLS — server-side only, never shipped to the
 * browser).
 */
import { createClient } from "@supabase/supabase-js";

import type { StrategicAngle, LocalizedContent } from "../types/edition.js";
import type { SourceItem } from "../types/source-bundle.js";
import { renderLocalizedToMarkdown } from "./edition-markdown.js";

const VALID_TOPICS = [
  "business_transformation",
  "conscious_capital",
  "family_business",
  "family_office",
  "artificial_intelligence",
  "technology",
] as const;
export type PortalTopic = (typeof VALID_TOPICS)[number];

/** "2026-19" → 202619. Deterministic, unique, monotonic per ISO week. */
export function editionNumberFromId(editionId: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(editionId);
  if (!m) {
    throw new Error(`Invalid editionId "${editionId}" — expected YYYY-WW`);
  }
  return Number(m[1]) * 100 + Number(m[2]);
}

function normalizeTopic(topic: string | undefined): PortalTopic {
  return (VALID_TOPICS as readonly string[]).includes(topic ?? "")
    ? (topic as PortalTopic)
    : "business_transformation";
}

export interface EditionRow {
  edition_id: string;
  edition_number: number;
  published_at: string | null;
  subject_en: string;
  subject_es: string;
  body_en: string;
  body_es: string;
  hero_image_url: string | null;
  topic: PortalTopic;
  pillar: string | null;
  quarterly_theme: string | null;
  shareable_sentence_en: string | null;
  shareable_sentence_es: string | null;
  byline: string | null;
  byline_role: string | null;
  is_published: boolean;
}

export interface MirrorInput {
  editionId: string;
  angle: StrategicAngle;
  enContent: LocalizedContent;
  esContent: LocalizedContent;
  shareableSentence: string | null;
  sources?: SourceItem[] | undefined;
  /** ISO datetime if the edition is scheduled; otherwise the run timestamp. */
  publishedAt: string;
  isPublished: boolean;
  /** Topic is not yet declared by the Strategist; defaults to business_transformation. */
  topic?: string | undefined;
  byline?: string | null | undefined;
  bylineRole?: string | null | undefined;
}

/** Pure mapping — unit-testable without any network. */
export function buildEditionRow(input: MirrorInput): EditionRow {
  return {
    edition_id: input.editionId,
    edition_number: editionNumberFromId(input.editionId),
    published_at: input.isPublished ? input.publishedAt : null,
    subject_en: input.enContent.subject,
    subject_es: input.esContent.subject,
    body_en: renderLocalizedToMarkdown(input.enContent),
    body_es: renderLocalizedToMarkdown(input.esContent),
    hero_image_url: null,
    topic: normalizeTopic(input.topic),
    pillar: input.angle.osPillar ?? null,
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
  items: SourceItem[],
): { edition_id: string; title: string; url: string; snippet: string | null; publisher: string | null }[] {
  return items.map((s) => ({
    edition_id: editionDbId,
    title: s.title,
    url: s.url,
    snippet: s.summary ? s.summary.slice(0, 600) : null,
    publisher: s.outlet ?? null,
  }));
}

export interface MirrorResult {
  skipped: boolean;
  reason?: string;
  editionId: string;
  sourcesMirrored?: number;
}

export async function mirrorEditionToPortal(input: MirrorInput): Promise<MirrorResult> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    return {
      skipped: true,
      reason: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set",
      editionId: input.editionId,
    };
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const row = buildEditionRow(input);
  const { data, error } = await supabase
    .from("editions")
    .upsert(row, { onConflict: "edition_id" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`editions upsert failed: ${error?.message ?? "no row returned"}`);
  }

  let sourcesMirrored = 0;
  if (input.sources && input.sources.length > 0) {
    const { error: delErr } = await supabase
      .from("edition_sources")
      .delete()
      .eq("edition_id", data.id);
    if (delErr) {
      throw new Error(`edition_sources cleanup failed: ${delErr.message}`);
    }
    const srcRows = buildSourceRows(data.id, input.sources);
    const { error: insErr } = await supabase.from("edition_sources").insert(srcRows);
    if (insErr) {
      throw new Error(`edition_sources insert failed: ${insErr.message}`);
    }
    sourcesMirrored = srcRows.length;
  }

  return { skipped: false, editionId: input.editionId, sourcesMirrored };
}
