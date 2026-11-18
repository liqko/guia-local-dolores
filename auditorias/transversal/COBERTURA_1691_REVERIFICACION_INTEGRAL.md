# Paso 3 — reverificación integral de 1.691 funciones (sin exclusiones)

**Corte de código:** `e6362836e6078a14a361732d79a8212258934056`. **Catálogo:** 987 unidades AUD. **Resultado reproducible:** [ejecución GitHub Actions 44419304635](https://github.com/liqko/guia-local-dolores/actions/runs/44419304635), script [reverificar-cobertura-total.py](../reverificar-cobertura-total.py). Se compararon **todas las 1.691 filas** con el código de ese mismo commit, incluidas expresamente las **608** a las que se había atribuido cierre parcial. Las 1.691 tienen ubicación fuente válida, pero **ningún recorrido se declara completo** por encontrar la declaración o el callback.

| Evidencia documentada para cada función | Registros | Cierre |
|---|---:|---|
| Callback de método estándar verificado en fuente y función padre enlazada a AUD | 608 | **NO**: falta acreditar entrada y condiciones |
| Invocador y AUD localizados, pero cadena completa no demostrada | 97 | NO |
| Función padre en AUD, sin activación certificada | 180 | NO |
| Llamador localizado, sin entrada AUD | 391 | NO |
| Registro localizado, sin entrada AUD | 307 | NO |
| Activador sin confirmar | 108 | NO |
| **Total** | **1.691** | **0 recorridos completos cerrados por esta prueba** |

**Hallazgo adicional de identidad.** Hay **114 identificadores GPS repetidos**, afectando **240 filas**. La evidencia AST muestra funciones *distintas en la misma línea*, p. ej. `administracion.html:1426` contiene callbacks separados de `filter`, `sort` y `forEach`, cada uno con `inicio`/`fin` propio. **No son 114 duplicaciones de código ni 114 errores**; son colisiones del rótulo `archivo:línea:callback`. La identidad correcta debe preservar el rango AST y el ordinal de fila; no fusionar ni eliminar estas funciones.

La clasificación anterior de **«608 cerradas» queda expresamente sin efecto como cierre de recorrido**. Acredita existencia estructural, no la activación desde interfaz ni ejecución real. Este reporte es estado del punto 3 y no habilita pasar al punto 4. No se tocó código de producción, Worker ni Hosting. El anexo individual de 1.691 filas incluye ubicación, texto original, activación, padre, llamadas y unidades encontradas.

**Siguiente operación técnica:** reconstruir cadena verificable *acción/entrada → invocador → función → dependencias* usando identidad AST exacta y, para llamadas dinámicas, conservar la brecha cuando no haya prueba. No clasificar posibles restos o parches como obsoletos antes de comprobarlos.
