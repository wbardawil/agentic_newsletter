import Link from "next/link";

import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { TOPICS, topicLabel } from "@/lib/topics";

export default async function HomePage() {
  const lang = await getLangFromCookies();
  const i18n = t(lang).landing;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: allLatest } = await supabase
    .from("editions")
    .select("edition_id, edition_number, subject_en, subject_es, shareable_sentence_en, shareable_sentence_es, topic, pillar, byline, byline_role, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(4);

  const [heroEdition, ...recentEditions] = allLatest ?? [];

  const heroTitle = heroEdition
    ? (lang === "es" ? heroEdition.subject_es ?? heroEdition.subject_en : heroEdition.subject_en ?? heroEdition.subject_es)
    : null;
  const heroExcerpt = heroEdition
    ? (lang === "es" ? heroEdition.shareable_sentence_es ?? heroEdition.shareable_sentence_en : heroEdition.shareable_sentence_en ?? heroEdition.shareable_sentence_es)
    : null;

  return (
    <>
      {/* Hero — Cover archetype: canvas + W watermark, bottom-right at ~8%
          opacity per Brand System DESIGN.md ("Marca de agua"). */}
      <section className="relative overflow-hidden container-wide py-28 lg:py-32 grid gap-12 lg:grid-cols-12 lg:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/w-mark.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute -bottom-10 -right-6 w-64 lg:w-80 opacity-[0.08]"
        />
        <div className="lg:col-span-7">
          <p className="pill mb-6">
            {lang === "es" ? "EN · ES · Semanal · Solo miembros" : "EN · ES · Weekly · Members only"}
          </p>
          {/* Tagline estático de marca */}
          <h1 className="heading-display mb-8">{i18n.hero}</h1>

          {/* Edición más reciente: título como enlace + extracto diagnóstico */}
          {heroEdition && heroTitle ? (
            <div className="mb-10 border-l-2 border-[var(--color-cta)] pl-5">
              <p className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
                #{heroEdition.edition_number} · {topicLabel(heroEdition.topic, lang)}
                {heroEdition.pillar ? ` · ${heroEdition.pillar}` : ""}
              </p>
              <Link
                href={`/newsroom/${heroEdition.edition_id}`}
                className="block text-[1.35rem] font-bold leading-snug text-[var(--color-fg)] hover:text-[var(--color-cta)] transition-colors mb-3"
              >
                {heroTitle}
              </Link>
              {heroExcerpt ? (
                <p className="text-[var(--color-fg-muted)] leading-relaxed text-sm">
                  {heroExcerpt}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="pull-quote mb-10">{i18n.filterSentence}</p>
          )}

          <div className="flex flex-wrap gap-3">
            {!user ? (
              <Link href="/apply" className="btn btn-cta btn-xl">{i18n.primaryCta} →</Link>
            ) : (
              <Link href="/archive" className="btn btn-cta btn-xl">{i18n.secondaryCta} →</Link>
            )}
          </div>
        </div>

        <aside className="lg:col-span-5 lg:pl-8 lg:border-l lg:border-[var(--color-line)]">
          <p className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-5">
            {lang === "es" ? "Ediciones recientes" : "Recent issues"}
          </p>
          <ul className="space-y-7">
            {recentEditions.map((e) => (
              <li key={e.edition_id}>
                <p className="text-[var(--color-fg-muted)] uppercase tracking-wider text-[0.7rem] mb-1">
                  #{e.edition_number} · {topicLabel(e.topic, lang)}{e.pillar ? ` · ${e.pillar}` : ""}
                </p>
                <Link
                  href={`/newsroom/${e.edition_id}`}
                  className="block text-[1.05rem] font-semibold leading-snug text-[var(--color-fg)] hover:text-[var(--color-cta)] transition-colors"
                >
                  {lang === "es" ? e.subject_es ?? e.subject_en : e.subject_en ?? e.subject_es}
                </Link>
                {e.byline ? (
                  <p className="text-xs text-[var(--color-fg-muted)] mt-1">
                    {lang === "es" ? "por" : "by"} {e.byline}{e.byline_role ? ` · ${e.byline_role}` : ""}
                  </p>
                ) : null}
                {(lang === "es" ? e.shareable_sentence_es : e.shareable_sentence_en) ? (
                  <p className="mt-2 text-sm text-[var(--color-fg-muted)] leading-relaxed">
                    {lang === "es" ? e.shareable_sentence_es : e.shareable_sentence_en}
                  </p>
                ) : null}
              </li>
            ))}
            {recentEditions.length === 0 ? (
              <li className="text-sm text-[var(--color-fg-muted)]">
                {lang === "es" ? "Próxima edición en camino." : "First issue on the way."}
              </li>
            ) : null}
          </ul>
        </aside>
      </section>

      {/* Coverage — six topics */}
      <section className="border-t border-[var(--color-line)]">
        <div className="container-wide py-28 lg:py-32">
          <div className="max-w-2xl mb-14">
            <h2 className="heading-section mb-4">{i18n.coverageHeading}</h2>
            <p className="text-executive">{i18n.coverageSub}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TOPICS.filter((t) => !["conscious_capital", "family_business", "family_office"].includes(t.id)).map((topic) => (
              <article key={topic.id} className="card">
                <h3 className="text-xl font-bold mb-2">{lang === "es" ? topic.es : topic.en}</h3>
                <p className="text-[var(--color-fg-muted)] leading-relaxed text-sm">
                  {lang === "es" ? topic.blurbEs : topic.blurbEn}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* OS sequence — scoped to business transformation */}
      <section className="border-t border-[var(--color-line)]">
        <div className="container-wide py-28 lg:py-32 grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="pill mb-4">Business Transformation OS</p>
            <h2 className="heading-section mb-4">{i18n.sequenceHeading}</h2>
            <p className="text-executive">{i18n.sequenceBody}</p>
          </div>
          <div className="lg:col-span-7 grid gap-6 sm:grid-cols-3">
            <Pillar order="1" title={i18n.pillarStrategy}  body={i18n.pillarStrategyBody} />
            <Pillar order="2" title={i18n.pillarOperating} body={i18n.pillarOperatingBody} />
            <Pillar order="3" title={i18n.pillarTech}      body={i18n.pillarTechBody} />
          </div>
        </div>
      </section>

      {/* People — always-on */}
      <section className="border-t border-[var(--color-line)]">
        <div className="container-wide py-28 lg:py-32 grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="pill mb-4">{lang === "es" ? "Personas · Siempre activo" : "People · Always-on"}</p>
            <h2 className="heading-section">{i18n.peopleHeading}</h2>
          </div>
          <p className="lg:col-span-7 text-executive text-[1.2rem] text-[var(--color-fg)]/90">
            {i18n.peopleBody}
          </p>
        </div>
      </section>

      {/* Audience + final CTA */}
      <section className="border-t border-[var(--color-line)]">
        <div className="container-wide py-28 lg:py-32 grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <h2 className="heading-section mb-5">{i18n.audienceHeading}</h2>
            <p className="text-executive">{i18n.audienceBody}</p>
          </div>
          <div className="lg:col-span-5 lg:text-right">
            {!user ? (
              <Link href="/apply" className="btn btn-cta btn-xl">{i18n.primaryCta} →</Link>
            ) : (
              <Link href="/archive" className="btn btn-cta btn-xl">{i18n.secondaryCta} →</Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function Pillar({ order, title, body }: { order: string; title: string; body: string }) {
  return (
    <div className="card">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-mono text-sm text-[var(--color-cta)]">0{order}</span>
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      <p className="text-[var(--color-fg-muted)] text-sm leading-relaxed">{body}</p>
    </div>
  );
}