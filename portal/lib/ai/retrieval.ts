import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Lang } from "@/lib/i18n/dictionary";
import type { Database } from "@/lib/supabase/types";

/**
 * Lightweight retrieval: pulls the most recently published editions whose
 * subject/body contains any of the salient tokens from the user query.
 *
 * Swap to pgvector / embeddings when the archive grows large — the
 * interface (returning {edition_number, subject, topic, pillar, snippet})
 * stays the same.
 */
export async function retrieveRelevantExcerpts(
  query: string,
  lang: Lang,
  limit = 5,
): Promise<{
  edition_id: string;
  edition_number: number;
  subject: string;
  topic: string | null;
  pillar: string | null;
  snippet: string;
}[]> {
  const tokens = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 4)
    .slice(0, 6);

  const supabase = getSupabaseAdminClient();

  const baseSelect = "edition_id, edition_number, subject_en, subject_es, body_en, body_es, topic, pillar, published_at";

  let q = supabase
    .from("editions")
    .select(baseSelect)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(limit * 3);

  if (tokens.length > 0) {
    const filters = tokens
      .map((t) => `subject_en.ilike.%${t}%,subject_es.ilike.%${t}%,body_en.ilike.%${t}%,body_es.ilike.%${t}%`)
      .join(",");
    q = q.or(filters);
  }

  const { data } = await q;
  const rows = (data ?? []) as Pick<Database["public"]["Tables"]["editions"]["Row"], "edition_id" | "edition_number" | "subject_en" | "subject_es" | "body_en" | "body_es" | "topic" | "pillar" | "published_at">[];

  return rows.slice(0, limit).map((r) => {
    const body = (lang === "es" ? r.body_es ?? r.body_en : r.body_en ?? r.body_es) ?? "";
    const subject = (lang === "es" ? r.subject_es ?? r.subject_en : r.subject_en ?? r.subject_es) ?? "";
    return {
      edition_id: r.edition_id,
      edition_number: r.edition_number,
      subject,
      topic: r.topic ?? null,
      pillar: r.pillar,
      snippet: extractSnippet(body, tokens, 600),
    };
  });
}

function extractSnippet(body: string, tokens: string[], maxLen: number): string {
  if (!body) return "";
  const lower = body.toLowerCase();
  let hit = -1;
  for (const t of tokens) {
    const idx = lower.indexOf(t);
    if (idx !== -1) { hit = idx; break; }
  }
  if (hit < 0) return body.slice(0, maxLen);
  const start = Math.max(0, hit - 120);
  return body.slice(start, start + maxLen);
}
