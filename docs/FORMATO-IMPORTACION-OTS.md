# Formato de importación de OTs

La carga diaria acepta archivos CSV, XLS o XLSX, con una fila de encabezados y un
máximo de 1.000 órdenes por archivo.

## Campos requeridos

| Encabezado aceptado | Descripción |
| --- | --- |
| `Código OT`, `OT` o `Número OT` | Identificador único de la orden. |
| `Dirección` o `Domicilio` | Dirección del cliente. |
| `Tipo de tarea`, `Tipo` o `Servicio` | Asistencia técnica, Instalación nueva, Traslado de servicio o Mantenimiento de red. |

## Campos opcionales

| Encabezado | Uso |
| --- | --- |
| `Código cliente`, `Cliente`, `Teléfono` | Datos de atención. |
| `Prioridad` | Entero entre 1 y 5. Si falta, se usa 3. |
| `Fecha programada` | Si falta, se usa la fecha elegida en la pantalla de importación. |
| `Zona`, `Nodo`, `Caja` | Referencias técnicas disponibles para asignación y mapas. |
| `Latitud`, `Longitud` | Coordenadas WGS84 decimales; si ambas están presentes, la OT aparece en el mapa operativo. |

Los códigos de OT duplicados en el mismo archivo se rechazan. La interfaz permite
guardar solo las filas válidas y muestra las observaciones de las filas rechazadas.
