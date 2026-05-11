import Link from "next/link";

import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";

export const metadata = {
  title: "About — Wadi Bardawil · The Transformation Letter",
  description:
    "Wadi Bardawil — Business Transformation Architect. The publisher behind The Transformation Letter.",
};

export default async function AboutPage() {
  const lang = await getLangFromCookies();
  const i18n = t(lang).about;
  const landing = t(lang).landing;

  return (
    <>
      <section className="container-wide py-28 lg:py-32 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="pill mb-6">{i18n.kicker}</p>
          <h1 className="heading-display mb-6">{i18n.title}</h1>
          <p className="text-executive mb-8">{i18n.publisherTagline}</p>
          <div className="space-y-5 text-[1.05rem] leading-relaxed text-[var(--color-fg)]/90 max-w-xl">
            {i18n.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>

        <aside className="lg:col-span-5 lg:pl-8 lg:border-l lg:border-[var(--color-line)] space-y-8">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-3">
              {i18n.publisherName}
            </p>
            <p className="text-lg font-semibold leading-tight">{i18n.publisherTitlePrimary}</p>
            <p className="text-[var(--color-fg-muted)]">{i18n.publisherTitleSecondary}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-3">
              {i18n.contactHeading}
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a className="nav-link" href="mailto:wadi@wadibardawil.com">
                  wadi@wadibardawil.com
                </a>
              </li>
              <li>
                <a className="nav-link" href="https://linkedin.com/in/wadibardawil" target="_blank" rel="noreferrer">
                  linkedin.com/in/wadibardawil
                </a>
              </li>
              <li>
                <a className="nav-link" href="https://wadibardawil.com" target="_blank" rel="noreferrer">
                  wadibardawil.com
                </a>
              </li>
              <li className="text-[var(--color-fg-muted)]">
                Monterrey, Mexico · {lang === "es" ? "Atendiendo México y EE.UU." : "Serving Mexico & United States"}
              </li>
            </ul>
          </div>

          <Link href="/apply" className="btn btn-cta btn-md w-full justify-center">
            {landing.primaryCta} →
          </Link>
        </aside>
      </section>
    </>
  );
}
