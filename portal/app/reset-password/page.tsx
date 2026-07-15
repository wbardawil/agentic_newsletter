import { ResetPasswordForm } from "./form";
import { getLangFromCookies } from "@/lib/i18n/server";

export const metadata = { title: "Set new password — The Transformation Letter" };

export default async function ResetPasswordPage() {
  const lang = await getLangFromCookies();

  const labels = {
    en: {
      title: "Set a new password",
      sub: "Choose a strong password for your account.",
      newPassword: "New password",
      confirmPassword: "Confirm new password",
      passwordHelp: "Minimum 8 characters.",
      passwordTooShort: "Password must be at least 8 characters.",
      passwordMismatch: "Passwords do not match.",
      submit: "Update password",
      submitting: "Updating…",
      successTitle: "Password updated.",
      successBody: "You can now sign in with your new password.",
      signIn: "Sign in",
    },
    es: {
      title: "Establecer nueva contraseña",
      sub: "Elige una contraseña segura para tu cuenta.",
      newPassword: "Nueva contraseña",
      confirmPassword: "Confirmar nueva contraseña",
      passwordHelp: "Mínimo 8 caracteres.",
      passwordTooShort: "La contraseña debe tener al menos 8 caracteres.",
      passwordMismatch: "Las contraseñas no coinciden.",
      submit: "Actualizar contraseña",
      submitting: "Actualizando…",
      successTitle: "Contraseña actualizada.",
      successBody: "Ya puedes ingresar con tu nueva contraseña.",
      signIn: "Ingresar",
    },
  };

  return (
    <section className="container-prose py-16">
      <h1 className="text-4xl mb-2">{labels[lang].title}</h1>
      <p className="text-[var(--color-fg-muted)] mb-8">{labels[lang].sub}</p>
      <ResetPasswordForm lang={lang} labels={labels[lang]} />
    </section>
  );
}
