# PEX Track

Sistema de monitoreo y gestión operativa para la Subárea de Planta Externa.

## Estructura

- `apps/web`: panel web Angular + PrimeNG.
- `apps/mobile`: aplicación Android nativa Kotlin (seguimiento GPS y operación offline).
- `supabase`: migraciones, funciones y configuración de base de datos.
- `docs`: decisiones de arquitectura, alcance y criterios de aceptación.

## Desarrollo local

El panel web se ejecuta desde `apps/web` con `npm start`. La conexión a Supabase se configura mediante variables `NG_APP_SUPABASE_URL` y `NG_APP_SUPABASE_PUBLISHABLE_KEY`.

El proyecto no utiliza claves secretas en los clientes. Las operaciones privilegiadas deben ejecutarse mediante RLS, funciones SQL seguras o Edge Functions.
