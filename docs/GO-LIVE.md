# PEX Track — procedimiento de salida a producción

Este procedimiento separa las acciones reproducibles del repositorio de las
credenciales privadas del propietario. No se deben pegar contraseñas, tokens ni
keystores en archivos versionados.

## 1. Panel web en Vercel

Desde la raíz del repositorio:

```powershell
npx vercel login
npx vercel link
npx vercel env add SUPABASE_URL production
npx vercel env add SUPABASE_PUBLISHABLE_KEY production
npx vercel --prod
```

Los valores son:

- `SUPABASE_URL`: URL del proyecto Supabase.
- `SUPABASE_PUBLISHABLE_KEY`: clave publicable `sb_publishable_...`.

Nunca se debe configurar una clave `service_role` en Vercel ni en el navegador.
Después del despliegue se debe abrir la URL generada y comprobar inicio de
sesión, mapa, Realtime, importación y exportación de reportes.

## 2. Release Android firmado

En GitHub, en `Settings → Secrets and variables → Actions`, crea estos secretos:

- `ANDROID_KEYSTORE_BASE64`: salida Base64 de la keystore oficial.
- `ANDROID_KEYSTORE_PASSWORD`.
- `ANDROID_KEY_ALIAS`.
- `ANDROID_KEY_PASSWORD`.
- `SUPABASE_URL`.
- `SUPABASE_PUBLISHABLE_KEY`.

Después, ejecuta manualmente `PEX Track Android Release` o crea un tag como
`v1.0.0`. El workflow compila, firma, verifica con `apksigner` y publica el APK
con su hash SHA-256 como artefacto.

La keystore oficial debe conservarse fuera del repositorio y respaldarse en un
gestor seguro. Si se pierde, no podrá publicarse una actualización sobre la
misma instalación Android.

## 3. Prueba piloto obligatoria

Antes de distribuir el APK a todos los técnicos, prueba al menos un dispositivo
Android 9 y uno de una versión reciente:

1. Iniciar sesión con una cuenta técnica vinculada a una cuadrilla.
2. Activar ubicación precisa, notificaciones y “Permitir siempre”.
3. Bloquear la pantalla durante al menos 15 minutos y comprobar nuevas posiciones.
4. Activar modo avión, cambiar el estado de una OT y guardar una observación.
5. Confirmar que la cola offline conserva los cambios y los sincroniza al volver la red.
6. Suspender una OT sin motivo y confirmar que la aplicación lo impide.
7. Dictar una observación y confirmar que solo se guarda la transcripción.
8. Cerrar sesión y entrar con otra cuenta; comprobar que no se mezclan colas offline.
9. Verificar desde el panel la antigüedad de la señal, historial, emergencia y reporte.

La publicación se considera aprobada solo después de conservar evidencia de estas
pruebas y de revisar los logs de GitHub Actions, Supabase y Vercel.
