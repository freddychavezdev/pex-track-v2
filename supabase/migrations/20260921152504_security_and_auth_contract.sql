-- Security hardening, authenticated access contract, and mobile-safe RPCs.
-- No service-role key is ever used from Angular or Android.

create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger technicians_set_updated_at before update on public.technicians
  for each row execute function public.set_updated_at();
create trigger vehicles_set_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();
create trigger teams_set_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create trigger work_orders_set_updated_at before update on public.work_orders
  for each row execute function public.set_updated_at();

-- Auth creates a harmless default profile. Privileged role assignment happens only
-- from a server-side administrative workflow.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    'technician'
  );
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
stable
security invoker
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

create or replace function public.can_manage_operations()
returns boolean
language sql
stable
security invoker
as $$
  select public.current_app_role() in ('supervisor', 'coordinator');
$$;

-- Reset the coarse first-pass policies and grants from the initial migration.
drop policy if exists "authenticated users can read active profiles" on public.profiles;
drop policy if exists "operations can read reference data" on public.technicians;
drop policy if exists "operations can read vehicles" on public.vehicles;
drop policy if exists "operations can read teams" on public.teams;
drop policy if exists "operations can read geography" on public.zones;
drop policy if exists "operations can read nodes" on public.network_nodes;
drop policy if exists "operations can read boxes" on public.distribution_boxes;
drop policy if exists "operations can read work orders" on public.work_orders;
drop policy if exists "supervisor and coordinator manage work orders" on public.work_orders;
drop policy if exists "technician updates assigned work orders" on public.work_orders;
drop policy if exists "operations can read team locations" on public.team_locations;
drop policy if exists "technicians insert team locations" on public.team_locations;
drop policy if exists "operations can read status history" on public.work_order_status_history;
drop policy if exists "authenticated users insert status history" on public.work_order_status_history;
drop policy if exists "supervisor reads audit logs" on public.audit_logs;

revoke all on table public.profiles, public.technicians, public.vehicles, public.teams,
  public.zones, public.network_nodes, public.distribution_boxes, public.work_orders,
  public.team_locations, public.work_order_status_history, public.audit_logs
  from anon, authenticated;

grant select on table public.profiles, public.technicians, public.vehicles, public.teams,
  public.zones, public.network_nodes, public.distribution_boxes, public.work_orders,
  public.team_locations, public.work_order_status_history, public.audit_logs
  to authenticated;
grant insert, update, delete on table public.technicians, public.vehicles, public.teams,
  public.zones, public.network_nodes, public.distribution_boxes, public.work_orders
  to authenticated;

create policy "users read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "operations read technicians"
  on public.technicians for select to authenticated
  using (public.can_manage_operations() or profile_id = (select auth.uid()));
create policy "supervisor manages technicians"
  on public.technicians for all to authenticated
  using (public.current_app_role() = 'supervisor')
  with check (public.current_app_role() = 'supervisor');

create policy "operations read vehicles"
  on public.vehicles for select to authenticated
  using (public.can_manage_operations() or exists (select 1 from public.teams team where team.vehicle_id = vehicles.id and public.is_team_member(team.id)));
create policy "supervisor manages vehicles"
  on public.vehicles for all to authenticated
  using (public.current_app_role() = 'supervisor')
  with check (public.current_app_role() = 'supervisor');

create policy "operations read teams"
  on public.teams for select to authenticated
  using (public.can_manage_operations() or public.is_team_member(id));
create policy "supervisor manages teams"
  on public.teams for all to authenticated
  using (public.current_app_role() = 'supervisor')
  with check (public.current_app_role() = 'supervisor');

create policy "operations read zones"
  on public.zones for select to authenticated using (public.current_app_role() is not null);
create policy "supervisor manages zones"
  on public.zones for all to authenticated
  using (public.current_app_role() = 'supervisor')
  with check (public.current_app_role() = 'supervisor');
create policy "operations read nodes"
  on public.network_nodes for select to authenticated using (public.current_app_role() is not null);
create policy "supervisor manages nodes"
  on public.network_nodes for all to authenticated
  using (public.current_app_role() = 'supervisor')
  with check (public.current_app_role() = 'supervisor');
create policy "operations read boxes"
  on public.distribution_boxes for select to authenticated using (public.current_app_role() is not null);
create policy "supervisor manages boxes"
  on public.distribution_boxes for all to authenticated
  using (public.current_app_role() = 'supervisor')
  with check (public.current_app_role() = 'supervisor');

create policy "operations read their orders"
  on public.work_orders for select to authenticated
  using (public.can_manage_operations() or public.is_team_member(assigned_team_id));
create policy "operations manage work orders"
  on public.work_orders for all to authenticated
  using (public.can_manage_operations())
  with check (public.can_manage_operations());

create policy "operations read locations"
  on public.team_locations for select to authenticated
  using (public.can_manage_operations() or public.is_team_member(team_id));
create policy "operations read order history"
  on public.work_order_status_history for select to authenticated
  using (
    public.can_manage_operations()
    or exists (select 1 from public.work_orders work_order where work_order.id = work_order_status_history.work_order_id and public.is_team_member(work_order.assigned_team_id))
  );
create policy "supervisor reads audit logs"
  on public.audit_logs for select to authenticated
  using (public.current_app_role() = 'supervisor');

create or replace function public.submit_team_location(
  p_team_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters numeric,
  p_heading_degrees numeric,
  p_speed_mps numeric,
  p_recorded_at timestamptz,
  p_client_event_id uuid
)
returns public.team_locations
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inserted_location public.team_locations;
begin
  if auth.uid() is null or not public.is_team_member(p_team_id) then
    raise exception 'Not authorized to report this team location' using errcode = '42501';
  end if;

  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid geographic coordinates' using errcode = '22023';
  end if;

  insert into public.team_locations (
    team_id, device_user_id, location, accuracy_meters, heading_degrees, speed_mps, recorded_at, client_event_id
  ) values (
    p_team_id, auth.uid(), st_setsrid(st_makepoint(p_longitude, p_latitude), 4326),
    p_accuracy_meters, p_heading_degrees, p_speed_mps, coalesce(p_recorded_at, now()), p_client_event_id
  )
  on conflict (client_event_id) do update set received_at = public.team_locations.received_at
  returning * into inserted_location;

  return inserted_location;
end;
$$;

create or replace function public.update_my_work_order_status(
  p_work_order_id uuid,
  p_new_status public.work_order_status,
  p_reason text,
  p_client_event_id uuid
)
returns public.work_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.work_orders;
  updated_order public.work_orders;
begin
  select work_order.* into current_order
  from public.work_orders work_order
  where work_order.id = p_work_order_id
    and public.is_team_member(work_order.assigned_team_id)
  for update;

  if not found then
    raise exception 'Work order is not assigned to the current technician' using errcode = '42501';
  end if;

  if p_new_status = 'suspended' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Suspension reason is required' using errcode = '22023';
  end if;

  if current_order.status in ('completed', 'suspended') then
    raise exception 'A closed work order cannot be changed by a technician' using errcode = '22023';
  end if;

  if exists (select 1 from public.work_order_status_history where client_event_id = p_client_event_id) then
    return current_order;
  end if;

  update public.work_orders
  set status = p_new_status,
      suspension_reason = case when p_new_status = 'suspended' then trim(p_reason) else null end
  where id = current_order.id
  returning * into updated_order;

  insert into public.work_order_status_history (
    work_order_id, previous_status, new_status, reason, changed_by, client_event_id
  ) values (
    current_order.id, current_order.status, p_new_status,
    case when p_new_status = 'suspended' then trim(p_reason) else null end,
    auth.uid(), p_client_event_id
  );

  return updated_order;
end;
$$;

revoke all on function public.submit_team_location(uuid, double precision, double precision, numeric, numeric, numeric, timestamptz, uuid) from public;
revoke all on function public.update_my_work_order_status(uuid, public.work_order_status, text, uuid) from public;
grant execute on function public.submit_team_location(uuid, double precision, double precision, numeric, numeric, numeric, timestamptz, uuid) to authenticated;
grant execute on function public.update_my_work_order_status(uuid, public.work_order_status, text, uuid) to authenticated;

create or replace function public.audit_work_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old is distinct from new then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values (
      auth.uid(),
      'work_order.updated',
      'work_order',
      new.id,
      jsonb_build_object('old_status', old.status, 'new_status', new.status, 'assigned_team_id', new.assigned_team_id)
    );
  end if;
  return new;
end;
$$;

revoke all on function public.audit_work_order_change() from public;
create trigger work_orders_audit_change
  after update on public.work_orders
  for each row execute function public.audit_work_order_change();
