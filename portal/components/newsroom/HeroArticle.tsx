import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";

import type { Lang, Dict } from "@/lib/i18n/dictionary";
import { topicLabel } from "@/lib/topics";

import { type NewsroomItem, itemTitle, itemExcerpt, itemDate } from "./types";

/**
 * The featured (most recent) edition, rendered large. Image-forward when the
 * edition has a hero image; otherwise a typographic hero. Never a broken image.
 */
export function HeroArticle({
  item,
  lang,
  labels,
}: {
  item: NewsroomItem;
  lang: Lang;
  labels: Dict["newsroom"];
}) {
  const href = `/edition/${item.edition_id}` as Route;
  const title = itemTitle(item, lang);
  const excerpt = itemExcerpt(item, lang);
  const date = itemDate(item, lang);

  return (
    <section className="container-wide py-12 lg:py-16">
      <p className="pill mb-5">{labels.featured}</p>

      <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
        {item.hero_image_url ? (
          <Link
            href={href}
            className="lg:col-span-7 relative block aspect-[16/9] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)]"
          >
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

        <div className={item.hero_image_url ? "lg:col-span-5" : "lg:col-span-9"}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-fg-muted)] mb-3">
            <span className="pill">{topicLabel(item.topic, lang)}</span>
            {item.pillar ? <span>{item.pillar}</span> : null}
            <span>·</span>
            <span>#{item.edition_number}</span>
          </div>

          <Link href={href} className="no-underline">
            <h2 className="heading-display mb-4 hover:text-[var(--color-cta)] transition-colors">
              {title}
            </h2>
          </Link>

          {excerpt ? <p className="pull-quote mb-6">{excerpt}</p> : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-fg-muted)] mb-6">
            {item.byline ? (
              <span>
                {lang === "es" ? "por" : "by"}{" "}
                <span className="text-[var(--color-fg)]">{item.byline}</span>
                {item.byline_role ? ` · ${item.byline_role}` : ""}
              </span>
            ) : null}
            {date ? <span>{date}</span> : null}
          </div>

          <Link href={href} className="btn btn-cta btn-md">
            {labels.readMore} →
          </Link>
        </div>
      </div>
    </section>
  );
}
