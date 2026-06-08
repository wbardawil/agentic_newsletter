import Link from "next/link";
import type { Route } from "next";

import type { Lang } from "@/lib/i18n/dictionary";
import { TOPICS } from "@/lib/topics";

/**
 * Newsroom-local channel filter (NOT the global SiteHeader). Renders one chip
 * per topic plus an "All" reset. Active channel is highlighted with the brand
 * CTA color — the same active idiom as LangToggle.
 */
export function ChannelBar({
  active,
  lang,
  allLabel,
}: {
  active?: string;
  lang: Lang;
  allLabel: string;
}) {
  return (
    <nav
      aria-label={lang === "es" ? "Canales" : "Channels"}
      className="border-b border-[var(--color-line)]"
    >
      <div className="container-wide py-4 flex flex-wrap gap-2">
        <ChannelChip href="/" label={allLabel} active={!active} />
        {TOPICS.map((topic) => (
          <ChannelChip
            key={topic.id}
            href={`/?topic=${topic.id}` as Route}
            label={lang === "es" ? topic.es : topic.en}
            active={active === topic.id}
          />
        ))}
      </div>
    </nav>
  );
}

function ChannelChip({
  href,
  label,
  active,
}: {
  href: Route;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
        active
          ? "bg-[var(--color-cta)] text-white"
          : "text-[var(--color-fg-muted)] border border-[var(--color-line)] hover:text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
      }`}
    >
      {label}
    </Link>
  );
}
