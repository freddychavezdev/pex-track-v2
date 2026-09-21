alter table public.audit_logs add column if not exists ip_address inet;
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, occurred_at desc);

create or replace function public.request_ip()
returns inet
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  raw_ip text;
begin
  raw_ip := split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1);
  if nullif(trim(raw_ip), '') is null then return null; end if;
  return trim(raw_ip)::inet;
exception when others then
  return null;
end;
$$;

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
      auth.uid(), 'work_order.updated', 'work_order', new.id,
      jsonb_build_object('old_status', old.status, 'new_status', new.status, 'assigned_team_id', new.assigned_team_id),
      public.request_ip()
    );
  end if;
  return new;
end;
$$;

create or replace function public.audit_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  target_id := case when tg_op = 'DELETE' then old.id else new.id end;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details, ip_address)
  values (
    auth.uid(), lower(tg_table_name) || '.' || lower(tg_op), lower(tg_table_name), target_id,
    jsonb_build_object('operation', tg_op, 'active', case when tg_op = 'DELETE' then old.active else new.active end),
    public.request_ip()
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.request_ip() from public, anon, authenticated, service_role;
revoke all on function public.audit_catalog_change() from public, anon, authenticated, service_role;
revoke all on function public.audit_work_order_change() from public, anon, authenticated, service_role;

drop trigger if exists technicians_audit_change on public.technicians;
drop trigger if exists vehicles_audit_change on public.vehicles;
drop trigger if exists teams_audit_change on public.teams;
create trigger technicians_audit_change after insert or update or delete on public.technicians
  for each row execute function public.audit_catalog_change();
create trigger vehicles_audit_change after insert or update or delete on public.vehicles
  for each row execute function public.audit_catalog_change();
create trigger teams_audit_change after insert or update or delete on public.teams
  for each row execute function public.audit_catalog_change();
