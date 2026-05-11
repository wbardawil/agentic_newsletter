import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";

import { PreferencesForm } from "./form";

export const metadata = { title: "Preferences — The Transformation Letter" };

export default async function PreferencesPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/me/preferences");

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!member) redirect("/me");

  const lang = await getLangFromCookies();
  const i18n = t(member.preferred_language ?? lang).preferences;

  return (
    <section className="container-prose py-12">
      <h1 className="text-3xl mb-2">{i18n.title}</h1>
      <p className="text-[var(--color-fg-muted)] mb-8">{i18n.sub}</p>
      <PreferencesForm
        lang={member.preferred_language ?? lang}
        initial={{
          preferred_language: member.preferred_language ?? "en",
          region: member.region,
          industry: member.industry,
          role: member.role,
          topics_of_interest: member.topics_of_interest ?? [],
        }}
      />
    </section>
  );
}
