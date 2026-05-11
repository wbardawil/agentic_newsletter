"use client";

import { useState } from "react";

import { t, type Lang } from "@/lib/i18n/dictionary";
import { TOPICS, type TopicId } from "@/lib/topics";

export function ApplyForm({ lang }: { lang: Lang }) {
  const i18n = t(lang).apply;
  const apply2 = t(lang).apply2;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicId[]>([]);

  function toggle(id: TopicId) {
    setTopics((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = { ...Object.fromEntries(fd.entries()), topics_of_interest: topics };

    const res = await fetch("/api/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }

    window.location.href = "/apply?ok=1";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className="field-label" htmlFor="full_name">{i18n.name}</label>
          <input required id="full_name" name="full_name" className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="email">{i18n.email}</label>
          <input required type="email" id="email" name="email" className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="company">{i18n.company}</label>
          <input required id="company" name="company" className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="role">{i18n.role}</label>
          <input required id="role" name="role" className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="company_size_band">{i18n.sizeBand}</label>
          <select required id="company_size_band" name="company_size_band" className="field-select" defaultValue="">
            <option value="" disabled />
            {i18n.sizeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="region">{i18n.region}</label>
          <select required id="region" name="region" className="field-select" defaultValue="">
            <option value="" disabled />
            {i18n.regionOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="industry">{i18n.industry}</label>
          <input id="industry" name="industry" className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="preferred_language">{i18n.language}</label>
          <select id="preferred_language" name="preferred_language" defaultValue={lang} className="field-select">
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="field-label">{apply2.topicsInterest}</legend>
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
                    ? "bg-[var(--color-fg)] text-[var(--color-bg)] border-[var(--color-fg)]"
                    : "border-[var(--color-line)] text-[var(--color-fg-muted)]"
                }`}
              >
                {lang === "es" ? topic.es : topic.en}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--color-fg-muted)] mt-2">{apply2.topicsInterestHelp}</p>
      </fieldset>

      <div>
        <label className="field-label" htmlFor="motivation">{i18n.motivation}</label>
        <textarea required minLength={20} maxLength={2000} id="motivation" name="motivation" rows={5} className="field-textarea" />
        <p className="text-xs text-[var(--color-fg-muted)] mt-1">{i18n.motivationHelp}</p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button disabled={submitting} type="submit" className="btn btn-primary">
        {submitting ? i18n.submitting : i18n.submit}
      </button>
    </form>
  );
}
