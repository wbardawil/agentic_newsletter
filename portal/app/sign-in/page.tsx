import { SignInForm } from "./form";
import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";

export const metadata = { title: "Sign in — The Transformation Letter" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const lang = await getLangFromCookies();
  const i18n = t(lang).signIn;

  return (
    <section className="container-prose py-16">
      <h1 className="text-4xl mb-2">{i18n.title}</h1>
      <p className="text-[var(--color-bronze)] mb-8">{i18n.sub}</p>
      {params.sent === "1" ? (
        <div className="card">
          <p>{i18n.check}</p>
        </div>
      ) : (
        <SignInForm lang={lang} next={params.next} />
      )}
    </section>
  );
}
