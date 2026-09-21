-- Extend the role-filtered map projection with PEX network references. The
-- client receives points only; raw PostGIS geometries remain behind the RPC.
create or replace function public.operational_map_snapshot(p_day date)
returns table (
  marker_type text,
  marker_id uuid,
  code text,
  label text,
  latitude double precision,
  longitude double precision,
  status text,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null or not public.can_manage_operations() then
    raise exception 'Not authorized to view the operational map' using errcode = '42501';
  end if;

  return query
  select 'work_order'::text, work_order.id, work_order.code,
    concat_ws(' · ', work_order.address, work_order.customer_name),
    st_y(work_order.location), st_x(work_order.location), work_order.status::text, work_order.updated_at
  from public.work_orders work_order
  where work_order.scheduled_for = p_day and work_order.location is not null;

  return query
  with latest_locations as (
    select distinct on (location.team_id) location.team_id, location.location, location.recorded_at
    from public.team_locations location
    order by location.team_id, location.recorded_at desc
  )
  select 'team'::text, team.id, team.code, concat('Cuadrilla ', team.code),
    st_y(latest.location), st_x(latest.location), coalesce(current_order.status::text, 'available'), latest.recorded_at
  from latest_locations latest
  join public.teams team on team.id = latest.team_id and team.active
  left join lateral (
    select work_order.status
    from public.work_orders work_order
    where work_order.assigned_team_id = team.id and work_order.scheduled_for = p_day
      and work_order.status not in ('completed', 'suspended')
    order by work_order.updated_at desc limit 1
  ) current_order on true;

  return query
  select 'network_node'::text, node.id, node.code, concat('Nodo ', coalesce(node.name, node.code)),
    st_y(node.location), st_x(node.location), 'network_node'::text, node.created_at
  from public.network_nodes node;

  return query
  select 'distribution_box'::text, box.id, box.code, concat('Caja ', box.code),
    st_y(box.location), st_x(box.location), 'distribution_box'::text, box.created_at
  from public.distribution_boxes box;
end;
$$;

revoke all on function public.operational_map_snapshot(date) from public, anon, authenticated, service_role;
grant execute on function public.operational_map_snapshot(date) to authenticated;
