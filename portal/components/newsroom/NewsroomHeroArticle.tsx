import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";

import type { Dict, Lang } from "@/lib/i18n/dictionary";
import { topicLabel } from "@/lib/topics";

import { itemDate, itemExcerpt, itemTitle, type NewsroomItem } from "./types";

export function NewsroomHeroArticle({
  item,
  lang,
  labels,
}: {
  item: NewsroomItem;
  lang: Lang;
  labels: Dict["newsroom"];
}) {
  const title = itemTitle(item, lang);
  const excerpt = itemExcerpt(item, lang);
  const date = itemDate(item, lang);
  const href = `/newsroom/${item.edition_id}` as Route;

  return (
    <section className="border-b border-[var(--color-line)]">
      <div className="container-wide py-14 lg:py-16 max-w-4xl">
        {item.hero_image_url ? (
          <Link href={href} className="relative mb-8 block aspect-[16/9] overflow-hidden rounded-lg">
            <Image
              src={item.hero_image_url}
              alt={title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
            />
          </Link>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="pill">{topicLabel(item.topic, lang)}</span>
          <span className="text-sm text-[var(--color-fg-muted)]">
            #{item.edition_number}
          </span>
        </div>

        <Link href={href} className="no-underline">
          <h2 className="heading-display mb-5 hover:text-[var(--color-cta)] transition-colors">
            {title}
          </h2>
        </Link>

        {excerpt ? (
          <p className="pull-quote mb-6">{excerpt}</p>
        ) : null}

        <div className="mb-7 flex flex-wrap items-center gap-2 text-sm text-[var(--color-fg-muted)]">
          {item.byline ? (
            <span>{lang === "es" ? "Por" : "By"} {item.byline}</span>
          ) : null}
          {item.byline_role ? <span>·</span> : null}
          {item.byline_role ? <span>{item.byline_role}</span> : null}
          {date ? <span>·</span> : null}
          {date ? <span>{date}</span> : null}
        </div>

        <Link href={href} className="btn btn-cta btn-md">{labels.readMore}</Link>
      </div>
    </section>
  );
}
