"use client";

import { useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { t, type Lang } from "@/lib/i18n/dictionary";

export function SignInForm({ lang, next }: { lang: Lang; next?: string }) {
  const i18n = t(lang).signIn;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const callbackBase = `${window.location.origin}/auth/callback`;
    const redirectTo = next
      ? `${callbackBase}?next=${encodeURIComponent(next)}`
      : callbackBase;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.href = "/sign-in?sent=1";
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <label htmlFor="email" className="field-label">{i18n.email}</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input"
          autoComplete="email"
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button disabled={loading} className="btn btn-primary" type="submit">
        {loading ? "…" : i18n.submit}
      </button>
    </form>
  );
}
