import Link from "next/link";

import { t, type Lang } from "@/lib/i18n/dictionary";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

import { BrandWordmark } from "@/components/BrandWordmark";
import { LangToggle } from "@/components/LangToggle";

/**
 * Sticky header. Public pages: logo + language toggle + sticky CTA only —
 * zero exit points, per wadibardawil.com brand spec. Member-only pages
 * (caller is signed in) get a minimal nav since members need to navigate
 * within the portal.
 */
export async function SiteHeader({ lang }: { lang: Lang }) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const i18n = t(lang);

  let isAdmin = false;
  if (user) {
    const { data: memberData } = await supabase
      .from("members")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    const member = memberData as Pick<Database["public"]["Tables"]["members"]["Row"], "is_admin"> | null;
    isAdmin = member?.is_admin === true;
  }

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-bg)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-bg)]/80 border-b border-[var(--color-line)]">
      <div className="container-wide flex items-center justify-between gap-4 py-4">
        <Link href="/" className="flex items-center no-underline" aria-label="The Transformation Letter — Wadi Bardawil">
          <BrandWordmark />
        </Link>

        {user ? (
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/archive"     className="nav-link">{i18n.nav.archive}</Link>
            <Link href="/me/ask"      className="nav-link">{i18n.nav.ask}</Link>
            <Link href="/convenings"  className="nav-link">{i18n.nav.convenings}</Link>
            {isAdmin ? <Link href="/admin/applications" className="nav-link">Admin</Link> : null}
          </nav>
        ) : null}

        <div className="flex items-center gap-3">
          <LangToggle current={lang} />
          {user ? (
            <Link href="/me" className="btn btn-ghost btn-sm">{i18n.nav.account}</Link>
          ) : (
            <>
              <Link href="/sign-in" className="nav-link hidden sm:inline">{i18n.nav.signIn}</Link>
              <Link href="/apply" className="btn btn-cta btn-sm">{i18n.nav.apply}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
