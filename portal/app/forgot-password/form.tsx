"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { siteUrl, withBase } from "@/lib/site";
import type { Lang } from "@/lib/i18n/dictionary";

interface Labels {
  email: string;
  submit: string;
  sending: string;
}

export function ForgotPasswordForm({ lang, labels }: { lang: Lang; labels: Labels }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const redirectTo = siteUrl("/auth/callback?next=/reset-password");

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Always redirect to the sent confirmation page (don't leak whether email exists)
    window.location.href = withBase("/forgot-password?sent=1");
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <label htmlFor="email" className="field-label">{labels.email}</label>
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
      <button disabled={loading} className="btn btn-primary w-full" type="submit">
        {loading ? labels.sending : labels.submit}
      </button>
    </form>
  );
}
