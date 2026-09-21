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
- Consola web ajustada para mostrar el usuario y rol autenticados, reflejar conectividad del navegador y ocultar/mostrar la tabla de OTs según necesidad operativa.
- Verificación posterior a instalación limpia: build Angular exitoso, 3 pruebas unitarias exitosas y 0 vulnerabilidades en dependencias de producción.
- Cola móvil offline limitada a 500 operaciones, con detección de conectividad y sincronización automática mediante WorkManager.
- La importación de OTs ahora persiste y valida las referencias de zona, nodo y caja de distribución, evitando perder la relación con la infraestructura de red.
- La consola permite consultar el historial de cambios de estado de cada OT con fecha, responsable y motivo de suspensión cuando corresponde.
- Política remota de perfiles verificada en Supabase para que supervisor/coordinador puedan resolver nombres de responsables sin exponer el directorio a usuarios no autorizados.
- Propuesta de ruta disponible por cuadrilla, ordenando sus OTs georreferenciadas desde la última posición conocida mediante vecino más cercano y mostrando distancia aproximada sin tráfico.

## Pendientes de puesta en producción

1. Configurar el proyecto Vercel con el repositorio y las variables publicables de Supabase.
2. Ejecutar pruebas de campo en dispositivos Android 9+ con batería, permisos y red intermitente.
3. Preparar firma de release Android y distribución controlada.
4. Completar pruebas E2E con datos operativos reales y revisar alertas/observabilidad.

## Observaciones conocidas antes de producción

- El mapa calcula un ETA aproximado por distancia en línea recta y velocidad configurable de referencia; para ETA de tráfico real se requiere integrar un proveedor de rutas.
- La aplicación web todavía debe validarse en navegadores objetivo y la aplicación Android en campo con Android 9+, bloqueo de pantalla, ahorro de batería y pérdida de red.
- Las advertencias de compilación de Leaflet y jsPDF corresponden a módulos CommonJS de terceros; no impiden la compilación ni afectan el reporte de vulnerabilidades de producción.
