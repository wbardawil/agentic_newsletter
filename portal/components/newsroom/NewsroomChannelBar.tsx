import Link from "next/link";
import type { Route } from "next";

import type { Lang } from "@/lib/i18n/dictionary";
import { TOPICS } from "@/lib/topics";

export function NewsroomChannelBar({
  active,
  lang,
  allLabel,
}: {
  active?: string;
  lang: Lang;
  allLabel: string;
}) {
  const activeClass =
    "pill transition-colors";
  const inactiveClass =
    "inline-flex items-center rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-semibold leading-none text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-cta)] hover:text-[var(--color-cta)]";

  return (
    <nav className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-bg)]/95 backdrop-blur">
      <div className="container-wide flex gap-3 overflow-x-auto py-4">
        <Link
          href={"/newsroom" as Route}
          className={!active ? activeClass : inactiveClass}
          aria-current={!active ? "page" : undefined}
        >
          {allLabel}
        </Link>
        {TOPICS.filter((topic) => !["conscious_capital", "family_business", "family_office"].includes(topic.id)).map((topic) => {
          const isActive = active === topic.id;
          const href = `/newsroom/topic/${topic.id}` as Route;
          return (
            <Link
              key={topic.id}
              href={href}
              className={isActive ? activeClass : inactiveClass}
              aria-current={isActive ? "page" : undefined}
            >
              {lang === "es" ? topic.es : topic.en}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
