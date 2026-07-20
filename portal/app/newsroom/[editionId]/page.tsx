import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { NewsroomChannelBar } from "@/components/newsroom/NewsroomChannelBar";
import { itemDate, itemExcerpt, itemTitle, NEWSROOM_SELECT, type NewsroomItem } from "@/components/newsroom/types";
import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { parseNewsletterBody } from "@/lib/markdown";

import { NewsletterMasthead } from "@/components/newsletter/NewsletterMasthead";
import { NewsletterLeadCallout } from "@/components/newsletter/NewsletterLeadCallout";
import { NewsletterStoryCard } from "@/components/newsletter/NewsletterStoryCard";
import { NewsletterFooter } from "@/components/newsletter/NewsletterFooter";

type FullEdition = {
  body_es?: string | null;
  body_en?: string | null;
  pillar?: string | null;
  quarterly_theme?: string | null;
  byline?: string | null;
  byline_role?: string | null;
};

export default async function NewsroomEditionPage({ params }: { params: Promise<{ editionId: string }> }) {
  const { editionId } = await params;
  const lang = await getLangFromCookies();
  const labels = t(lang).newsroom;

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("editions_public").select(NEWSROOM_SELECT).eq("edition_id", editionId).maybeSingle();
  if (!data) notFound();

  const item = data as NewsroomItem;
  const title = itemTitle(item, lang);
  const excerpt = itemExcerpt(item, lang);
  const date = itemDate(item, lang);

  // Check user session and get full premium body if member/admin
  const { data: { user } } = await supabase.auth.getUser();
  let full: FullEdition | null = null;
  let body: string | null = null;

  if (user) {
    const { data: fullData } = await supabase
      .from("editions")
      .select("body_es, body_en, pillar, quarterly_theme, byline, byline_role")
      .eq("edition_id", editionId)
      .eq("is_published", true)
      .maybeSingle();
    full = fullData as FullEdition | null;
    if (full) {
      body = lang === "es" ? (full.body_es ?? full.body_en ?? null) : (full.body_en ?? full.body_es ?? null);
    }
  }

  return (
    <>
      <NewsroomChannelBar active={item.topic} lang={lang} allLabel={labels.allChannels} />
      
      {body ? (
        // Premium members-only view
        (() => {
          const { leadHtml, sections } = parseNewsletterBody(body, lang);
          return (
            <article className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-3.5 md:px-6 lg:px-10 py-7 md:py-9 lg:py-12">
              {/* 1. Header Masthead Nameplate */}
              <NewsletterMasthead
                editionNumber={item.edition_number}
                lang={lang}
                publishedAt={item.published_at ?? ""}
                subject={title}
                byline={item.byline ?? undefined}
                bylineRole={item.byline_role ?? undefined}
              />

              {/* 2. Hero Image (Optional) */}
              {item.hero_image_url ? (
                <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-xl border border-[var(--color-line)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.hero_image_url}
                    alt={title}
                    className="object-cover w-full h-full select-none"
                  />
                </div>
              ) : null}

              {/* 3. Lead Insight Callout block */}
              {leadHtml ? (
                <NewsletterLeadCallout htmlContent={leadHtml} />
              ) : null}

              {/* 4. Render segmented story cards, falling back gracefully to a single card if none found */}
              {sections.length > 0 ? (
                <div className="space-y-4">
                  {sections.map((section, idx) => (
                    <NewsletterStoryCard
                      key={`${section.title}-${idx}`}
                      title={section.title}
                      htmlContent={section.contentHtml}
                    />
                  ))}
                </div>
              ) : (
                // Backward-compatibility: Render as a single styled story container if no '##' headings exist
                leadHtml && (
                  <NewsletterStoryCard
                    title={lang === "es" ? "ANÁLISIS" : "ANALYSIS"}
                    htmlContent={leadHtml}
                  />
                )
              )}

              {/* 5. Cohesive Issue-Specific Footer Signature */}
              <NewsletterFooter
                editionNumber={item.edition_number}
                lang={lang}
                publishedAt={item.published_at ?? ""}
                byline={item.byline ?? undefined}
                bylineRole={item.byline_role ?? undefined}
                pillar={item.pillar ?? undefined}
                quarterlyTheme={full?.quarterly_theme ?? undefined}
              />
            </article>
          );
        })()
      ) : (
        // Public/Locked teaser view
        <article className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-3.5 md:px-6 lg:px-10 py-7 md:py-9 lg:py-12">
          {/* 1. Header Masthead Nameplate */}
          <NewsletterMasthead
            editionNumber={item.edition_number}
            lang={lang}
            publishedAt={item.published_at ?? ""}
            subject={title}
            byline={item.byline ?? undefined}
            bylineRole={item.byline_role ?? undefined}
          />

          {/* 2. Hero Image (Optional) */}
          {item.hero_image_url ? (
            <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-xl border border-[var(--color-line)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.hero_image_url}
                alt={title}
                className="object-cover w-full h-full select-none"
              />
            </div>
          ) : null}

          {/* 3. Render excerpt as a beautiful preview story card */}
          {excerpt ? (
            <NewsletterStoryCard
              title={lang === "es" ? "SÍNTESIS DEL DIRECTOR" : "EXECUTIVE SUMMARY"}
              htmlContent={`<p className="leading-relaxed font-semibold">${excerpt}</p>`}
            />
          ) : null}

          {/* 4. Styled lock block as a clean story card segment */}
          <section className="bg-[var(--color-surface)] border border-[var(--color-line)] rounded-2xl p-[1.5rem_1.4rem_1.4rem] md:p-[2rem_2.6rem_2rem] my-[1.15rem] mx-0 space-y-4">
            <h2 className="text-xl font-bold text-[var(--color-fg)]">
              {lang === "es" ? "Análisis completo" : "Full analysis"}
            </h2>
            <p className="text-[var(--color-fg-muted)] leading-relaxed">
              {user
                ? lang === "es"
                  ? "Tu membresía aún no está activa. En cuanto se apruebe, tendrás acceso completo al archivo bilingüe."
                  : "Your membership isn't active yet. Once approved, you'll get full access to the bilingual archive."
                : lang === "es"
                  ? "El análisis completo en EN/ES es para miembros. Aplica para acceder al archivo, o inicia sesión si ya eres miembro."
                  : "The full EN/ES analysis is for members. Apply for access to the archive, or sign in if you're already a member."}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {user ? (
                <Link href={"/me" as Route} className="btn btn-cta btn-md">
                  {lang === "es" ? "Ir a mi cuenta" : "Go to my account"} →
                </Link>
              ) : (
                <>
                  <Link href={"/apply" as Route} className="btn btn-cta btn-md">
                    {lang === "es" ? "Unirme" : "Apply"} →
                  </Link>
                  <Link href={`/sign-in?next=/newsroom/${editionId}` as Route} className="btn btn-cta-outline btn-md">
                    {lang === "es" ? "Iniciar sesión" : "Sign in"}
                  </Link>
                </>
              )}
            </div>
          </section>

          {/* 5. Clean preview-oriented footer */}
          <NewsletterFooter
            editionNumber={item.edition_number}
            lang={lang}
            publishedAt={item.published_at ?? ""}
            byline={item.byline ?? undefined}
            bylineRole={item.byline_role ?? undefined}
            pillar={item.pillar ?? undefined}
          />
        </article>
      )}
    </>
  );
}
