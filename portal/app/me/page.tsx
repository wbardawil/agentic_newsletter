import Link from "next/link";
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";
import { topicLabel } from "@/lib/topics";

export const metadata = { title: "Member — The Transformation Letter" };

export default async function MemberHome() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/me");

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const lang = await getLangFromCookies();
  const memberLang = member?.preferred_language ?? lang;
  const i18n = t(memberLang).member;

  const { data: latest } = await supabase
    .from("editions")
    .select("edition_id, edition_number, subject_en, subject_es, topic, pillar, byline, byline_role, published_at, shareable_sentence_en, shareable_sentence_es")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: convenings } = await supabase
    .from("convenings")
    .select("id, city, starts_at, language, capacity")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(3);

  if (!member) {
    return (
      <section className="container-prose py-16">
        <h1 className="text-3xl mb-3">
          {memberLang === "es"
            ? "Tu cuenta existe, pero aún no eres miembro activo."
            : "Your account exists, but you are not an active member yet."}
        </h1>
        <p className="text-[var(--color-bronze)] mb-6">
          {memberLang === "es"
            ? "Si ya aplicaste, te avisaremos por correo cuando entres."
            : "If you have already applied, we will let you know by email once you are in."}
        </p>
        <Link href="/apply" className="btn btn-primary">
          {memberLang === "es" ? "Postular" : "Apply"}
        </Link>
      </section>
    );
  }

  return (
    <section className="container-wide py-12 grid md:grid-cols-12 gap-8">
      <div className="md:col-span-8 space-y-6">
        <header>
          <p className="pill mb-3">{i18n.welcome}</p>
          <h1 className="text-3xl font-display">{member.full_name ?? user.email}</h1>
        </header>

        {latest ? (
          <article className="card">
            <p className="text-xs text-[var(--color-bronze)] uppercase tracking-wider mb-2">
              {i18n.latestIssue} · #{latest.edition_number} · {topicLabel(latest.topic, memberLang)}
              {latest.pillar ? ` · ${latest.pillar}` : ""}
            </p>
            <h2 className="text-2xl mb-2">
              {memberLang === "es" ? latest.subject_es ?? latest.subject_en : latest.subject_en ?? latest.subject_es}
            </h2>
            {latest.byline ? (
              <p className="text-sm text-[var(--color-bronze)] mb-2">
                {memberLang === "es" ? "por" : "by"} {latest.byline}
                {latest.byline_role ? ` · ${latest.byline_role}` : ""}
              </p>
            ) : null}
            {(memberLang === "es" ? latest.shareable_sentence_es : latest.shareable_sentence_en) ? (
              <p className="pull-quote mb-3">
                {memberLang === "es" ? latest.shareable_sentence_es : latest.shareable_sentence_en}
              </p>
            ) : null}
            <Link className="btn btn-primary text-sm" href={`/archive/${latest.edition_id}`}>
              {memberLang === "es" ? "Leer la edición" : "Read the issue"} →
            </Link>
          </article>
        ) : null}

        <div className="card">
          <h3 className="text-xl mb-2">{i18n.askAssistant}</h3>
          <p className="text-[var(--color-bronze)] mb-3">
            {memberLang === "es"
              ? "Pregúntale a la IA, anclada en el archivo y el Voice Bible."
              : "Ask the Transformation AI, grounded in the archive and the Voice Bible."}
          </p>
          <Link href="/me/ask" className="btn btn-ghost text-sm">→ {i18n.askAssistant}</Link>
        </div>
      </div>

      <aside className="md:col-span-4 space-y-6">
        <div className="card">
          <h3 className="text-lg mb-3">{i18n.yourPreferences}</h3>
          <dl className="text-sm grid grid-cols-[8rem_1fr] gap-y-1">
            <dt className="text-[var(--color-bronze)]">Region</dt><dd>{member.region ?? "—"}</dd>
            <dt className="text-[var(--color-bronze)]">Industry</dt><dd>{member.industry ?? "—"}</dd>
            <dt className="text-[var(--color-bronze)]">Role</dt><dd>{member.role ?? "—"}</dd>
            <dt className="text-[var(--color-bronze)]">Language</dt><dd>{member.preferred_language}</dd>
            <dt className="text-[var(--color-bronze)]">Topics</dt>
            <dd>
              {(member.topics_of_interest ?? []).length > 0
                ? (member.topics_of_interest ?? []).map((id) => topicLabel(id, memberLang)).join(", ")
                : "—"}
            </dd>
          </dl>
          <Link className="text-sm mt-3 inline-block" href="/me/preferences">Edit →</Link>
        </div>

        <div className="card">
          <h3 className="text-lg mb-3">{i18n.upcomingConvenings}</h3>
          {(convenings ?? []).length === 0 ? (
            <p className="text-sm text-[var(--color-bronze)]">{i18n.noUpcoming}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {(convenings ?? []).map((c) => (
                <li key={c.id}>
                  <div className="font-display text-lg">{c.city}</div>
                  <div className="text-[var(--color-bronze)]">
                    {new Date(c.starts_at).toLocaleDateString(memberLang === "es" ? "es-MX" : "en-US", {
                      month: "long", day: "numeric", year: "numeric",
                    })}
                    {" · "} {c.language.toUpperCase()}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link className="text-sm mt-3 inline-block" href="/convenings">All convenings →</Link>
        </div>

        <form action="/auth/sign-out" method="post">
          <button type="submit" className="text-sm text-[var(--color-bronze)] underline">
            {t(memberLang).nav.signOut}
          </button>
        </form>
      </aside>
    </section>
  );
}
