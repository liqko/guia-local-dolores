# Paso 3 · Cotejo de funciones sin enlace

Corte de código [`e6362836`](https://github.com/liqko/guia-local-dolores/commit/e6362836e6078a14a361732d79a8212258934056). Se verificaron huellas iguales entre catálogo, GPS y árboles. Identidad contrastada por archivo, posición AST y convención de nombre del árbol. El cotejo sólo acredita cobertura estática.

| Evidencia | Declaraciones | Con operación detectada |
| --- | ---: | ---: |
| La misma declaración aparece en un árbol | 329 | 83 |
| Declarada dentro de una función ya mapeada | 1.867 | 129 |
| Llamada localizada en código cuyo origen sigue sin árbol | 516 | 90 |
| Sin llamador resuelto por el grafo | 913 | 92 |
| Total original | 3.625 | 394 |

El catálogo cruzaba nombres diferentes para la misma declaración: el GPS califica el nombre de callbacks con archivo y línea, y el árbol utiliza la línea. Las 329 están presentes en los árboles. Las otras 3.296 todavía requieren evidencia de recorrido o una clasificación comprobada. La mera declaración dentro de una función no acredita ejecución. El recuento por posición distingue 394 declaraciones con operación, frente a 392 identificadores antiguos del GPS. Los detectores incluyen operaciones locales, como búsquedas de elementos de pantalla.


## Qué queda en revisión

Una sola declaración puede tener dos etiquetas en los informes. Por ejemplo, el GPS y el árbol usan etiquetas diferentes para el callback de `plataforma/actividades.html:726`. La posición de la declaración coincide y el árbol ya lo incorpora a `AUD-00003`.

- 1.867 declaraciones dentro de funciones mapeadas. Verificar qué evento, llamada o condición activa cada bloque.
- 516 declaraciones con un llamador localizado cuyo origen sigue sin árbol. Rastrear ese origen hasta una entrada de la plataforma.
- 913 declaraciones sin llamador resuelto automáticamente. Buscar disparadores indirectos y documentar, cuando corresponda, evidencia de falta de uso.

Estas tres filas suman las 3.296 declaraciones restantes del cruce por identidad. Los candidatos con operaciones de red se revisan primero. Las comprobaciones directas documentadas abajo aportan evidencia de origen, aunque sus enlaces aún no están incorporados al catálogo generado. No se deduce una duplicación, un error ni un desuso sólo porque falte un enlace.

## Comprobaciones directas adicionales

- `empleo-enlaces.js:1` se invoca al cargar el script desde `suscriptores.html:1623` y `login.html:10258`. Consulta la versión del Worker antes de habilitar enlaces de Empleo.
- `terminos-documento.js:1` se invoca al cargar el script desde `terminos-anunciantes.html:18`. Consulta el contenido de los términos.
- `administracion.html:534` y `administracion.html:540` forman la cadena usada por los listados de Gran Hermano. Los invocadores están, por ejemplo, en `gh-listados.js:84` y `gh-publicidad.js:22`.
- `ghBuscarModeradores` sólo aparece definido en `administracion.html:958` en una búsqueda textual dentro de Plataforma. Queda como candidato a código sin uso, sujeto a comprobar disparadores indirectos.

## Casos de red en el grupo prioritario

Se conservan los 34 candidatos del cruce automático de red y las cuatro declaraciones con origen comprobado arriba. No se atribuyen lecturas ni escrituras reales a estos resultados.

| Ubicación | Función | Resultado del grafo |
| --- | --- | --- |
| `plataforma/actividades.html:635` | `fetchJsonConTimeout` | Llamada localizada, origen aún sin árbol |
| `plataforma/administracion.html:534` | `ghAdminRequest_` | Sin llamador resuelto por el grafo |
| `plataforma/administracion.html:540` | `ghAdminRequestRaw143` | Sin llamador resuelto por el grafo |
| `plataforma/administracion.html:958` | `ghBuscarModeradores` | Sin llamador resuelto por el grafo |
| `plataforma/administracion.html:1977` | `callback` | Declarada dentro de una función ya mapeada |
| `plataforma/administracion.html:3641` | `callback` | Declarada dentro de una función ya mapeada |
| `plataforma/administracion.html:3764` | `ghComercialBuscar186` | Sin llamador resuelto por el grafo |
| `plataforma/anunciantes.html:1226` | `fetchInstagramImageUncached` | Llamada localizada, origen aún sin árbol |
| `plataforma/carcasa.html:1022` | `fetchInstagramImage` | Sin llamador resuelto por el grafo |
| `plataforma/carcasa.html:1052` | `gldFetchJson` | Llamada localizada, origen aún sin árbol |
| `plataforma/empleo-enlaces.js:1` | `anonymous` | Sin llamador resuelto por el grafo |
| `plataforma/empleo.js:47` | `save` | Sin llamador resuelto por el grafo |
| `plataforma/empleo.js:49` | `appeal` | Sin llamador resuelto por el grafo |
| `plataforma/empleo.js:57` | `start` | Llamada localizada, origen aún sin árbol |
| `plataforma/eventos.html:773` | `fetchInstagramImage` | Sin llamador resuelto por el grafo |
| `plataforma/gh-listados.js:66` | `callback` | Llamada localizada, origen aún sin árbol |
| `plataforma/gh-listados.js:93` | `search` | Llamada localizada, origen aún sin árbol |
| `plataforma/login.html:2856` | `anonymous` | Llamada localizada, origen aún sin árbol |
| `plataforma/login.html:3089` | `events_get` | Sin llamador resuelto por el grafo |
| `plataforma/login.html:5904` | `farmacias_get` | Sin llamador resuelto por el grafo |
| `plataforma/panel-comercial.html:41` | `req` | Llamada localizada, origen aún sin árbol |
| `plataforma/paquete-ciudad.js:188` | `fetchJson` | Llamada localizada, origen aún sin árbol |
| `plataforma/planes-publicos.js:134` | `load` | Llamada localizada, origen aún sin árbol |
| `plataforma/terminos-documento.js:1` | `anonymous` | Sin llamador resuelto por el grafo |
| `worker/worker206.txt:270` | `route` | Sin llamador resuelto por el grafo |
| `worker/worker206.txt:799` | `newToken` | Llamada localizada, origen aún sin árbol |
| `worker/worker206.txt:869` | `request` | Llamada localizada, origen aún sin árbol |
| `worker/worker206.txt:889` | `sourceDocument119` | Llamada localizada, origen aún sin árbol |
| `worker/worker206.txt:901` | `commitPatches` | Declarada dentro de una función ya mapeada |
| `worker/worker206.txt:980` | `queryEqual` | Declarada dentro de una función ya mapeada |
| `worker/worker206.txt:12021` | `cityBookMarkShared` | Llamada localizada, origen aún sin árbol |
| `worker/worker206.txt:12222` | `call` | Llamada localizada, origen aún sin árbol |
| `worker/worker206.txt:12860` | `dispatch` | Sin llamador resuelto por el grafo |
| `worker/worker206.txt:13123` | `dispatch` | Sin llamador resuelto por el grafo |

## Origen comprobado en los diez candidatos de red del Worker

| Declaración en `worker/worker206.txt` | Invocación comprobada en fuente |
| --- | --- |
| 270, `route` territorial | Despacho del Worker en 13217. El despachador verifica ruta y método antes de usar el coordinador. |
| 799, `newToken` | Renovación por `tokenCache.pending` en 825. |
| 869, `request` | Adaptador Firestore. Lo invocan las operaciones de documento y listado, por ejemplo 890, 939, 955 y 965. |
| 889, `sourceDocument119` | Llamado por métodos del adaptador en 918, 923, 938 y 954. |
| 901, `commitPatches` | Escritura agrupada, llamada por soporte en 444 y publicidad en 559. |
| 980, `queryEqual` | Consulta por campo, llamada por soporte en 417 y publicidad en 545. |
| 12021, `cityBookMarkShared` | Escritura y eliminación de claves compartidas en el adaptador KV, 12238 y 12256. |
| 12222, `call` | Adaptador de paquetes de ciudad, usado por las ramas de lectura, escritura y eliminación del Proxy de 12236–12256. |
| 12860, `dispatch` comercial | Exportado en 12924 e invocado por el Worker en 13218. Despacha también a Eventos. |
| 13123, `dispatch` de Eventos | Exportado en 13173 e invocado en 12863. Valida rutas de escritura de eventos y moderación. |

Estos diez casos tienen origen de uso comprobado estáticamente. Queda pendiente incorporar sus enlaces exactos al catálogo y comprobar los otros 20 candidatos de red. Las operaciones restantes del grupo y las declaraciones sin llamador estático también quedan en revisión.
