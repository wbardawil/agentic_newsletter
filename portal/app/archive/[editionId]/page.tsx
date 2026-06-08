import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getLangFromCookies } from "@/lib/i18n/server";
import { renderBody } from "@/lib/markdown";
import { topicLabel } from "@/lib/topics";

export default async function EditionPage({
  params,
  searchParams,
}: {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { editionId } = await params;
  const { lang: overrideLang } = await searchParams;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/archive/${editionId}`);

  const { data: editionData } = await supabase
    .from("editions")
    .select("*")
    .eq("edition_id", editionId)
    .eq("is_published", true)
    .maybeSingle();
  const edition = editionData as Database["public"]["Tables"]["editions"]["Row"] | null;

  if (!edition) notFound();

  const { data: sourcesData } = await supabase
    .from("edition_sources")
    .select("title, url, snippet, publisher")
    .eq("edition_id", edition.id);
  const sources = sourcesData as Pick<Database["public"]["Tables"]["edition_sources"]["Row"], "title" | "url" | "snippet" | "publisher">[] | null;

  const cookieLang = await getLangFromCookies();
  const lang = overrideLang === "es" ? "es" : overrideLang === "en" ? "en" : cookieLang;
  const subject = lang === "es" ? edition.subject_es ?? edition.subject_en : edition.subject_en ?? edition.subject_es;
  const body = lang === "es" ? edition.body_es ?? edition.body_en : edition.body_en ?? edition.body_es;
  const shareable = lang === "es" ? edition.shareable_sentence_es : edition.shareable_sentence_en;

  return (
    <article className="container-prose py-12">
      <header className="mb-8">
        <p className="text-xs text-[var(--color-fg-muted)] uppercase tracking-wider">
          #{edition.edition_number} · {topicLabel(edition.topic, lang)}
          {edition.pillar ? ` · ${edition.pillar}` : ""}
          {edition.quarterly_theme ? ` · ${edition.quarterly_theme}` : ""}
        </p>
        <h1 className="text-4xl mt-2 mb-4">{subject}</h1>
        {edition.byline ? (
          <p className="text-sm text-[var(--color-fg-muted)] mb-3">
            {lang === "es" ? "por" : "by"} <span className="text-[var(--color-fg)]">{edition.byline}</span>
            {edition.byline_role ? ` · ${edition.byline_role}` : ""}
          </p>
        ) : null}
        {shareable ? <p className="pull-quote">{shareable}</p> : null}
        <nav className="mt-6 text-sm flex gap-2">
          <Link
            href={`/archive/${editionId}?lang=en`}
            className={`px-2 py-1 rounded ${lang === "en" ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : "text-[var(--color-fg-muted)]"}`}
          >EN</Link>
          <Link
            href={`/archive/${editionId}?lang=es`}
            className={`px-2 py-1 rounded ${lang === "es" ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : "text-[var(--color-fg-muted)]"}`}
          >ES</Link>
        </nav>
      </header>

      <div
        className="prose prose-neutral max-w-none"
        dangerouslySetInnerHTML={{ __html: renderBody(body ?? "") }}
      />

      {sources && sources.length > 0 ? (
        <section className="mt-12 border-t border-[var(--color-line)] pt-6">
          <h3 className="text-lg mb-3">{lang === "es" ? "Fuentes" : "Sources"}</h3>
          <ol className="space-y-2 text-sm list-decimal pl-5">
            {sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                {s.publisher ? <span className="text-[var(--color-fg-muted)]"> — {s.publisher}</span> : null}
                {s.snippet ? <div className="text-[var(--color-fg-muted)] mt-1">{s.snippet}</div> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
