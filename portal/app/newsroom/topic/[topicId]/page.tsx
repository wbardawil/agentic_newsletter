import { notFound } from "next/navigation";

import { NewsroomApplyCta } from "@/components/newsroom/NewsroomApplyCta";
import { NewsroomChannelBar } from "@/components/newsroom/NewsroomChannelBar";
import { NewsroomFeedLatest } from "@/components/newsroom/NewsroomFeedLatest";
import { NewsroomHeader } from "@/components/newsroom/NewsroomHeader";
import { NewsroomHeroArticle } from "@/components/newsroom/NewsroomHeroArticle";
import { NEWSROOM_SELECT, type NewsroomItem } from "@/components/newsroom/types";
import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { TOPIC_IDS } from "@/lib/topics";

export default async function NewsroomTopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;
  if (!(TOPIC_IDS as readonly string[]).includes(topicId)) notFound();

  const lang = await getLangFromCookies();
  const labels = t(lang).newsroom;
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("editions_public")
    .select(NEWSROOM_SELECT)
    .eq("topic", topicId)
    .order("published_at", { ascending: false })
    .limit(13);

  const items = (data as NewsroomItem[] | null) ?? [];
  const [hero, ...latest] = items;

  return (
    <>
      <NewsroomChannelBar active={topicId} lang={lang} allLabel={labels.allChannels} />
      <NewsroomHeader lang={lang} />
      {hero ? (
        <>
          <NewsroomHeroArticle item={hero} lang={lang} labels={labels} />
          <NewsroomFeedLatest items={latest} lang={lang} labels={labels} channelFiltered />
        </>
      ) : (
        <NewsroomFeedLatest items={[]} lang={lang} labels={labels} channelFiltered />
      )}
      <NewsroomApplyCta lang={lang} />
    </>
  );
}