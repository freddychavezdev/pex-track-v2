-- Operational dispatch inputs used by the start-of-day planning flow.
-- Existing teams remain available by default and keep their current behavior.
alter table public.teams
  add column if not exists dispatch_status text not null default 'available'
    check (dispatch_status in ('available', 'unavailable', 'on_service')),
  add column if not exists base_label text,
  add column if not exists base_location extensions.geometry(Point, 4326);

create index if not exists teams_dispatch_status_idx
  on public.teams(dispatch_status)
  where active;

create or replace function public.operation_team_catalog()
returns table (
  id uuid,
  code text,
  active boolean,
  dispatch_status text,
  base_label text,
  base_latitude double precision,
  base_longitude double precision
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  if public.current_app_role() not in ('supervisor', 'coordinator') then
    raise exception 'Not authorized to view operational teams' using errcode = '42501';
  end if;

  return query
  select team.id,
    team.code,
    team.active,
    team.dispatch_status,
    team.base_label,
    st_y(team.base_location),
    st_x(team.base_location)
  from public.teams team
  order by team.code;
end;
$$;

create or replace function public.set_team_dispatch_profile(
  p_team_id uuid,
  p_dispatch_status text,
  p_base_label text,
  p_base_latitude double precision,
  p_base_longitude double precision
)
returns void
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  if public.current_app_role() <> 'supervisor' then
    raise exception 'Not authorized to edit team dispatch profile' using errcode = '42501';
  end if;

  if p_dispatch_status not in ('available', 'unavailable', 'on_service') then
    raise exception 'Invalid dispatch status' using errcode = '22023';
  end if;

  if (p_base_latitude is null) <> (p_base_longitude is null) then
    raise exception 'Base latitude and longitude must be provided together' using errcode = '22023';
  end if;

  if p_base_latitude is not null and (p_base_latitude not between -90 and 90 or p_base_longitude not between -180 and 180) then
    raise exception 'Base coordinates are outside valid ranges' using errcode = '22023';
  end if;

  update public.teams team
  set dispatch_status = p_dispatch_status,
      base_label = nullif(trim(p_base_label), ''),
      base_location = case
        when p_base_latitude is null then null
        else st_setsrid(st_makepoint(p_base_longitude, p_base_latitude), 4326)
      end,
      updated_at = now()
  where team.id = p_team_id;

  if not found then
    raise exception 'Team not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.operation_team_catalog() from public, anon;
grant execute on function public.operation_team_catalog() to authenticated;
revoke all on function public.set_team_dispatch_profile(uuid, text, text, double precision, double precision) from public, anon;
grant execute on function public.set_team_dispatch_profile(uuid, text, text, double precision, double precision) to authenticated;
