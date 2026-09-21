alter table public.work_orders
  add column if not exists is_emergency boolean not null default false;

create index if not exists work_orders_emergency_day_idx
  on public.work_orders(scheduled_for, is_emergency)
  where is_emergency;
