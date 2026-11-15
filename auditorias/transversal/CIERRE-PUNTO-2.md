# Punto 2 — consolidación del recorrido transversal (15/11/2026)

## Cobertura verificable del código

Se leyeron las **13.369 líneas del único Worker** y los cuatro HTML principales (**34.764 líneas**) y, adicionalmente, los **38 módulos JavaScript externos** cargados por esos HTML (**2.089 líneas**). **Total inspeccionado mediante el inventariado: 36.853 líneas de fuente.** No se supone que esos archivos representen todo el repositorio: no se revisaron HTML adicionales, service workers ni recursos no referenciados directamente por los cuatro HTML.

Matriz fuente:
- `inventario-codigo.json`: todas las funciones nombradas y coincidencias de llamadas de acceso a datos del Worker + HTML, con línea.
- `recorrido-exhaustivo-estatico.json`: **278 condiciones** identificadas de rutas y acciones en el Worker, con texto de condición, archivo, línea y función nombrada más cercana; **856 líneas** con operaciones de almacenamiento reconocibles y **120 puntos** de invocación de red/helper en los cuatro HTML.
- `matriz-rutas.json`: **245 referencias literales de ruta**, no necesariamente rutas efectivas únicas.
- `navegador-modulos-01.json` a `04.json`: inventario completo de los **38 scripts externos** de esas interfaces: 22 líneas con APIs de red o persistencia de entre los patrones rastreados. **Cero módulos faltantes en la extracción.**
- `recorridos-peticiones.json`: orden del despacho principal, capas de persistencia y puntos de entrada a cada función transversal.
- `RECORRIDOS-PUNTO-2.md`: relaciones de negocio entre configuración GH, acceso, ficha, permisos, publicaciones, proyecciones, Guía pública, eventos y publicidad.

## Secuencia de efecto y frontera de medición

1. **Interfaz**: acción UI → helper HTTP/script → petición; también paquete local por ciudad, caché del navegador y posibles retries.
2. **Worker**: observación KV/Firestore y memoización por petición (L13177–13209) → controles de acceso y rutas prioritarias (L13215–13220) → validación de publicación y controladores de módulos (L13221–13243).
3. **Fuente y proyecciones**: Firestore y wrappers de escritura → Durable Object serializador/caché SQL → KV y paquetes de ciudad → lectura pública de Usuario (o paquete local servido sin petición al Worker).
4. **Efectos postrespuesta**: migraciones y alarmas de Durable Objects, invalidación/recuperación, posibles tareas con `waitUntil`. Estas operaciones **no se miden íntegramente desde el navegador**.
5. **Seguridad**: el estado y revocación de permisos necesita vigencia inmediata, separada del corte diario de las publicaciones.

## Agrupaciones de rutas y acciones de mayor densidad

- `routePanelV3`, líneas desde 4242: **25 condiciones** identificadas; suscripciones, comercio, promos, actividades, efemérides, farmacias.
- `routePanelV4`, desde 4597: **22 condiciones**; eventos, publicidad, farmacias.
- `routeAdminV3`, desde 7281: **18 condiciones**; territorio, configuración, publicadores y catálogos.
- `routeEmpleo109`, desde 11588: **17 condiciones**; lectura y operaciones de Empleo.
- `routePublicV4`, desde 1704: **9 condiciones**; entrada pública a guía, promociones, eventos, publicidad, efemérides y farmacias.
- `routeModeratorsV72`, desde 10692: **9 condiciones**; controles de acceso/moderación.
- `routePanelV7` y `routePanelV8`: **9 condiciones cada una**; acciones de Suscriptores.

Una condición de acción dentro de un controlador no es una nueva ruta. Varias rutas heredadas se encadenan: que existan dos condiciones sobre el mismo path **no demuestra doble ejecución**. El primer controlador que devuelve respuesta corta el despacho. Tampoco toda invocación `db.get` o `kv.get` se ejecuta en todas las acciones.

## Problemas detectados para el punto 3 (sin adelantar correcciones)

- `routeGuideDispatch132` y `GLD_BUSINESS143.dispatch` devuelven respuestas sin `traced` exterior (L13218–13219); el detalle por petición del Worker puede no llegar al navegador.
- `preparePublicationV77` autentica dos veces la misma petición (L10840 y 10847); no se ha medido el número efectivo de operaciones físicas.
- `cachedAdvertiserRelations104` consulta deltas KV aun cuando encuentra paquete (L10054–10060); el requerimiento de revocación exige estudiar reemplazo seguro.
- `panelQuery` puede escribir una caché al abrir consultas frías (L10246–10255).
- Cada handler usa múltiples wrappers transversales, por lo que atribuir lecturas o escrituras sin registrar el circuito entero puede ser erróneo.

## Límite verificable del cierre del punto 2

**Se completó el relevamiento estático de los archivos objeto de esta fase, incluidas las dependencias JS referenciadas directamente.** No se afirmó —ni se obtuvo— ejecución de todas las combinaciones posibles de método, ruta, acción, permisos, datos y estado de caché. Las condiciones dinámicas (157 de las 278 sin ruta literal en la misma línea), rutas construidas con variables y tareas programadas no pueden certificarse con búsquedas textuales. El campo `nearestFunction` de los artefactos es una asociación léxica, **no un árbol de sintaxis ni una traza automática de llamadas**, y los detectores por expresión regular no prueban cobertura semántica total.

**Para afirmar un recorrido exhaustivo en ejecución** faltan pruebas automáticas instrumentadas que generen peticiones por cada ruta y acción, con estados frío/caliente, permisos distintos, mutaciones, publicación y alarmas, y que comparen trazas observadas de KV/DO/Firestore. Estas pruebas pertenecen al **punto 5** y la detección automática de la redundancia pertenece al **punto 3**; no deben afirmarse completadas aquí.

**Worker de la rama:** idéntico a `main`, blob `788a9cb79d536459fd01050a449cd85db4daaf54`. **No hay cambios funcionales, despliegue ni medición en producción.** La corrección anticipada de dos retornos fue revertida (commit `146f9f53d8af342d3e1cfeee78f03066731f52b6`).

**Siguiente paso fijo:** punto **3**: detector reproducible para redundancia de peticiones del navegador + operaciones Firestore/KV/DO redundantes, rutas superpuestas, invalidaciones y escrituras sin cambios; priorizar por número físico de operaciones y riesgo de seguridad, **sin pasar todavía a editar el Worker**.
