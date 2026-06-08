import Link from "next/link";

import { t, type Lang } from "@/lib/i18n/dictionary";

/**
 * Condensed conversion block that preserves the /apply funnel below the feed.
 * Reuses the existing landing copy (audienceHeading/Body/primaryCta) — no new
 * i18n keys.
 */
export function ApplyCta({ lang }: { lang: Lang }) {
  const i18n = t(lang).landing;

  return (
    <section className="border-t border-[var(--color-line)]">
      <div className="container-wide py-16 lg:py-20 grid gap-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-8">
          <h2 className="heading-section mb-4">{i18n.audienceHeading}</h2>
          <p className="text-executive">{i18n.audienceBody}</p>
        </div>
        <div className="lg:col-span-4 lg:text-right">
          <Link href="/apply" className="btn btn-cta btn-xl">
            {i18n.primaryCta} →
          </Link>
        </div>
      </div>
    </section>
  );
}
