> **RECTIFICACIÓN OBLIGATORIA, 18/11/2026:** Este documento contiene una clasificación antigua de «608 conexiones cerradas». NO ES UN CIERRE DE RECORRIDO. Fue reemplazada por [la reverificación integral de las 1.691 funciones](COBERTURA_1691_REVERIFICACION_INTEGRAL.md), que conserva las 608 como pendientes de entrada y condiciones. No utilizar 1.083 como total verificado pendiente de recorridos completos.

# Punto 3 — cruce automático reproducible de 1.691 declaraciones

**Corte de código:** `e6362836e6078a14a361732d79a8212258934056`, catálogo de **987** unidades. No se editó ni desplegó código de plataforma. Se ejecutó el [script de cruce](../verificar-cobertura-1691.py) en [GitHub Actions](https://github.com/liqko/guia-local-dolores/actions/runs/44416541704), leyendo **todas** las identidades individuales de `COBERTURA_ACTIVACIONES.zip` y cotejando las unidades AUD con el catálogo. [Anexo exportado con 1.691 filas, JSON y CSV](https://github.com/liqko/guia-local-dolores/actions/runs/44416541704/artifacts/14479393699).

## Validación posterior — 608 conexiones comprobadas en la fuente exacta

Se ejecutó [la comprobación de identidad, uso y catálogo](https://github.com/liqko/guia-local-dolores/actions/runs/44418082630) contra el **mismo commit** del inventario (`e6362836`), con un checkout independiente de la rama de auditoría. Resultado reproducible: **608/608** registros presentan la llamada al método de colección o promesa, un callback en el sitio fuente y una o varias unidades AUD válidas. Se validaron 579 callbacks de colección y 29 callbacks de promesa. El primer control, hecho sobre una revisión de archivo diferente, devolvió 64 discrepancias; fueron diferencias de fuente y desaparecieron al comparar con la versión correcta. No se ocultaron como errores de plataforma.

**Estado actualizado para el paso 3:** 608 recorridos con **cobertura estructural acreditada**, **1.083** aún pendientes de cadena o clasificación. La verificación estructural acredita la existencia de la instrucción y su vínculo con unidades existentes, **no prueba que se ejecute efectivamente en una sesión ni que el receptor tenga datos válidos**. Estas comprobaciones de funcionamiento y consumos quedan para el paso 4. El catálogo no se renumera ni elimina registros.

**Los 1.083 pendientes** se distribuyen en 153 con padre AUD pero activación de callback no comprobada, 97 con padre AUD pero invocador sin entrada, y 833 sin entrada acreditada. Conservar los identificadores completos y los casos abiertos.

## Resultado

| Clasificación de evidencia | Declaraciones | Interpretación |
|---|---:|---|
| Enlazadas a AUD por función padre y callback de método estándar de colecciones (map, filter, find, etc.) | 579 | **Conexión estática candidata acreditada**; queda comprobar tipo de receptor y condición |
| Enlazadas a AUD por callback de promesa (then, catch, finally) | 29 | **Conexión estática candidata acreditada**; ejecución depende de resolución/rechazo |
| Función padre conectada a AUD, pero activación del callback aún no demostrada | 153 | Abierto |
| Función padre conectada a AUD, pero la entrada del invocador no está completa | 97 | Abierto |
| Sin entrada acreditada por este cruce | 833 | Abierto |
| **Total examinado automáticamente** | **1.691** | |

**608** de los 1.691 ahora tienen identificada automáticamente una **cadena candidata hacia una unidad AUD y el mecanismo de callback**, con ID exacto y expresión en el anexo. Se acreditaron posteriormente como **608 conexiones estructurales** mediante cotejo con código del mismo commit; no se realizaron pruebas funcionales ni se certificaron tipos de receptores. Los **1.083 restantes** no alcanzan ese nivel de vínculo automático (153 + 97 + 833).

Se conservan los cuatro estados originales del anexo sin ocultar casos: 1.068 registros/asignaciones, 488 invocadores sin entrada, 129 declaraciones sin invocador, 6 con uso no localizado. El pendiente estructural es ahora de **1.083**; las 608 tienen trazabilidad estructural comprobada. No se alteró el código funcional.

**Ejemplos con vínculo automático:** `administracion.html:515` filtrado/búsqueda sobre catálogo administrativo, enlazado a `AUD-00013` entre otras unidades; `administracion.html:579` transformación de sedes, enlazada a `AUD-00013`; `actividades.html:886` tratamiento de error de promesa, enlazado a `AUD-00004`.

**Siguiente verificación del paso 3:** confirmar tipo del receptor y condiciones de las 608, incorporar las conexiones acreditadas al catálogo (sin renumerarlo ni eliminar rutas), y luego seguir los otros 1.083 por origen hasta una entrada o clasificarlos como pendientes/posible desuso con evidencia. Los consumos reales, correcciones y pruebas funcionales definitivas corresponden al paso 4.
