-- Restrict callable database functions to the roles that need them. These
-- functions are exposed through PostgREST, so PUBLIC/anon execution must not
-- remain enabled by PostgreSQL's default ACL.
revoke all on function public.add_my_work_order_note(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.add_my_work_order_note(uuid, text, uuid)
  to authenticated;

revoke all on function public.audit_work_order_change()
  from public, anon, authenticated, service_role;

revoke all on function public.current_team_id()
  from public, anon, authenticated, service_role;
grant execute on function public.current_team_id()
  to authenticated;

revoke all on function public.handle_new_auth_user()
  from public, anon, authenticated, service_role;

revoke all on function public.is_team_member(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.is_team_member(uuid)
  to authenticated;

revoke all on function public.my_assigned_work_orders()
  from public, anon, authenticated, service_role;
grant execute on function public.my_assigned_work_orders()
  to authenticated;

revoke all on function public.operational_map_snapshot(date)
  from public, anon, authenticated, service_role;
grant execute on function public.operational_map_snapshot(date)
  to authenticated;

revoke all on function public.submit_team_location(
  uuid, double precision, double precision, numeric, numeric, numeric, timestamptz, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.submit_team_location(
  uuid, double precision, double precision, numeric, numeric, numeric, timestamptz, uuid
) to authenticated;

revoke all on function public.update_my_work_order_status(
  uuid, public.work_order_status, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.update_my_work_order_status(
  uuid, public.work_order_status, text, uuid
) to authenticated;

revoke all on function public.weekly_report_summary(date, date)
  from public, anon, authenticated, service_role;
grant execute on function public.weekly_report_summary(date, date)
  to authenticated;

-- Pin invoker helper search paths so future objects cannot shadow references.
alter function public.current_app_role() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.can_manage_operations() set search_path = public;

-- Foreign-key indexes identified by the Supabase advisor. The existing
-- composite indexes already cover team_locations.team_id and
-- work_order_notes.work_order_id.
create index if not exists technicians_profile_id_idx
  on public.technicians(profile_id);
create index if not exists teams_technician_one_id_idx
  on public.teams(technician_one_id);
create index if not exists teams_technician_two_id_idx
  on public.teams(technician_two_id);
create index if not exists teams_vehicle_id_idx
  on public.teams(vehicle_id);
create index if not exists network_nodes_zone_id_idx
  on public.network_nodes(zone_id);
create index if not exists distribution_boxes_node_id_idx
  on public.distribution_boxes(node_id);
create index if not exists work_orders_zone_id_idx
  on public.work_orders(zone_id);
create index if not exists work_orders_node_id_idx
  on public.work_orders(node_id);
create index if not exists work_orders_box_id_idx
  on public.work_orders(box_id);
create index if not exists work_orders_assigned_team_id_idx
  on public.work_orders(assigned_team_id);
create index if not exists work_orders_created_by_idx
  on public.work_orders(created_by);
create index if not exists team_locations_device_user_id_idx
  on public.team_locations(device_user_id);
create index if not exists work_order_status_history_work_order_id_idx
  on public.work_order_status_history(work_order_id);
create index if not exists work_order_status_history_changed_by_idx
  on public.work_order_status_history(changed_by);
create index if not exists work_order_notes_author_id_idx
  on public.work_order_notes(author_id);
create index if not exists audit_logs_actor_id_idx
  on public.audit_logs(actor_id);
