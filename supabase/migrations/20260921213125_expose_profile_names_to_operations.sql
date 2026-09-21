-- Supervisors and coordinators need display names for OT history and catalog
-- relationships. The helper is kept in the private schema and only exposes
-- the boolean authorization decision; profile rows remain RLS-protected.
create or replace function private.can_read_profile_directory()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles actor
    where actor.id = (select auth.uid())
      and actor.active
      and actor.role in ('supervisor', 'coordinator')
  );
$$;

revoke all on function private.can_read_profile_directory() from public;
grant execute on function private.can_read_profile_directory() to authenticated;

create policy "operations read active profile directory"
  on public.profiles for select to authenticated
  using (active and private.can_read_profile_directory());
