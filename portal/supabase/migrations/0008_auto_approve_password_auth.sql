-- Migration 0008: Auto-approve registration + password authentication
--
-- Changes:
-- 1. Drop the old RLS policy that only allowed INSERT with status='pending'.
--    The /api/apply route now uses the SERVICE_ROLE key which bypasses RLS,
--    but this cleans up the policy so it reflects the new reality.
-- 2. Add a new INSERT policy that allows approved status (service role bypass
--    means this is only for defense-in-depth and direct Supabase client use).
-- 3. Remove the unique index that only covered pending applications — replace
--    with a full-email unique index on approved applications to prevent duplicate
--    accounts, while still allowing rejected/waitlisted applicants to re-apply.

-- Drop old policy that required status = 'pending' on anon insert
drop policy if exists "applications anon insert" on public.applications;

-- New policy: anyone can insert only if status is 'pending' or 'approved'
-- (admin client bypasses RLS anyway; this is for defense-in-depth)
create policy "applications insert" on public.applications
  for insert with check (status in ('pending', 'approved'));

-- Drop the pending-only unique index
drop index if exists applications_email_pending_idx;

-- New unique index: prevent duplicate approved applications for the same email
-- (rejected/waitlisted do not block a new submission)
create unique index applications_email_approved_idx
  on public.applications (lower(email))
  where status = 'approved';
