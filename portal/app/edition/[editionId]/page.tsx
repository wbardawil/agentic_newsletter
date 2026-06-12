import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getLangFromCookies } from "@/lib/i18n/server";
import { renderBody } from "@/lib/markdown";
import { topicLabel } from "@/lib/topics";

type PublicMeta = Database["public"]["Views"]["editions_public"]["Row"];
type FullEdition = Database["public"]["Tables"]["editions"]["Row"];
type SourceRow = Pick<Database["public"]["Tables"]["edition_sources"]["Row"], "title" | "url" | "snippet" | "publisher">;

/**
 * Public newsroom article page.
 *
 * Anyone can read the headline, byline, topic and the shareable excerpt (from
 * the body-free `editions_public` view). The full body + sources render only
 * for authenticated active members — membership is enforced by the existing
 * `editions` RLS policy: the gated query simply returns no row for everyone
 * else, so there is no separate membership check to keep in sync.
 */
export default async function PublicEditionPage({
  params,
  searchParams,
}: {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { editionId } = await params;
  const { lang: overrideLang } = await searchParams;

  const supabase = await getSupabaseServerClient();

  // Public, body-free metadata — readable by anon.
  const { data: metaData } = await supabase
    .from("editions_public")
    .select("edition_id, edition_number, subject_en, subject_es, topic, pillar, quarterly_theme, shareable_sentence_en, shareable_sentence_es, byline, byline_role")
    .eq("edition_id", editionId)
    .maybeSingle();
  const meta = metaData as PublicMeta | null;
  if (!meta) notFound();

  // Membership-gated full body. RLS returns a row only for active members.
  const { data: { user } } = await supabase.auth.getUser();
  let full: FullEdition | null = null;
  let sources: SourceRow[] | null = null;
  if (user) {
    const { data: fullData } = await supabase
      .from("editions")
      .select("*")
      .eq("edition_id", editionId)
      .eq("is_published", true)
      .maybeSingle();
    full = (fullData as FullEdition | null) ?? null;
    if (full) {
      const { data: src } = await supabase
        .from("edition_sources")
        .select("title, url, snippet, publisher")
        .eq("edition_id", full.id);
      sources = (src as SourceRow[] | null) ?? null;
    }
  }

  const cookieLang = await getLangFromCookies();
  const lang = overrideLang === "es" ? "es" : overrideLang === "en" ? "en" : cookieLang;

  const subject = lang === "es" ? meta.subject_es ?? meta.subject_en : meta.subject_en ?? meta.subject_es;
  const shareable = lang === "es" ? meta.shareable_sentence_es ?? meta.shareable_sentence_en : meta.shareable_sentence_en ?? meta.shareable_sentence_es;
  const body = full ? (lang === "es" ? full.body_es ?? full.body_en : full.body_en ?? full.body_es) : null;

  return (
    <article className="container-prose py-12">
      <header className="mb-8">
        <p className="text-xs text-[var(--color-fg-muted)] uppercase tracking-wider">
          #{meta.edition_number} · {topicLabel(meta.topic, lang)}
          {meta.pillar ? ` · ${meta.pillar}` : ""}
          {meta.quarterly_theme ? ` · ${meta.quarterly_theme}` : ""}
        </p>
        <h1 className="text-4xl mt-2 mb-4">{subject}</h1>
        {meta.byline ? (
          <p className="text-sm text-[var(--color-fg-muted)] mb-3">
            {lang === "es" ? "por" : "by"} <span className="text-[var(--color-fg)]">{meta.byline}</span>
            {meta.byline_role ? ` · ${meta.byline_role}` : ""}
          </p>
        ) : null}
        {shareable ? <p className="pull-quote">{shareable}</p> : null}
        <nav className="mt-6 text-sm flex gap-2">
          <Link
            href={`/edition/${editionId}?lang=en` as Route}
            className={`px-2 py-1 rounded ${lang === "en" ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : "text-[var(--color-fg-muted)]"}`}
          >EN</Link>
          <Link
            href={`/edition/${editionId}?lang=es` as Route}
            className={`px-2 py-1 rounded ${lang === "es" ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : "text-[var(--color-fg-muted)]"}`}
          >ES</Link>
        </nav>
      </header>

      {body ? (
        <>
          <div
            className="prose prose-neutral max-w-none"
            dangerouslySetInnerHTML={{ __html: renderBody(body) }}
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
        </>
      ) : (
        <section className="mt-8 border-t border-[var(--color-line)] pt-8">
          <div className="card">
            <h2 className="text-xl font-bold mb-2">
              {lang === "es" ? "Lee la edición completa" : "Read the full issue"}
            </h2>
            <p className="text-[var(--color-fg-muted)] leading-relaxed mb-5">
              {user
                ? lang === "es"
                  ? "Tu membresía aún no está activa. En cuanto se apruebe, tendrás acceso completo al archivo bilingüe."
                  : "Your membership isn't active yet. Once approved, you'll get full access to the bilingual archive."
                : lang === "es"
                  ? "El análisis completo en EN/ES es para miembros. Aplica para acceder al archivo, o inicia sesión si ya eres miembro."
                  : "The full EN/ES analysis is for members. Apply for access to the archive, or sign in if you're already a member."}
            </p>
            <div className="flex flex-wrap gap-3">
              {user ? (
                <Link href="/me" className="btn btn-cta btn-xl">{lang === "es" ? "Ir a mi cuenta" : "Go to my account"} →</Link>
              ) : (
                <>
                  <Link href="/apply" className="btn btn-cta btn-xl">{lang === "es" ? "Aplicar" : "Apply"} →</Link>
                  <Link href={`/sign-in?next=/edition/${editionId}` as Route} className="btn btn-cta-outline btn-xl">
                    {lang === "es" ? "Iniciar sesión" : "Sign in"}
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
