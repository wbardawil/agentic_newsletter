"use client";

import { useState, useTransition } from "react";

import { t, type Lang } from "@/lib/i18n/dictionary";
import type { ApplicationRow as Row } from "@/lib/supabase/types";

export function ApplicationRow({ app, lang }: { app: Row; lang: Lang }) {
  const i18n = t(lang).admin;
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<Row["status"]>(app.status);
  const [error, setError] = useState<string | null>(null);

  function decide(next: Row["status"]) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: app.id, status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Update failed.");
        return;
      }
      setStatus(next);
    });
  }

  return (
    <article className="card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <div>
          <h3 className="text-xl font-display">{app.full_name}</h3>
          <p className="text-sm text-[var(--color-bronze)]">
            {app.role} · {app.company} · {app.region.replace("_", " ")} · {app.company_size_band}
          </p>
        </div>
        <a href={`mailto:${app.email}`} className="text-sm">{app.email}</a>
      </header>

      <p className="text-[var(--color-ink)]/90 whitespace-pre-wrap mb-3">{app.motivation}</p>

      <footer className="flex items-center gap-2 flex-wrap">
        <span className="pill">{status}</span>
        <button disabled={isPending || status === "approved"} onClick={() => decide("approved")}   className="btn btn-primary text-sm">{i18n.approve}</button>
        <button disabled={isPending || status === "waitlisted"} onClick={() => decide("waitlisted")} className="btn btn-ghost text-sm">{i18n.waitlist}</button>
        <button disabled={isPending || status === "rejected"} onClick={() => decide("rejected")}   className="btn btn-ghost text-sm">{i18n.reject}</button>
        {error ? <span className="text-sm text-red-700">{error}</span> : null}
      </footer>
    </article>
  );
}
