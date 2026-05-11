"use client";

import { useState, useTransition } from "react";

import { t, type Lang } from "@/lib/i18n/dictionary";
import type { ConveningRow, ConveningRsvpRow } from "@/lib/supabase/types";

type Status = ConveningRsvpRow["status"] | null;

export function ConveningCard({
  convening,
  lang,
  initialStatus,
}: {
  convening: ConveningRow;
  lang: Lang;
  initialStatus: Status;
}) {
  const i18n = t(lang).convenings;
  const [status, setStatus] = useState<Status>(initialStatus);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const full = convening.rsvp_count >= convening.capacity;
  const label =
    status === "confirmed"
      ? i18n.rsvped
      : status === "waitlist"
        ? i18n.capacityFull
        : full
          ? i18n.capacityFull
          : i18n.rsvp;

  function rsvp() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/convenings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ convening_id: convening.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "RSVP failed.");
        return;
      }
      const data = await res.json();
      setStatus(data.status);
    });
  }

  return (
    <article className="card">
      <header className="flex items-baseline justify-between mb-2">
        <h3 className="text-2xl font-display">{convening.city}</h3>
        <span className="pill">{convening.language.toUpperCase()}</span>
      </header>
      <p className="text-[var(--color-bronze)] text-sm mb-3">
        {new Date(convening.starts_at).toLocaleString(lang === "es" ? "es-MX" : "en-US", {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        })}
      </p>
      <p className="text-[var(--color-ink)]/85 mb-4">{convening.description}</p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--color-bronze)]">
          {convening.rsvp_count} / {convening.capacity}
        </span>
        <button
          onClick={rsvp}
          disabled={isPending || status === "confirmed" || status === "waitlist"}
          className="btn btn-primary text-sm"
        >
          {isPending ? "…" : label}
        </button>
      </div>
      {error ? <p className="text-sm text-red-700 mt-2">{error}</p> : null}
    </article>
  );
}
