begin;
select plan(15);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.work_orders'::regclass),
  'work_orders has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.team_locations'::regclass),
  'team_locations has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_logs'::regclass),
  'audit_logs has row level security enabled'
);
select ok(
  not has_table_privilege('anon', 'public.work_orders', 'select, insert, update, delete'),
  'anon has no work order table privileges'
);
select ok(
  not has_table_privilege('authenticated', 'public.team_locations', 'insert, update, delete'),
  'authenticated clients cannot write raw team locations'
);
select ok(
  has_table_privilege('authenticated', 'public.work_orders', 'select'),
  'authenticated clients can read orders only through policies'
);
select ok(
  has_function_privilege('authenticated', 'public.submit_team_location(uuid, double precision, double precision, numeric, numeric, numeric, timestamptz, uuid)', 'execute'),
  'authenticated users can submit locations through the controlled RPC'
);
select ok(
  not has_function_privilege('anon', 'public.submit_team_location(uuid, double precision, double precision, numeric, numeric, numeric, timestamptz, uuid)', 'execute'),
  'anonymous users cannot submit locations'
);
select ok(
  not has_function_privilege('anon', 'public.update_my_work_order_status(uuid, public.work_order_status, text, uuid)', 'execute'),
  'anonymous users cannot update work order state'
);
select ok(
  has_function_privilege('authenticated', 'public.current_team_id()', 'execute'),
  'authenticated technicians can resolve only their current team through the controlled helper'
);
select ok(
  not has_function_privilege('anon', 'public.current_team_id()', 'execute'),
  'anonymous users cannot resolve team membership'
);
select ok(
  has_function_privilege('authenticated', 'public.operational_map_snapshot(date)', 'execute'),
  'authenticated operations users can request the controlled map snapshot'
);
select ok(
  not has_function_privilege('anon', 'public.operational_map_snapshot(date)', 'execute'),
  'anonymous users cannot request operational map markers'
);
select ok(
  has_function_privilege('authenticated', 'public.weekly_report_summary(date, date)', 'execute'),
  'authenticated operations users can request the weekly aggregate report'
);
select ok(
  not has_function_privilege('anon', 'public.weekly_report_summary(date, date)', 'execute'),
  'anonymous users cannot generate the weekly report'
);

select * from finish();
rollback;
