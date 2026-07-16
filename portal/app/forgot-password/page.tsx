import { ForgotPasswordForm } from "./form";
import { getLangFromCookies } from "@/lib/i18n/server";

export const metadata = { title: "Forgot password — The Transformation Letter" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;
  const lang = await getLangFromCookies();

  const labels = {
    en: {
      title: "Reset your password",
      sub: "Enter your member email and we will send you a reset link.",
      email: "Email",
      submit: "Send reset link",
      sending: "Sending…",
      successTitle: "Check your inbox.",
      successBody: "If that email is registered, you will receive a password reset link shortly.",
      backToSignIn: "Back to sign in",
    },
    es: {
      title: "Restablecer contraseña",
      sub: "Ingresa tu correo de miembro y te enviaremos un enlace para restablecer tu contraseña.",
      email: "Correo electrónico",
      submit: "Enviar enlace",
      sending: "Enviando…",
      successTitle: "Revisa tu correo.",
      successBody: "Si ese correo está registrado, recibirás un enlace para restablecer tu contraseña.",
      backToSignIn: "Volver al inicio de sesión",
    },
  };
  const i18n = labels[lang];

  return (
    <section className="container-prose py-16">
      <h1 className="text-4xl mb-2">{i18n.title}</h1>
      <p className="text-[var(--color-fg-muted)] mb-8">{i18n.sub}</p>
      {params.sent === "1" ? (
        <div className="card space-y-3">
          <p className="font-medium">{i18n.successTitle}</p>
          <p className="text-[var(--color-fg-muted)]">{i18n.successBody}</p>
          <a href="/sign-in" className="text-sm underline underline-offset-2">{i18n.backToSignIn}</a>
        </div>
      ) : (
        <ForgotPasswordForm lang={lang} labels={i18n} />
      )}
    </section>
  );
}
