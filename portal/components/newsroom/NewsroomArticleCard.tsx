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
    <article className="card flex h-full flex-col">
      {item.hero_image_url ? (
        <Link href={href} className="relative mb-4 block h-32 w-full overflow-hidden rounded-md">
          <Image
            src={item.hero_image_url}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </Link>
      ) : null}

      <div className="mb-3">
        <span className="pill">{topicLabel(item.topic, lang)}</span>
      </div>

      <Link href={href} className="no-underline">
        <h3 className="text-lg font-bold leading-snug mb-3 text-[var(--color-fg)] hover:text-[var(--color-cta)] transition-colors">
          {title}
        </h3>
      </Link>

      {excerpt ? (
        <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-[var(--color-fg-muted)]">
          {excerpt}
        </p>
      ) : null}

      <div className="mt-auto text-xs text-[var(--color-fg-muted)] leading-relaxed">
        {item.byline ? (
          <p>{item.byline}{item.byline_role ? `, ${item.byline_role}` : ""}</p>
        ) : null}
        {date ? <p>{date}</p> : null}
      </div>
    </article>
  );
}
