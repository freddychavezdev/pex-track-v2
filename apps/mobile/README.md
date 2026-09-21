# PEX Track Mobile

Aplicación Android nativa en Kotlin para técnicos de campo.

## Requisitos de diseño

- `minSdk`: Android 9 / API 28.
- Foreground Service de ubicación con notificación persistente.
- Fused Location Provider para captura de coordenadas.
- Room/SQLite para operaciones offline.
- WorkManager para sincronización de eventos.
- Identificadores idempotentes por evento para evitar duplicados.

La implementación móvil se conectará con el mismo contrato de Supabase, pero no
utilizará una PWA para el seguimiento de ubicación en segundo plano.
