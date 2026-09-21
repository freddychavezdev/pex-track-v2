# PEX Track - decisiones de arquitectura

## Alcance de la primera versión productiva

La primera versión productiva incluye autenticación, roles, técnicos, vehículos,
cuadrillas, importación de OTs, asignación, estados, monitoreo de posiciones,
modo offline, sincronización, emergencias, histórico y reportes básicos.

Las funciones de ruteo avanzado, transcripción de voz y ETA con tráfico real se
implementarán detrás de interfaces sustituibles. El sistema debe funcionar sin
ellas mediante asignación manual, bitácora escrita y ETA basado en ruta sin tráfico.

## Decisiones

1. Angular + PrimeNG para el panel web.
2. Supabase para Auth, PostgreSQL, PostGIS, Storage y Realtime.
3. Kotlin nativo para Android, porque el seguimiento con pantalla bloqueada requiere
   un foreground service y control explícito de permisos.
4. Room/SQLite para la cola offline del móvil.
5. Realtime de Supabase para actualizaciones del panel; Vercel no actúa como servidor
   WebSocket.
6. Toda autorización real se aplica en RLS y en operaciones del servidor; ocultar
   controles en Angular no es una medida de seguridad.
7. Las posiciones se registran con `recorded_at`, precisión, rumbo y última señal.
   La interfaz siempre muestra la antigüedad de la posición.

## Condiciones de producción

- El mapa debe usar un proveedor de tiles permitido para producción.
- El cálculo de ruta debe usar un motor de calles separado de PostGIS.
- Las coordenadas de clientes, cajas y nodos deben estar disponibles o definirse un
  proceso de geocodificación autorizado.
- Los reportes PDF y XLSX se generan con bibliotecas de reportes, no con PrimeNG.
- Las pruebas deben realizarse en Android 9 y versiones posteriores, incluyendo
  pantalla bloqueada, ahorro de batería, pérdida de señal y reinicio del teléfono.
