import Link from "next/link";
import type { Route } from "next";

import type { Dict, Lang } from "@/lib/i18n/dictionary";

import { NewsroomArticleCard } from "./NewsroomArticleCard";
import type { NewsroomItem } from "./types";

export function NewsroomFeedLatest({
  items,
  lang,
  labels,
  channelFiltered,
}: {
  items: NewsroomItem[];
  lang: Lang;
  labels: Dict["newsroom"];
  channelFiltered: boolean;
}) {
  return (
    <section className="border-t border-[var(--color-line)]">
      <div className="container-wide py-14 lg:py-16">
        <h2 className="heading-section mb-8">{labels.latest}</h2>
        {items.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <NewsroomArticleCard key={item.edition_id} item={item} lang={lang} />
            ))}
          </div>
        ) : (
          <div className="card text-[var(--color-fg-muted)]">
            <p>{channelFiltered ? labels.emptyChannel : labels.empty}</p>
            {channelFiltered ? (
              <Link href={"/newsroom" as Route} className="btn btn-ghost btn-sm mt-5">
                {labels.resetChannel}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
