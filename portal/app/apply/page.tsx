import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";

import { ApplyForm } from "./form";

export const metadata = { title: "Apply — The Transformation Letter" };

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const lang = await getLangFromCookies();
  const i18n = t(lang).apply;

  if (ok === "1") {
    return (
      <section className="container-prose py-20">
        <h1 className="text-4xl mb-3">{i18n.successTitle}</h1>
        <p className="text-[var(--color-fg-muted)] text-lg">{i18n.successBody}</p>
      </section>
    );
  }

  return (
    <section className="container-prose py-16">
      <h1 className="text-4xl mb-2">{i18n.title}</h1>
      {i18n.subtitle ? <p className="text-[var(--color-fg-muted)] mb-8">{i18n.subtitle}</p> : <div className="mb-6" />}
      <ApplyForm lang={lang} />
    </section>
  );
}
