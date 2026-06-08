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
          <div className="rounded-lg border border-[var(--color-newsroom-border)] bg-white p-6">
            <p className="mb-5 text-lg leading-relaxed text-[var(--color-newsroom-dark)]">{labels.byMembers}</p>
            <Link href={"/apply" as Route} className="btn btn-md newsroom-cta">{t(lang).landing.primaryCta}</Link>
          </div>
        </div>
      </article>
    </>
  );
}