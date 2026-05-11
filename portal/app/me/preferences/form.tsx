"use client";

import { useState } from "react";

import { t, type Lang } from "@/lib/i18n/dictionary";
import { TOPICS, type TopicId } from "@/lib/topics";
import type { Region } from "@/lib/supabase/types";

export function PreferencesForm({
  lang,
  initial,
}: {
  lang: Lang;
  initial: {
    preferred_language: Lang;
    region: Region | null;
    industry: string | null;
    role: string | null;
    topics_of_interest: string[];
  };
}) {
  const i18n = t(lang).preferences;
  const apply = t(lang).apply;
  const [topics, setTopics] = useState<TopicId[]>(
    initial.topics_of_interest.filter((id): id is TopicId =>
      TOPICS.some((t) => t.id === id),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: TopicId) {
    setTopics((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      preferred_language: fd.get("preferred_language"),
      region: fd.get("region") || null,
      industry: (fd.get("industry") || null) as string | null,
      role: (fd.get("role") || null) as string | null,
      topics_of_interest: topics,
    };

    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Update failed.");
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="field-label">{i18n.language}</label>
          <select name="preferred_language" defaultValue={initial.preferred_language} className="field-select">
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>
        <div>
          <label className="field-label">{i18n.region}</label>
          <select name="region" defaultValue={initial.region ?? ""} className="field-select">
            <option value="" />
            {apply.regionOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">{i18n.industry}</label>
          <input name="industry" defaultValue={initial.industry ?? ""} className="field-input" />
        </div>
        <div>
          <label className="field-label">{i18n.role}</label>
          <input name="role" defaultValue={initial.role ?? ""} className="field-input" />
        </div>
      </div>

      <fieldset>
        <legend className="field-label">{i18n.topicsInterest}</legend>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((topic) => {
            const active = topics.includes(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggle(topic.id)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-full border text-sm ${
                  active
                    ? "bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]"
                    : "border-[var(--color-line)] text-[var(--color-bronze)]"
                }`}
              >
                {lang === "es" ? topic.es : topic.en}
              </button>
            );
          })}
        </div>
      </fieldset>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {saved ? <p className="text-sm text-[var(--color-teal)]">{i18n.saved}</p> : null}

      <button type="submit" disabled={saving} className="btn btn-primary">
        {saving ? "…" : i18n.save}
      </button>
    </form>
  );
}
