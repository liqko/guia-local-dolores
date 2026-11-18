# Punto 3 — cruce automático reproducible de 1.691 declaraciones

**Corte de código:** `e6362836e6078a14a361732d79a8212258934056`, catálogo de **987** unidades. No se editó ni desplegó código de plataforma. Se ejecutó el [script de cruce](../verificar-cobertura-1691.py) en [GitHub Actions](https://github.com/liqko/guia-local-dolores/actions/runs/44416541704), leyendo **todas** las identidades individuales de `COBERTURA_ACTIVACIONES.zip` y cotejando las unidades AUD con el catálogo. [Anexo exportado con 1.691 filas, JSON y CSV](https://github.com/liqko/guia-local-dolores/actions/runs/44416541704/artifacts/14479393699).

## Resultado

| Clasificación de evidencia | Declaraciones | Interpretación |
|---|---:|---|
| Enlazadas a AUD por función padre y callback de método estándar de colecciones (map, filter, find, etc.) | 579 | **Conexión estática candidata acreditada**; queda comprobar tipo de receptor y condición |
| Enlazadas a AUD por callback de promesa (then, catch, finally) | 29 | **Conexión estática candidata acreditada**; ejecución depende de resolución/rechazo |
| Función padre conectada a AUD, pero activación del callback aún no demostrada | 153 | Abierto |
| Función padre conectada a AUD, pero la entrada del invocador no está completa | 97 | Abierto |
| Sin entrada acreditada por este cruce | 833 | Abierto |
| **Total examinado automáticamente** | **1.691** | |

**608** de los 1.691 ahora tienen identificada automáticamente una **cadena candidata hacia una unidad AUD y el mecanismo de callback**, con ID exacto y expresión en el anexo. No equivalen a 608 pruebas de ejecución ni a 608 casos cerrados definitivamente: hay que cotejar tipo de receptor y condiciones. Los **1.083 restantes** no alcanzan ese nivel de vínculo automático (153 + 97 + 833).

Se conservan los cuatro estados originales del anexo sin ocultar casos: 1.068 registros/asignaciones, 488 invocadores sin entrada, 129 declaraciones sin invocador, 6 con uso no localizado. No se redujo artificialmente el total pendiente; la comprobación agrega trazabilidad y un orden de revisión por evidencia.

**Ejemplos con vínculo automático:** `administracion.html:515` filtrado/búsqueda sobre catálogo administrativo, enlazado a `AUD-00013` entre otras unidades; `administracion.html:579` transformación de sedes, enlazada a `AUD-00013`; `actividades.html:886` tratamiento de error de promesa, enlazado a `AUD-00004`.

**Siguiente verificación del paso 3:** confirmar tipo del receptor y condiciones de las 608, incorporar las conexiones acreditadas al catálogo (sin renumerarlo ni eliminar rutas), y luego seguir los otros 1.083 por origen hasta una entrada o clasificarlos como pendientes/posible desuso con evidencia. Los consumos reales, correcciones y pruebas funcionales definitivas corresponden al paso 4.
