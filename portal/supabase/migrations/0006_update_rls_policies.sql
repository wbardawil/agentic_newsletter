-- Redesign permissions for editions and convenings.
-- Admins should have universal read access, regardless of their 'status'.
-- Members must have 'active' status to read.

-- ---------------------------------------------------------------------------
-- editions
-- ---------------------------------------------------------------------------
drop policy if exists "editions member read" on public.editions;

create policy "editions member read" on public.editions for select
  using (
    auth.uid() is not null
    and is_published = true
    and (
      public.is_admin()
      or
      exists (select 1 from public.members m where m.id = auth.uid() and m.status = 'active')
    )
  );

-- ---------------------------------------------------------------------------
-- convenings
-- ---------------------------------------------------------------------------
drop policy if exists "convenings member read" on public.convenings;

create policy "convenings member read" on public.convenings for select
  using (
    auth.uid() is not null
    and (
      public.is_admin()
      or
      exists (select 1 from public.members m where m.id = auth.uid() and m.status = 'active')
    )
  );
