-- Additive: expose hero_image_url on the public newsroom projection.
--
-- The newsroom homepage renders image-forward hero/cards, so the body-free
-- public view needs the (already body-safe) hero image URL. This re-creates the
-- view from 0004_public_editions.sql with ONE extra column appended last.
--
-- Security model is UNCHANGED from 0004: default (definer) rights, body columns
-- (body_en/body_es) still omitted, only is_published = true rows. The member RLS
-- on public.editions is NOT touched. hero_image_url is a plain URL column that
-- already exists on public.editions (0001_init.sql), so this compiles cleanly.
--
-- Note: `create or replace view` does NOT carry forward grants, so we re-grant
-- explicitly to keep anon/authenticated read access.

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
    byline_role,
    hero_image_url
  from public.editions
  where is_published = true;

grant select on public.editions_public to anon, authenticated;
