# Configuración de Supabase para Android

La aplicación Android usa una clave **publicable** de Supabase, nunca una clave `service_role` o secreta. El acceso efectivo depende de las políticas RLS y de las RPC de las migraciones.

## 1. Aplicar la base de datos

Desde la raíz del repositorio, inicie Supabase localmente con Docker o vincule un proyecto remoto y aplique las migraciones de `supabase/migrations`. La migración `20260921162008_harden_team_membership_helpers.sql` es necesaria para que el móvil obtenga solamente la cuadrilla activa del técnico autenticado.

## 2. Configurar el cliente Android

Copie [local.properties.example](../apps/mobile/local.properties.example) como `apps/mobile/local.properties`. Conserve también el valor `sdk.dir` creado por Android Studio y agregue:

```properties
SUPABASE_URL=https://<referencia-del-proyecto>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<clave-publicable>
```

`local.properties` está ignorado por Git. En CI el APK compila sin esos valores, pero no podrá iniciar sesión ni transmitir hasta que se genere una compilación con ellos.

## 3. Preparar al técnico

1. Cree el usuario en Supabase Auth con correo y contraseña.
2. Verifique que su fila `profiles` esté activa y tenga el rol `technician`.
3. Cree o asocie su registro `technicians` usando el `profile_id` del usuario.
4. Asigne al técnico a una `teams` activa junto con su segundo técnico y vehículo.

Al iniciar sesión, la aplicación llama a `current_team_id()`. Si no existe una cuadrilla activa, no permite iniciar el seguimiento. Al recibir coordenadas, usa `submit_team_location()` con el identificador local del evento: reintentar una transmisión no duplica ubicaciones.

## Prueba de campo mínima

1. Instale el APK en un Android 9 o superior y otorgue ubicación precisa y notificaciones cuando corresponda.
2. Inicie sesión con un técnico ya asignado.
3. Inicie el seguimiento y mantenga visible la notificación persistente.
4. Desactive datos durante un par de lecturas; las coordenadas quedan en la cola local.
5. Active datos y confirme en `team_locations` que llegan una sola vez por `client_event_id`.

La prueba debe hacerse en un área autorizada y con personal informado: la ubicación es un dato personal operativo.
