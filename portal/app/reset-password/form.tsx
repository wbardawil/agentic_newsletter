"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { withBase } from "@/lib/site";
import type { Lang } from "@/lib/i18n/dictionary";

interface Labels {
  newPassword: string;
  confirmPassword: string;
  passwordHelp: string;
  passwordTooShort: string;
  passwordMismatch: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successBody: string;
  signIn: string;
}

export function ResetPasswordForm({ lang, labels }: { lang: Lang; labels: Labels }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(labels.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(labels.passwordMismatch);
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="card space-y-3">
        <p className="font-medium">{labels.successTitle}</p>
        <p className="text-[var(--color-fg-muted)]">{labels.successBody}</p>
        <a href={withBase("/sign-in")} className="btn btn-primary inline-block">{labels.signIn}</a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <label htmlFor="password" className="field-label">{labels.newPassword}</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input"
          autoComplete="new-password"
        />
        <p className="text-xs text-[var(--color-fg-muted)] mt-1">{labels.passwordHelp}</p>
      </div>
      <div>
        <label htmlFor="confirm_password" className="field-label">{labels.confirmPassword}</label>
        <input
          id="confirm_password"
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="field-input"
          autoComplete="new-password"
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button disabled={loading} className="btn btn-primary w-full" type="submit">
        {loading ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
