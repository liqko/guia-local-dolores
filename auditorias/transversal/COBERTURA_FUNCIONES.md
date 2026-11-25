# Cotejo de cobertura de funciones

Corte `e6362836e6078a14a361732d79a8212258934056`. Se cotejaron las 3.625 declaraciones del desajuste original y se conservó cada identidad AST. El [anexo de activaciones](COBERTURA_ACTIVACIONES.zip) enlaza las declaraciones al [catálogo maestro](CATALOGO_MAESTRO.md) por identificador de árbol y unidad AUD cuando hay evidencia. Conserva llamadas del cuerpo, operaciones, sitio de registro, ruta estática y comprobación abierta.

| Evidencia por declaración | Cantidad |
| --- | ---: |
| El mismo cuerpo ya figura en un árbol AUD | 329 |
| Cadena de llamadas o disparadores en fuente, enlazada a una unidad AUD | 1.406 |
| Cadena desde el nivel superior del script, sin ID AUD en la traza guardada | 102 |
| Sólo una llamada o registro en el nivel superior del script | 85 |
| Sólo un invocador localizado en revisión directa | 12 |
| Sin entrada o mecanismo de activación rastreado por completo | 1.691 |
| Total | 3.625 |

El cotejo recuperó la entrada o el disparador para **85** declaraciones que estaban abiertas. Conserva las 3.625 identidades y ninguna declaración con cobertura anterior volvió a quedar abierta. Entre los enlaces nuevos se comprobó que el coordinador territorial usa `this.serialized` y llama al parámetro `fn` después de que termina la operación anterior. Esto conecta los callbacks de `fetch` y `alarm` con el coordinador y sus dependencias. También se verificaron llamadas a métodos de objetos devueltos por una clausura, funciones de configuración desestructuradas y símbolos únicos entre bloques de script clásicos. Las rutas de llamadas acreditan conexiones en fuente, sujetas a las condiciones de cada entrada.

## Ejecución local del Worker

Se importó el Worker del corte y se registró la ejecución de funciones por rango exacto de inicio y fin con V8. Se probaron 12 escenarios de solicitudes y alarma con la fixture de territorio y se registró también la carga del módulo. Pasaron 48 pruebas de cinco suites del repositorio. Cuatro de esas suites aportaron rangos del Worker con identidad comprobable. También pasaron las integraciones de copia persistente, roles del panel y costos públicos, con dos inserciones conocidas de observación, descontadas al cotejar los rangos. El [anexo](COBERTURA_ACTIVACIONES.zip) incluye la huella del Worker, las ejecuciones por declaración, los conteos de prueba y el procedimiento reproducible.

Se observaron **507 declaraciones** del grupo original en ejecución local. **330** pertenecen a las 1.691 que todavía carecen de un recorrido estático completo. Para esas 330 hay evidencia de ejecución con datos simulados. Quedan **1.361** sin cadena demostrada ni ejecución observada en estas pruebas. La cobertura funcional en las interfaces y el consumo real siguen pendientes.

Los resultados de tres integraciones que fallaron se conservaron y sus rangos no se sumaron a la evidencia. `verify-owner-costs` y `verify-user-guide-integrado` esperaban 200 al abrir la ficha y recibieron 503 con `COMMERCE_COPY_PREPARING`. `verify-whole-advertiser-save-integrado` esperaba 409 para un guardado con revisión de sede vieja y recibió 412. Las tres discrepancias se observaron en pruebas locales. Falta verificar si el montaje de cada prueba refleja el precalentamiento y el contrato de respuesta vigentes.

Para continuar el cotejo, vincular las 330 declaraciones ejercitadas al disparador concreto de las pruebas y ejecutar los escenarios todavía ausentes, empezando por las ramas de `/commerce` con copia ausente, en preparación y lista. Para el caso de revisión de sede, confirmar primero el estado de la copia, comprobar la causa del 412 y verificar que el rechazo no deje escrituras parciales. Las demás declaraciones pendientes conservan su ubicación, invocador o registro, condición y prueba abierta en el anexo.

## Revisión de los 20 orígenes de red de Plataforma pendientes

Se completó la inspección de los 34 casos de la lista prioritaria. **28** tienen uso localizado en fuente y **seis** son candidatos a desuso. Esos seis requieren observar la interfaz que carga el archivo y registrar si el cuerpo se ejecuta antes de considerar su eliminación. Los 34 corresponden al filtro prioritario de red y no representan todos los sitios de operaciones del catálogo.

| Declaración | Resultado | Evidencia |
| --- | --- | --- |
| `plataforma/actividades.html:635` | Uso localizado | iniciarModuloActividades solicita actividades en :1056 y publicidad en :1072 si el paquete de ciudad no aporta los datos. |
| `plataforma/administracion.html:958` | Candidato a desuso | ghBuscarModeradores sólo figura en su declaración en las fuentes de Plataforma. Revisar el acceso a Moderadores con datos antes de considerar su eliminación. |
| `plataforma/administracion.html:1977` | Uso localizado | detalleAnu solicita nueve catálogos mediante catalogTypes.map y Promise.allSettled al abrir la ficha de un anunciante. Cada valor llama api('listar_catalogo',{tipo}). |
| `plataforma/administracion.html:3641` | Uso localizado | ghCotizarRecalcular171 (:3602) programa POST /sales/quote al validar la selección comercial. Luego descarta una respuesta desplazada por cambios en la cotización. |
| `plataforma/administracion.html:3764` | Candidato a desuso | ghComercialBuscar186 aparece como declaración y como ID leído en el cuerpo, sin llamador ni control con ese ID en Plataforma. Revisar la búsqueda comercial activa antes de eliminar. |
| `plataforma/anunciantes.html:1226` | Uso localizado | La tarjeta solicita una imagen de Instagram en :2529. fetchInstagramImage (:1221–1224) usa el resolvedor de imágenes si está disponible o invoca la función directamente. |
| `plataforma/carcasa.html:1022` | Candidato a desuso | fetchInstagramImage sólo aparece como declaración en Carcasa. Anunciantes tiene su propia declaración e invocación. Revisar tarjetas con Instagram en Carcasa. |
| `plataforma/carcasa.html:1052` | Uso localizado | Adaptador JSON invocado para ciclo de farmacias (:1744, tras intentar el paquete), efemérides (:1945) y módulos de ciudad (:2008, cuando falta caché local). |
| `plataforma/empleo.js:47` | Uso localizado | Formulario de publicación (onsubmit en :51); valida datos y contactos, usa identidad del anunciante y distingue alta, edición y renovación. |
| `plataforma/empleo.js:49` | Uso localizado | Formulario de apelación (onsubmit en :51); exige publicación propia cargada y sin solicitud en curso. El flujo se ofrece para publicaciones rechazadas. |
| `plataforma/empleo.js:57` | Uso localizado | Inicialización directa en :61; intenta el módulo público del paquete de ciudad según contexto de sesión y panel, con /empleo/catalogo como alternativa. |
| `plataforma/eventos.html:773` | Candidato a desuso | fetchInstagramImage sólo aparece como declaración en Eventos. Anunciantes tiene una implementación aparte. Revisar tarjetas de Eventos con Instagram. |
| `plataforma/gh-listados.js:66` | Uso localizado | Botones de los listados de Promociones/Publicidad (:67–69) y confirmación del operador. Envía POST con identificador y acción, luego recarga. |
| `plataforma/gh-listados.js:93` | Uso localizado | buscarAnu y buscarSus (:98) usan este buscador. Consulta /advertisers/search o /subscribers/search si la página no está en caché. Script incluido en administracion.html:4098. |
| `plataforma/login.html:2856` | Uso localizado | Selector de colaboradores de Eventos. eventPartnerLoadCity_ (:2893, disparadores :2948 y :2962–2963) pasa por eventPartnerAllRows_ y :2880. Consulta /guide por ciudad sin promesa cacheada. |
| `plataforma/login.html:3089` | Candidato a desuso | events_get sólo aparece en su declaración en Plataforma. Revisar carga/edición de Eventos y comprobar el adaptador efectivamente usado. |
| `plataforma/login.html:5904` | Candidato a desuso | farmacias_get sólo aparece en su declaración en Plataforma. Revisar módulo y edición de Farmacias y comprobar el adaptador efectivamente usado. |
| `plataforma/panel-comercial.html:41` | Uso localizado | Gran Hermano enlaza el panel en administracion.html:174; botones y formulario invocan login, catálogo, cotización, búsqueda, cierre y equipo. Las seis rutas /commercial/* siguen sin despacho en el Worker del corte. |
| `plataforma/paquete-ciudad.js:188` | Uso localizado | El cliente recibe fetchJson por desestructuración en :89 y lo llama en :102 por archivo de paquete. Descarga desde Hosting si necesita obtener la copia; Actividades, Eventos, Guía, Carcasa y Empleo cargan este script. |
| `plataforma/planes-publicos.js:134` | Uso localizado | load() se invoca al cargar en :151. planes-servicios.html:67 incluye el script; la función reutiliza caché de sesión antes de consultar el catálogo. |

## Prueba funcional y consumo

Ejecutar `AUD-00001` desde una ficha de anunciante en Gran Hermano con un perfil autorizado y una cuenta de prueba. Registrar clic, apertura de pestaña, POST `/superadmin/advertisers/:id/panel-access`, canje del acceso y llegada al panel. Repetir con caché caliente y verificar solicitudes y métricas correlacionadas de Cloudflare y Firebase. Si hay error o duplicación, aislar la causa y repetir la misma prueba tras la corrección. Conservar las 1.776 comprobaciones pendientes en el anexo y vincularlas a las pruebas de acción que puedan resolverlas.

El catálogo conserva las ubicaciones del corte. `main` en `9b7fd659e3b9f46e4a714955016df26ce3764c82` trae cambios posteriores en `plataforma/login.html` y `plataforma/publicacion.js`, en particular en Soporte y Reclamo. Antes de probar las unidades que alcancen esos tramos, cotejar su recorrido con la revisión vigente. Este lote no realizó pruebas reales ni medición de recursos.

## Resultados históricos del cruce y revisión del Worker

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

## Rastreo de disparadores en los tres grupos

Se cotejó cada declaración por posición exacta en el código y se siguieron las llamadas con destino identificado en el grafo del corte `e6362836`. El [detalle por función](COBERTURA_ACTIVACIONES.zip) conserva archivo, línea, receptor, invocadores, unidades y, cuando se encontró, la cadena desde la carga del script.

| Grupo inicial | Resultado en fuente | Casos |
| --- | --- | ---: |
| Dentro de funciones mapeadas | Se localizó el receptor al que se entrega la función | 1.660 |
| Dentro de funciones mapeadas | Se encontró programación explícita con temporizador o cuadro de animación | 72 |
| Dentro de funciones mapeadas | Disparador por resolver | 135 |
| Con llamador identificado | Se obtuvo una cadena desde una función que se invoca al cargar un script | 28 |
| Con llamador identificado | La cadena hacia una entrada de la plataforma sigue pendiente | 488 |
| Sin llamador resuelto en el cruce anterior | Funciones que se invocan directamente al cargar su script | 74 |
| Sin llamador resuelto en el cruce anterior | Se encontró programación explícita con temporizador o cuadro de animación | 17 |
| Sin llamador resuelto en el cruce anterior | Se localizó el receptor al que se entrega la función | 622 |
| Sin llamador resuelto en el cruce anterior | Disparador por resolver | 200 |

Las 3.296 filas quedaron examinadas en este cruce. Encontrar el receptor de una función documenta el punto de entrega. Su ejecución aún depende de que el llamador la invoque y de las condiciones del recorrido. Los enlaces del rastreo conservan el tipo de resolución del grafo. Queda pendiente comprobar los receptores y orígenes aún abiertos, vincularlos al catálogo maestro y cotejar los 20 candidatos de red de Plataforma que siguen abiertos.
