-- PEX Track: datos piloto para demostración.
-- Crea una cuadrilla, vehículo y tres OTs inequívocamente identificados con PRUEBA-.
-- Es idempotente y reutiliza las dos primeras cuentas activas con rol technician.

begin;

do $$
declare
  technician_profile_one uuid;
  technician_profile_two uuid;
  technician_one uuid;
  technician_two uuid;
  pilot_vehicle uuid;
  pilot_team uuid;
begin
  select id into technician_profile_one
  from public.profiles
  where role = 'technician' and active
  order by id
  limit 1;

  select id into technician_profile_two
  from public.profiles
  where role = 'technician' and active
  order by id
  offset 1
  limit 1;

  if technician_profile_one is null or technician_profile_two is null then
    raise exception 'Se requieren dos perfiles activos con rol technician para cargar los datos piloto.';
  end if;

  select id into technician_one
  from public.technicians
  where profile_id = technician_profile_one and document_number = 'PRUEBA-TEC-01';

  if technician_one is null then
    if exists (select 1 from public.technicians where profile_id = technician_profile_one) then
      raise exception 'El primer perfil técnico ya está asociado a un técnico no piloto; no se modificó.';
    end if;

    insert into public.technicians (profile_id, document_number, phone, availability, active)
    values (technician_profile_one, 'PRUEBA-TEC-01', '70000001', 'available', true)
    returning id into technician_one;
  end if;

  select id into technician_two
  from public.technicians
  where profile_id = technician_profile_two and document_number = 'PRUEBA-TEC-02';

  if technician_two is null then
    if exists (select 1 from public.technicians where profile_id = technician_profile_two) then
      raise exception 'El segundo perfil técnico ya está asociado a un técnico no piloto; no se modificó.';
    end if;

    insert into public.technicians (profile_id, document_number, phone, availability, active)
    values (technician_profile_two, 'PRUEBA-TEC-02', '70000002', 'available', true)
    returning id into technician_two;
  end if;

  insert into public.vehicles (plate, model, vehicle_type, status, active)
  values ('PRUEBA-VEH-01', 'Vehículo demostración', 'Camioneta', 'available', true)
  on conflict (plate) do update
    set model = excluded.model,
        vehicle_type = excluded.vehicle_type,
        status = excluded.status,
        active = excluded.active
  returning id into pilot_vehicle;

  insert into public.teams (code, technician_one_id, technician_two_id, vehicle_id, active)
  values ('PRUEBA-CUADRILLA-01', technician_one, technician_two, pilot_vehicle, true)
  on conflict (code) do update
    set technician_one_id = excluded.technician_one_id,
        technician_two_id = excluded.technician_two_id,
        vehicle_id = excluded.vehicle_id,
        active = excluded.active
  returning id into pilot_team;

  insert into public.work_orders (
    code, customer_code, customer_name, customer_phone, address, location,
    task_type, status, priority, is_emergency, assigned_team_id, scheduled_for
  )
  values
    ('PRUEBA-OT-001', 'PRUEBA-CLIENTE-001', 'Cliente de prueba 001', '70000011',
      'PRUEBA — Zona Sopocachi, La Paz',
      extensions.ST_SetSRID(extensions.ST_MakePoint(-68.1320, -16.5080), 4326),
      'technical_assistance', 'pending', 2, false, pilot_team, current_date),
    ('PRUEBA-OT-002', 'PRUEBA-CLIENTE-002', 'Cliente de prueba 002', '70000012',
      'PRUEBA — Zona Miraflores, La Paz',
      extensions.ST_SetSRID(extensions.ST_MakePoint(-68.1190, -16.5000), 4326),
      'new_installation', 'pending', 3, false, pilot_team, current_date),
    ('PRUEBA-OT-003', 'PRUEBA-CLIENTE-003', 'Cliente de prueba 003', '70000013',
      'PRUEBA — Zona Obrajes, La Paz',
      extensions.ST_SetSRID(extensions.ST_MakePoint(-68.0860, -16.5360), 4326),
      'network_maintenance', 'pending', 1, true, pilot_team, current_date)
  on conflict (code) do update
    set customer_code = excluded.customer_code,
        customer_name = excluded.customer_name,
        customer_phone = excluded.customer_phone,
        address = excluded.address,
        location = excluded.location,
        task_type = excluded.task_type,
        status = excluded.status,
        priority = excluded.priority,
        is_emergency = excluded.is_emergency,
        assigned_team_id = excluded.assigned_team_id,
        scheduled_for = excluded.scheduled_for,
        suspension_reason = null;
end $$;

commit;
