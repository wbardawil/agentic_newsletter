import Link from "next/link";

import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { TOPICS, topicLabel } from "@/lib/topics";

export default async function HomePage() {
  const lang = await getLangFromCookies();
  const i18n = t(lang).landing;

  const supabase = await getSupabaseServerClient();
  const { data: latest } = await supabase
    .from("editions")
    .select("edition_id, edition_number, subject_en, subject_es, shareable_sentence_en, shareable_sentence_es, topic, pillar, byline, byline_role, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(3);

  return (
    <>
      <section className="container-wide py-20 grid md:grid-cols-12 gap-10 items-start">
        <div className="md:col-span-7">
          <p className="pill mb-6">EN / ES · Weekly · Members only</p>
          <h1 className="text-5xl md:text-6xl leading-[1.05] mb-6">
            {i18n.hero}
          </h1>
          <p className="pull-quote mb-8">{i18n.filterSentence}</p>
          <p className="text-[var(--color-bronze)] max-w-prose mb-8">{i18n.subFilter}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/apply" className="btn btn-primary">{i18n.primaryCta} →</Link>
            <Link href="/archive" className="btn btn-ghost">{i18n.secondaryCta}</Link>
          </div>
        </div>

        <aside className="md:col-span-5 md:pl-6 md:border-l md:border-[var(--color-line)]">
          <h3 className="text-xl mb-4">{lang === "es" ? "Ediciones recientes" : "Recent issues"}</h3>
          <ul className="space-y-5">
            {(latest ?? []).map((e) => (
              <li key={e.edition_id} className="text-sm">
                <div className="text-[var(--color-bronze)] uppercase tracking-wider text-xs mb-1">
                  #{e.edition_number} · {topicLabel(e.topic, lang)}{e.pillar ? ` · ${e.pillar}` : ""}
                </div>
                <div className="text-[var(--color-ink)] font-display text-lg leading-snug">
                  {lang === "es" ? e.subject_es ?? e.subject_en : e.subject_en ?? e.subject_es}
                </div>
                {e.byline ? (
                  <div className="text-xs text-[var(--color-bronze)] mt-1">
                    {lang === "es" ? "por" : "by"} {e.byline}{e.byline_role ? ` · ${e.byline_role}` : ""}
                  </div>
                ) : null}
                {(lang === "es" ? e.shareable_sentence_es : e.shareable_sentence_en) ? (
                  <p className="mt-1 text-[var(--color-bronze)]">
                    {lang === "es" ? e.shareable_sentence_es : e.shareable_sentence_en}
                  </p>
                ) : null}
              </li>
            ))}
            {(!latest || latest.length === 0) ? (
              <li className="text-sm text-[var(--color-bronze)]">
                {lang === "es" ? "Próxima edición en camino." : "First issue on the way."}
              </li>
            ) : null}
          </ul>
        </aside>
      </section>

      <section className="container-wide py-16 border-t border-[var(--color-line)]">
        <header className="mb-10 max-w-3xl">
          <h2 className="text-3xl mb-3">{i18n.coverageHeading}</h2>
          <p className="text-[var(--color-bronze)]">{i18n.coverageSub}</p>
        </header>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOPICS.map((topic) => (
            <article key={topic.id} className="card">
              <h3 className="text-xl mb-2">{lang === "es" ? topic.es : topic.en}</h3>
              <p className="text-[var(--color-bronze)]">
                {lang === "es" ? topic.blurbEs : topic.blurbEn}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-wide py-16 border-t border-[var(--color-line)] grid md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <p className="pill mb-3">Business Transformation OS</p>
          <h2 className="text-3xl mb-3">{i18n.sequenceHeading}</h2>
          <p className="text-[var(--color-bronze)]">{i18n.sequenceBody}</p>
        </div>
        <div className="md:col-span-7 grid sm:grid-cols-3 gap-6">
          <Pillar order="1" title={i18n.pillarStrategy}  body={i18n.pillarStrategyBody} />
          <Pillar order="2" title={i18n.pillarOperating} body={i18n.pillarOperatingBody} />
          <Pillar order="3" title={i18n.pillarTech}      body={i18n.pillarTechBody} />
        </div>
      </section>

      <section className="container-wide py-16 border-t border-[var(--color-line)] grid md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <p className="pill mb-4">People · Always-on</p>
          <h2 className="text-3xl">{i18n.peopleHeading}</h2>
        </div>
        <p className="md:col-span-7 text-lg leading-relaxed text-[var(--color-ink)]/85">
          {i18n.peopleBody}
        </p>
      </section>

      <section className="container-wide py-16 border-t border-[var(--color-line)] grid md:grid-cols-12 gap-10 items-center">
        <div className="md:col-span-7">
          <h2 className="text-3xl mb-4">{i18n.audienceHeading}</h2>
          <p className="text-[var(--color-bronze)] text-lg">{i18n.audienceBody}</p>
        </div>
        <div className="md:col-span-5 md:text-right">
          <Link href="/apply" className="btn btn-primary">{i18n.primaryCta} →</Link>
        </div>
      </section>
    </>
  );
}

function Pillar({ order, title, body }: { order: string; title: string; body: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-mono text-sm text-[var(--color-ochre)]">0{order}</span>
        <h3 className="text-xl">{title}</h3>
      </div>
      <p className="text-[var(--color-bronze)] text-sm">{body}</p>
    </div>
  );
}
