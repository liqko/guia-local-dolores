# GUÍA LOCAL — ESTADO ÚNICO DE AUDITORÍA

Este archivo es el punto de continuación obligatorio de la auditoría de consumos. Se ACTUALIZA EN EL MISMO LUGAR; no se crean versiones, inventarios ni informes de avance adicionales. Para reanudar en otro chat o Work: leer primero este archivo y el Worker enlazado, y continuar sin reiniciar la auditoría.

## Objetivo fijo
Auditar y optimizar, una acción a la vez y de punta a punta, las tres interfaces: Usuario final, Anunciante y Gran Hermano. Medir operaciones de Cloudflare (Worker, KV, Durable Objects), Firebase/Firestore y cualquier otro servicio, con cuota y costo real por acción; identificar y corregir duplicaciones, comprobar ahorro. Sin datos medidos, marcar NO COMPROBADO.

## Hoja de ruta y tablero de control
Este es el itinerario operativo único. No reinicia la auditoría ni autoriza cambios fuera de la acción vigente. Los recorridos específicos se verifican en el código y la interfaz al abordar cada módulo; no se dan por existentes funciones no comprobadas.

| Orden | Bloque | Recorrido previsto | Estado |
|---|---|---|---|
| 1 | Accesos | INGRESAR (001); después recuperar acceso, mantener sesión y salir, cada acción por separado | EN CURSO: 001 |
| 2 | Guía | Consultar y buscar; gestionar ficha; revisar, publicar y administrar | Pendiente |
| 3 | Eventos | Consultar; crear, modificar y gestionar; revisar y administrar | Pendiente |
| 4 | Promociones | Consultar; crear, modificar y gestionar; revisar y administrar | Pendiente |
| 5 | Actividades | Consultar; crear, modificar y gestionar; revisar y administrar | Pendiente |
| 6 | Funciones complementarias | Cubrir las funciones existentes no incluidas antes y sus dependencias | Pendiente |
| 7 | Publicidad | Contratación, piezas, distribución, visualización y administración | Pendiente |
| 8 | Balance económico integral | Consolidar costos y cuotas medidos por acción, proyecciones según uso y límites de sostenibilidad | Pendiente |

### Unidad de trabajo y orden de revisión
- Dentro de cada bloque: una acción de principio a fin; comprobar Usuario → Anunciante → Gran Hermano cuando corresponda. Marcar “No aplica” con motivo cuando una interfaz no tenga esa acción.
- Las dependencias necesarias se resuelven dentro del recorrido actual. Cuando se aborde un proceso administrativo propio, como ciudades, mantener su ciclo completo (crear, consultar, modificar y estado) antes de pasar a otro proceso.
- Numerar la siguiente acción solo al cerrar la vigente; los pasos de prueba de 001 no son acciones nuevas.
- El balance económico se construye con cada medición; el bloque 8 consolida los resultados, no posterga su evaluación.

### Procedimiento obligatorio por acción
1. Delimitar interfaz, botón o disparador, condiciones iniciales y resultado esperado.
2. Ejecutar un caso controlado y correlacionar todas sus solicitudes, incluida la carga inicial que dispara.
3. Medir operaciones de Worker, KV, Durable Objects, Firebase/Firestore y otros servicios realmente usados; separar contadores observados, operaciones facturadas y costo monetario. Marcar cobertura faltante como NO COMPROBADA.
4. Detectar errores y consumos innecesarios; corregir solo lo relacionado con esa acción en el archivo único del Worker. Incrementar versión por modificación y entregar enlace.
5. Tras el despliegue del usuario, verificar versión activa, resultado funcional, repeticiones, caché e invalidaciones pertinentes; comparar consumo antes/después en condiciones equivalentes.
6. Cerrar únicamente con evidencia suficiente de funcionamiento y consumo. Si existe bloqueo, registrar estado y próximo paso exacto; no avanzar a otro módulo.

### Secuencia fija de la Acción 001
Esta secuencia sustituye las instrucciones anteriores que pedían al usuario cerrar sesión y probar sin haber documentado primero el recorrido. No reiniciar correcciones ya realizadas.

| Paso | Trabajo y condición de terminación | Estado |
|---|---|---|
| 001.1 | Leer el código de las pantallas y del Worker para documentar, por interfaz, pulsación INGRESAR → validación de credenciales → sesión → carga inicial. Identificar disparadores y dependencias con referencias al código. | ACTUAL: incompleto |
| 001.2 | Establecer la medición de cada recorrido: solicitudes correlacionadas, operaciones por servicio, caso inicial y repetido, cobertura y limitaciones. Resolver cómo ejecutar sin depender de pulsaciones del usuario antes de programar pruebas; no prometer autonomía si falta acceso. | Pendiente |
| 001.3 | Comprobar y optimizar el recorrido completo de Usuario; documentar evidencia y consumo. | Pendiente |
| 001.4 | Comprobar y optimizar el recorrido completo de Anunciante; documentar evidencia y consumo. | Pendiente |
| 001.5 | Comprobar y optimizar el recorrido completo de Gran Hermano; distinguir autenticación de carga del panel. Aquí verificar caché, caducidad e invalidación del resumen de cumpleaños y ahorro real del 156. | Pendiente; ajuste ya desplegado |
| 001.6 | Consolidar evidencias de las tres interfaces y cerrar 001 únicamente con funcionamiento y consumo comprobados; registrar faltantes o bloqueos si no puede cerrarse. | Pendiente |

**Posición actual:** Accesos → Acción 001 INGRESAR → paso 001.1. Hecho: corrección de cumpleaños y despliegue 156 cotejado. Falta: documentar el recorrido completo desde el código de las pantallas; no basta con leer rutas del Worker. Cumpleaños se carga al abrir el panel de Gran Hermano; no se prueba cerrando la sesión de Usuario.
**Próxima tarea exacta del asistente:** localizar y leer en GitHub el código vigente de acceso y carga inicial de las tres interfaces, seguir sus llamadas en el Worker 156 y registrar las referencias y operaciones de 001.1 en este mismo archivo. Sin modificar Worker ni pedir pulsaciones al usuario durante este paso.
**Control de continuidad:** informar siempre el número de paso; no cambiar el orden por un hallazgo. Resolverlo dentro del recorrido al que pertenece o documentarlo pendiente. Cualquier cambio necesario de itinerario debe explicarse y quedar actualizado aquí antes de ejecutarlo.

### Tablero vigente
| Bloque / acción | Usuario | Anunciante | Gran Hermano | Entrega | Cierre |
|---|---|---|---|---|---|
| Accesos / 001 INGRESAR | Prueba controlada pendiente | Prueba controlada pendiente | Corrección de cumpleaños preparada; prueba real pendiente | 157 desplegado; 158 preparado para optimizar login | ABIERTA; ahorro NO COMPROBADO |

### Formato fijo de cada actualización
Bloque y acción · interfaz bajo prueba · versión preparada y desplegada · corrección concreta · comprobación y consumo · pendiente y próximo paso exacto. Actualizar este tablero al obtener evidencia; no presentar porcentajes de avance inventados.

## Estado actual — 2026-11-04
- **Acción vigente:** 001 — INGRESAR, tres interfaces.
- **Estado:** ABIERTA. No comenzar la 002.
- **Problema:** al ingresar a Gran Hermano, el resumen de cumpleaños recorría repetidamente claves KV.
- **Corrección incorporada:** el resumen se conserva temporalmente, con invalidación al modificar cumpleaños. Comprobación aislada: segunda consulta, 0 listados adicionales; modificación de cumpleaños, 1 reconstrucción.
- **Worker activo:** 157 desplegado; **entrega preparada:** 158, pendiente de despliegue manual, archivo único en rama `feature/gran-hermano-roles-permisos-20261103`: `worker/worker155_roles_permisos.txt`; commit del ajuste `9c6890121d6bf5df58bd624c124a978c6acff1c9`.
- **Despliegue:** 157 realizado por el usuario y verificado directamente en Cloudflare el 2026-11-04. Código activo coincide con GitHub. Ahorro real aún NO COMPROBADO.
- **Pendiente para cerrar 001:** seguir la secuencia 001.1–001.6 y verificar consumos reales por ingreso completo en las tres interfaces; correlacionar una pulsación con todas las solicitudes; revisar escrituras/lecturas y operaciones facturadas; validar caché e invalidación de cumpleaños; corregir más hallazgos de la 001 si los hubiera.
- **Dato importante:** usuario y anunciante comparten `POST /suscriptores` (`action=login`), sin marcador de origen en métricas actuales; Gran Hermano llama `POST /superadmin/session/login`, luego `GET /superadmin/dashboard` y `GET /superadmin/inbox` para cargar pantalla. Las dos últimas son funciones de la pantalla, no validación de credenciales; no representan datos duplicados idénticos.

## Regla invariable de ejecución
1. Leer este archivo antes de continuar, aunque se cambie de chat o modo.
2. Trabajar SOLAMENTE en la acción vigente. Si surge un fallo, corregirlo como subproblema de la misma acción.
3. Tras cada cambio, actualizar únicamente este registro y el archivo único del Worker; no crear archivos numerados transitorios.
4. No cerrar acción hasta haber verificado funcionalidad, todas las operaciones y consumo por pulsación; distinguir prueba aislada, código guardado y producción desplegada.
5. Al cerrar una acción, registrar resultado y ahorro comprobado en una línea en `Acciones cerradas`; recién entonces cambiar `Acción vigente` a 002, luego 003, etc.
6. Al responder al usuario, dar solamente: acción actual, qué se corrigió, si está probado/desplegado, y siguiente tarea concreta. No trasladar informes técnicos.
7. Cada modificación del Worker incrementa en uno la versión de entrega: 156, 157, etc. Actualizar identificación de versión en cabecera, respuesta y métricas. Conservar el mismo archivo y enlace; no cambiar claves persistentes ni versiones de esquemas por el solo incremento de entrega. El usuario copia el código desde GitHub y lo despliega en Cloudflare.

## Acciones cerradas
Ninguna todavía.

## Verificación de continuidad — 2026-11-04
- **Acción 001 sigue ABIERTA.** Intervención de solo lectura sobre producción; no se desplegó ni modificó el Worker.
- GitHub: archivo único `worker/worker155_roles_permisos.txt` en `feature/gran-hermano-roles-permisos-20261103`, blob `5cd3addb093bd714e484614ecffc4a49b66fbbea`. Conserva caché de cumpleaños por día con TTL 300 s e invalidación al cambiar fecha/estado o crear un cumpleaños activo.
- Cloudflare: Worker `login`, última modificación declarada `2026-11-03T23:39:11.240947Z`. Código recuperado directamente del despliegue: **NO contiene** `BIRTHDAY_SUMMARY_CACHE_V155`; el resumen sigue enumerando KV en cada consulta. La cabecera dice 155 pero el reporte principal emite `worker_version:154` y la raíz `version:147`. No identificar el despliegue por su cabecera solamente.
- Línea base observada: consulta de las 24 h anteriores a esta intervención, ruta exacta `/superadmin/dashboard`: 7 observaciones, 65 listados KV, 42 lecturas KV y 0 lecturas/escrituras Firestore según los contadores emitidos; versión reportada 154. Son agregados de esa ruta, **no** costo por pulsación ni cantidad atribuida exclusivamente a cumpleaños, ni comprobante de facturación.
- Segunda consulta (2026-11-03T13:15:00Z a 2026-11-04T12:24:50.412Z): `/suscriptores`, `action=login`, estado 200: 3 observaciones, 60 lecturas KV, 0 listados/escrituras KV y 0 lecturas/escrituras Firestore reportadas. No permite distinguir Usuario de Anunciante. Hallazgos adicionales a correlacionar con INGRESAR: 9 respuestas 500 de `perfil` y 10 de `favoritos`; no se atribuyen al ingreso sin trazas.
- Limitaciones comprobadas: consulta de eventos individuales falla en el conector por validación de `$workers.requestId` ausente; las agregaciones sí responden. No hay herramienta de despliegue en el conector de Cloudflare disponible. El navegador conectado devuelve “Browser access requires the originating browser context”; no se pudo usar esa sesión para desplegar ni ejecutar ingresos autenticados. No hay acceso directo a métricas/facturación de Firebase/Firestore en las herramientas disponibles. Costo monetario integral y ahorro: **NO COMPROBADOS**.
- **Próximo paso exacto:** recuperar acceso al navegador conectado desde ChatGPT abierto con su extensión; comparar nuevamente el código activo con el archivo único de GitHub para evitar sobrescribir desarrollo concurrente; verificar impacto y desplegar el ajuste pendiente; ejecutar un ingreso controlado por interfaz y un segundo ingreso, correlacionando solicitudes y contadores; comprobar invalidación de cumpleaños con cuenta autorizada y revisar los 500 de perfil/favoritos si forman parte de la carga inicial. Contrastar contadores con consumo de proveedor antes de cerrar 001.
- Registro actualizado a 2026-11-04T12:25:17.768Z; no iniciar Acción 002.

## Entrega Worker 156 y método acordado — 2026-11-04
- Instrucción vigente del usuario: modificar exclusivamente el archivo único en GitHub; entregar su enlace; el usuario copia, pega y despliega en Cloudflare. No solicitar navegador para desplegar. Cada cambio incrementa la versión en 1.
- **Entrega 156:** mismo archivo `worker/worker155_roles_permisos.txt`, misma rama. Se conserva el nombre del archivo para mantener un único enlace. Commit `582e0c86607a78ac4f977fadcaee8585c2a7738b`.
- Alcance: ajuste de caché de cumpleaños ya incorporado para INGRESAR a Gran Hermano; en esta intervención solo se actualizaron 11 líneas de identificación de entrega (cabecera, métricas, raíz y cabecera de respuesta que aún indicaba 145). Sin cambios de reglas, permisos, ciudades, datos o claves persistentes.
- Comprobación: lectura posterior desde GitHub coincide exactamente con el contenido entregado, blob `75fee43041a942316f7cdaf3e1fdaa77d8778de5`; mismo número de líneas, cambios limitados a identificación. Esto no comprueba funcionamiento en Cloudflare.
- **Control visible de Acción 001 — INGRESAR:** 1) confirmar despliegue 156; 2) comprobar ingreso completo de Usuario y sus solicitudes iniciales; 3) comprobar ingreso completo de Anunciante y sus solicitudes iniciales; 4) comprobar ingreso completo de Gran Hermano, incluida su pantalla inicial y bandeja; 5) repetir ingresos para medir reutilización y comprobar invalidación de cumpleaños; 6) registrar operaciones, cobertura y ahorro real, corregir fallos de esta acción y repetir lo afectado antes de cerrarla. Una sola interfaz bajo prueba por vez. Los puntos no constituyen acciones nuevas.
- Nombres de interfaz para informar: “pantalla inicial de Gran Hermano” en lugar de “dashboard”. `GET /superadmin/dashboard` es su ruta técnica. No iniciar ciudades u otro módulo durante la 001.
- **Próximo paso exacto vigente (reemplaza el del apartado anterior):** el usuario despliega la entrega 156 del enlace único; después verificar directamente código/versión activos y comenzar la comprobación controlada del ingreso de Usuario. Despliegue, funcionamiento integral y ahorro de 156: PENDIENTES / NO COMPROBADOS.

## Despliegue 156 verificado — 2026-11-04
- Usuario confirmó implementación. Se recuperó el código activo del Worker `login` desde Cloudflare y se cotejó con el archivo único de GitHub (blob `75fee43041a942316f7cdaf3e1fdaa77d8778de5`): coincidencia completa, excluyendo únicamente envoltorio multipart y espacios exteriores; 709517 caracteres en ambos códigos extraídos.
- Confirmados en producción: caché de resumen de cumpleaños, identificación principal de métricas 156 y versión de raíz 156. No se modificó código ni producción en esta intervención.
- **001 continúa ABIERTA.** Despliegue comprobado no equivale a ingreso funcional ni ahorro comprobado.
- **Instrucción de prueba a Usuario retirada:** fue prematura. Rige la secuencia fija 001.1–001.6; no solicitar cierre de sesión ni pulsaciones durante 001.1.

## 001.1 — Usuario: recorridos identificados en código
- Alcance de esta intervención: lectura de código y navegación/lectura en Ópera; sin cambios del Worker ni pruebas de credenciales. El conector específico de Ópera **sí funciona**: listó las pestañas y leyó `https://www.guialocal.ar/` y `/suscriptores/`. La limitación previa correspondía al otro conector, no a ausencia total de acceso al navegador.
- La lectura de Jimdo muestra los marcos “Guía Local” y “Nosotros”, pero no expone el contenido interno ni su URL. Por tanto, todavía no se afirma que el HTML servido por Firebase coincida con la rama main. No confundir lectura del repositorio con comprobación del código servido.
- Fuentes main leídas: `plataforma/inicio.html` blob `c3bd077dc64f7bb067c3707b749698aef9d84d5e`; `plataforma/carcasa.html` blob `548b17d4e06521df4af14dfb28473ccce28a7c91`; `plataforma/suscriptores.html` blob `5c1c9418d2f983973aff8ad7aaa5e29c3c4313c1`; `sesion-persistente.js`, `entrada-recordada.js` y `consumo-v44.js`. Worker leído del archivo único, rama de entrega.
- **Entrada a la ciudad, no autenticación:** `inicio.html:131–149` intenta recuperar ciudad; si no la recupera solicita `GET /territory/public`. `inicio.html:192–206` guarda contexto local y navega a `https://anunciantes-guialocal.web.app/plataforma/carcasa.html`. `entrada-recordada.js:19–41` puede consultar `GET /suscriptores?action=perfil` si tiene token. Son antecedentes que deben separarse del clic de autenticación.
- **Recorrido Usuario A — Ingresar desde la guía:** `carcasa.html:1319–1327` abre formulario local cuando no hay sesión. `carcasa.html:1152–1197` envía `POST /suscriptores` con `action=login`; exige suscriptor y token; guarda ambos localmente; actualiza el acceso y cierra el formulario. Si el acceso fue solicitado por un módulo pendiente, lo reanuda (`1183–1190`); esa carga debe atribuirse por su disparador. El clic normal de cabecera no llama automáticamente a favoritos/comercios en esta función.
- **Recorrido Usuario B — página Suscriptores / Mi Guía:** `suscriptores.html:1405` conecta el botón a `login():980–1022`. Un `POST /suscriptores`, `action=login`, y `saveSession():929–939` guarda perfil/token; `renderSession():959–976` muestra cuenta y dispara favoritos (`renderMiGuia:840–924`, `loadFavorites:807–815`) y comercios asociados (`cargarComerciosAutorizados_:690–699`). Rutas: `GET /suscriptores?action=favoritos` y `GET /suscriptores?action=anunciantes_autorizados`.
- En B, el arranque de documento ejecuta `renderSession(false)` y `loadCities().then(...renderMiGuia)` (`1455–1459`), por lo que no debe sumarse una segunda llamada de favoritos como certeza sin correlacionar tiempos. Posible cruce entre login y resolución de ciudades: pendiente de comprobar, no declarado error confirmado.
- Consultas diferidas de B: `GET /suscriptores?action=perfil` al abrir “Mis datos” (`1237–1246`); `GET /suscriptores/territory` al abrir residencia/ciudades (`1286–1295`). Parámetro `seccion=datos/ciudades` puede abrirlas al renderizar (`1420–1426`). No atribuirlas siempre al ingreso.
- **Servidor común:** archivo único del Worker: `routePanelV8:5794–5819` dirige login a `subscriberLoginV2:5562–5617`: credenciales, activo/verificación, estado de sesión, relaciones con anunciantes, enriquecimiento condicional y firma del token. `withAuthCacheV58:9112–9127` consulta KV para credenciales; si falta caché, consulta suscriptores y prepara caché. `subscriberSessionState:2619–2624` lee KV. `loginRelations:8888` usa caché privada; `subscriberFavorites:8880–8885` consulta caché y recurre a Firestore si falta. `anunciantes_autorizados:5798–5811` valida sesión y devuelve relaciones del token, sin consulta explícita a Firestore en esa ruta. No son números facturados por ingreso: son dependencias comprobadas en código.
- **Hallazgo de alcance:** Usuario tiene al menos dos entradas de autenticación diferentes. Antes se describió indebidamente el flujo de Suscriptores como si fuera el único botón INGRESAR. Ambos quedan dentro de 001; cumpleaños pertenece exclusivamente a la carga del panel de Gran Hermano, no a estos recorridos.
- **Posición actual exacta:** 001.1 → Usuario. Lectura estática de ambos recorridos documentada; falta contrastar el HTML servido y revisar interceptores/rutas de inicio que puedan añadir llamadas. No se pasó a Anunciante, no se cerró 001.1 ni se midió ahorro nuevo.
- **Próximo paso exacto:** contrastar `carcasa.html` y `suscriptores.html` servidos por Firebase con las fuentes leídas; completar llamadas de inicio e interceptores del recorrido Usuario A y B. Usar Ópera para inspección disponible; no pedir al usuario cerrar sesión. Luego documentar Anunciante en 001.1, manteniendo el orden Usuario → Anunciante → Gran Hermano.

## 001.1 — Usuario: contraste servido y resultados observados
- Verificación HTTP directa del hosting Firebase: `carcasa.html` responde 200, 123721 bytes, Git blob calculado `548b17d4e06521df4af14dfb28473ccce28a7c91`; `suscriptores.html` responde 200, 60380 bytes, Git blob calculado `5c1c9418d2f983973aff8ad7aaa5e29c3c4313c1`. Ambos coinciden byte por byte con las fuentes GitHub leídas. Queda resuelto el contraste pendiente del HTML servido en esas URLs; no demuestra por sí solo la URL del iframe de Jimdo.
- Observabilidad consultada a 2026-11-04T13:54:16.694Z, filtro `worker_version=156`, `path=/suscriptores`, últimas 24 h: 5 registros de perfil, todos 200; 5 de favoritos, todos 200; no aparecen registros de login en ese conjunto. No afirmar que las 10 respuestas sean 10 ingresos ni prueba de autenticación.
- Consulta de consumo últimas 6 h, mismas rutas y versión: favoritos 5 respuestas / 20 lecturas KV / 0 listados KV / 0 escrituras KV / 0 lecturas y escrituras Firestore reportadas; perfil 5 respuestas / 15 lecturas KV / 0 listados KV / 0 escrituras KV / 0 lecturas y escrituras Firestore reportadas. Promedios observados: favoritos 4 lecturas KV por respuesta, perfil 3. Sin acceso a facturación de proveedor; son contadores emitidos, no costo final.
- Resultado concreto: HTML servido coincide con GitHub; las consultas perfil/favoritos observadas en 156 respondieron correctamente y no recurrieron a Firestore según sus contadores. No se encontraron respuestas 500 en ese conjunto; no generalizar al resto de la plataforma ni considerar corregidos los 500 históricos sin reproducir su causa.
- Duplicación por pulsación y ahorro integral del ingreso: NO COMPROBADOS, porque no hay registro login 156 ni correlación con una pulsación. No se modificó Worker ni frontend.
- Próximo paso exacto: completar interceptores de Usuario y comprobar la posible doble carga de favoritos si el login coincide con la resolución de ciudades mediante reproducción aislada del código servido; luego registrar si es reproducible y su impacto antes de preparar una corrección. Sigue 001.1 → Usuario.

## Optimización relacionada con 001 — entrega 157
- Evaluación concreta de las lecturas de Perfil: sesión 1 KV + índice de cuenta 1 KV + paquete de cuenta 1 KV. Se reduce la indirección del perfil guardando su proyección sin clave en el índice por suscriptor durante la misma escritura existente. No se añaden claves ni escrituras; aumenta el tamaño del valor del índice.
- Archivo único actualizado a 157; commit `32aba6535df14f82d4bc789f0418074c6ec02f06`, blob `3299abb9eebbcadb98aad7ebd7cd77d87531a916`. Cotejo previo de código desplegado 156 contra GitHub: coincidencia. Lectura posterior de GitHub: coincidencia exacta con entrega.
- Alcance funcional: únicamente `withAuthCacheV58.store` y `cachedSubscriberProjection`, más identificación de versión. No se modificaron favoritos, revocación, permisos ni cumpleaños.
- Prueba aislada ejecutando la función modificada con KV/DB simulados: proyección 2 → 1 lecturas KV, 0 Firestore en caché preparada; contando la validación de sesión que permanece intacta, Perfil pasa de 3 → 2 lecturas por respuesta (reducción esperada 33,3%). Escrituras al preparar caché: siguen siendo 2.
- Pruebas pasadas: edición de nombre, cambio de correo (login antiguo rechazado), cambio de contraseña (anterior rechazada), cuenta inactiva, eliminación, exclusión de contraseña en proyección y compatibilidad con índice antiguo. Índice antiguo conserva su camino anterior de 2 lecturas de proyección, sin escritura de migración al leer. La reducción entra al regenerarse la caché por sus mecanismos existentes, no automáticamente en todos los perfiles al desplegar.
- No se retiró ninguna lectura de favoritos: versión y marcador de cambios sirven a la coherencia del paquete; reducirlas requiere una evaluación separada dentro de esta acción. No declararlas sobrantes sin comprobar invalidaciones.
- **Estado:** 157 preparado y pruebas aisladas pasadas; NO desplegado ni ahorro real comprobado. Activo verificado antes de preparar: 156.
- **Próximo paso exacto:** el usuario despliega 157 desde el mismo enlace; comprobar código activo, medir Perfil con índice nuevo frente a índice antiguo y confirmar lecturas reales y funcionamiento antes de declarar ahorro. Continúa Acción 001, interfaz Usuario; no se avanza a otra acción.

## 001 Usuario — eliminar solicitudes completas repetidas
- Fallos reproducidos antes del cambio usando las funciones originales: dos llamadas concurrentes de favoritos generan 2 solicitudes; tras login se vuelve a consultar anunciantes autorizados aunque el servidor ya los devolvió en la respuesta autenticada.
- Corrección en `plataforma/suscriptores.html`, commit `6915adcb8279586dd0e16c8b643872858c7aad43`, blob `18f43ed4d409a86121dbf7ee7bf48a909bdaa976`: reutilizar anunciantes de la respuesta de login (incluida lista vacía), conservar consulta de respaldo al restaurar sesión o si falta ese campo; compartir solo solicitudes de favoritos simultáneas por cuenta/token; evitar que el final de carga de ciudades repita favoritos ya solicitados durante login; descartar respuestas exitosas de la cuenta anterior al cambiar sesión.
- No se introduce una caché de duración indefinida ni se eliminan verificaciones de sesión del servidor. Una solicitud posterior de favoritos vuelve a leer: cambios no quedan congelados. No promete cero consultas entre dispositivos.
- Pruebas aisladas antes/después: favoritos concurrentes 2 → 1 solicitudes; listado de comercios inmediatamente tras login 1 → 0 solicitudes. Pasaron sintaxis de scripts, respuesta vacía de login, respaldo de sesión restaurada, separación por token, reintento tras error y supresión del callback inicial duplicado. Integridad de publicación existente pasó para carcasa y anunciantes.
- Revisión de impacto previa a publicar: cambio acotado al frontend de Suscriptores; Worker, datos persistentes y permisos sin cambios en esta intervención. Se confirmó en Cloudflare que sigue activo 156, no 157.
- Publicación automática Firebase iniciada por cambio de main; ejecución `41846422607`. Primera consulta de página servida aún devuelve blob anterior; no declarar publicada hasta comprobar ejecución y HTML activo.
- Ahorro demostrado en reproducción: se evitan solicitudes completas, no solo lecturas internas. Equivalencia de ahorro KV de favoritos esperada si conserva caché caliente: una solicitud duplicada evitada suprime sus 4 lecturas observadas en 156. Es una proyección del caso reproducido, NO medición de tráfico de producción tras el cambio.
- Próximo paso exacto: comprobar finalización de Firebase y cotejar el blob servido con `18f43ed4d409a86121dbf7ee7bf48a909bdaa976`; medir ingreso real con código nuevo. 157 sigue preparado para copia manual, no desplegado. Acción 001 ABIERTA.

### Publicación del cambio de Usuario comprobada
- Firebase ejecución `41846422607`: completed / success.
- HTTP directo de `https://anunciantes-guialocal.web.app/plataforma/suscriptores.html`: 200; Git blob calculado `18f43ed4d409a86121dbf7ee7bf48a909bdaa976`, coincidencia exacta con entrega. Presentes reutilización de anunciantes del login y deduplicación de favoritos. Corrección frontend publicada.
- No declarar aún ahorro de producción por ingreso: pendiente correlación de pulsación autenticada y solicitudes del código nuevo. Próximo paso: medir ese caso con la publicación comprobada; no requiere volver a desplegar frontend. Worker 157 permanece pendiente de despliegue manual.

## Despliegue 157 comprobado
- Usuario confirmó despliegue; código recuperado directamente del Worker `login` coincide completamente con GitHub, blob `3299abb9eebbcadb98aad7ebd7cd77d87531a916`, excluyendo envoltorio multipart y espacios exteriores. Identificación principal 157 confirmada.
- Consulta de registros a 2026-11-04T14:29:23.424Z, última hora, versión 157 y ruta `/suscriptores`: sin observaciones. No confundir ausencia de registros con cero consumo o funcionamiento comprobado.
- Frontend de Suscriptores ya publicado y verificado en intervención anterior. No se modificó código en esta verificación.
- **Próximo paso exacto:** obtener evidencia de solicitudes autenticadas bajo 157 y frontend nuevo, distinguiendo índices de perfil antiguos/nuevos; comprobar lecturas y ausencia de solicitudes redundantes por ingreso. No cerrar 001 ni atribuir ahorro real hasta tener datos. Orden de trabajo: Usuario.

## Intento de comprobación autenticada 157
- Se navegó en Ópera al HTML servido `https://anunciantes-guialocal.web.app/plataforma/suscriptores.html?vista=mi-guia`, redirigido por Firebase a ruta sin extensión. Pestaña 1883589471: la lectura muestra “Ingresá a tu cuenta”, campos Mail/Contraseña vacíos y botón Ingresar. No hay sesión de Usuario utilizable en esa página.
- Capacidades reales del conector Ópera disponible: navegación, lectura, pestañas y capturas; no expone pulsación ni escritura. El otro conector Browser sigue devolviendo “Browser access requires the originating browser context”. No se inventaron acciones UI ni se leyó almacenamiento privado para extraer tokens.
- Solicitudes HTTP desde el entorno a raíz, perfil y favoritos del Worker recibieron 403 no JSON, sin cabeceras X-GLD. No se atribuyen esas respuestas al control de autenticación del Worker: falta evidencia de llegada y pueden corresponder al acceso de red. No se consideran pruebas funcionales ni consumo de la plataforma.
- Observabilidad última hora, versión 157, /suscriptores: sigue sin muestras. Ahorro real e ingreso autenticado NO COMPROBADOS.
- **Bloqueo concreto:** no hay sesión autorizada abierta en la página accesible ni herramienta que pueda operar su formulario. **Próximo paso exacto:** disponer de sesión de Usuario iniciada en la pestaña de Suscriptores abierta; sin pedir contraseña en chat. Con esa sesión, navegar/recargar permite comprobar carga autenticada y sus solicitudes; no equivale a probar una nueva pulsación de login. La prueba completa del botón requiere capacidad de interacción habilitada. Continúa 001 Usuario.

## Usuario autenticado observado — 157
- En Ópera, pestaña 1883589471 muestra Mi Guía con cuenta iniciada, ciudad habitual y favoritos cargados. Se comprobó la pantalla real, sin extraer credenciales ni tokens.
- Registros /suscriptores, versión 157, últimos 15 minutos: 2 login 200, 40 lecturas KV totales (20 cada uno); 1 favoritos 200, 4 lecturas KV; 3 session 200, 3 lecturas KV. Todos reportan 0 escrituras/listados KV y 0 lecturas/escrituras Firestore. No aparecen anunciantes_autorizados ni perfil en ese conjunto.
- Ingresos individualizados: 2026-11-04T14:36:10.778Z (request c2595173-feb3-403e-962f-179c86f1ec08) y 2026-11-04T14:36:54.836Z (request 1ad7c9bf-a71f-40e6-bb75-1b04f7151222), 20 lecturas KV cada uno. Separados aproximadamente 44 s: no atribuirlos a una sola pulsación ni declararlos duplicados.
- Resultado funcional comprobado: sesión iniciada y carga visible de favoritos; respuestas observadas exitosas. Ausencia de consulta extra anunciantes_autorizados compatible con corrección frontend, pero no se afirma ahorro controlado antes/después sin correlación individual de la pantalla.
- Hallazgo prioritario dentro de INGRESAR Usuario: 20 lecturas KV por login incluso con Firestore en 0. El enriquecimiento de relaciones puede consultar paquetes por anunciante y revisión; se leyó loginAdvertiser (8890–8910), que usa lectura de revisión y paquete por colección/anunciante. Falta desglosar las 20 por claves reales o reproducción con las mismas relaciones antes de corregir. No declarar que son todas necesarias.
- Perfil 3 → 2: todavía NO COMPROBADO en producción; no hubo solicitud perfil en esta muestra. Caché de cumpleaños: sigue pendiente en recorrido de Gran Hermano.
- **Próximo paso exacto:** desglosar y reducir el costo de 20 lecturas KV del login Usuario, comprobando permisos, vínculos y revocación sin agregar escrituras por ingreso; mantener comprobado lo anterior y no cerrar 001. Usuario ya dispone de sesión: no pedirle ingresar nuevamente para continuar análisis.

## 001 Usuario — 20 lecturas desglosadas y entrega 158
- Se recuperaron claves de trazas KV del intervalo 2026-11-04T14:36:10Z–14:36:12Z, correspondiente al primer login observado (14:36:10.778Z). Enumeración: 1 clave auth:mail, 1 subscriber:session-state, 2 login:relations (revisión y paquete), 8 revisiones y 8 paquetes de anunciantes_administracion. Total 20. Las claves de suscriptor/cuenta no se reproducen en el informe al usuario.
- Causa confirmada: cada login relee los 8 paquetes de administración aunque sus revisiones no hayan cambiado. No se eliminan los 8 controles de revisión ni credenciales/sesión/vínculos.
- Corrección 158, mismo archivo único: caché en memoria aislada por binding, máximo 256 entradas, caducidad 5 minutos, para proyecciones de login por clave y revisión. Cada acceso vuelve a consultar revisión; si cambia, obtiene el paquete nuevo. Invalidación local elimina entradas antes de mutaciones; retorno por copia para impedir contaminación entre solicitudes. No se almacenan credenciales en esa caché ni se agregan escrituras KV/Firestore.
- Pruebas ejecutadas sobre función real anterior/modificada y archivo final: 8 paquetes = 16 lecturas antes; después 16 con memoria fría y 8 al repetir tras 44 s, sin nuevas escrituras ni Firestore. Con los 4 controles comunes, caso real modelado 20 → 12 lecturas, reducción de 40% **solo con memoria caliente del mismo isolate**. En otro isolate, tras caducidad o cambio de revisión, las lecturas de paquetes necesarias reaparecen. No afirmar 12 garantizadas por cada ingreso.
- Pasaron: revisión modificada externamente, cambio local de nombre/funcionalidades, eliminación, caducidad 5 min, aislamiento por binding, copias de resultados y expulsión a 256 entradas. Sintaxis completa del Worker validada con Node en modo módulo.
- Commit entrega `088807d6bd1de598164ffc9de59b991dbe7760ff`, blob `e4f791cf776f8d84f198c4dc2aba87021541b689`; lectura posterior coincide exactamente. Se cotejó antes el 157 desplegado con GitHub y se volvió a comprobar ausencia de edición concurrente del archivo antes de escribir.
- **Estado:** 158 guardado y probado de forma aislada, pendiente de despliegue por usuario. 157 sigue activo según última verificación. No se cambiaron frontend ni datos de producción en esta intervención.
- **Próximo paso exacto:** usuario despliega 158 desde enlace único; cotejar código activo y observar ingresos repetidos, distinguiendo memoria fría/caliente, así como cambios de revisiones. Medir ahorro real antes de cerrar 001. No volver a pedir al usuario definiciones del procedimiento: el análisis, pruebas, correcciones y documentación continúan por cuenta del asistente; solo se solicita intervención cuando falta capacidad real o para el despliegue manual acordado.

## Ajuste de criterio del ingreso — carga de permisos a demanda
- Instrucción del usuario: mostrar nombres ya disponibles sin volver a consultar datos; cargar detalle/permisos del anunciante al seleccionarlo. Objetivo de 001: reducir trabajo disparado por ingresar, no limitarse a acelerar el mismo enriquecimiento de ocho anunciantes.
- Lectura adicional comprobada: login subscriberLoginV2 enriquece todos los vínculos antes de firmar el token; los controles requirePanel (4099), requirePanel3 (5140), requirePanel4 (6309) y routePanelV10 permisos_panel (6325) dependen de auth en ese token. Por ello no es seguro simplemente quitar el enriquecimiento: rompería accesos o validación de permisos. Es necesario adaptar emisión y consumo del token coordinadamente y verificar el cliente de administración correcto (anunciantes.html es listado público, no asumir que es el panel privado).
- Mostrar un nombre que ya está en la respuesta o en memoria local no requiere lecturas remotas. Validar credenciales y vigencia de sesión es una operación distinta y sí puede requerirlas; no prometer cero consumo para autenticación completa.
- La entrega 158 es una mejora parcial en memoria, todavía pendiente según registro; no cumple por sí sola la carga de permisos a demanda. No solicitar despliegues sucesivos de una mejora parcial mientras se determina esta dependencia.
- **Próximo paso exacto:** localizar cliente privado de anunciantes y cómo consume session/auth; diseñar y probar el paso de identidad/lista mínima a autorización del anunciante seleccionado, conservando permisos, revocación y compatibilidad de tokens existentes. Solo preparar entrega cuando esas pruebas permitan afirmar su impacto. No modificar permisos ni producción mientras se desconozca el cliente.

## Actualización operativa — 2026-11-06: entrada pública y medición de costos
- **Registro único vigente:** este mismo archivo. No crear auditorías, registros maestros ni documentos paralelos. Las anotaciones históricas conservan su fecha: sus «próximos pasos» anteriores no sustituyen esta prioridad más reciente.
- **Decisión expresa del usuario:** prioridad inmediata al recorrido del Usuario final, empezando por selector de ciudad, recuperación de ciudad habitual y sesión, y después carcasa pública (tarjetas, efemérides y farmacias), acción por acción. Se registra como desagregación/prioridad operativa dentro del bloque Accesos/Usuario y su dependencia inmediata de Guía; no se declara cerrada la Acción 001 ni se alteran otros módulos.
- **Conexión pública:** usuario confirmó el 2026-11-06 que el QR abre correctamente y que puede navegar la página. `guialocal.ar` y `www.guialocal.ar` se comprobaron externamente llegando a `/plataforma/inicio`. Este incidente de dominio queda cerrado; no volver a tocar DNS/Jimdo ni reabrirlo salvo evidencia de un nuevo fallo.
- **Selector — código comprobado:** `plataforma/inicio.html` llama `GET /territory/public` una vez cuando necesita mostrar el selector; la búsqueda en el campo, la elección de ciudad y el botón de ingreso no generan otra solicitud de catálogo en ese documento. El Worker `login` atiende `/territory/public` con una lectura de Cloudflare KV del paquete público; no consulta Firestore en ese recorrido según código y métricas disponibles. La respuesta incorpora cabecera de caché HTTP, pero el selector no conserva por sí mismo una copia persistente del catálogo en almacenamiento local.
- **Métrica agregada, NO por pulsación:** observabilidad de Cloudflare, filtro ruta exacta `/territory/public`, intervalo 2026-11-06 11:00–16:00 UTC: 5 solicitudes Worker, 5 operaciones KV GET y 0 lecturas Firestore facturables reportadas. **NO significa cinco lecturas por una sola selección** y no se identificó qué navegador o gesto originó cada una. Evitar repetir ese error de atribución.
- **Medidor existente:** `plataforma/consumo-v44.js` incluye «Activar pruebas privadas», «Empezar medición desde ahora», registro por ruta y exportación CSV. Muestra contadores del Worker/Firestore y CPU del Worker cuando está informada; no representa todo el gasto de la cuenta ni mide directamente bytes/almacenamiento total de proveedores. La prueba controlada de selector debe iniciarse **antes** de abrirlo, y debe correlacionarse con observabilidad para cubrir solicitudes que el navegador no capturó. Medir también tiempo CPU, duración y datos almacenados cuando el proveedor los exponga; marcar **NO COMPROBADO** lo faltante, nunca inventar cifras.
- **Sesión/ciudad recordada:** `plataforma/entrada-recordada.js` consulta `GET /suscriptores?action=perfil` si encuentra token, elige `ciudad_predeterminada_id` y `inicio.html` salta el selector; comprobar funcionamiento y costo en caso controlado sin exponer credenciales ni forzar cierres innecesarios.
- **Estado:** selector revisado estáticamente y con agregación del servidor; costo integral por apertura, selección y regreso con sesión **NO COMPROBADO**. Aún no hay cambio de optimización publicado para selector; no convertir recomendaciones de caché en supuestas correcciones.
- **Próximo paso exacto:** una medición controlada del selector con pruebas privadas: registrar línea base, abrir `guialocal.ar` como nuevo visitante sin sesión, escribir y elegir ciudad, pulsar «Ingresar», detener y exportar; separar acciones y medir solicitudes Worker, KV, CPU, Firestore y cobertura. Después comprobar reingreso con sesión/ciudad recordada. Solo una intervención por vez; comparar costo antes/después de cualquier corrección.

## Corrección del menú APP — 2026-11-06
- Hallazgo confirmado en `plataforma/app-prueba.html`: la versión instalada redirigía siempre a `/plataforma/inicio.html` al pulsar APP desde navegación.
- Corregidas ambas redirecciones: con `gld_ciudad_contexto` válido, APP instalado abre `/plataforma/carcasa.html` con los parámetros de la ciudad guardada; sin ciudad, mantiene selector inicial. No agrega solicitudes a Worker ni a Firestore para elegir el destino; se lee `localStorage`.
- Commit `c49f6dec78f264aa97af433e2dc96f6838c11eda`; workflow Firebase `42263871957`, job de despliegue completado con éxito. Aún pendiente comprobar recorrido interactivo en un dispositivo con PWA instalada y ciudad recordada. No se modificaron sesiones, permisos ni Worker.

## Corte integral de auditoría — 2026-11-06, 07:00–15:30 Argentina
- **Solicitado por usuario:** identificar todas las funciones efectivamente presentes y consumos por interfaz, pantalla y acción; no repetir auditorías ni usar supuestos de usuarios ficticios. Este corte registra exclusivamente evidencia comprobada hoy. Las cifras de registros son agregadas, no consumos por persona ni necesariamente todas las llamadas de un recorrido.
- **Código inspeccionado:** `inicio.html` (selector), `carcasa.html` (navegación y carga general), `anunciantes.html` (vista pública y búsqueda), `login.html` (anunciante y edición), `administracion.html` (panel general), `eventos.html`, `promos.html`, `actividades.html`, `empleo.html` y `empleo.js`; `territorio-cache.js`, `entrada-recordada.js`, `consumo-v44.js`. Hay otras funciones en el repositorio por recorrer; esta enumeración NO es auditoría funcional cerrada de todos los botones.
- **Datos reales Cloudflare Worker `login`, período 2026-11-06T10:00:00Z a 18:30:00Z, ruta exacta, contadores de la instrumentación**:
| Ruta | Solicitudes observadas | KV GET | KV PUT | KV LIST | Firestore billed reads reportadas | Firestore billed writes reportadas |
|---|---:|---:|---:|---:|---:|---:|
| /territory/public | 24 | 24 | 0 | 0 | 0 | 0 |
| /events-new | 4 | 0 | 0 | 0 | 0 | 0 |
| /promos | 4 | 0 | 0 | 0 | 0 | 0 |
| /actividades | 4 | 0 | 0 | 0 | 0 | 0 |
| /farmacias | 5 | 0 | 0 | 0 | 0 | 0 |
| /efemerides | 2 | 0 | 0 | 0 | 0 | 0 |
| /publicidad | 5 | 15 | 0 | 0 | 0 | 0 |
- **Sin observaciones en ese mismo período y filtro de ruta exacta:** /suscriptores, /superadmin/dashboard, /superadmin/inbox, /superadmin/territory, /login, /menu, /empleo. Cero registros NO prueba cero tráfico ni cero costo: pudo haber otras rutas, filtros, muestreo o solicitudes sin telemetría disponible.
- **No se ha medido por usuario ni botón:** los agregados del Worker no identifican inequívocamente la pantalla ni la pulsación; rutas públicas pueden servir a varias interfaces. La medición privada en `consumo-v44.js` recoge el `pagina` y la ruta por llamada *en el navegador autorizado*, hasta 160 registros, y dispone de CSV o **Compartir registro** con URL de lectura temporal. No es un monitor global de la cuenta. Para vincular la prueba privada al análisis, hace falta que el titular comparta el enlace o CSV de esa sesión; no afirmar que se tiene acceso a su localStorage.
- **Hallazgos estáticos verificables:** `territorio-cache.js` reutiliza el catálogo de ciudades por dispositivo durante 24 horas; el servidor mantiene catálogo público de KV y operaciones administrativas actualizan su contenido. `anunciantes.html` mantiene caché de Guía local de 2 horas y cachés de módulos de 1 hora; `carcasa.html` también tiene cachés de módulos de 1 hora. Esos plazos se han observado en código pero **no equivalen a consumos reales por persona** ni garantizan invalidación interdispositivo.
- **Pendiente crítico:** validar funcionalidad y costo *completo*, con pruebas de botón y pantalla, de cada interfaz. Especialmente comparar ingreso, selector, guía/tarjetas, creación y modificación de anuncios, eventos, promociones, actividades, empleo, moderación y soporte. Medir campos `pagina`, `ruta`, `accion`, Firestore, KV y CPU, distinguir no medido de cero, y comparar contra contadores del proveedor; no estimar ahorro hasta tener antes/después del mismo caso.
- **No hay cambios de código ni despliegue a producción en este corte**; únicamente se registran resultados. Mantener este documento como fuente única.

### Implementación medidor por plano y dispositivo — 2026-11-06
- Actualizado `plataforma/consumo-v44.js`: incorpora `interfaz` (Usuario / Panel anunciante / Administración general) a cada fila diagnosticada, identificador aleatorio persistente por navegador `dispositivo` y ambas columnas al CSV y al detalle. No se agrega ninguna solicitud de red para medición; requiere pruebas privadas activadas/autorizadas y que el Worker exponga contadores por cabeceras. No identifica usuarios reales ni todas las sesiones de la plataforma.
- Referencia de script activada `?v=142` en `inicio.html`, `carcasa.html`, `anunciantes.html`, `login.html`, `administracion.html`. Solo instrumentación privada, sin transmitir identidad ni cambiar lecturas en Firestore.
- **Distribución horaria comprobada de 24 GET /territory/public y 24 KV GET, mismo día**: 07:00–12:00 ART: 1 pedido/1 KV GET; 12:00–15:30 ART: 23 pedidos/23 KV GET. No se puede inferir de estos agregados cuántos dispositivos distintos ni quién los ejecutó.
- **Pendiente crítico:** probar navegación con pruebas privadas autorizadas y compartir CSV/enlace para vincular pantalla/acción con consumo real. Log agregado anterior sin identificador no permite retroatribuir esos 24 pedidos. Validar despliegue GitHub Actions último commit `a39d70c3`.

### 2026-11-06 — Duplicación territorial entre interfaces
- Inspección de `inicio.html` y `carcasa.html`: ambos usan `GLD_CATALOGO_TERRITORIAL.load()` con `localStorage` 24h. **Hallazgo** en `login.html`: `gldTerritoryPublic_()` llamaba directamente `fetch('/territory/public')` pese a existir la caché compartida, pudiendo generar 1 Worker request y 1 KV GET adicional por navegador/entrada al panel anunciante.
- Corregido `plataforma/login.html`: importa `territorio-cache.js?v=2` y reutiliza `GLD_CATALOGO_TERRITORIAL.load()` preservando transformación de campos esperados; commit `8b276fac8bea620b13094bf4d8e67ea58e61c51b`. Este cambio evita la repetición al usar la misma instancia de navegador y caché válida; no significa cero lecturas entre dispositivos ni prueba un ahorro medido antes/después.
- Seguimiento: comprobar despliegue y medir por navegación de panel anunciante cuando haya registro autorizado. No confundir análisis estático con prueba de consumo completa.
