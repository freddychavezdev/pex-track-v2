# PEX Track

Sistema de monitoreo y gestión operativa para la Subárea de Planta Externa.

## Estructura

- `apps/web`: panel web Angular + PrimeNG.
- `apps/mobile`: aplicación Android nativa Kotlin (seguimiento GPS y operación offline).
- `supabase`: migraciones, funciones y configuración de base de datos.
- `docs`: decisiones de arquitectura, alcance y criterios de aceptación.

## Desarrollo local

El panel web se ejecuta desde `apps/web` con `npm start`. Para conectar Supabase en desarrollo, copia los valores de `apps/web/src/environments/environment.example.ts` a `environment.ts`; solo debe incluirse la URL del proyecto y la clave publicable.

El proyecto no utiliza claves secretas en los clientes. Las operaciones privilegiadas deben ejecutarse mediante RLS, funciones SQL seguras o Edge Functions.

La integración continua compila el panel web y la aplicación Android en cada cambio. Vercel publica únicamente `apps/web`; la aplicación Android se distribuye mediante un flujo separado de compilación y firma.
