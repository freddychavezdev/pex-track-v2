alter table public.work_orders
  add column if not exists route_sequence integer
  check (route_sequence is null or route_sequence > 0);

with ranked_orders as (
  select
    work_order.id,
    row_number() over (
      partition by work_order.assigned_team_id, work_order.scheduled_for
      order by work_order.priority, work_order.code
    )::integer as route_sequence
  from public.work_orders work_order
  where work_order.assigned_team_id is not null
    and work_order.status in ('pending', 'en_route', 'in_progress')
)
update public.work_orders work_order
set route_sequence = ranked_order.route_sequence
from ranked_orders ranked_order
where ranked_order.id = work_order.id
  and work_order.route_sequence is null;

create unique index if not exists work_orders_active_route_sequence_uniq
  on public.work_orders(assigned_team_id, scheduled_for, route_sequence)
  where assigned_team_id is not null
    and route_sequence is not null
    and status in ('pending', 'en_route', 'in_progress');

create index if not exists work_orders_team_day_route_idx
  on public.work_orders(assigned_team_id, scheduled_for, route_sequence)
  where assigned_team_id is not null;

create or replace function public.assign_work_order_team(
  p_work_order_id uuid,
  p_team_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_date date;
  order_status public.work_order_status;
  current_team_id uuid;
  current_sequence integer;
  next_sequence integer;
begin
  if public.current_app_role() is null or public.current_app_role() not in ('supervisor', 'coordinator') then
    raise exception 'Not authorized to assign work orders' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.teams team
    where team.id = p_team_id and team.active
  ) then
    raise exception 'The selected team is not active' using errcode = '23514';
  end if;

  select work_order.scheduled_for
  into order_date
  from public.work_orders work_order
  where work_order.id = p_work_order_id;

  if not found then
    raise exception 'Work order not found' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_team_id::text || ':' || order_date::text, 0)
  );

  select work_order.scheduled_for, work_order.status, work_order.assigned_team_id, work_order.route_sequence
  into order_date, order_status, current_team_id, current_sequence
  from public.work_orders work_order
  where work_order.id = p_work_order_id
  for update;

  if order_status in ('completed', 'suspended') then
    raise exception 'A closed work order cannot be reassigned' using errcode = '23514';
  end if;

  if current_team_id = p_team_id and current_sequence is not null then
    return;
  end if;

  select coalesce(max(work_order.route_sequence), 0) + 1
  into next_sequence
  from public.work_orders work_order
  where work_order.assigned_team_id = p_team_id
    and work_order.scheduled_for = order_date
    and work_order.status in ('pending', 'en_route', 'in_progress');

  update public.work_orders
  set assigned_team_id = p_team_id,
      route_sequence = next_sequence,
      updated_at = now()
  where id = p_work_order_id;
end;
$$;

revoke all on function public.assign_work_order_team(uuid, uuid) from public, anon;
grant execute on function public.assign_work_order_team(uuid, uuid) to authenticated;

create or replace function public.save_team_route(
  p_team_id uuid,
  p_scheduled_for date,
  p_work_order_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected_count integer;
  provided_count integer := coalesce(pg_catalog.array_length(p_work_order_ids, 1), 0);
  distinct_count integer;
begin
  if public.current_app_role() is null or public.current_app_role() not in ('supervisor', 'coordinator') then
    raise exception 'Not authorized to approve team routes' using errcode = '42501';
  end if;

  if p_scheduled_for is null then
    raise exception 'The route date is required' using errcode = '22004';
  end if;

  if not exists (
    select 1 from public.teams team
    where team.id = p_team_id and team.active
  ) then
    raise exception 'The selected team is not active' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_team_id::text || ':' || p_scheduled_for::text, 0)
  );

  perform 1
  from public.work_orders work_order
  where work_order.assigned_team_id = p_team_id
    and work_order.scheduled_for = p_scheduled_for
    and work_order.status in ('pending', 'en_route', 'in_progress')
  for update;

  select count(*)::integer
  into expected_count
  from public.work_orders work_order
  where work_order.assigned_team_id = p_team_id
    and work_order.scheduled_for = p_scheduled_for
    and work_order.status in ('pending', 'en_route', 'in_progress');

  select count(distinct route_id)::integer
  into distinct_count
  from pg_catalog.unnest(coalesce(p_work_order_ids, array[]::uuid[])) route_id;

  if provided_count <> expected_count or distinct_count <> provided_count then
    raise exception 'The approved route must contain every active work order exactly once'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(coalesce(p_work_order_ids, array[]::uuid[])) route_id
    where not exists (
      select 1
      from public.work_orders work_order
      where work_order.id = route_id
        and work_order.assigned_team_id = p_team_id
        and work_order.scheduled_for = p_scheduled_for
        and work_order.status in ('pending', 'en_route', 'in_progress')
    )
  ) then
    raise exception 'The approved route contains an invalid work order' using errcode = '23514';
  end if;

  update public.work_orders work_order
  set route_sequence = null,
      updated_at = now()
  where work_order.assigned_team_id = p_team_id
    and work_order.scheduled_for = p_scheduled_for
    and work_order.status in ('pending', 'en_route', 'in_progress');

  update public.work_orders work_order
  set route_sequence = ordered_work_order.position::integer,
      updated_at = now()
  from pg_catalog.unnest(coalesce(p_work_order_ids, array[]::uuid[]))
    with ordinality as ordered_work_order(id, position)
  where work_order.id = ordered_work_order.id;
end;
$$;

revoke all on function public.save_team_route(uuid, date, uuid[]) from public, anon;
grant execute on function public.save_team_route(uuid, date, uuid[]) to authenticated;

create or replace function public.audit_work_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old is distinct from new then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details, ip_address)
    values (
      auth.uid(),
      'work_order.updated',
      'work_order',
      new.id,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'old_assigned_team_id', old.assigned_team_id,
        'assigned_team_id', new.assigned_team_id,
        'old_route_sequence', old.route_sequence,
        'route_sequence', new.route_sequence
      ),
      public.request_ip()
    );
  end if;
  return new;
end;
$$;

revoke all on function public.audit_work_order_change() from public, anon, authenticated, service_role;

drop function if exists public.my_assigned_work_orders();

create function public.my_assigned_work_orders()
returns table (
  id uuid,
  code text,
  address text,
  task_type text,
  status text,
  priority integer,
  is_emergency boolean,
  route_sequence integer,
  scheduled_for date,
  suspension_reason text,
  latest_note text,
  latest_note_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.current_app_role() <> 'technician' then
    raise exception 'Not authorized to view assigned work orders' using errcode = '42501';
  end if;

  return query
  select
    work_order.id,
    work_order.code,
    work_order.address,
    work_order.task_type::text,
    work_order.status::text,
    work_order.priority,
    work_order.is_emergency,
    work_order.route_sequence,
    work_order.scheduled_for,
    work_order.suspension_reason,
    latest_note.transcript,
    latest_note.created_at
  from public.work_orders work_order
  left join lateral (
    select note.transcript, note.created_at
    from public.work_order_notes note
    where note.work_order_id = work_order.id
    order by note.created_at desc
    limit 1
  ) latest_note on true
  where public.is_team_member(work_order.assigned_team_id)
    and work_order.status not in ('completed', 'suspended')
  order by work_order.route_sequence nulls last,
    work_order.priority,
    work_order.scheduled_for,
    work_order.code;
end;
$$;

revoke all on function public.my_assigned_work_orders() from public;
grant execute on function public.my_assigned_work_orders() to authenticated;
