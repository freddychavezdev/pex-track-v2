-- Applies an editable start-of-day dispatch proposal atomically.
create or replace function public.apply_dispatch_plan(
  p_scheduled_for date,
  p_assignments jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  assignment record;
  expected_count integer;
  received_count integer;
begin
  if public.current_app_role() not in ('supervisor', 'coordinator') then
    raise exception 'Not authorized to apply dispatch plans' using errcode = '42501';
  end if;
  if p_scheduled_for is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'A date and an assignment list are required' using errcode = '22023';
  end if;

  select count(*)::integer into received_count
  from jsonb_to_recordset(p_assignments) as item(work_order_id uuid, team_id uuid, route_sequence integer);
  if received_count = 0 then
    raise exception 'The dispatch plan has no assignments' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_assignments) as item(work_order_id uuid, team_id uuid, route_sequence integer)
    where item.work_order_id is null or item.team_id is null or item.route_sequence is null or item.route_sequence < 1
  ) then
    raise exception 'The dispatch plan contains incomplete assignments' using errcode = '22023';
  end if;

  if exists (
    select item.work_order_id
    from jsonb_to_recordset(p_assignments) as item(work_order_id uuid, team_id uuid, route_sequence integer)
    group by item.work_order_id
    having count(*) > 1
  ) then
    raise exception 'The dispatch plan contains duplicate work orders' using errcode = '23514';
  end if;

  if exists (
    select item.team_id, item.route_sequence
    from jsonb_to_recordset(p_assignments) as item(work_order_id uuid, team_id uuid, route_sequence integer)
    group by item.team_id, item.route_sequence
    having count(*) > 1
  ) then
    raise exception 'The dispatch plan contains duplicate route positions' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_assignments) as item(work_order_id uuid, team_id uuid, route_sequence integer)
    left join public.work_orders work_order on work_order.id = item.work_order_id
    where work_order.id is null
      or work_order.scheduled_for <> p_scheduled_for
      or work_order.status not in ('pending', 'en_route', 'in_progress')
  ) then
    raise exception 'The dispatch plan contains an invalid work order' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_assignments) as item(work_order_id uuid, team_id uuid, route_sequence integer)
    left join public.teams team on team.id = item.team_id
    where team.id is null or not team.active or team.dispatch_status <> 'available'
  ) then
    raise exception 'The dispatch plan contains an unavailable team' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('dispatch-plan:' || p_scheduled_for::text, 0)
  );

  update public.work_orders work_order
  set assigned_team_id = item.team_id,
      route_sequence = item.route_sequence,
      updated_at = now()
  from jsonb_to_recordset(p_assignments) as item(work_order_id uuid, team_id uuid, route_sequence integer)
  where work_order.id = item.work_order_id;

  get diagnostics expected_count = row_count;
  if expected_count <> received_count then
    raise exception 'The dispatch plan could not be applied completely' using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.apply_dispatch_plan(date, jsonb) from public, anon;
grant execute on function public.apply_dispatch_plan(date, jsonb) to authenticated;
