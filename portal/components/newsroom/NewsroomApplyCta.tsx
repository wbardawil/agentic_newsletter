import Link from "next/link";
import type { Route } from "next";

import { t, type Lang } from "@/lib/i18n/dictionary";

export function NewsroomApplyCta({ lang }: { lang: Lang }) {
  const labels = t(lang).landing;

  return (
    <section className="newsroom-section border-t border-[var(--color-newsroom-border)] bg-white">
      <div className="container-wide grid gap-8 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-8">
          <h2 className="newsroom-heading-section mb-4 text-[var(--color-newsroom-terracotta)]">{labels.audienceHeading}</h2>
          <p className="max-w-3xl text-lg leading-relaxed text-[var(--color-newsroom-muted)]">{labels.audienceBody}</p>
        </div>
        <div className="lg:col-span-4 lg:text-right">
          <Link href={"/apply" as Route} className="btn btn-xl newsroom-cta">{labels.primaryCta}</Link>
        </div>
      </div>
    </section>
  );
}
