-- Row Level Security policies.
-- Default: deny. Grant the minimum each role needs.

alter table public.members            enable row level security;
alter table public.applications       enable row level security;
alter table public.editions           enable row level security;
alter table public.edition_sources    enable row level security;
alter table public.ai_conversations   enable row level security;
alter table public.ai_messages        enable row level security;
alter table public.convenings         enable row level security;
alter table public.convening_rsvps    enable row level security;

-- Helper: is the caller an admin?
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce(
    (select is_admin from public.members where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------
drop policy if exists "members self read"   on public.members;
drop policy if exists "members self update" on public.members;
drop policy if exists "members admin read"  on public.members;

create policy "members self read"   on public.members for select
  using (auth.uid() = id);

create policy "members self update" on public.members for update
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "members admin read"  on public.members for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- applications
-- Anon CAN insert (apply form). Only admins read / update.
-- ---------------------------------------------------------------------------
drop policy if exists "applications anon insert" on public.applications;
drop policy if exists "applications admin read"  on public.applications;
drop policy if exists "applications admin write" on public.applications;

create policy "applications anon insert" on public.applications for insert
  with check (status = 'pending');

create policy "applications admin read"  on public.applications for select
  using (public.is_admin());

create policy "applications admin write" on public.applications for update
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- editions + sources — readable by any authenticated member; admins manage.
-- ---------------------------------------------------------------------------
drop policy if exists "editions member read"   on public.editions;
drop policy if exists "editions admin write"   on public.editions;
drop policy if exists "edition_sources member read"  on public.edition_sources;
drop policy if exists "edition_sources admin write"  on public.edition_sources;

create policy "editions member read" on public.editions for select
  using (
    auth.uid() is not null
    and is_published = true
    and exists (select 1 from public.members m where m.id = auth.uid())
  );

create policy "editions admin write" on public.editions for all
  using (public.is_admin()) with check (public.is_admin());

create policy "edition_sources member read" on public.edition_sources for select
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.editions e
      where e.id = edition_sources.edition_id and e.is_published = true
    )
  );

create policy "edition_sources admin write" on public.edition_sources for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ai_conversations + ai_messages — strictly per-member.
-- ---------------------------------------------------------------------------
drop policy if exists "ai_conv self all"      on public.ai_conversations;
drop policy if exists "ai_msg self read"      on public.ai_messages;
drop policy if exists "ai_msg self insert"    on public.ai_messages;

create policy "ai_conv self all" on public.ai_conversations for all
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

create policy "ai_msg self read" on public.ai_messages for select
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.member_id = auth.uid()
    )
  );

create policy "ai_msg self insert" on public.ai_messages for insert
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.member_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- convenings — members read; admins write.
-- ---------------------------------------------------------------------------
drop policy if exists "convenings member read" on public.convenings;
drop policy if exists "convenings admin write" on public.convenings;
drop policy if exists "rsvps self all"         on public.convening_rsvps;
drop policy if exists "rsvps admin read"       on public.convening_rsvps;

create policy "convenings member read" on public.convenings for select
  using (
    auth.uid() is not null
    and exists (select 1 from public.members m where m.id = auth.uid() and m.status = 'active')
  );

create policy "convenings admin write" on public.convenings for all
  using (public.is_admin()) with check (public.is_admin());

create policy "rsvps self all"   on public.convening_rsvps for all
  using (member_id = auth.uid()) with check (member_id = auth.uid());

create policy "rsvps admin read" on public.convening_rsvps for select
  using (public.is_admin());

grant select on public.convenings_with_counts to authenticated;
