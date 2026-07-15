import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { NewsroomChannelBar } from "@/components/newsroom/NewsroomChannelBar";
import { itemDate, itemExcerpt, itemTitle, NEWSROOM_SELECT, type NewsroomItem } from "@/components/newsroom/types";
import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { topicLabel } from "@/lib/topics";
import type { Database } from "@/lib/supabase/types";
import { renderBody } from "@/lib/markdown";

type FullEdition = Database["public"]["Tables"]["editions"]["Row"];
type SourceRow = Pick<Database["public"]["Tables"]["edition_sources"]["Row"], "title" | "url" | "snippet" | "publisher">;

export default async function NewsroomEditionPage({ params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = await params;
  const lang = await getLangFromCookies();
  const labels = t(lang).newsroom;

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("editions_public").select(NEWSROOM_SELECT).eq("edition_id", editionId).maybeSingle();
  if (!data) notFound();

  const item = data as NewsroomItem;
  const title = itemTitle(item, lang);
  const excerpt = itemExcerpt(item, lang);
  const date = itemDate(item, lang);

  // Check user session and get full premium body if member/admin
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

  const body = full ? (lang === "es" ? full.body_es ?? full.body_en : full.body_en ?? full.body_es) : null;

  return (
    <>
      <NewsroomChannelBar active={item.topic} lang={lang} allLabel={labels.allChannels} />
      <article className="newsroom-section">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="newsroom-pill">{topicLabel(item.topic, lang)}</span>
            <span className="text-sm text-[var(--color-newsroom-muted)]">#{item.edition_number}</span>
          </div>
          <h1 className="newsroom-heading-display mb-5">{title}</h1>
          <div className="mb-8 flex flex-wrap items-center gap-2 text-sm text-[var(--color-newsroom-muted)]">
            {item.byline ? <span>{lang === "es" ? "Por" : "By"} {item.byline}</span> : null}
            {item.byline_role ? <span>|</span> : null}
            {item.byline_role ? <span>{item.byline_role}</span> : null}
            {date ? <span>|</span> : null}
            {date ? <span>{date}</span> : null}
          </div>
          {item.hero_image_url ? (
            <div className="relative mb-8 aspect-[16/9] overflow-hidden rounded-lg">
              <Image src={item.hero_image_url} alt={title} fill priority sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
            </div>
          ) : null}
          {excerpt ? <p className="mb-8 border-l-4 border-[var(--color-newsroom-terracotta)] pl-5 text-2xl italic leading-relaxed text-[var(--color-newsroom-muted)]">{excerpt}</p> : null}
          
          {body ? (
            <>
              <div
                className="prose prose-neutral max-w-none mt-8 newsroom-prose"
                dangerouslySetInnerHTML={{ __html: renderBody(body) }}
              />
              {sources && sources.length > 0 ? (
                <section className="mt-12 border-t border-[var(--color-newsroom-border)] pt-6">
                  <h3 className="text-lg font-bold mb-3 text-[var(--color-newsroom-dark)]">
                    {lang === "es" ? "Fuentes" : "Sources"}
                  </h3>
                  <ol className="space-y-2 text-sm list-decimal pl-5 text-[var(--color-newsroom-muted)]">
                    {sources.map((s, i) => (
                      <li key={i}>
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-[var(--color-newsroom-terracotta)] hover:underline">{s.title}</a>
                        {s.publisher ? <span className="text-[var(--color-newsroom-muted)]"> — {s.publisher}</span> : null}
                        {s.snippet ? <div className="text-[var(--color-newsroom-muted)] mt-1 opacity-80">{s.snippet}</div> : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </>
          ) : (
            <div className="rounded-lg border border-[var(--color-newsroom-border)] bg-white p-6 mt-8">
              <h2 className="text-xl font-bold mb-2 text-[var(--color-newsroom-dark)]">
                {lang === "es" ? "Análisis completo" : "Full analysis"}
              </h2>
              <p className="mb-5 text-base leading-relaxed text-[var(--color-newsroom-muted)]">
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
                  <Link href={"/me" as Route} className="btn btn-md newsroom-cta">
                    {lang === "es" ? "Ir a mi cuenta" : "Go to my account"} →
                  </Link>
                ) : (
                  <>
                    <Link href={"/apply" as Route} className="btn btn-md newsroom-cta">
                      {lang === "es" ? "Postular" : "Apply"} →
                    </Link>
                    <Link href={`/sign-in?next=/newsroom/${editionId}` as Route} className="btn btn-md btn-cta-outline border-[var(--color-newsroom-border)] text-[var(--color-newsroom-dark)] hover:bg-neutral-50">
                      {lang === "es" ? "Iniciar sesión" : "Sign in"}
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </article>
    </>
  );
}