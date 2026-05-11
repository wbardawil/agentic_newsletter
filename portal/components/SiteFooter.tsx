import Link from "next/link";

import type { Lang } from "@/lib/i18n/dictionary";
import { t } from "@/lib/i18n/dictionary";

export function SiteFooter({ lang }: { lang: Lang }) {
  const i18n = t(lang);
  return (
    <footer className="border-t border-[var(--color-line)] mt-24">
      <div className="container-wide py-10 flex flex-col md:flex-row gap-6 md:items-center md:justify-between text-sm text-[var(--color-bronze)]">
        <div className="font-display text-[1.05rem] text-[var(--color-ink)]">
          The Transformation Letter
        </div>
        <div>{i18n.brand.tagline}</div>
        <div className="flex gap-4">
          <Link href="/archive">{i18n.nav.archive}</Link>
          <Link href="/convenings">{i18n.nav.convenings}</Link>
          <Link href="/apply">{i18n.nav.apply}</Link>
        </div>
      </div>
    </footer>
  );
}
