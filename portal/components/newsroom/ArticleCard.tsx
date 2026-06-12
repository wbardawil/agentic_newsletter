import Link from "next/link";
import Image from "next/image";

import type { Lang } from "@/lib/i18n/dictionary";
import { topicLabel } from "@/lib/topics";

import { type NewsroomItem, itemTitle, itemExcerpt, itemDate } from "./types";

/**
 * A single feed card. Text-first; a thumbnail is shown only when the edition
 * has a hero image (seed editions have none → text-only, never a broken image).
 */
export function ArticleCard({ item, lang }: { item: NewsroomItem; lang: Lang }) {
  const href = `/edition/${item.edition_id}` as const;
  const title = itemTitle(item, lang);
  const excerpt = itemExcerpt(item, lang);
  const date = itemDate(item, lang);

  return (
    <article className="card flex flex-col gap-3">
      {item.hero_image_url ? (
        <Link href={href} className="relative block aspect-[16/9] overflow-hidden rounded-[var(--radius)]">
          <Image
            src={item.hero_image_url}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        </Link>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-fg-muted)]">
        <span className="pill">{topicLabel(item.topic, lang)}</span>
        {item.pillar ? <span>{item.pillar}</span> : null}
      </div>

      <Link
        href={href}
        className="text-lg font-bold leading-snug text-[var(--color-fg)] no-underline hover:text-[var(--color-cta)]"
      >
        {title}
      </Link>

      {excerpt ? (
        <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">{excerpt}</p>
      ) : null}

      <p className="mt-auto pt-1 text-xs text-[var(--color-fg-muted)]">
        {item.byline ? (
          <>
            {lang === "es" ? "por" : "by"} {item.byline}
            {item.byline_role ? `, ${item.byline_role}` : ""}
            {date ? " · " : ""}
          </>
        ) : null}
        {date}
      </p>
    </article>
  );
}
