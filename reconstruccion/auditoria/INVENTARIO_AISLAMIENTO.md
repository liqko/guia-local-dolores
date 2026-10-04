# Inventario de aislamiento — revisión iniciada el 4/10/2026

No es un conteo final de toda la aplicación. Se agregan los siguientes bloques
después de seguir su HTML y sus rutas efectivamente vigentes. Los alias no cuentan
como acciones diferentes. DB representa documentos Firestore; KV tiene cuotas propias.

## Usuario final: consultas vigentes (9 familias)

| Acción | Ruta | Lecturas KV permitidas | Firestore / escrituras |
| --- | --- | --- | --- |
| Elegir ciudad | /territory/public | territorio:public:v1 | 0 / 0 |
| Cargar filtros de Guía | /catalogs/public/guide | catalogs:commerce:v1 | 0 / 0 |
| Consultar tarjetas | /guide | guide:city:v1:ciudad | 0 / 0 |
| Consultar Promos | /promos | promos:city:v1:ciudad | 0 / 0 |
| Consultar Eventos | /events-new | events:city:v2:ciudad | 0 / 0 |
| Consultar Actividades | /actividades publicas | activities:city:v2:ciudad | 0 / 0 |
| Consultar Publicidad por módulo/categoría | /publicidad publicas | publicity:city:v2:ciudad + catalogs:publicidad:v1 | 0 / 0 |
| Consultar Efemérides por fecha | /efemerides | efemerides:city:v2:ciudad | 0 / 0 |
| Consultar Farmacias por fecha | /farmacias turnos | farmacias:city:v2:ciudad | 0 / 0 |

TEST_AISLAMIENTO_PUBLICO_V36 bloquea DB, fetch externo y escrituras, y restringe
claves KV. Ejecuta 43 casos (ciudades, caché preparada/vacía y parámetros ausentes)
contra routePublicV12 y el entrypoint V35. No hay fallback a Firestore con KV vacío.
TEST_CARCASA_V32 ahora usa V35: ciudad, catálogos, iframe, módulos, deduplicación,
reintentos y timeout. Buscar, filtrar, paginar, ordenar y abrir una galería utilizan
datos locales; los enlaces de medios externos no son consultas Firestore.
Login, favoritos y preferencias personales quedan en el bloque compartido Suscriptores.

## Anunciante / administración: datos y sedes

| Acción existente | DB necesaria | Escritura | Estado |
| --- | --- | --- | --- |
| Carga inicial Modificar datos | anunciante + administración + sedes del anunciante | Ninguna | Existente; prueba navegador V35 |
| Consultar permisos | administración del anunciante | Ninguna | Existente |
| Guardar datos del anunciante | Sin lectura adicional; sesión autorizada | Campos recibidos y permitidos + timestamp | Prueba exacta descripción V36 |
| Agregar sede | Catálogo ciudad KV | Nueva sede | Flujo V35 |
| Editar sede | Sede indicada para pertenencia | Sólo campos cambiados + timestamp | Prueba exacta imagen V36 |
| Eliminar sede | Sede indicada para pertenencia | Elimina sólo esa sede | Prueba V36; conserva cuenta |
| Perfil administrativo | Sin lectura adicional; rol autorizado | Campos permitidos enviados | Corregido V36; KV puntual |
| Relaciones administrativas de sede | Una lectura por sede enviada para pertenencia | Sólo relaciones cambiadas | Corregido V36; valida lote antes de escribir |
| Configuración comercial administrativa | Sin lectura adicional; rol autorizado | Campos comerciales enviados | Existente; cobertura exacta pendiente |
| Búsqueda/ficha administrativa | Índice KV / carga de ficha al abrir | Ninguna | Inventario y aislamiento restantes pendientes |

TEST_AISLAMIENTO_COMMERCE_V36 comprueba 6 circuitos con colecciones y campos
exactos. No significa que toda administración esté cerrada.

## Promos

| Acción existente | DB necesaria | Escritura |
| --- | --- | --- |
| Carga inicial | Administración, anunciante, sedes propias y promos propias | Ninguna |
| Listar promos | Promos del anunciante | Ninguna |
| Alta | Cupo (administración y promos propias); sede indicada si existe | Nueva promo |
| Editar datos generales | Sólo promo indicada para pertenencia | Sólo campos realmente cambiados |
| Cambiar categoría/ciudad/sede | Promo; sede indicada si corresponde; catálogos KV | Campos modificados y derivados de categoría |
| Pausar | Sólo promo indicada | pausado + timestamp |
| Reanudar | Promo, administración y promos propias para cupo | pausado + timestamp |
| Baja | Sólo promo indicada | Elimina promo; retira KV |

TEST_AISLAMIENTO_PROMOS_V36: 47 casos, 21 campos generales y repetición intacta,
pausa/reactivación/cupo, ciudad incompatible con sede, traslado y baja.
No se encontró acción de edición o moderación de Promos en Gran Hermano vigente;
no se desarrolla una nueva. Alta/listado y rechazos siguen en TEST_MUTACIONES_V33.

## Bloques siguientes

Eventos -> Actividades -> Farmacias -> Efemérides -> Publicidad -> Suscriptores.
Inventariar operaciones de anunciante y administración en conjunto. Todavía no
está acreditado el aislamiento de guardados en estos bloques.
