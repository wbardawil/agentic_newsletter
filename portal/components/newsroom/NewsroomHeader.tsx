import { t, type Lang } from "@/lib/i18n/dictionary";

export function NewsroomHeader({ lang }: { lang: Lang }) {
  const labels = t(lang).newsroom;

  return (
    <section className="border-b border-[var(--color-line)]">
      <div className="container-wide py-14 lg:py-16 max-w-2xl">
        <p className="pill mb-4">Editorial</p>
        <h1 className="heading-display mb-5">{labels.curatorGreeting}</h1>
        <p className="text-executive text-[var(--color-fg-muted)]">
          {labels.curatorSubtitle}
        </p>
        <p className="mt-5 text-sm italic text-[var(--color-fg-muted)]">
          {lang === "es" ? "Por Wadi Bardawil" : "By Wadi Bardawil"}
        </p>
      </div>
    </section>
  );
}
