create extension if not exists postgis with schema extensions;

create type public.app_role as enum ('supervisor', 'coordinator', 'technician');
create type public.work_order_status as enum ('pending', 'en_route', 'in_progress', 'completed', 'suspended');
create type public.work_order_type as enum ('technical_assistance', 'new_installation', 'service_transfer', 'network_maintenance');
create type public.availability_status as enum ('available', 'unavailable', 'on_service');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  document_number text,
  phone text,
  availability public.availability_status not null default 'available',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  model text,
  vehicle_type text,
  status public.availability_status not null default 'available',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  technician_one_id uuid not null references public.technicians(id),
  technician_two_id uuid not null references public.technicians(id),
  vehicle_id uuid not null references public.vehicles(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_distinct_technicians check (technician_one_id <> technician_two_id)
);

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  boundary extensions.geometry(Polygon, 4326),
  created_at timestamptz not null default now()
);

create table public.network_nodes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text,
  location extensions.geometry(Point, 4326) not null,
  zone_id uuid references public.zones(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.distribution_boxes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  node_id uuid references public.network_nodes(id) on delete set null,
  location extensions.geometry(Point, 4326) not null,
  created_at timestamptz not null default now()
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_code text,
  customer_name text,
  customer_phone text,
  address text not null,
  location extensions.geometry(Point, 4326),
  task_type public.work_order_type not null,
  status public.work_order_status not null default 'pending',
  priority integer not null default 3 check (priority between 1 and 5),
  zone_id uuid references public.zones(id) on delete set null,
  node_id uuid references public.network_nodes(id) on delete set null,
  box_id uuid references public.distribution_boxes(id) on delete set null,
  assigned_team_id uuid references public.teams(id) on delete set null,
  scheduled_for date not null,
  suspension_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suspended_orders_require_reason check (status <> 'suspended' or nullif(trim(suspension_reason), '') is not null)
);

create table public.team_locations (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  device_user_id uuid not null references public.profiles(id) on delete restrict,
  location extensions.geometry(Point, 4326) not null,
  accuracy_meters numeric,
  heading_degrees numeric,
  speed_mps numeric,
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  client_event_id uuid not null unique
);

create table public.work_order_status_history (
  id bigint generated always as identity primary key,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  previous_status public.work_order_status,
  new_status public.work_order_status not null,
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  client_event_id uuid unique
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index team_locations_team_received_idx on public.team_locations(team_id, received_at desc);
create index team_locations_location_gist_idx on public.team_locations using gist(location);
create index work_orders_location_gist_idx on public.work_orders using gist(location);
create index network_nodes_location_gist_idx on public.network_nodes using gist(location);
create index distribution_boxes_location_gist_idx on public.distribution_boxes using gist(location);
create index work_orders_daily_status_idx on public.work_orders(scheduled_for, status);

alter table public.profiles enable row level security;
alter table public.technicians enable row level security;
alter table public.vehicles enable row level security;
alter table public.teams enable row level security;
alter table public.zones enable row level security;
alter table public.network_nodes enable row level security;
alter table public.distribution_boxes enable row level security;
alter table public.work_orders enable row level security;
alter table public.team_locations enable row level security;
alter table public.work_order_status_history enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security invoker
as $$
  select role from public.profiles where id = (select auth.uid()) and active;
$$;

create policy "authenticated users can read active profiles"
  on public.profiles for select to authenticated
  using (active or id = (select auth.uid()));

create policy "operations can read reference data"
  on public.technicians for select to authenticated
  using (public.current_app_role() in ('supervisor', 'coordinator', 'technician'));
create policy "operations can read vehicles"
  on public.vehicles for select to authenticated
  using (public.current_app_role() in ('supervisor', 'coordinator', 'technician'));
create policy "operations can read teams"
  on public.teams for select to authenticated
  using (public.current_app_role() in ('supervisor', 'coordinator', 'technician'));
create policy "operations can read geography"
  on public.zones for select to authenticated using (true);
create policy "operations can read nodes"
  on public.network_nodes for select to authenticated using (true);
create policy "operations can read boxes"
  on public.distribution_boxes for select to authenticated using (true);

create policy "operations can read work orders"
  on public.work_orders for select to authenticated
  using (public.current_app_role() in ('supervisor', 'coordinator', 'technician'));
create policy "supervisor and coordinator manage work orders"
  on public.work_orders for all to authenticated
  using (public.current_app_role() in ('supervisor', 'coordinator'))
  with check (public.current_app_role() in ('supervisor', 'coordinator'));
create policy "technician updates assigned work orders"
  on public.work_orders for update to authenticated
  using (assigned_team_id in (select id from public.teams where technician_one_id in (select id from public.technicians where profile_id = (select auth.uid())) or technician_two_id in (select id from public.technicians where profile_id = (select auth.uid()))))
  with check (assigned_team_id in (select id from public.teams where technician_one_id in (select id from public.technicians where profile_id = (select auth.uid())) or technician_two_id in (select id from public.technicians where profile_id = (select auth.uid()))));

create policy "operations can read team locations"
  on public.team_locations for select to authenticated
  using (public.current_app_role() in ('supervisor', 'coordinator', 'technician'));
create policy "technicians insert team locations"
  on public.team_locations for insert to authenticated
  with check (device_user_id = (select auth.uid()));

create policy "operations can read status history"
  on public.work_order_status_history for select to authenticated using (true);
create policy "authenticated users insert status history"
  on public.work_order_status_history for insert to authenticated
  with check (changed_by = (select auth.uid()));

create policy "supervisor reads audit logs"
  on public.audit_logs for select to authenticated
  using (public.current_app_role() = 'supervisor');

revoke all on public.audit_logs from authenticated;
grant select on public.audit_logs to authenticated;
