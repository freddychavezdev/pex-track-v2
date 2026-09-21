-- Voice input is transcribed on Android and stored as text only. No audio
-- blob is uploaded or retained by PEX Track.
create table public.work_order_notes (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  transcript text not null check (
    char_length(trim(transcript)) between 1 and 4000
  ),
  client_event_id uuid not null unique,
  created_at timestamptz not null default now()
);

create index work_order_notes_order_created_idx
  on public.work_order_notes(work_order_id, created_at desc);

alter table public.work_order_notes enable row level security;

revoke all on public.work_order_notes from anon, authenticated;
grant select, insert on public.work_order_notes to authenticated;

create policy "operations read assigned order notes"
  on public.work_order_notes for select to authenticated
  using (
    public.can_manage_operations()
    or exists (
      select 1
      from public.work_orders work_order
      where work_order.id = work_order_notes.work_order_id
        and public.is_team_member(work_order.assigned_team_id)
    )
  );

create policy "technicians create assigned order notes"
  on public.work_order_notes for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.current_app_role() = 'technician'
    and exists (
      select 1
      from public.work_orders work_order
      where work_order.id = work_order_notes.work_order_id
        and public.is_team_member(work_order.assigned_team_id)
    )
  );

create or replace function public.add_my_work_order_note(
  p_work_order_id uuid,
  p_transcript text,
  p_client_event_id uuid
)
returns public.work_order_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_note public.work_order_notes;
  inserted_note public.work_order_notes;
  normalized_transcript text;
begin
  if auth.uid() is null or public.current_app_role() <> 'technician' then
    raise exception 'Not authorized to add work order notes' using errcode = '42501';
  end if;

  if p_client_event_id is null then
    raise exception 'Client event ID is required' using errcode = '22023';
  end if;

  normalized_transcript := nullif(trim(coalesce(p_transcript, '')), '');
  if normalized_transcript is null then
    raise exception 'The transcription cannot be empty' using errcode = '22023';
  end if;
  if char_length(normalized_transcript) > 4000 then
    raise exception 'The transcription is too long' using errcode = '22023';
  end if;

  select note.* into existing_note
  from public.work_order_notes note
  where note.client_event_id = p_client_event_id;
  if found then
    return existing_note;
  end if;

  if not exists (
    select 1
    from public.work_orders work_order
    where work_order.id = p_work_order_id
      and public.is_team_member(work_order.assigned_team_id)
      and work_order.status not in ('completed', 'suspended')
  ) then
    raise exception 'Work order is not assigned to the current technician' using errcode = '42501';
  end if;

  insert into public.work_order_notes (
    work_order_id, author_id, transcript, client_event_id
  ) values (
    p_work_order_id, auth.uid(), normalized_transcript, p_client_event_id
  ) returning * into inserted_note;

  return inserted_note;
end;
$$;

revoke all on function public.add_my_work_order_note(uuid, text, uuid) from public;
grant execute on function public.add_my_work_order_note(uuid, text, uuid) to authenticated;

-- Keep the mobile projection narrow while exposing the most recent note for
-- the technician to review and edit before dictating a new observation.
drop function if exists public.my_assigned_work_orders();

create or replace function public.my_assigned_work_orders()
returns table (
  id uuid,
  code text,
  address text,
  task_type text,
  status text,
  priority integer,
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
