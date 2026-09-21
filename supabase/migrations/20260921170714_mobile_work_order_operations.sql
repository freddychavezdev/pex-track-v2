-- The Android client receives only its own active work orders. The projection
-- avoids exposing customer contact details in the field application.
create or replace function public.my_assigned_work_orders()
returns table (
  id uuid,
  code text,
  address text,
  task_type text,
  status text,
  priority integer,
  scheduled_for date,
  suspension_reason text
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
    work_order.scheduled_for,
    work_order.suspension_reason
  from public.work_orders work_order
  where public.is_team_member(work_order.assigned_team_id)
    and work_order.status not in ('completed', 'suspended')
  order by work_order.priority, work_order.scheduled_for, work_order.code;
end;
$$;

-- Replaces the first-pass status RPC with explicit transitions and keeps the
-- client event check before validation, preserving idempotency after a lost reply.
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
  if p_client_event_id is null then
    raise exception 'Client event ID is required' using errcode = '22023';
  end if;

  select work_order.* into current_order
  from public.work_orders work_order
  where work_order.id = p_work_order_id
    and public.is_team_member(work_order.assigned_team_id)
  for update;

  if not found then
    raise exception 'Work order is not assigned to the current technician' using errcode = '42501';
  end if;

  if exists (select 1 from public.work_order_status_history where client_event_id = p_client_event_id) then
    return current_order;
  end if;

  if p_new_status = 'suspended' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Suspension reason is required' using errcode = '22023';
  end if;

  if not (
    (current_order.status = 'pending' and p_new_status in ('en_route', 'suspended'))
    or (current_order.status = 'en_route' and p_new_status in ('in_progress', 'suspended'))
    or (current_order.status = 'in_progress' and p_new_status in ('completed', 'suspended'))
  ) then
    raise exception 'Invalid work order status transition' using errcode = '22023';
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

revoke all on function public.my_assigned_work_orders() from public;
revoke all on function public.update_my_work_order_status(uuid, public.work_order_status, text, uuid) from public;
grant execute on function public.my_assigned_work_orders() to authenticated;
grant execute on function public.update_my_work_order_status(uuid, public.work_order_status, text, uuid) to authenticated;
