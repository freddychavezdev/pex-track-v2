# PEX Track — estado de preparación para producción

Actualizado: 2026-09-22.

## Evidencia técnica aprobada

| Área | Evidencia |
| --- | --- |
| Panel web | Compilación Angular y 9 pruebas unitarias exitosas. |
| Despliegue web | `https://pex-track-v2.vercel.app/` respondió HTTP 200. |
| Base de datos | Las 22 migraciones locales coinciden con el proyecto Supabase remoto. El lint del esquema `public` no reporta errores. |
| Seguridad móvil | Las RPC de OTs y ubicación no son ejecutables por `anon`; las funciones exigen sesión y validan la cuadrilla activa. |
| Integración continua | El commit `8c4eb2d` aprobó los jobs web, database y Android. |
| APK | GitHub Actions genera un APK release sin firmar como artefacto de CI. |

## Datos piloto disponibles

Los datos de demostración remotos se identifican explícitamente con el prefijo
`PRUEBA-`:

- `PRUEBA-TEC-01` y `PRUEBA-TEC-02`.
- `PRUEBA-VEH-01`.
- `PRUEBA-CUADRILLA-01`.
- `PRUEBA-OT-001`, `PRUEBA-OT-002` y `PRUEBA-OT-003`.

Los scripts [pilot-data.sql](../supabase/pilot-data.sql) y
[remove-pilot-data.sql](../supabase/remove-pilot-data.sql) permiten cargar o
retirar estos datos de forma controlada.

## Acciones obligatorias antes de liberar a técnicos

1. Completar la invitación enviada a la cuenta supervisora real y establecer
   una contraseña inicial segura. El perfil ya está activo con rol supervisor.
2. En Supabase Auth, configurar la URL del sitio y redirecciones:
   `https://pex-track-v2.vercel.app` y `https://pex-track-v2.vercel.app/**`.
3. Activar la protección contra contraseñas filtradas si está disponible en el
   plan de Supabase.
4. Crear una keystore de producción y configurar los secretos de firma y de
   Supabase en GitHub Actions, siguiendo [GO-LIVE.md](GO-LIVE.md).
5. Instalar el APK firmado en, como mínimo, un dispositivo Android 9 y otro de
   una versión reciente; ejecutar la prueba de pantalla bloqueada, modo avión,
   recuperación de red y dictado indicada en [GO-LIVE.md](GO-LIVE.md).
6. Sustituir o confirmar el proveedor de tiles de mapa según el volumen de uso
   esperado y sus condiciones de servicio.

No se debe liberar el APK a personal operativo antes de completar y registrar
estas acciones.
