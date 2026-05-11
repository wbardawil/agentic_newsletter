-- Transformation Letter portal — initial schema.
-- Run via `supabase db push` or apply manually in the SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type application_status as enum ('pending', 'approved', 'rejected', 'waitlisted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_status as enum ('active', 'paused', 'revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type company_size_band as enum ('under_5m', '5m_25m', '25m_50m', '50m_100m', 'over_100m');
exception when duplicate_object then null; end $$;

do $$ begin
  create type region as enum (
    'miami', 'monterrey', 'bogota', 'panama_city', 'mexico_city',
    'other_us', 'other_latam', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type os_pillar as enum ('Strategy OS', 'Operating Model OS', 'Technology OS');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lang as enum ('en', 'es');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Members — extends auth.users with portal profile + preferences.
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  company text,
  role text,
  company_size_band company_size_band,
  region region,
  industry text,
  preferred_language lang not null default 'en',
  /**
   * Topic IDs the member opts in to. Validated at write-time against the
   * TOPICS list in /portal/lib/topics.ts — kept as plain text so adding a
   * new topic does not require a schema migration.
   */
  topics_of_interest text[] not null default array[]::text[],
  status member_status not null default 'active',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists members_email_idx on public.members (lower(email));

-- ---------------------------------------------------------------------------
-- Applications — the apply gate. Anyone (anon) can insert; only admins read.
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  company text not null,
  role text not null,
  company_size_band company_size_band not null,
  region region not null,
  industry text,
  preferred_language lang not null default 'en',
  /**
   * Topic IDs the applicant flagged on the apply form. Carried into
   * members.topics_of_interest by the new-user trigger when approved.
   */
  topics_of_interest text[] not null default array[]::text[],
  motivation text not null check (char_length(motivation) between 20 and 2000),
  status application_status not null default 'pending',
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists applications_status_idx on public.applications (status, created_at desc);
create unique index if not exists applications_email_pending_idx
  on public.applications (lower(email)) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Editions — published newsletter issues. Mirrors src/types/edition.ts.
-- ---------------------------------------------------------------------------
create table if not exists public.editions (
  id uuid primary key default gen_random_uuid(),
  edition_id text not null unique,
  edition_number int not null unique,
  published_at timestamptz,
  subject_en text,
  subject_es text,
  body_en text,
  body_es text,
  hero_image_url text,
  /**
   * Editorial topic. Validated against /portal/lib/topics.ts at write-time.
   * Wide enough to cover business transformation, conscious capital,
   * family business, family office, AI, and tech without a schema change.
   */
  topic text not null default 'business_transformation',
  /**
   * OS pillar — only meaningful when topic = 'business_transformation'.
   * Required there by app-level validation; ignored otherwise.
   */
  pillar os_pillar,
  quarterly_theme text,
  shareable_sentence_en text,
  shareable_sentence_es text,
  /**
   * Author for this issue. Wadi anchors business transformation; named
   * contributors carry the byline on family business / family office /
   * conscious capital issues. byline_role appears under the name (e.g.
   * "Family Office Principal"). Both nullable; if NULL the UI falls back
   * to the publication's house byline.
   */
  byline text,
  byline_role text,
  is_published boolean not null default false
);

create index if not exists editions_published_idx
  on public.editions (is_published, published_at desc);
create index if not exists editions_topic_idx
  on public.editions (topic, is_published, published_at desc);

create table if not exists public.edition_sources (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions(id) on delete cascade,
  title text not null,
  url text not null,
  snippet text,
  publisher text
);

create index if not exists edition_sources_edition_idx on public.edition_sources (edition_id);

-- ---------------------------------------------------------------------------
-- AI assistant — conversations and messages, per-member.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now()
);

create index if not exists ai_conversations_member_idx
  on public.ai_conversations (member_id, created_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conv_idx on public.ai_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Convenings — member dinners / working groups.
-- ---------------------------------------------------------------------------
create table if not exists public.convenings (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  region region not null,
  starts_at timestamptz not null,
  capacity int not null check (capacity > 0),
  description text not null,
  language lang not null default 'en'
);

create index if not exists convenings_upcoming_idx on public.convenings (starts_at);

create table if not exists public.convening_rsvps (
  member_id uuid not null references public.members(id) on delete cascade,
  convening_id uuid not null references public.convenings(id) on delete cascade,
  status text not null check (status in ('confirmed', 'waitlist', 'cancelled')) default 'confirmed',
  created_at timestamptz not null default now(),
  primary key (member_id, convening_id)
);

-- View: per-convening RSVP counts.
create or replace view public.convenings_with_counts as
  select c.*,
         coalesce(r.confirmed_count, 0) as rsvp_count
  from public.convenings c
  left join (
    select convening_id, count(*)::int as confirmed_count
    from public.convening_rsvps
    where status = 'confirmed'
    group by convening_id
  ) r on r.convening_id = c.id;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists members_updated_at on public.members;
create trigger members_updated_at before update on public.members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-provision a members row on new auth.users (only if there is an
-- approved application matching the email).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  app record;
begin
  select * into app
  from public.applications
  where lower(email) = lower(new.email)
    and status = 'approved'
  order by decided_at desc
  limit 1;

  if found then
    insert into public.members (
      id, email, full_name, company, role,
      company_size_band, region, industry, preferred_language,
      topics_of_interest, status
    )
    values (
      new.id, new.email, app.full_name, app.company, app.role,
      app.company_size_band, app.region, app.industry, app.preferred_language,
      app.topics_of_interest, 'active'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
