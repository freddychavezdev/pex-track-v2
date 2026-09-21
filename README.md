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

La autenticación, asignación de cuadrilla y sincronización idempotente con Supabase están descritas en [docs/CONFIGURACION-SUPABASE-ANDROID.md](docs/CONFIGURACION-SUPABASE-ANDROID.md).

## Publicación web en Vercel

Importe el repositorio `freddychavezdev/pex-track-v2` en Vercel usando la raíz del repositorio. El archivo `vercel.json` ya configura la instalación, compilación, SPA fallback y encabezados de seguridad desde `apps/web`. La aplicación usa la URL y la clave publicable configuradas en `apps/web/src/environments/environment.ts`; si se decide externalizarlas durante el pipeline, use únicamente `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`, nunca una clave `service_role`.

La publicación de Vercel cubre únicamente el panel web. El APK Android se genera mediante GitHub Actions y requiere un proceso separado de firma y distribución.

El procedimiento completo de salida, firma y prueba piloto está en [docs/GO-LIVE.md](docs/GO-LIVE.md).
