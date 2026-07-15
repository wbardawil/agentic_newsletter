import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import type { Lang } from "@/lib/i18n/dictionary";
import { topicLabel } from "@/lib/topics";

import { itemDate, itemExcerpt, itemTitle, type NewsroomItem } from "./types";

export function NewsroomArticleCard({ item, lang }: { item: NewsroomItem; lang: Lang }) {
  const title = itemTitle(item, lang);
  const excerpt = itemExcerpt(item, lang);
  const date = itemDate(item, lang);
  const href = `/newsroom/${item.edition_id}` as Route;

  return (
    <article className="newsroom-card flex h-full flex-col">
      {item.hero_image_url ? (
        <Link href={href} className="relative mb-4 block h-24 w-24 overflow-hidden rounded-md">
          <Image src={item.hero_image_url} alt={title} fill sizes="96px" className="object-cover" />
        </Link>
      ) : null}

      <div className="mb-3"><span className="newsroom-pill">{topicLabel(item.topic, lang)}</span></div>

      <Link href={href} className="no-underline">
        <h3 className="newsroom-heading-section mb-3 text-xl hover:text-[var(--color-newsroom-light-rust)]">{title}</h3>
      </Link>

      {excerpt ? <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-[var(--color-newsroom-muted)]">{excerpt}</p> : null}

      <div className="mt-auto text-xs leading-relaxed text-[var(--color-newsroom-muted)]">
        {item.byline ? <p>{item.byline}{item.byline_role ? `, ${item.byline_role}` : ""}</p> : null}
        {date ? <p>{date}</p> : null}
      </div>
    </article>
  );
}
