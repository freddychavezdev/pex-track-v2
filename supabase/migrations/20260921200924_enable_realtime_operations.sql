-- Publish operational changes so supervisors and coordinators see the map and
-- order board update without manual polling. RLS remains the authorization
-- boundary for every row delivered to authenticated clients.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['work_orders', 'team_locations', 'work_order_status_history'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
