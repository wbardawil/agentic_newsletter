"use client";

import { useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { t, type Lang } from "@/lib/i18n/dictionary";
import { withBase } from "@/lib/site";

export function SignInForm({ lang, next }: { lang: Lang; next?: string }) {
  const i18n = t(lang).signIn;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    window.location.href = withBase(next ?? "/me");
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
      <div>
        <label htmlFor="password" className="field-label">{i18n.password}</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input"
          autoComplete="current-password"
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button disabled={loading} className="btn btn-primary w-full" type="submit">
        {loading ? "…" : i18n.submit}
      </button>
      <p className="text-center text-sm text-[var(--color-fg-muted)]">
        <a href={withBase("/forgot-password")} className="underline underline-offset-2">
          {i18n.forgotPassword}
        </a>
      </p>
    </form>
  );
}
