# Estado de desarrollo

## Completado

- Revisión del documento de requisitos y corrección de decisiones de arquitectura.
- Estructura monorepo inicial.
- Aplicación Angular compilable.
- Primera pantalla de centro de monitoreo basada en las maquetas.
- Esquema PostgreSQL/PostGIS inicial.
- RLS inicial para perfiles, operaciones, órdenes, posiciones e historial.
- Cliente Supabase, sesión persistente y formulario de acceso web.
- RPCs protegidos para ubicación móvil y cambio de estado de OT.
- Importación y prevalidación de OTs desde CSV, XLS y XLSX.
- Documentación de arquitectura y plan de implementación.
- Catálogos administrativos web para usuarios, técnicos, vehículos y cuadrillas.
- Alta manual de órdenes de trabajo y asignación desde el panel operativo.
- Edge Function segura para administración de usuarios Auth sin exponer claves secretas.
- Realtime habilitado para órdenes, posiciones e historial operativo.
- Aplicación Android nativa Kotlin con autenticación, OTs, dictado/transcripción, cola offline y foreground service GPS.
- Migraciones aplicadas y verificadas en el proyecto Supabase de producción.
- CI de GitHub para pruebas/build Angular y generación del APK Android.

## Pendientes de puesta en producción

1. Configurar el proyecto Vercel con el repositorio y las variables publicables de Supabase.
2. Ejecutar pruebas de campo en dispositivos Android 9+ con batería, permisos y red intermitente.
3. Preparar firma de release Android y distribución controlada.
4. Completar pruebas E2E con datos operativos reales y revisar alertas/observabilidad.
