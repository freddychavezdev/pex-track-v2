-- PEX Track: red piloto para demostración en La Paz y El Alto.
-- Datos inequívocamente identificados como PRUEBA-. Es seguro ejecutarlo más de una vez.

begin;

with pilot_nodes(code, name, city, latitude, longitude) as (
  values
    ('PRUEBA-NODO-LP-01', 'Miraflores', 'La Paz', -16.5002, -68.1268),
    ('PRUEBA-NODO-LP-02', 'Sopocachi', 'La Paz', -16.5116, -68.1295),
    ('PRUEBA-NODO-LP-03', 'Obrajes', 'La Paz', -16.5294, -68.1023),
    ('PRUEBA-NODO-LP-04', 'San Miguel', 'La Paz', -16.5418, -68.0836),
    ('PRUEBA-NODO-LP-05', 'Villa Fátima', 'La Paz', -16.4833, -68.1177),
    ('PRUEBA-NODO-EA-01', 'Ciudad Satélite', 'El Alto', -16.5201, -68.1946),
    ('PRUEBA-NODO-EA-02', '12 de Octubre', 'El Alto', -16.5006, -68.1910),
    ('PRUEBA-NODO-EA-03', 'Villa Adela', 'El Alto', -16.5483, -68.2064),
    ('PRUEBA-NODO-EA-04', 'Senkata', 'El Alto', -16.5564, -68.2332),
    ('PRUEBA-NODO-EA-05', 'Río Seco', 'El Alto', -16.4763, -68.1908)
)
insert into public.network_nodes (code, name, location)
select code, concat('PRUEBA — ', name, ', ', city),
  extensions.ST_SetSRID(extensions.ST_MakePoint(longitude, latitude), 4326)
from pilot_nodes
on conflict (code) do update
  set name = excluded.name,
      location = excluded.location;

with pilot_boxes(code, node_code, latitude, longitude) as (
  values
    ('PRUEBA-CAJA-LP-01A', 'PRUEBA-NODO-LP-01', -16.5008, -68.1275),
    ('PRUEBA-CAJA-LP-01B', 'PRUEBA-NODO-LP-01', -16.4995, -68.1259),
    ('PRUEBA-CAJA-LP-02A', 'PRUEBA-NODO-LP-02', -16.5122, -68.1302),
    ('PRUEBA-CAJA-LP-02B', 'PRUEBA-NODO-LP-02', -16.5109, -68.1287),
    ('PRUEBA-CAJA-LP-03A', 'PRUEBA-NODO-LP-03', -16.5300, -68.1030),
    ('PRUEBA-CAJA-LP-03B', 'PRUEBA-NODO-LP-03', -16.5287, -68.1016),
    ('PRUEBA-CAJA-LP-04A', 'PRUEBA-NODO-LP-04', -16.5425, -68.0843),
    ('PRUEBA-CAJA-LP-04B', 'PRUEBA-NODO-LP-04', -16.5411, -68.0829),
    ('PRUEBA-CAJA-LP-05A', 'PRUEBA-NODO-LP-05', -16.4840, -68.1185),
    ('PRUEBA-CAJA-LP-05B', 'PRUEBA-NODO-LP-05', -16.4826, -68.1169),
    ('PRUEBA-CAJA-EA-01A', 'PRUEBA-NODO-EA-01', -16.5207, -68.1955),
    ('PRUEBA-CAJA-EA-01B', 'PRUEBA-NODO-EA-01', -16.5194, -68.1938),
    ('PRUEBA-CAJA-EA-02A', 'PRUEBA-NODO-EA-02', -16.5013, -68.1918),
    ('PRUEBA-CAJA-EA-02B', 'PRUEBA-NODO-EA-02', -16.4999, -68.1902),
    ('PRUEBA-CAJA-EA-03A', 'PRUEBA-NODO-EA-03', -16.5490, -68.2072),
    ('PRUEBA-CAJA-EA-03B', 'PRUEBA-NODO-EA-03', -16.5475, -68.2055),
    ('PRUEBA-CAJA-EA-04A', 'PRUEBA-NODO-EA-04', -16.5571, -68.2340),
    ('PRUEBA-CAJA-EA-04B', 'PRUEBA-NODO-EA-04', -16.5557, -68.2324),
    ('PRUEBA-CAJA-EA-05A', 'PRUEBA-NODO-EA-05', -16.4770, -68.1916),
    ('PRUEBA-CAJA-EA-05B', 'PRUEBA-NODO-EA-05', -16.4756, -68.1900)
)
insert into public.distribution_boxes (code, node_id, location)
select box.code, node.id,
  extensions.ST_SetSRID(extensions.ST_MakePoint(box.longitude, box.latitude), 4326)
from pilot_boxes box
join public.network_nodes node on node.code = box.node_code
on conflict (code) do update
  set node_id = excluded.node_id,
      location = excluded.location;

commit;

-- Verificación esperada: 10 nodos y 20 cajas piloto.
select
  (select count(*) from public.network_nodes where code like 'PRUEBA-NODO-%') as nodos_piloto,
  (select count(*) from public.distribution_boxes where code like 'PRUEBA-CAJA-%') as cajas_piloto;
