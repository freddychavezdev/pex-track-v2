-- Administrative catalog read access. User creation and role changes remain
-- server-side in the admin-users Edge Function; the browser never receives a
-- service-role key.
create policy "supervisors read all profiles"
  on public.profiles for select to authenticated
  using (public.current_app_role() = 'supervisor');

create index if not exists technicians_profile_id_idx
  on public.technicians(profile_id);

create index if not exists teams_technician_one_idx
  on public.teams(technician_one_id);

create index if not exists teams_technician_two_idx
  on public.teams(technician_two_id);
