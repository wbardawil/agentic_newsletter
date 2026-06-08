-- Public newsroom projection.
--
-- The member-facing `editions` policies (0002_rls.sql) stay UNTOUCHED: full
-- bodies remain readable only by authenticated active members. This migration
-- is purely additive — it exposes a *curated, body-free* projection of
-- published editions to anonymous visitors so the public Garry's List-style
-- newsroom can show headlines, excerpts, topic, byline and date.
--
-- Why a view (not an anon RLS policy): RLS is row-level, not column-level. An
-- anon SELECT policy on `editions` would let anyone read body_en/body_es via
-- the REST API. A view that simply omits the body columns is the only way to
-- hide them. The view runs with definer (owner) rights by default, so anon can
-- read published rows through it without the base-table RLS blocking them —
-- which is the intended public exposure. Only the safe columns below are ever
-- returned, and only for is_published = true.

create or replace view public.editions_public as
  select
    id,
    edition_id,
    edition_number,
    published_at,
    subject_en,
    subject_es,
    topic,
    pillar,
    quarterly_theme,
    shareable_sentence_en,
    shareable_sentence_es,
    byline,
    byline_role
  from public.editions
  where is_published = true;

-- Public read access (anon = logged-out visitors; authenticated = members).
grant select on public.editions_public to anon, authenticated;
