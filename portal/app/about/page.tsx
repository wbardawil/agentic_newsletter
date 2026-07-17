import Link from "next/link";

import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "About — Wadi Bardawil · The Transformation Letter",
  description:
    "Wadi Bardawil — Business Transformation Architect. The publisher behind The Transformation Letter.",
};

export default async function AboutPage() {
  const lang = await getLangFromCookies();
  const i18n = t(lang).about;
  const landing = t(lang).landing;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

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
                <a className="nav-link" href="mailto:wb@wadibardawil.com">
                  wb@wadibardawil.com
                </a>
              </li>
              <li>
                <a className="nav-link" href="https://www.linkedin.com/in/wadibardawil/" target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
              </li>
              <li>
                <a className="nav-link" href="https://www.instagram.com/wbardawil/" target="_blank" rel="noreferrer">
                  Instagram
                </a>
              </li>
              <li>
                <a className="nav-link" href="https://www.facebook.com/profile.php?id=61583226644816" target="_blank" rel="noreferrer">
                  Facebook
                </a>
              </li>
              <li>
                <a className="nav-link" href="https://wadibardawil.com" target="_blank" rel="noreferrer">
                  www.wadibardawil.com
                </a>
              </li>
              <li className="text-[var(--color-fg-muted)]">
                Monterrey, Mexico · {lang === "es" ? "Atendiendo México y EE.UU." : "Serving Mexico & United States"}
              </li>
            </ul>
          </div>

          {!user ? (
            <Link href="/apply" className="btn btn-cta btn-md w-full justify-center">
              {landing.primaryCta} →
            </Link>
          ) : null}
        </aside>
      </section>
    </>
  );
}
