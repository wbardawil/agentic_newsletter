import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getLangFromCookies } from "@/lib/i18n/server";
import { parseNewsletterBody } from "@/lib/markdown";

import { NewsletterMasthead } from "@/components/newsletter/NewsletterMasthead";
import { NewsletterLeadCallout } from "@/components/newsletter/NewsletterLeadCallout";
import { NewsletterStoryCard } from "@/components/newsletter/NewsletterStoryCard";
import { NewsletterFooter } from "@/components/newsletter/NewsletterFooter";

export default async function EditionPage({
  params,
  searchParams,
}: {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { editionId } = await params;
  const { lang: overrideLang } = await searchParams;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/archive/${editionId}`);

  const { data: editionData } = await supabase
    .from("editions")
    .select("*")
    .eq("edition_id", editionId)
    .eq("is_published", true)
    .maybeSingle();
  const edition = editionData as Database["public"]["Tables"]["editions"]["Row"] | null;

  if (!edition) notFound();

  const cookieLang = await getLangFromCookies();
  const lang = overrideLang === "es" ? "es" : overrideLang === "en" ? "en" : cookieLang;
  const subject = lang === "es" ? edition.subject_es ?? edition.subject_en : edition.subject_en ?? edition.subject_es;
  const body = lang === "es" ? edition.body_es ?? edition.body_en : edition.body_en ?? edition.body_es;

  // Split and compile markdown sections using our high-fidelity parser helper
  const { leadHtml, sections } = parseNewsletterBody(body ?? "", lang);

  return (
    // Body Width limits match the template specs: max-w-[640px] climbing to max-w-[920px] dynamically
    <article className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-3.5 md:px-6 lg:px-10 py-7 md:py-9 lg:py-12">
      
      {/* 1. Header Masthead Nameplate */}
      <NewsletterMasthead
        editionNumber={edition.edition_number}
        lang={lang}
        publishedAt={edition.published_at ?? ""}
        subject={subject ?? ""}
        byline={edition.byline ?? undefined}
        bylineRole={edition.byline_role ?? undefined}
      />

      {/* 3. Hero Image (Optional) */}
      {edition.hero_image_url ? (
        <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-xl border border-[var(--color-line)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={edition.hero_image_url}
            alt={subject ?? undefined}
            className="object-cover w-full h-full select-none"
          />
        </div>
      ) : null}

      {/* 4. Lead Insight Callout block */}
      {leadHtml ? (
        <NewsletterLeadCallout htmlContent={leadHtml} />
      ) : null}

      {/* 5. Render segmented story cards, falling back gracefully to a single card if none found */}
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

      {/* 6. Cohesive Issue-Specific Footer Signature */}
      <NewsletterFooter
        editionNumber={edition.edition_number}
        lang={lang}
        publishedAt={edition.published_at ?? ""}
        byline={edition.byline ?? undefined}
        bylineRole={edition.byline_role ?? undefined}
        pillar={edition.pillar ?? undefined}
        quarterlyTheme={edition.quarterly_theme ?? undefined}
      />

    </article>
  );
}
