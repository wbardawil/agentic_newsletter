import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";

import { AskClient } from "./client";

export const metadata = { title: "Ask — The Transformation Letter" };

export default async function AskPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/me/ask");

  const { data: memberData } = await supabase
    .from("members")
    .select("preferred_language, status")
    .eq("id", user.id)
    .maybeSingle();
  const member = memberData as Pick<Database["public"]["Tables"]["members"]["Row"], "preferred_language" | "status"> | null;

  if (!member || member.status !== "active") redirect("/me");

  const cookieLang = await getLangFromCookies();
  const lang = member.preferred_language ?? cookieLang;
  const i18n = t(lang).ask;

  return (
    <section className="container-prose py-12">
      <header className="mb-6">
        <h1 className="text-3xl mb-2">{i18n.title}</h1>
        <p className="text-[var(--color-fg-muted)]">{i18n.sub}</p>
      </header>
      <AskClient lang={lang} />
    </section>
  );
}
