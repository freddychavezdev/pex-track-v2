# PEX Track Mobile

Aplicación Android nativa en Kotlin para técnicos de campo.

## Requisitos de diseño

- `minSdk`: Android 9 / API 28.
- Foreground Service de ubicación con notificación persistente.
- Fused Location Provider para captura de coordenadas.
- Room/SQLite para operaciones offline.
- WorkManager para sincronización de eventos.
- Identificadores idempotentes por evento para evitar duplicados.
- La cola offline queda aislada por usuario y cuadrilla para impedir que una
  sesión distinta sincronice operaciones pendientes de otro técnico.
- La cola conserva un máximo de 500 operaciones y reserva 100 espacios para
  cambios de estado y observaciones; cuando no hay red, descarta primero las
  posiciones GPS más antiguas para no bloquear la atención de OTs.

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

## Release firmado en GitHub Actions

El workflow `.github/workflows/android-release.yml` se ejecuta manualmente o
cuando se publica un tag con formato `v1.0.0`. Antes de ejecutarlo, configura en
el repositorio estos secretos:

- `ANDROID_KEYSTORE_BASE64`: contenido de la keystore convertido a Base64.
- `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`.
- `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`.

El workflow decodifica la keystore solo durante el job, compila el APK, lo firma,
verifica la firma y publica el APK junto con su hash SHA-256 como artefacto.
