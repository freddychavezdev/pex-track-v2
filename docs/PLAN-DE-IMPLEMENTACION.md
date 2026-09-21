# Plan de implementación

## Fase 0 - Fundaciones

- Repositorio y ramas.
- Variables de entorno.
- Migración inicial y políticas RLS.
- Tipos compartidos y contratos de sincronización.
- CI de compilación y pruebas.

## Fase 1 - Administración y operación web

- Login y roles.
- Técnicos, vehículos y cuadrillas.
- Importación validada de OTs.
- Estados, asignación y reasignación.

## Fase 2 - Móvil Android

- Login del técnico.
- OTs asignadas.
- Cambios de estado.
- Room/SQLite y cola offline.
- Foreground service de ubicación.
- Sincronización idempotente.

## Fase 3 - Monitoreo geográfico

- Mapa de OTs y cuadrillas.
- Realtime.
- Última posición conocida.
- Capas de cajas, nodos y zonas.
- Alertas de desviación.

## Fase 4 - Reportes y mejoras

- Histórico completo.
- Reportes PDF/XLSX.
- Propuesta de rutas.
- Dictado y transcripción.
- ETA con proveedor de rutas.

## Fase 5 - Piloto y producción

- Pruebas con 10 dispositivos.
- Pruebas de red intermitente.
- Pruebas de permisos y batería.
- Revisión de seguridad.
- Despliegue controlado y monitoreo.
