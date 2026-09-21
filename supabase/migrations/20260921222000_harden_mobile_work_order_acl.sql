-- Keep the mobile projection callable only by authenticated clients.
-- Explicitly revoke both PUBLIC and anon because Supabase exposes anon as a
-- distinct database role while PUBLIC privileges can otherwise be inherited.
revoke all on function public.my_assigned_work_orders() from public;
revoke all on function public.my_assigned_work_orders() from anon;
grant execute on function public.my_assigned_work_orders() to authenticated;
