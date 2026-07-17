import Link from "next/link";
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";
import { TOPICS, TOPIC_IDS, topicLabel } from "@/lib/topics";

export const metadata = { title: "Archive — The Transformation Letter" };

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; topic?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/archive");

  const lang = await getLangFromCookies();
  const i18n = t(lang).archive;

  let query = supabase
    .from("editions")
    .select("edition_id, edition_number, subject_en, subject_es, topic, pillar, byline, byline_role, published_at, shareable_sentence_en, shareable_sentence_es, hero_image_url")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (params.topic && (TOPIC_IDS as string[]).includes(params.topic)) {
    query = query.eq("topic", params.topic);
  }

  if (params.q?.trim()) {
    const q = `%${params.q.trim()}%`;
    query = query.or(
      `subject_en.ilike.${q},subject_es.ilike.${q},shareable_sentence_en.ilike.${q},shareable_sentence_es.ilike.${q}`,
    );
  }

  const { data: dataRows } = await query;
  const data = dataRows as Pick<Database["public"]["Tables"]["editions"]["Row"], "edition_id" | "edition_number" | "subject_en" | "subject_es" | "topic" | "pillar" | "byline" | "byline_role" | "published_at" | "shareable_sentence_en" | "shareable_sentence_es" | "hero_image_url">[] | null;

  return (
    <section className="container-wide py-12">
      <header className="mb-8">
        <h1 className="text-4xl mb-2">{i18n.title}</h1>
        <p className="text-[var(--color-fg-muted)]">{i18n.sub}</p>
      </header>

      <form method="get" className="flex flex-wrap gap-3 items-end mb-8">
        <div className="flex-1 min-w-[16rem]">
          <label className="field-label" htmlFor="q">{i18n.search}</label>
          <input id="q" name="q" defaultValue={params.q ?? ""} className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="topic">{i18n.filterTopic}</label>
          <select id="topic" name="topic" defaultValue={params.topic ?? ""} className="field-select">
            <option value="" />
            {TOPICS.map((tp) => (
              <option key={tp.id} value={tp.id}>{lang === "es" ? tp.es : tp.en}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-ghost">{lang === "es" ? "Filtrar" : "Filter"}</button>
      </form>

      <ul className="divide-y divide-[var(--color-line)]">
        {(data ?? []).map((e) => (
          <li key={e.edition_id} className="py-6">
            <div className="flex items-baseline justify-between gap-4 mb-1">
              <Link href={`/archive/${e.edition_id}`} className="font-bold text-2xl text-[var(--color-fg)] no-underline hover:text-[var(--color-cta)]">
                {lang === "es" ? e.subject_es ?? e.subject_en : e.subject_en ?? e.subject_es}
              </Link>
              <span className="text-xs text-[var(--color-fg-muted)] uppercase tracking-wider">
                #{e.edition_number}
              </span>
            </div>
            <div className="text-sm text-[var(--color-fg-muted)] mb-2 flex flex-wrap items-baseline gap-2">
              <span className="pill">{topicLabel(e.topic, lang)}</span>
              {e.pillar ? <span>{e.pillar}</span> : null}
              <span>·</span>
              <span>
                {e.published_at ? new Date(e.published_at).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", {
                  year: "numeric", month: "long", day: "numeric",
                }) : ""}
              </span>
              {e.byline ? (
                <>
                  <span>·</span>
                  <span>{i18n.byline} {e.byline}{e.byline_role ? `, ${e.byline_role}` : ""}</span>
                </>
              ) : null}
            </div>

            {(lang === "es" ? e.shareable_sentence_es : e.shareable_sentence_en) ? (
              <p className="text-[var(--color-fg)]/85">
                {lang === "es" ? e.shareable_sentence_es : e.shareable_sentence_en}
              </p>
            ) : null}
          </li>
        ))}
        {(!data || data.length === 0) ? (
          <p className="py-6 text-[var(--color-fg-muted)]">{i18n.noResults}</p>
        ) : null}
      </ul>
    </section>
  );
}
