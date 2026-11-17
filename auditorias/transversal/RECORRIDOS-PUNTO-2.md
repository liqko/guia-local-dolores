# Punto 2 — recorridos de peticiones entre interfaces y almacenes

**Estado:** análisis estático transversal, no ejecución ni costos reales. **Fuente:** cinco archivos íntegros identificados en `inventario-codigo.json`. Entradas y operaciones de cada etapa en `recorridos-peticiones.json`.

## Canal común a las peticiones

`Worker fetch` (L13177) → observación KV (`observeKv117`) y reutilización KV por petición (`requestCache121`) L13179–13180 → Firestore con capas de observación, reutilización, cachés de autorización y panel L13208 → diarios transaccionales de Guía y publicaciones L13209 → controlador específico L13215–13243 → respuesta y telemetría L13182–13202.

**Capas en orden de composición (desde origen):** `createDb` → `observeDbV41` → `roleSourceDb192` → `requestDb119` → `withPrivateCacheV46` → `withAuthCacheV58` → `withPanelCacheV48` → `guideJournalDb132` → `GLD_BUSINESS143.journal`.

**Secuencia de despacho y primera respuesta efectiva:** `routeAdvertiserAccess155`, `roleGate155`, `GLD_ACTIONS138.route`, `GLD_BUSINESS143.dispatch`, `routeGuideDispatch132`, `routeAtomicAdvertiserInternal`, `preparePublicationV77`, diagnósticos, territorio, empleo, directorios, notificaciones, publicidad administrativa, promociones administrativas, calendario, términos, publicaciones, soporte, contenido adulto, datos públicos, panel, roles, moderadores y administración. Ver líneas 13215–13243 del Worker y el JSON de recorridos.

**Regla esencial:** no se ejecutan todos los controladores. La primera respuesta no nula detiene el despacho. Las capas pueden generar consultas o cambios indirectos y deben contarse en la **misma transacción lógica**. Además `commerceMigrationKick209` puede iniciarse con `execution.waitUntil` (L13178), fuera del costo visible de la respuesta.

## Recorridos funcionales cruzados

### A. Configuración y apertura de Gran Hermano

`administracion.html` L1055 → `POST /superadmin/session/login`; L1065–1090 usa la entrada diaria que recibe del ingreso o `GET /superadmin/dashboard`. Worker: autorización administrativa `verifyAdmin` L1113–1133 → `accessRecord201` (Durable Object por usuario, L2629–2644) para estado de acceso → copia diaria administrativa cuando existe; sin la copia preparada, ruta de respaldo. La autorización se verifica aunque el contenido administrativo provenga de un paquete. Los gastos de validación **no son lo mismo que los de cargar datos del panel**.

### B. Gran Hermano consulta y modifica un anunciante

`administracion.html` `detalleAnu` L1969–1979 → `ghCargarCiudades` → `api('detalle_anunciante')` y **nueve** `api('listar_catalogo')` potenciales en `Promise.allSettled`. El helper `api` L511–531 mapea a rutas administrativas; `ghAdminRequestRaw143` L540–558 realiza el HTTP autenticado. Worker: `routeAdminV8` L8158–8170 (alcanzado desde `routeAdminV11` y sus versiones delegadas) → `verifyAdmin` → `adminAdvertiserDetailV2` L8151–8153 → `ghDetailActor204` L1041, L8117 y L8149 → almacenamiento SQL del Durable Object para la ficha. **El costo de abrir la ficha abarca también territorio, catálogos y autenticación: no puede medirse solamente `GET /superadmin/advertisers/{id}`.** Guardados modifican Firestore a través de los wrappers y disparan invalidaciones y regeneraciones según colección.

### C. Alta/propiedad, delegación y permisos del anunciante

Gran Hermano `/superadmin/advertisers/{id}/responsables` y acceso puntual `/panel-access` pasan por `routeAdvertiserAccess155`, L13302–13330. El guardado de relación L13275–13300 obtiene suscriptor, ficha, administración y relaciones, comprueba revisión optimista y `db.patch('suscriptor_anunciante')`. Panel de propietario `/commerce/team/responsables` L13339–13350 reutiliza la misma mutación y restringe los roles. `withPrivateCacheV46` L9953 en adelante mantiene relaciones KV, invalidación de sesiones y deltas; `cachedAdvertiserRelations104` L10054–10060 lee paquete y deltas. Verificación de sesión y permisos `verifySubscriberSessionRaw143` L2770–2789 usa estado privado duradero. **La lectura pública de la ficha no puede sustituir la comprobación actual de permisos.**

### D. Anunciante guarda su ficha y llega a Usuario

`login.html` contiene los helpers HTTP de panel, entre ellos `postJson` L3323–3336 con operación de publicación y `apiSuscriptores_` L8605–8615. Worker `routeGuideDispatch132` L12681–12699 intercepta `/commerce` (acciones `save_ficha`, `set_datos`, `set_sedes`, `set_relaciones_sede`, `delete_sede`) y ciertos `/superadmin/advertisers/{id}/...` después de autenticar. Remite al Durable Object por anunciante; dentro, `guideJournalDb132` L12700–12708 registra intención antes de escribir fuente. La publicación y su recuperación usan las copias por ciudad, con la política de corte 01:00 Argentina (L11720–11721). Para la visualización `anunciantes.html` L1256–1288 usa primero `GLD_PAQUETE_CIUDAD.get(ciudad)`, salvo concesión de contenido adulto; en falta de paquete hace `GET /guide?compact=1&ciudad_id=...`, atendido por el Worker público con guardia de Firestore. **Las lecturas del paquete de ciudad pueden evitar llamadas al Worker, pero no sustituyen las escrituras/invalidaciones y accesos seguros del panel.**

### E. Promociones y Publicidad: operación de panel hasta publicación pública

Un `POST /promos` o `POST /publicidad` con acción habilitada entra en `GLD_BUSINESS143.dispatch` L12860–12895, comprueba sesión y permisos; el Durable Object serializa la mutación. `GLD_BUSINESS143.journal` L12911–12917 registra cambios `promos/publicidades/publicidad_estado/publicidad_media/publicidad_segmentacion/eventos/evento_programacion` y los datos anteriores necesarios. `GLD_BUSINESS143.restoreContract` L12919–12923 revisa contrato guardado y puede leer/escribir KV. Lecturas públicas provienen de proyecciones/catálogos, mientras los flujos con autorización siguen separados. Las respuestas delegadas en L13218–13219 **no pasan por `traced` del Worker exterior**: desajuste de visibilidad documentado, sin arreglar antes de completar esta fase.

### F. Eventos y otras funcionalidades

Worker `GLD_EVENTS145.dispatch` se invoca dentro de `GLD_BUSINESS143.dispatch` L12863 antes del filtro `/promos|/publicidad`; los demás eventos llegan a `routePanelV15` o rutas específicas dependiendo de método y acción. Los controladores independientes de empleo, calendario, farmacias, notificaciones, soporte y directorios se ejecutan en el orden de despacho de L13227–13243. **No atribuirles automáticamente las mismas rutas o invalidaciones que Guía**: hay que seguir sus colecciones concretas y las capas compartidas del Worker.

## Desglose de costos que el código permite (y no permite) afirmar

- `observeDbV41` L9845–9873 cuenta llamadas a métodos Firestore; no acredita unidades facturables exactas de Firebase.
- `observeKv117` L11668–11681 registra GET/PUT/DELETE/LIST visibles para el proxy exterior.
- `requestDb119` L12296–12318 deduplica consultas por petición; `requestCache121` L12263–12294 reutiliza valores y listas KV por petición.
- `consumption136` L12824–12850 **marca explícitamente INCOMPLETA** la cobertura de CPU, duración facturada de DO, almacenamiento y llamadas externas del navegador. Los efectos de actores internos tienen contadores aparte.
- L13178 puede programar trabajo de migración con `waitUntil`: **el navegador puede no ver sus costos en el HTTP original**.
- L13218–13219 retorna directamente operaciones delegadas, sin la envoltura de telemetría de las demás rutas: problema a verificar en pruebas de integración, no corregido en este punto.

## Criterio de cierre

Se identificó el tronco compartido del Worker y los recorridos principales de GH, propietario/anunciante y Usuario, con costos directos e indirectos. Se han indexado las entradas HTTP en los cuatro HTML y operaciones de las capas relevantes. **No existe todavía una traza ejecutada de cada combinación de ruta/método/acción del sistema**; el inventario JSON permite continuarla sin volver a leer o contar desde cero. El paso 3 debe aprovechar estas relaciones para generar detecciones repetibles de duplicaciones, rutas solapadas, invalidación y escrituras sin cambios. No se autoriza tocar producción.
