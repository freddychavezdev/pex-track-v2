revoke all on function public.set_work_order_location(uuid, double precision, double precision)
  from public, anon, authenticated, service_role;
grant execute on function public.set_work_order_location(uuid, double precision, double precision)
  to authenticated;
