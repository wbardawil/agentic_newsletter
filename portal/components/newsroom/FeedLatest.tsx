import Link from "next/link";

import type { Lang, Dict } from "@/lib/i18n/dictionary";

import { ArticleCard } from "./ArticleCard";
import type { NewsroomItem } from "./types";

/**
 * The "Latest issues" grid. When a channel filter yields no rows, shows a muted
 * empty-channel line plus an "All" reset link.
 */
export function FeedLatest({
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
    <section className="container-wide py-12 border-t border-[var(--color-line)]">
      <h2 className="heading-section mb-8">{labels.latest}</h2>

      {items.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ArticleCard key={item.edition_id} item={item} lang={lang} />
          ))}
        </div>
      ) : (
        <div className="text-[var(--color-fg-muted)]">
          <p className="text-executive mb-3">
            {channelFiltered ? labels.emptyChannel : labels.empty}
          </p>
          {channelFiltered ? (
            <Link href="/" className="btn btn-ghost btn-sm">
              {labels.resetChannel}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
