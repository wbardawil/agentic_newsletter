import Link from "next/link";

import type { Lang } from "@/lib/i18n/dictionary";
import { t } from "@/lib/i18n/dictionary";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function SiteFooter({ lang }: { lang: Lang }) {
  const i18n = t(lang);
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <footer className="mt-32 border-t border-[var(--color-line)] bg-[var(--color-bg)]">
      <div className="container-wide py-14 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="font-bold tracking-[0.18em] uppercase text-sm">Wadi Bardawil</p>
          <p className="text-[var(--color-fg-muted)] text-sm mt-2">
            Business Transformation Architect · Fractional Chief Strategy &amp; Technology Officer
          </p>
          <p className="text-[var(--color-fg-muted)] text-sm mt-4 max-w-md">
            {i18n.brand.tagline}
          </p>
        </div>

        <div className="md:col-span-3">
          <p className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-3">Letter</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/"           className="nav-link">{i18n.about.kicker === "El editor" ? "Letra" : "Letter"}</Link></li>
            <li><Link href="/about"      className="nav-link">{i18n.about.kicker}</Link></li>
            <li><Link href="/archive"    className="nav-link">{i18n.nav.archive}</Link></li>
            {/* <li><Link href="/convenings" className="nav-link">{i18n.nav.convenings}</Link></li> */}
            {!user ? (
              <>
                <li><Link href="/apply"      className="nav-link">{i18n.nav.apply}</Link></li>
                <li><Link href="/sign-in"    className="nav-link">{i18n.nav.signIn}</Link></li>
              </>
            ) : (
              <li><Link href="/me"         className="nav-link">{i18n.nav.account}</Link></li>
            )}
          </ul>
        </div>

        <div className="md:col-span-4">
          <p className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)] mb-3">Contact</p>
          <ul className="space-y-2 text-sm">
            <li><a href="mailto:wadi@wadibardawil.com" className="nav-link">wadi@wadibardawil.com</a></li>
            <li><a href="https://linkedin.com/in/wadibardawil" target="_blank" rel="noreferrer" className="nav-link">LinkedIn</a></li>
            <li><a href="https://wadibardawil.com" target="_blank" rel="noreferrer" className="nav-link">wadibardawil.com</a></li>
            <li className="text-[var(--color-fg-muted)]">Monterrey, Mexico · Serving Mexico &amp; United States</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--color-line)]">
        <div className="container-wide py-5 text-xs text-[var(--color-fg-muted)] flex justify-between">
          <span>© {new Date().getFullYear()} Wadi Bardawil. All rights reserved.</span>
          <span>EN · ES</span>
        </div>
      </div>
    </footer>
  );
}
