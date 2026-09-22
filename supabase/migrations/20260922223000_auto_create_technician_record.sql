-- Keep authentication accounts and operational technician records in sync.
-- A technician account must be selectable in teams immediately after creation.

create or replace function public.ensure_technician_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'technician' then
    insert into public.technicians (profile_id, phone, availability, active)
    select new.id, new.phone, 'available', new.active
    where not exists (
      select 1 from public.technicians where profile_id = new.id
    );
  end if;
  return new;
end;
$$;

revoke all on function public.ensure_technician_record() from public;

drop trigger if exists profiles_create_technician on public.profiles;
create trigger profiles_create_technician
  after insert or update of role on public.profiles
  for each row execute function public.ensure_technician_record();

-- Backfill technician records for accounts created before this synchronization.
insert into public.technicians (profile_id, phone, availability, active)
select profile.id, profile.phone, 'available', profile.active
from public.profiles profile
where profile.role = 'technician'
  and not exists (
    select 1 from public.technicians technician where technician.profile_id = profile.id
  );
