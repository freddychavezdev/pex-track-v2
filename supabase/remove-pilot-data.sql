-- PEX Track: retiro controlado de los datos de demostración PRUEBA-.
-- No ejecutar mientras se necesiten los registros piloto.

begin;

delete from public.work_orders where code like 'PRUEBA-OT-%';
delete from public.teams where code = 'PRUEBA-CUADRILLA-01';
delete from public.vehicles where plate = 'PRUEBA-VEH-01';
delete from public.technicians where document_number in ('PRUEBA-TEC-01', 'PRUEBA-TEC-02');

commit;
