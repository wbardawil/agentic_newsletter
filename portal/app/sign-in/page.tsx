import { SignInForm } from "./form";
import { getLangFromCookies } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/dictionary";

export const metadata = { title: "Sign in — The Transformation Letter" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const lang = await getLangFromCookies();
  const i18n = t(lang).signIn;

  return (
    <section className="container-prose py-16">
      <h1 className="text-4xl mb-2">{i18n.title}</h1>
      <p className="text-[var(--color-fg-muted)] mb-8">{i18n.sub}</p>
      {params.error === "auth" && (
        <p className="text-sm text-red-700 mb-4">
          {lang === "es"
            ? "El enlace de acceso no es válido o ha expirado. Intenta de nuevo."
            : "The access link is invalid or has expired. Please try again."}
        </p>
      )}
      <SignInForm lang={lang} next={params.next} />
    </section>
  );
}
