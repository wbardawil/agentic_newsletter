import Link from "next/link";

import { t, type Lang } from "@/lib/i18n/dictionary";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import { LangToggle } from "@/components/LangToggle";

export async function SiteHeader({ lang }: { lang: Lang }) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const i18n = t(lang);

  let isAdmin = false;
  if (user) {
    const { data } = await supabase
      .from("members")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = data?.is_admin === true;
  }

  return (
    <header className="border-b border-[var(--color-line)]">
      <div className="container-wide flex items-center justify-between gap-6 py-5">
        <Link href="/" className="font-display text-[1.35rem] leading-none text-[var(--color-ink)] no-underline">
          The Transformation Letter
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/archive">{i18n.nav.archive}</Link>
          <Link href="/convenings">{i18n.nav.convenings}</Link>
          {user ? <Link href="/me/ask">{i18n.nav.ask}</Link> : null}
          {isAdmin ? <Link href="/admin/applications">Admin</Link> : null}
        </nav>

        <div className="flex items-center gap-3">
          <LangToggle current={lang} />
          {user ? (
            <Link href="/me" className="btn btn-ghost text-sm">
              {i18n.nav.account}
            </Link>
          ) : (
            <>
              <Link href="/sign-in" className="text-sm">{i18n.nav.signIn}</Link>
              <Link href="/apply" className="btn btn-primary text-sm">{i18n.nav.apply}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
