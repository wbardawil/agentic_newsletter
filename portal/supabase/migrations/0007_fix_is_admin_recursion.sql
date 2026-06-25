-- Fix the RLS infinite recursion bug by setting public.is_admin() to SECURITY DEFINER.
-- This allows the function to bypass Row Level Security when checking the members table.
-- We also explicitly set the search_path to public to prevent hijacking.

create or replace function public.is_admin()
returns boolean security definer set search_path = public language plpgsql stable as $$
begin
  return coalesce(
    (select is_admin from public.members where id = auth.uid()),
    false
  );
end;
$$;
