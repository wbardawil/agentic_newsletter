import Link from "next/link";

import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { TOPICS, TOPIC_IDS } from "@/lib/topics";

import { ChannelBar } from "@/components/newsroom/ChannelBar";
import { HeroArticle } from "@/components/newsroom/HeroArticle";
import { FeedLatest } from "@/components/newsroom/FeedLatest";
import { ApplyCta } from "@/components/newsroom/ApplyCta";
import { NEWSROOM_SELECT, type NewsroomItem } from "@/components/newsroom/types";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const lang = await getLangFromCookies();
  const i18n = t(lang);

  // Validate the channel filter against the canonical topic list (same guard as
  // /archive). Garbage values are treated as "All" — never an error.
  const activeTopic =
    params.topic && (TOPIC_IDS as string[]).includes(params.topic) ? params.topic : undefined;

  // One query against the public (body-free) view. Anon-readable under RLS.
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from("editions_public")
    .select(NEWSROOM_SELECT)
    .order("published_at", { ascending: false })
    .limit(13);
  if (activeTopic) query = query.eq("topic", activeTopic);

  const { data } = await query;
  const items = (data as NewsroomItem[] | null) ?? [];
  const [hero, ...latest] = items;

  return (
    <>
      <ChannelBar active={activeTopic} lang={lang} allLabel={i18n.newsroom.allChannels} />

      {hero ? (
        <HeroArticle item={hero} lang={lang} labels={i18n.newsroom} />
      ) : (
        <section className="container-wide py-16">
          <p className="text-executive text-[var(--color-fg-muted)]">
            {activeTopic ? i18n.newsroom.emptyChannel : i18n.newsroom.empty}
          </p>
          {activeTopic ? (
            <Link href="/" className="btn btn-ghost btn-sm mt-4">
              {i18n.newsroom.resetChannel}
            </Link>
          ) : null}
        </section>
      )}

      {hero ? (
        <FeedLatest
          items={latest}
          lang={lang}
          labels={i18n.newsroom}
          channelFiltered={Boolean(activeTopic)}
        />
      ) : null}

      {/* Condensed coverage — six topics (preserves the funnel context) */}
      <section className="border-t border-[var(--color-line)]">
        <div className="container-wide py-16 lg:py-20">
          <div className="max-w-2xl mb-10">
            <h2 className="heading-section mb-4">{i18n.landing.coverageHeading}</h2>
            <p className="text-executive">{i18n.landing.coverageSub}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TOPICS.map((topic) => (
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

      {/* Final apply CTA */}
      <ApplyCta lang={lang} />
    </>
  );
}
