drop function if exists public.my_assigned_work_orders();

create or replace function public.my_assigned_work_orders()
returns table (
  id uuid,
  code text,
  address text,
  task_type text,
  status text,
  priority integer,
  is_emergency boolean,
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
  order by work_order.priority, work_order.scheduled_for, work_order.code;
end;
$$;

revoke all on function public.my_assigned_work_orders() from public;
grant execute on function public.my_assigned_work_orders() to authenticated;
