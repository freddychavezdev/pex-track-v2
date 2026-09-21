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

## Release y firma

`./gradlew :app:assembleRelease` genera un APK release sin firmar en
`app/build/outputs/apk/release/app-release-unsigned.apk`. Antes de distribuirlo
se debe firmar con una keystore privada y verificarla con `apksigner`; la keystore
no debe entrar al repositorio.

Ejemplo de firma local, usando una ruta explícita a Android SDK:

```powershell
$sdk = "C:\Users\<usuario>\AppData\Local\Android\Sdk"
$buildTools = Get-ChildItem "$sdk\build-tools" -Directory | Sort-Object Name -Descending | Select-Object -First 1
& "$($buildTools.FullName)\apksigner.bat" sign `
  --ks "C:\ruta-segura\pex-track-release.jks" `
  --ks-key-alias pex-track `
  --out "app\build\outputs\apk\release\pex-track-release.apk" `
  "app\build\outputs\apk\release\app-release-unsigned.apk"
& "$($buildTools.FullName)\apksigner.bat" verify --verbose `
  "app\build\outputs\apk\release\pex-track-release.apk"
```

Para una distribución real, la keystore, sus contraseñas y la configuración de
Supabase deben inyectarse mediante secretos del pipeline; nunca deben guardarse
en `local.properties`, el APK o GitHub.
