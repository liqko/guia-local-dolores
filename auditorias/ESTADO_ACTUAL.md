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
| Accesos / 001 INGRESAR | Prueba controlada pendiente | Prueba controlada pendiente | Corrección de cumpleaños preparada; prueba real pendiente | 156 desplegado y cotejado con GitHub | ABIERTA; ahorro NO COMPROBADO |

### Formato fijo de cada actualización
Bloque y acción · interfaz bajo prueba · versión preparada y desplegada · corrección concreta · comprobación y consumo · pendiente y próximo paso exacto. Actualizar este tablero al obtener evidencia; no presentar porcentajes de avance inventados.

## Estado actual — 2026-11-04
- **Acción vigente:** 001 — INGRESAR, tres interfaces.
- **Estado:** ABIERTA. No comenzar la 002.
- **Problema:** al ingresar a Gran Hermano, el resumen de cumpleaños recorría repetidamente claves KV.
- **Corrección incorporada:** el resumen se conserva temporalmente, con invalidación al modificar cumpleaños. Comprobación aislada: segunda consulta, 0 listados adicionales; modificación de cumpleaños, 1 reconstrucción.
- **Worker preparado:** versión 156 (desplegada y cotejada con GitHub), archivo único en rama `feature/gran-hermano-roles-permisos-20261103`: `worker/worker155_roles_permisos.txt`; commit del ajuste `9c6890121d6bf5df58bd624c124a978c6acff1c9`.
- **Despliegue:** 156 realizado por el usuario y verificado directamente en Cloudflare el 2026-11-04. Código activo coincide con GitHub. Ahorro real aún NO COMPROBADO.
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
