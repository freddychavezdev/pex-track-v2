-- Avoid policy recursion when a technician's team membership is evaluated from RLS.
-- The function still derives identity exclusively from auth.uid(), never from caller input.
create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams team
    join public.technicians technician
      on technician.id in (team.technician_one_id, team.technician_two_id)
    where team.id = target_team_id
      and technician.profile_id = (select auth.uid())
      and team.active
      and technician.active
  );
$$;

-- Provides the only active team for the authenticated technician. It is purposely
-- parameterless so an Android client cannot select another team's identifier.
create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team.id
  from public.teams team
  join public.technicians technician
    on technician.id in (team.technician_one_id, team.technician_two_id)
  where technician.profile_id = (select auth.uid())
    and technician.active
    and team.active
  order by team.created_at desc
  limit 1;
$$;

revoke all on function public.is_team_member(uuid) from public;
revoke all on function public.current_team_id() from public;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.current_team_id() to authenticated;
