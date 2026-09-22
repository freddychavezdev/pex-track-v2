# Prueba de campo — PEX Track Android

Usa este protocolo con el APK de prueba antes de firmar la versión de
distribución. Está pensado para un dispositivo Android 9 o posterior.

## Preparación

1. Copia e instala `app-debug.apk` en el teléfono.
2. Inicia sesión con una cuenta técnica de prueba; no uses la cuenta
   supervisora para registrar posiciones.
3. Cuando Android lo solicite, concede ubicación precisa, micrófono y, si el
   sistema lo muestra, notificaciones. Para el seguimiento de campo selecciona
   la opción de ubicación que permita el uso continuo.
4. Verifica que la notificación de seguimiento permanezca visible al activar la
   ubicación.

## Recorrido de validación

| Paso | Acción en Android | Resultado esperado en Android | Resultado esperado en la web |
| --- | --- | --- | --- |
| 1 | Abrir la lista de OTs | Se muestran las OTs asignadas a `PRUEBA-CUADRILLA-01`. | Las mismas OTs aparecen para el supervisor. |
| 2 | Iniciar una OT pendiente | La OT queda `En curso` y se añade a la cola de sincronización. | Al actualizar, la OT muestra el nuevo estado. |
| 3 | Activar ubicación y bloquear la pantalla durante dos minutos | La notificación de seguimiento sigue activa. | El mapa muestra o actualiza la posición de la cuadrilla. |
| 4 | Activar modo avión, registrar una observación y cambiar estado | La aplicación confirma que la operación queda pendiente. | No se duplica ni se pierde la operación. |
| 5 | Desactivar modo avión y esperar sincronización | La cola pendiente se vacía. | Estado, observación y última ubicación aparecen una sola vez. |
| 6 | Dictar una nota | Se inserta texto transcrito; no se conserva un archivo de audio. | La nota de texto queda visible en el historial de la OT. |

## Criterio de aprobación

La prueba se considera aprobada cuando los seis pasos concluyen sin cierre de
la app, pérdida de datos ni duplicación de eventos. Si algo falla, registra la
hora, el modelo y versión Android, el código de la OT y una captura; no envíes
contraseñas ni claves de Supabase.
