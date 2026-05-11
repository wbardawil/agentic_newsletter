import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";

import { ConveningCard } from "./card";

export const metadata = { title: "Convenings — The Transformation Letter" };

export default async function ConveningsPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/convenings");

  const lang = await getLangFromCookies();
  const i18n = t(lang).convenings;

  const { data: convenings } = await supabase
    .from("convenings_with_counts")
    .select("*")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  const { data: myRsvps } = await supabase
    .from("convening_rsvps")
    .select("convening_id, status")
    .eq("member_id", user.id);

  const rsvpMap = new Map(
    (myRsvps ?? []).map((r) => [r.convening_id, r.status]),
  );

  return (
    <section className="container-wide py-12">
      <header className="mb-8">
        <h1 className="text-4xl mb-2">{i18n.title}</h1>
        <p className="text-[var(--color-fg-muted)]">{i18n.sub}</p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        {(convenings ?? []).map((c) => (
          <ConveningCard
            key={c.id}
            convening={c}
            lang={lang}
            initialStatus={rsvpMap.get(c.id) ?? null}
          />
        ))}
        {(!convenings || convenings.length === 0) ? (
          <p className="text-[var(--color-fg-muted)]">{t(lang).member.noUpcoming}</p>
        ) : null}
      </div>
    </section>
  );
}
