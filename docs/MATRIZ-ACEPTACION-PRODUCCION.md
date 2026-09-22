# PEX Track - matriz de aceptación y liberación

Actualizada: 2026-09-22.

Esta matriz contrasta el núcleo funcional del documento de análisis con la
implementación actual. El criterio **Implementado** significa que existe código
integrado, migraciones aplicadas y verificación automatizada o remota. No se
usa como sustituto de una prueba con personal, equipos y red reales.

## Cobertura funcional

| Requisito del documento | Estado | Evidencia en el producto |
| --- | --- | --- |
| RF-28/RF-29 - autenticación y RBAC | Implementado | Supabase Auth, perfiles activos, RLS y RPC con validación de rol; la Edge Function `admin-users` está protegida para la gestión del supervisor. |
| RF-01 a RF-10 - mapa, OTs, capas de red, alertas y cambios de estado | Implementado | Panel Angular/PrimeNG con Leaflet, capa PostGIS, Realtime, historial operativo y alertas de señal vencida/desvío. |
| RF-13 a RF-16 - OT prioritaria y emergencia | Implementado | Alta de emergencia, prioridad forzada, recomendación de cuadrillas por distancia/carga/señal y reasignación controlada. El ETA es referencial, sin tráfico. |
| RF-19 - secuencia de visitas | Implementado | Ruta sugerida, reordenamiento manual, aprobación atómica en Supabase y secuencia mostrada al técnico. |
| RF-20 a RF-22 - bitácora de atención | Implementado con alcance acordado | Android usa reconocimiento de voz nativo y guarda solo la transcripción editable, junto con estado, observación y fecha/hora. |
| RF-23 - audio de respaldo | Excluido por decisión del propietario | Se acordó explícitamente “solo transcribir el audio”; no se conserva audio ni se envía material de voz a Supabase. |
| RF-24 a RF-27 - administración operativa | Implementado | Panel de catálogos para usuarios, técnicos, vehículos y cuadrillas; importación validada y alta manual de OTs. |
| RF-34/RF-35 - modo offline y sincronización | Implementado | Room, WorkManager, sincronización idempotente, cola aislada por técnico/cuadrilla y límite de 500 operaciones. |
| RF-37 - reporte semanal | Implementado | Resumen semanal por cuadrilla, exportación CSV, XLSX y PDF desde el panel. El envío posterior es responsabilidad del Supervisor. |

## Requisitos técnicos acordados

| Componente | Implementación | Evidencia actual |
| --- | --- | --- |
| Panel de coordinación | Angular 20 + PrimeNG | Compilación y 9 pruebas unitarias exitosas en CI. |
| Datos y seguridad | Supabase, PostgreSQL y PostGIS | 22 migraciones aplicadas en `hlvhtnurrzzwagedcfub`, RLS y pruebas pgTAP. |
| Aplicación de técnicos | Kotlin nativo, Android mínimo 9 | Servicio de ubicación en primer plano, permisos por versión y builds debug/release exitosos. |
| Despliegue | GitHub + Vercel | `master` desplegado y `https://pex-track-v2.vercel.app/` responde HTTP 200. |
| Mapa | Leaflet y tiles públicos configurables | Capas operativas y marcadores alimentados por PostGIS; el proveedor definitivo depende del volumen real. |

## Evidencia de verificación disponible

- GitHub Actions aprobó los jobs `web`, `database` y `android` para el commit
  `b578a62`.
- Las migraciones locales y remotas coinciden; `supabase db lint --linked
  --schema public --level warning` no reporta errores.
- La prueba remota de rutas comprobó la secuencia 1, 2 y 3 para las OTs
  `PRUEBA-OT-*`; la proyección móvil devuelve la misma secuencia para el
  técnico de prueba.
- Vercel publicó el commit actual correctamente.

## Puertas obligatorias antes de liberar a operación

1. Completar la invitación enviada a la cuenta supervisora real y definir su
   contraseña; no se debe usar la cuenta de prueba para una operación real.
2. Configurar en Supabase Auth la URL del sitio y las redirecciones indicadas
   en [GO-LIVE.md](GO-LIVE.md).
3. Generar y respaldar la keystore oficial; luego cargar los secretos de firma
   de Android en GitHub Actions.
4. Ejecutar y registrar la prueba de campo en Android 9 y una versión reciente:
   GPS con pantalla bloqueada, modo avión, recuperación de red, dictado y
   cambio de sesión.
5. Validar con los responsables la experiencia en navegadores objetivo y el
   proveedor de tiles de mapa según volumen y condiciones de uso.

La salida del código puede considerarse lista para piloto controlado. La salida
a producción operativa requiere completar y documentar las cinco puertas
anteriores.
