# PEX Track - product backlog

Actualizado: 2026-09-22. Priorizado para la salida a producción acordada.

| ID | Historia de producto | Estado | Resultado verificable |
| --- | --- | --- | --- |
| PB-01 | Como Supervisor, quiero autenticarme y acceder solo a capacidades de mi rol. | Hecho | Supabase Auth, perfiles activos, RBAC, RLS y cuenta supervisora invitada. |
| PB-02 | Como Supervisor, quiero administrar usuarios, técnicos, vehículos y cuadrillas. | Hecho | Panel administrativo y Edge Function protegida para altas/bajas. |
| PB-03 | Como Coordinador, quiero importar y crear OTs para la jornada. | Hecho | Importación CSV/XLS/XLSX con validación y alta manual. |
| PB-04 | Como Coordinador, quiero asignar OTs y controlar su avance. | Hecho | Asignación, estados, suspensiones con motivo e historial auditable. |
| PB-05 | Como Coordinador, quiero monitorear OTs, cuadrillas e infraestructura en un mapa. | Hecho | Leaflet, PostGIS, Realtime, capas de red y alertas de señal/desvío. |
| PB-06 | Como Coordinador, quiero atender una emergencia con la cuadrilla más conveniente. | Hecho | Registro de emergencia, prioridad, recomendación por distancia/carga/señal y reasignación. |
| PB-07 | Como Coordinador, quiero planificar y aprobar una ruta operativa por cuadrilla. | Hecho | Ruta sugerida, reordenamiento manual y secuencia persistida para Android. |
| PB-08 | Como Técnico, quiero trabajar desde Android 9+ aun sin conectividad. | Hecho | Kotlin nativo, Room, WorkManager, cola idempotente y límite de 500 operaciones. |
| PB-09 | Como Técnico, quiero emitir mi posición aun con pantalla bloqueada. | Hecho en código; pendiente validación física | Servicio Android en primer plano, permisos y cola de ubicaciones. |
| PB-10 | Como Técnico, quiero registrar una bitácora por voz sin conservar el audio. | Hecho | Reconocimiento de voz nativo y transcripción editable, conforme al alcance acordado. |
| PB-11 | Como Supervisor, quiero exportar el reporte semanal de operación. | Hecho | Resumen por cuadrilla y exportación CSV, XLSX y PDF. |
| PB-12 | Como propietario, quiero publicar cambios sin perder control de calidad. | Hecho | GitHub Actions para web, base de datos y Android; Vercel para el panel. |
| PB-13 | Como Supervisor, quiero iniciar sesión con mi cuenta real. | En curso externo | Invitación enviada a `efreddy.chavez@gmail.com`; falta aceptar el correo y definir contraseña. |
| PB-14 | Como propietario, quiero distribuir un APK confiable. | Pendiente externo | Generar keystore, cargar secretos de firma y ejecutar release firmado. |
| PB-15 | Como área operativa, quiero aprobar el producto en campo. | Pendiente externo | Prueba en Android 9 y reciente: GPS bloqueado, offline, recuperación, dictado y sesión. |

## Definición de listo para piloto

Los ítems PB-01 a PB-12 están implementados y validados mediante compilación,
pruebas automatizadas, migraciones remotas y despliegue. El piloto controlado
puede comenzar al completar PB-13. La salida operativa requiere adicionalmente
PB-14 y PB-15.
