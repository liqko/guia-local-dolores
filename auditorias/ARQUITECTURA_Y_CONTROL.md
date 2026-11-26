# GUÍA LOCAL — ARQUITECTURA Y CONTROL OBLIGATORIOS

**Estado:** contrato técnico objetivo, NO implementación. Se aplica a todas las acciones de Usuario, Anunciante y Gran Hermano.
**Seguimiento de ejecución y estado real:** [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md). Nunca reemplazar comprobación por una declaración de diseño.

## Arquitectura única

1. **Datos:** Firestore es la fuente de registros modificables. La autorización es responsabilidad exclusiva del servidor. Ninguna interfaz consulta registros individuales de Firestore para repetir información ya publicada sin cambios.
2. **Mutaciones:** un núcleo por entidad, en el Worker vigente, define alta, edición, activación, desactivación y eliminación, relaciones, permisos, dependencias, recuperación e idempotencia; las interfaces no duplican reglas.
3. **Publicación:** ante cambio real se recompone una versión de lectura de los conjuntos afectados; un dato idéntico no origina escritura. La publicación nunca precede a la persistencia confirmada. Un fallo se detecta y se puede reintentar sin repetir operaciones.
4. **Catálogo territorial:** una autoridad lógica país→provincia→ciudad. El campo activo define qué se publica. La administración puede visualizar inactivos. Los campos no públicos y los permisos siguen protegidos, sin mantener por defecto copias completas redundantes del catálogo en KV.
5. **Distribución:** catálogo público y paquetes por ciudad como archivos publicados, versionados y persistidos en el navegador. Abrir un paquete vigente no exige lectura Firestore/KV. La comprobación de cambios no requiere consultar las bases por cada apertura.
6. **Paquetes por funcionalidad:** Usuario obtiene la ciudad elegida y sus módulos aplicables; el anunciante autenticado obtiene primero un índice de sus anunciantes y después el seleccionado, dividido por módulo si el tamaño real lo justifica. Los paquetes privados no se entregan como archivos públicos.
7. **Clientes:** Usuario, Anunciante y Gran Hermano comparten identidad y utilidades. No hay lectores paralelos de las mismas entidades sin un motivo documentado, medido y temporal. Si existe una contingencia, se registra cada activación y se retira al verificarse el sistema normal.
8. **Criterio de programación:** DRY, KISS, responsabilidades separadas, mínima complejidad y una sola implementación por función; no agregar una capa para ocultar otra rota.

## Ciudades: contrato funcional

- Crear país de manera **independiente**; crear provincia/estado ligada a país; crear ciudad/partido ligada a provincia y país. No exigir un alta conjunta.
- Gran Hermano: tres pestañas **Ciudades | Provincias | Países**; búsqueda, selección, edición, activación/desactivación y eliminación segura, con verificación de referencias.
- **Actualizar** verde y siempre al final de los controles. **Eliminar** rojo.
- Modificar activo actualiza lo visible públicamente; no expone datos administrativos ni contraseñas.
- Al cambiar una ciudad, recomponer solo paquetes afectados. Validar Usuario, Anunciante, Gran Hermano, sedes, Guía, Eventos, Actividades, Promociones, Publicidad, Farmacias, Empleo y Efemérides según dependencia real.
- El sistema `paquete-ciudad.js` y `territorio-cache.js` se analiza como **lector y catálogo relacionados**; conservar sólo funciones necesarias. Completar publicación y versiones antes de eliminar consultas alternativas.

## Auditoría integral: cómo evitar problemas que reaparecen

**Una fila por problema**, identificador estable `CIU-001`, etc. No crear varias filas por el mismo síntoma. Cada fila exige:
- **Síntoma visible** y acción/rol afectados.
- **Causa raíz confirmada**, ubicación y cadena completa desde escritura hasta todas las interfaces.
- **Dependencias**; determinar si la misma causa explica otros problemas, enlazarlos.
- **Corrección definitiva propuesta**; marcar **diseño / implementada / comprobada en pruebas aisladas / comprobada en navegador / desplegada** sin mezclarlos.
- **Pruebas de aceptación** y prueba negativa, incluidas las tres interfaces cuando correspondan.
- **Consumo antes/después**, por servicio (Firestore, KV, Durable Objects, Worker, CPU, USD); distinguir estimación de dato medido.
- **Evidencia reproducible** (commit, request, respuesta, contador), responsable y **siguiente paso exacto**.

**Tres pasadas por acción, obligatorias antes del cierre:**
1. **Auditor de recorrido:** descubre todos los puntos de entrada, escritura, consulta, caché y presentación; los ordena en un mapa de dependencias.
2. **Auditor adversarial:** busca fallos, duplicación, permisos, invalidaciones, contingencias, datos desactualizados y consumos en ese mapa; si aparece algo nuevo, añade su causa al mismo registro y repite las pruebas afectadas.
3. **Auditor de resultados:** comprueba extremo a extremo en las interfaces con datos reales controlados, sin asumir que el código o las pruebas aisladas equivalen a funcionamiento; compara consumos reales antes/después.

**Puerta de cierre:** no se termina una acción hasta que el inventario de recorridos esté completo, todas las incidencias conocidas estén resueltas o identificadas como bloqueo explícito, no se detecten nuevas regresiones en las tres pasadas y el responsable pueda observar el resultado y la medición. Una auditoría no puede garantizar matemáticamente ausencia de errores: se controla su alcance y evidencia.

## Incidencias actualmente identificadas (estado al 16/11/2026)

| ID | Causa y efecto | Estado verificable | Corrección y comprobación pendiente |
|---|---|---|---|
| CIU-001 | `territorio-cache.js`: índice de paquetes vacío y catálogo embebido nulo en GitHub | Confirmado en rama y main; producción no verificada | Implementar el publicador de versiones, publicar archivo real y probar carga sin contingencias |
| CIU-002 | No existe ruta de archivos `plataforma/paquetes-ciudad/` en ramas inspeccionadas | Confirmado en GitHub; alojamiento no verificado | Generar archivos de paquetes por ciudad y validar URL/publicación |
| CIU-003 | Anunciantes y Carcasa tienen consultas alternativas por módulo cuando no hay paquete | Código confirmado; frecuencia y costo no medidos | Instrumentar, completar CIU-001/002 y retirar duplicaciones tras prueba |
| CIU-004 | Dos paquetes KV territoriales completos, administrativo/público, se reescriben tras cambios | Confirmado en código; costo físico sin medir | Diseñar y migrar un catálogo lógico/versionado; reducir operaciones sin exponer datos no públicos |
| CIU-005 | Gran Hermano tiene caché entre sesiones implementada en rama, no sincronizada por cambio externo | Parcial, no desplegada ni comprobada en navegador | Versiones e invalidación sin lecturas de DB por visita; probar dos dispositivos |
| CIU-006 | Alta de ciudad en rama obliga/propone flujo conjunto con país y provincia; no coincide con alta independiente acordada | Confirmado en HTML/Worker de rama | Corregir alta independiente y relaciones; probar con país/provincia ya creados |
| CIU-007 | Faltan pestañas funcionales para provincias y países y operaciones completas de edición/baja | Pendiente | Implementar y probar, incluido bloqueo por referencias |
| CIU-008 | HTML hace DELETE de ciudad; ruta equivalente no localizada en Worker revisado | Riesgo confirmado por búsqueda textual, requiere rastreo de todos los dispatchers | Determinar ruta efectiva, implementar/verificar eliminación sin pérdida de registros relacionados |
| CIU-009 | Estilos y orden Actualizar/Eliminar modificados en rama | Sintaxis comprobada; navegador/producción pendientes | Verificación visual en todas las pantallas afectadas |
| CIU-010 | Contadores de consumos reales no levantados en pruebas de Usuario/Anunciante/Gran Hermano | Pendiente | Escenarios frío/caliente/cambio, Firestore/KV/DO/CPU/USD antes/después |

**Siguiente paso único:** completar el mapa de recorridos de Ciudades en las tres interfaces y corregir la cadena CIU-001→CIU-002→CIU-003 con publicación verificable; después continuar CIU-004 a CIU-010 y la prueba transversal. No cambiar de acción ni acumular parches sin resolver causa raíz.

## Dirección de implementación transversal — contrato de ejecución

**Vigencia:** 24/11/2026. Este apartado fija el orden de ingeniería y los criterios de aceptación de toda la plataforma. Complementa los requisitos anteriores sin eliminar ningún contrato funcional ni alterar los identificadores de los pasos 1–4. No es una nueva auditoría ni un nuevo inventario.

### Arquitectura que debe construirse

1. **Fuente y operaciones compartidas:** Firestore conserva los registros modificables; el Worker vigente controla autenticación, permisos, validaciones, cambios, relaciones, concurrencia, idempotencia y recuperación. Una operación semántica tiene un solo camino autorizado. No se crean escrituras duplicadas por cachés o proyecciones.
2. **Lectura pública:** paquetes publicados, versionados, por ciudad y funcionalidad; índice de versiones verificable y conservación local. Abrir información pública vigente no realiza consultas repetidas a Firestore o KV. El corte ordinario es a las **01:00 de Argentina (04:00 UTC)**, con publicación solamente de conjuntos efectivamente cambiados. Seguridad, revocaciones y bajas urgentes no esperan ese corte.
3. **Lectura privada:** por cuenta de suscriptor, índice de anunciantes asociados, datos del anunciante seleccionado y módulos necesarios; administración con permisos propios. No usar archivos públicos para datos privados ni cargar cuentas, anunciantes o módulos no solicitados. La granularidad real se decide mediante medición, no por crear paquetes gigantes.
4. **Escritura y sincronización común:** cambio visible de inmediato; estado claramente pendiente o confirmado; consolidación de cambios compatibles y cancelaciones; persistencia fiable sin depender del cierre de sesión; recuperación tras recarga/dispositivo nuevo una vez confirmado; invalidación y versiones que eviten sobrescribir datos nuevos con copias viejas. Respetar límites diarios de edición, consentimiento y operaciones urgentes. Un lote HTTP no se supone una única escritura facturable.
5. **Un solo contrato de caché y versiones:** identificar todos los lectores y escritores anteriores por entidad y retirada gradual de redundancias **después** de verificar sus consumidores, sin reemplazarlos por otra capa paralela. Mantener compatibilidad histórica solo cuando se demuestre necesaria y medir la frecuencia de activación.
6. **Costo total:** contabilizar conjuntamente consultas/escrituras Firestore, operaciones KV, invocaciones/almacenamiento Durable Objects, Workers/CPU, Hosting y distribución. Ninguna mejora se aprueba porque traslade costo entre proveedores o porque una simulación arroje cero consultas Firestore.

### Secuencia única de reprogramación (siete entregables integrados)

**E1 — Contrato de recorridos ejecutable.** Reutilizar los mapas del Paso 1, las 989 acciones del Paso 2, las dependencias y 321 excepciones del Paso 3, y el inventario P4. Vincular entrada → operación → almacenamiento → publicación/lectura → las tres interfaces afectadas. Identificar consumidores y causas comunes sin generar un inventario nuevo. Entregar pruebas de cobertura automática que señalen cadenas omitidas, no informes de botones.

**E2 — Núcleo común de operaciones.** Integrar permisos, transacciones/cambios idempotentes, relaciones, concurrencia y recuperación. Migrar las rutas actuales al contrato común conservando funcionamiento y datos históricos. Validar primero operaciones críticas y no romper los otros recorridos.

**E3 — Paquetes públicos y publicador.** Completar producción efectiva de índices y paquetes por ciudad/módulo, versiones, deltas, calendario 01:00 y excepciones urgentes; comprobar paquete servido y recuperado sin consultas innecesarias, no solo que existe código o cron.

**E4 — Paquetes privados y sincronización.** Integrar datos de suscriptores, anunciantes y administración con lectura bajo demanda, cambios visibles, agrupación segura de operaciones y recuperaciones entre dispositivos. Favoritos y sus correcciones existentes son un caso de prueba, **no** un proyecto separado ni la arquitectura general.

**E5 — Migración de los tres clientes y retiro de duplicaciones.** Conectar Usuario, Anunciante y Gran Hermano al mismo contrato, usando los árboles y dependencias para cubrir **todos** los consumidores de mecanismos sustituidos. Retirar consultas alternativas solo tras validar su reemplazo; conservar excepciones justificadas y acotadas.

**E6 — Pruebas automáticas de punta a punta y optimización integral.** Por recorrido aplicable, verificar sesión sin modificaciones; múltiples modificaciones, incluidas cancelaciones; y cambios efectivos con cierre/recarga/recuperación. Cubrir rol correcto e incorrecto, identidad, concurrencia, fallos, reversión y dependencias entre interfaces. Medir el mismo escenario antes/después, diferenciando simulación, instrumentación y consumos físicos; controlar también trabajo asíncrono y costos Cloudflare/Firebase/Hosting.

**E7 — Entrega y certificación de versiones integradas.** Preparar bloques compatibles, Worker completo cuando corresponda, CI, pruebas de interfaz y backend, mediciones, reversión y URLs de los archivos. Ningún merge o despliegue sin autorización expresa. El Paso 5 verifica integración total; no hereda trabajos sin terminar del Paso 4.

### Dirección y garantía de progreso

- **Control económico desagregado obligatorio.** En cada cambio y para cada acción, identificar servicio, tipo de operación, función, documento/colección/clave/actor, origen y destino, información tratada, registros y bytes, finalidad, momento, frecuencia y copias existentes. Clasificar cada operación como imprescindible, redundante, evitable o consolidable y justificar su necesidad, alternativa e impacto económico. Correlacionar acción de navegador, solicitud y registros de servicio. Eliminar redundancias seguras y comparar escenarios equivalentes. Diferenciar simulación, instrumentación, observación en producción y facturación. Registrar las métricas faltantes con su impedimento y conservar las garantías de autorización, persistencia, concurrencia, recuperación y publicación.

- **Los siete entregables son paquetes de trabajo de arquitectura, no siete auditorías sucesivas.** Se desarrollan por dependencias técnicas y pueden superponerse; la secuencia describe el camino de integración. No bloquear toda la ejecución porque una prueba externa no destructiva esté pendiente: registrar el bloqueo, seguir dependencias independientes y no dar por cerrada la entrega incompleta.
- **Una unidad de cambio es un mecanismo compartido más todos sus consumidores.** Las 40 P4/61 ejecuciones históricas son puntos de control de cobertura y trazabilidad, nunca orden obligatorio de 61 parches aislados. Comprobar lo implementado, reutilizarlo y revalidarlo frente al contrato.
- **Cada entrega exige evidencia:** rutas/consumidores cubiertos, código modificado, pruebas negativas y positivas, CI, medidas antes/después, funcionalidades de las tres interfaces afectadas, pendientes y aptitud de despliegue. Commit o prueba añadida sin resultado funcional no equivale a implementación.
- **Tablero existente, sin otro inventario:** registrar en `auditorias/PASO4_INTERVENCIONES.json` la cobertura y estado de los recorridos/ejecuciones originales, y en `auditorias/ESTADO_ACTUAL.md` el estado de E1–E7, referencias verificables y bloqueos. Nunca marcar como implementado lo que solo está diseñado, probado aisladamente o no publicado.
- **El usuario ve:** funcionalidades operativas, versión preparada/instalada, pruebas y costo comprobado. Solo se le consulta para una autorización o una prueba que no pueda realizarse autónomamente; una instrucción concreta cada vez. No solicitar decisiones de programación ni nuevos listados de fallas.
- **Prioridad permanente:** seguridad/integridad crítica antes que otras tareas; conservar la producción estable. Tras cada corrección compartida verificar regresiones en todas las interfaces y módulos dependientes. No detenerse tras cada commit para pedir nuevas instrucciones.

---
