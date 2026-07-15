import type { EditionPublicRow } from "@/lib/supabase/types";
import type { Lang } from "@/lib/i18n/dictionary";

/**
 * The subset of the public (body-free) edition projection the newsroom feed
 * renders. Sourced from `editions_public` — never the gated `editions` table.
 */
export type NewsroomItem = Pick<
  EditionPublicRow,
  | "edition_id"
  | "edition_number"
  | "subject_en"
  | "subject_es"
  | "shareable_sentence_en"
  | "shareable_sentence_es"
  | "topic"
  | "pillar"
  | "byline"
  | "byline_role"
  | "published_at"
  | "hero_image_url"
>;

/** The columns to select from editions_public for the feed (kept in one place). */
export const NEWSROOM_SELECT =
  "edition_id, edition_number, subject_en, subject_es, shareable_sentence_en, shareable_sentence_es, topic, pillar, byline, byline_role, published_at, hero_image_url";

/** Bilingual pick with fallback to the other language — the app-wide idiom. */
export function pickLang(lang: Lang, es: string | null, en: string | null): string | null {
  return lang === "es" ? es ?? en : en ?? es;
}

/** Localized title (never null — falls back to the edition number label upstream). */
export function itemTitle(item: NewsroomItem, lang: Lang): string {
  return pickLang(lang, item.subject_es, item.subject_en) ?? `#${item.edition_number}`;
}

/** Localized shareable excerpt (may be null). */
export function itemExcerpt(item: NewsroomItem, lang: Lang): string | null {
  return pickLang(lang, item.shareable_sentence_es, item.shareable_sentence_en);
}

/** Formatted publish date in the active locale, or "" when missing. */
export function itemDate(item: NewsroomItem, lang: Lang): string {
  if (!item.published_at) return "";
  return new Date(item.published_at).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
