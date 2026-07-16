import Link from "next/link";
import type { Route } from "next";

import { t, type Lang } from "@/lib/i18n/dictionary";

export function NewsroomApplyCta({ lang }: { lang: Lang }) {
  const labels = t(lang).landing;

  return (
    <section className="border-t border-[var(--color-line)]">
      <div className="container-wide py-14 lg:py-16 grid gap-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-8">
          <h2 className="heading-section mb-4">{labels.audienceHeading}</h2>
          <p className="text-executive text-[var(--color-fg-muted)]">{labels.audienceBody}</p>
        </div>
        <div className="lg:col-span-4 lg:text-right">
          <Link href={"/apply" as Route} className="btn btn-cta btn-xl">
            {labels.primaryCta} →
          </Link>
        </div>
      </div>
    </section>
  );
}
