-- Recreating the mobile projection can restore direct role grants depending on
-- the project defaults. Keep this security-definer RPC unavailable to anon.
revoke all on function public.my_assigned_work_orders() from public, anon;
grant execute on function public.my_assigned_work_orders() to authenticated;
