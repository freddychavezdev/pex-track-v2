-- Aggregated operational data for the weekly management report. Technicians do
-- not receive this cross-team view; it is derived server-side after role check.
create or replace function public.weekly_report_summary(p_start_day date, p_end_day date)
returns table (
  team_code text,
  team_id uuid,
  total_orders bigint,
  completed_orders bigint,
  active_orders bigint,
  pending_orders bigint,
  suspended_orders bigint,
  completion_rate numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_manage_operations() then
    raise exception 'Not authorized to generate operational reports' using errcode = '42501';
  end if;

  if p_start_day is null or p_end_day is null or p_end_day < p_start_day then
    raise exception 'Invalid report date range' using errcode = '22023';
  end if;

  return query
  select
    coalesce(team.code, 'SIN_ASIGNAR'),
    work_order.assigned_team_id,
    count(*)::bigint,
    count(*) filter (where work_order.status = 'completed')::bigint,
    count(*) filter (where work_order.status in ('en_route', 'in_progress'))::bigint,
    count(*) filter (where work_order.status = 'pending')::bigint,
    count(*) filter (where work_order.status = 'suspended')::bigint,
    round(100.0 * count(*) filter (where work_order.status = 'completed') / nullif(count(*), 0), 2)
  from public.work_orders work_order
  left join public.teams team on team.id = work_order.assigned_team_id
  where work_order.scheduled_for between p_start_day and p_end_day
  group by team.code, work_order.assigned_team_id
  order by team.code nulls last;
end;
$$;

revoke all on function public.weekly_report_summary(date, date) from public;
grant execute on function public.weekly_report_summary(date, date) to authenticated;
