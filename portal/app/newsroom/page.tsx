import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { TOPIC_IDS } from "@/lib/topics";

import { NewsroomApplyCta } from "@/components/newsroom/NewsroomApplyCta";
import { NewsroomChannelBar } from "@/components/newsroom/NewsroomChannelBar";
import { NewsroomFeedLatest } from "@/components/newsroom/NewsroomFeedLatest";
import { NewsroomHeader } from "@/components/newsroom/NewsroomHeader";
import { NewsroomHeroArticle } from "@/components/newsroom/NewsroomHeroArticle";
import { NEWSROOM_SELECT, type NewsroomItem } from "@/components/newsroom/types";

export const metadata = {
  title: "Newsroom - The Transformation Letter",
  description: "A public newsroom view for The Transformation Letter diagnostics.",
};

export default async function NewsroomPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const params = await searchParams;
  const lang = await getLangFromCookies();
  const labels = t(lang).newsroom;
  const activeTopic = params.topic && (TOPIC_IDS as readonly string[]).includes(params.topic) ? params.topic : undefined;

  const supabase = await getSupabaseServerClient();
  let query = supabase.from("editions_public").select(NEWSROOM_SELECT).order("published_at", { ascending: false }).limit(13);
  if (activeTopic) query = query.eq("topic", activeTopic);

  const { data } = await query;
  const items = (data as NewsroomItem[] | null) ?? [];
  const [hero, ...latest] = items;

  return (
    <>
      <NewsroomChannelBar active={activeTopic} lang={lang} allLabel={labels.allChannels} />
      <NewsroomHeader lang={lang} />
      {hero ? (
        <>
          <NewsroomHeroArticle item={hero} lang={lang} labels={labels} />
          <NewsroomFeedLatest items={latest} lang={lang} labels={labels} channelFiltered={Boolean(activeTopic)} />
        </>
      ) : (
        <NewsroomFeedLatest items={[]} lang={lang} labels={labels} channelFiltered={Boolean(activeTopic)} />
      )}
      <NewsroomApplyCta lang={lang} />
    </>
  );
}
