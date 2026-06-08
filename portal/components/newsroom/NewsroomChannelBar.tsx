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
  const inactiveClass = "newsroom-pill newsroom-pill-outline transition-colors";
  const activeClass = "newsroom-pill transition-colors";

  return (
    <nav className="sticky top-0 z-10 border-b border-[var(--color-newsroom-border)] bg-[var(--color-newsroom-cream)]/95 backdrop-blur">
      <div className="container-wide flex gap-3 overflow-x-auto py-4">
        <Link href={"/newsroom" as Route} className={!active ? activeClass : inactiveClass} aria-current={!active ? "page" : undefined}>
          {allLabel}
        </Link>
        {TOPICS.map((topic) => {
          const isActive = active === topic.id;
          const href = `/newsroom/topic/${topic.id}` as Route;
          return (
            <Link key={topic.id} href={href} className={isActive ? activeClass : inactiveClass} aria-current={isActive ? "page" : undefined}>
              {lang === "es" ? topic.es : topic.en}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
