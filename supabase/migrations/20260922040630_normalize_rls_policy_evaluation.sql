-- An ALL policy also participates in SELECT evaluation. Split catalog changes
-- into their actual operations so each table keeps one SELECT policy.
drop policy if exists "supervisor manages boxes" on public.distribution_boxes;
create policy "supervisor inserts boxes" on public.distribution_boxes for insert to authenticated with check (public.current_app_role() = 'supervisor');
create policy "supervisor updates boxes" on public.distribution_boxes for update to authenticated using (public.current_app_role() = 'supervisor') with check (public.current_app_role() = 'supervisor');
create policy "supervisor deletes boxes" on public.distribution_boxes for delete to authenticated using (public.current_app_role() = 'supervisor');

drop policy if exists "supervisor manages nodes" on public.network_nodes;
create policy "supervisor inserts nodes" on public.network_nodes for insert to authenticated with check (public.current_app_role() = 'supervisor');
create policy "supervisor updates nodes" on public.network_nodes for update to authenticated using (public.current_app_role() = 'supervisor') with check (public.current_app_role() = 'supervisor');
create policy "supervisor deletes nodes" on public.network_nodes for delete to authenticated using (public.current_app_role() = 'supervisor');

drop policy if exists "supervisor manages teams" on public.teams;
create policy "supervisor inserts teams" on public.teams for insert to authenticated with check (public.current_app_role() = 'supervisor');
create policy "supervisor updates teams" on public.teams for update to authenticated using (public.current_app_role() = 'supervisor') with check (public.current_app_role() = 'supervisor');
create policy "supervisor deletes teams" on public.teams for delete to authenticated using (public.current_app_role() = 'supervisor');

drop policy if exists "supervisor manages technicians" on public.technicians;
create policy "supervisor inserts technicians" on public.technicians for insert to authenticated with check (public.current_app_role() = 'supervisor');
create policy "supervisor updates technicians" on public.technicians for update to authenticated using (public.current_app_role() = 'supervisor') with check (public.current_app_role() = 'supervisor');
create policy "supervisor deletes technicians" on public.technicians for delete to authenticated using (public.current_app_role() = 'supervisor');

drop policy if exists "supervisor manages vehicles" on public.vehicles;
create policy "supervisor inserts vehicles" on public.vehicles for insert to authenticated with check (public.current_app_role() = 'supervisor');
create policy "supervisor updates vehicles" on public.vehicles for update to authenticated using (public.current_app_role() = 'supervisor') with check (public.current_app_role() = 'supervisor');
create policy "supervisor deletes vehicles" on public.vehicles for delete to authenticated using (public.current_app_role() = 'supervisor');

drop policy if exists "supervisor manages zones" on public.zones;
create policy "supervisor inserts zones" on public.zones for insert to authenticated with check (public.current_app_role() = 'supervisor');
create policy "supervisor updates zones" on public.zones for update to authenticated using (public.current_app_role() = 'supervisor') with check (public.current_app_role() = 'supervisor');
create policy "supervisor deletes zones" on public.zones for delete to authenticated using (public.current_app_role() = 'supervisor');

drop policy if exists "operations manage work orders" on public.work_orders;
create policy "operations insert work orders" on public.work_orders for insert to authenticated with check (public.can_manage_operations());
create policy "operations update work orders" on public.work_orders for update to authenticated using (public.can_manage_operations()) with check (public.can_manage_operations());
create policy "operations delete work orders" on public.work_orders for delete to authenticated using (public.can_manage_operations());

-- Supervisors retain visibility of inactive profiles; all other access matches
-- the prior own-profile and active operational-directory predicates.
drop policy if exists "operations read active profile directory" on public.profiles;
drop policy if exists "supervisors read all profiles" on public.profiles;
drop policy if exists "users read their own profile" on public.profiles;
create policy "authorized profile reads" on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or (active and private.can_read_profile_directory())
  or public.current_app_role() = 'supervisor'
);
