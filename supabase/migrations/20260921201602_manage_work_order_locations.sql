create or replace function public.set_work_order_location(
  p_work_order_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns public.work_orders
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  updated_order public.work_orders;
begin
  if auth.uid() is null or not public.can_manage_operations() then
    raise exception 'Not authorized to set a work order location' using errcode = '42501';
  end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid geographic coordinates' using errcode = '22023';
  end if;
  update public.work_orders
  set location = st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)
  where id = p_work_order_id
  returning * into updated_order;
  if not found then
    raise exception 'Work order not found' using errcode = 'P0002';
  end if;
  return updated_order;
end;
$$;

revoke all on function public.set_work_order_location(uuid, double precision, double precision) from public;
grant execute on function public.set_work_order_location(uuid, double precision, double precision) to authenticated;
