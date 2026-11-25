# Control transversal de consumos — resultado del recorrido estructural inicial
Fecha: 2026-11-15
Fuente única: `main` de `liqko/guia-local-dolores` al momento de inspección. Producción no modificada.
**Evidencia completa de ubicaciones**: `auditorias/transversal/inventario-codigo.json`. Su contenido se generó leyendo íntegramente los cinco archivos, sin depender de muestras ni de fragmentos recuperados por búsqueda.

## Alcance recorrido mecánicamente

| Archivo | SHA blob inspeccionado | Líneas | Funciones declaradas con nombre | Referencias literales de rutas (aprox.) |
|---|---|---:|---:|---:|
| `worker/worker206.txt` | `788a9cb79d536459fd01050a449cd85db4daaf54` | 13.369 | 688 | 209 |
| `plataforma/administracion.html` | `34350e2840285e57149de09cbc75a5af00b7b94e` | 4.117 | 209 | 28 |
| `plataforma/login.html` | `5886a743b8508343b70764412cc3849ef3b4bb0b` | 10.360 | 348 | 16 |
| `plataforma/anunciantes.html` | `483bcf0dee104ff2d492cfe58f2a84859b688a12` | 4.004 | 168 | 4 |
| `plataforma/carcasa.html` | `67aba95361b598ecc3356262324762a7e028b677` | 2.914 | 83 | 0 |

**Total recorrido:** 34.764 líneas. La cuenta de referencias literales no equivale a rutas exclusivas y la cuenta de funciones incluye funciones locales y variaciones de sintaxis; no demuestra que sean rutas duplicadas ni que hayan sido ejecutadas.

**Worker, apariciones de invocaciones detectadas por patrón** (no son operaciones facturadas, ni sumables entre sí): `db.get/getVersioned` 166; `db.queryEqual/list` 166; `db.patch/delete/commitPatches` 149; `kv/cache.get` 227; `kv/cache.put/delete/list` 166; comprobaciones de identidad/autorización 120; llamadas de reconstrucción/preparación 41. Este es el inventario de **dónde pueden ocurrir consumos**; no una simulación de que todos sucedan en cada petición.

## Hallazgos técnicos con evidencia de código (orden de riesgo)

### C-01 — Mediciones incompletas en circuitos delegados — PRIORIDAD CRÍTICA

**Worker líneas 13182–13202:** `traced(response)` ejecuta `db.flushLoginCache` y añade `X-GLD-Consumption`, `X-GLD-Operations`, `X-GLD-Cache-Checks`, `X-GLD-Request-Id`, y otros datos que necesita la interfaz de medición.

**Worker líneas 13218–13219:** al devolver `GLD_BUSINESS143.dispatch(ctx)` o `routeGuideDispatch132(ctx)` se retorna la respuesta directamente, **sin pasar por `traced`**. El `finally` de líneas 13248–13250 escribe el resumen en logs, pero **no añade el encabezado de consumo a la respuesta** ni ejecuta la finalización de caché reservada a `traced`. Son dos circuitos de guardado importantes: promociones/publicidad y fichas/sedes.

**Consecuencia demostrable:** el navegador no recibe por esa vía el desglose completo del Worker exterior; por eso es imposible declarar medición completa desde los encabezados de esas respuestas. La conciliación con resultados del actor interno sigue pendiente. **No corregir agregando `traced` sin comprobar qué escrituras o resultados espera `flushLoginCache`; probar seguridad e idempotencia antes.**

### C-02 — Lectura redundante de autorización dentro de una acción — PRIORIDAD ALTA

**Worker 10840 y 10847:** `preparePublicationV77` ejecuta `verifySubscriberSession(env,request)` dos veces para la misma petición. **Worker 2770–2788** muestra que el verificador comprueba `subscriberSessionState`; el estado de sesión puede usar el actor de acceso privado. El segundo acceso a nivel de código es indiscutible. **El incremento exacto de Durable Objects, SQL u otras unidades aún requiere prueba**, porque puede haber memoización aguas abajo. Reparación: reutilizar el resultado autenticado, sin quitar la verificación de permiso vigente ante mutación.

### C-03 — Listados de deltas KV incluso con paquete principal caliente — PRIORIDAD ALTA

**Worker 10054–10060:** `cachedAdvertiserRelations104` consulta la copia de relaciones, y ejecuta `kv.list({prefix:...':delta:'})` incondicionalmente si KV soporta `list`, aunque el paquete se haya encontrado. Cada delta agrega `kv.get`. Por diseño puede multiplicar operaciones de lista/lectura según cantidad de cambios acumulados. **No se puede eliminar la consulta sin comprobar cómo se garantiza la vigencia de permisos**; hace falta prueba de revocación y lectura caliente.

### C-04 — Llenado de caché con escrituras por consulta inicial — PRIORIDAD MEDIA/ALTA

**Worker 10246–10255:** un fallo de `panelQuery` puede disparar `db.queryEqual`, lectura del marcador de cambios, y `kv.put` de la copia; `panelGet` hace `kv.put` tras fallo (10289–10291). Es un diseño de *cache-aside* que puede tener costo considerable en arranques fríos y ante invalidaciones. **No calificar todas las escrituras de erróneas:** deben cuantificarse por acción y compararse contra la publicación/copia diaria, preservando autorización y coherencia.

### C-05 — Encadenamiento de capas de datos con múltiples efectos secundarios — PRIORIDAD DE ARQUITECTURA

**Worker 13208–13209:** una sola petición se envuelve en `observeDbV41 → roleSourceDb192 → requestDb119 → withPrivateCacheV46 → withAuthCacheV58 → withPanelCacheV48 → guideJournalDb132 → GLD_BUSINESS143.journal`. No es prueba automática de duplicación, pero **el recorrido de una escritura no se determina leyendo sólo la ruta**: cada capa puede consultar o invalidar por su cuenta. El análisis de cada acción debe inspeccionar todos los wrappers y acciones indirectas; corregir solo la ruta visible no alcanza.

## Regla de ejecución para el siguiente recorrido

La unidad es una **acción completa entre interfaces**, no una ficha ni una pantalla:
`Gran Hermano/configuración de nivel y permisos → registro y operaciones de Anunciante → fuente de negocio → cachés/índices/proyección → paquete de ciudad → lectura de Usuario → posteriores actualizaciones`.

Para cada entrada real, construir automáticamente:
`ruta → autenticación → handlers → wrappers de db/KV/DO → operaciones por colección y clave → invalidación/publicación → lectura de otro plano`.
Separar operaciones (a) necesarias, (b) redundantes confirmadas, (c) sospechosas por diseño, (d) no medidas. No cambiar producción mientras no existan pruebas de funcionalidad y consumo de antes/después.

## Qué quedó probado y qué no

- **Probado:** lectura completa de los cinco archivos y generación de inventario con ubicaciones; presencia de los caminos de código C-01 a C-05; inconsistencia del encabezado de consumo en C-01.
- **No probado:** repetición física exacta en Cloudflare/Firestore; estado del Worker efectivamente desplegado; costo monetario, cuota consumida, impacto total en las tres interfaces y ausencia de errores adicionales.
- **No se corrigió código operativo:** este corte se limita al punto 1 de inventariado; la revisión siguiente debe continuar con las dependencias de operaciones, no abrir otra auditoría desde cero.
