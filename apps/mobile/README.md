# PEX Track Mobile

Aplicación Android nativa en Kotlin para técnicos de campo.

## Requisitos de diseño

- `minSdk`: Android 9 / API 28.
- Foreground Service de ubicación con notificación persistente.
- Fused Location Provider para captura de coordenadas.
- Room/SQLite para operaciones offline.
- WorkManager para sincronización de eventos.
- Identificadores idempotentes por evento para evitar duplicados.

La implementación móvil se conecta con el mismo contrato de Supabase y no utiliza
una PWA para el seguimiento de ubicación en segundo plano. El APK se genera con
`./gradlew :app:assembleDebug`, requiere Android 9 (API 28) como mínimo y utiliza
un foreground service para mantener la captura activa con la pantalla bloqueada.
