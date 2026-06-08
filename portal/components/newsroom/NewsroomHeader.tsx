import { t, type Lang } from "@/lib/i18n/dictionary";

export function NewsroomHeader({ lang }: { lang: Lang }) {
  const labels = t(lang).newsroom;

  return (
    <section className="newsroom-section border-b border-[var(--color-newsroom-border)]">
      <div className="mx-auto max-w-2xl px-6">
        <p className="newsroom-pill mb-4">Editorial</p>
        <h1 className="newsroom-heading-display mb-5">{labels.curatorGreeting}</h1>
        <p className="text-lg leading-relaxed text-[var(--color-newsroom-muted)]">
          {labels.curatorSubtitle}
        </p>
        <p className="mt-6 text-sm italic text-[var(--color-newsroom-muted)]">
          {lang === "es" ? "Por Wadi Bardawil" : "By Wadi Bardawil"}
        </p>
      </div>
    </section>
  );
}
