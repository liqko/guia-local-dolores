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

## Mutaciones de los módulos — avance V37

| Bloque | Acciones implementadas revisadas | Límite del acceso |
| --- | --- | --- |
| Eventos VIP/FREE | Carga/listado, comprobar similares FREE, alta, datos/imágenes, programación, pausa/reactivación, duplicación, baja, aprobación/rechazo | Edición general lee el evento; relaciones intactas en KV. Cupo sólo alta/duplicación/reactivación. Cambiar/borrar programación consulta las instancias de ese evento |
| Actividades | Carga, alta, datos/imágenes, horarios/lugares/ciudades, pausa/reactivación/renovación, baja, aprobación/rechazo | Administración para habilitación/cupo y actividad propia. Horarios intactos KV; editar/borrar sólo horarios de esa actividad |
| Farmacias | Carga, alta/edición ciclo, fecha/hora/duración/simultaneidad, participantes/orden, activar/desactivar | Permiso territorial y ciclo propio. Relación intacta KV; editar participantes consulta ese ciclo y sedes implicadas |
| Efemérides | Carga, alta/edición fija/móvil, fecha, territorio, nombre/imagen/descripción, activar/desactivar, baja | Administración para permiso y efeméride indicada; no consulta módulos ajenos |
| Publicidad existente | Carga, alta/edición datos/CTA/formato, imágenes/media, segmentación, selección activa, baja | Administración/cupo y pieza propia; consulta media o segmentación sólo cuando se modifica/baja, con fallback acotado si falta KV |
| Suscriptores/correo | Registro/login, sesión/autorizados, perfil/ciudad/clave, favoritos (5 tipos), verificación/recuperación y baja | Patch sólo cuenta/favorito indicado; sesión/autorizados y solicitar códigos no acceden a DB. Confirmar código consulta cuenta por mail; baja consulta relaciones propias |
| Administración existente | Dashboard, búsquedas/fichas, perfil/comercial/relaciones, 10 catálogos, moderación de eventos/actividades, alta de ciudad | Búsqueda/dashboard/catálogos KV; ficha sólo el anunciante/suscriptor abierto y sus relaciones. Guardado por diferencias; moderación usa los mismos read models |

No se hace un nuevo módulo administrativo de Promos, Farmacias, Efemérides o
Publicidad donde esa pantalla no existe. País/Provincia/altas/baja de anunciante
que siguen sin estar implementados conservan su condición histórica.

## Evidencia y límites V37

- TEST_AISLAMIENTO_MODULOS_V37: 75 casos, colecciones/campos exactos; 22 campos generales, históricos incompletos, horas/imágenes, lotes intactos y ciclos de vida.
- TEST_AISLAMIENTO_SUSCRIPTORES_V37: 24 casos.
- TEST_AISLAMIENTO_ADMIN_V37: 24 casos; 10 catálogos + búsquedas/dashboard.
- TEST_ADMIN_VISUAL_V37: Chromium, rutas reales, ficha/catálogos, edición comercial/perfil/relaciones, retiro de llamadas legacy y no-op.
- TEST_PREPARACION_KV_V37: seed explícito prepara relaciones incluso para pendientes/inactivos; posteriores ediciones de cuatro módulos no consultan relaciones.
- TEST_FIRESTORE_PATCH_V37: transporte real con red simulada, un PATCH y updateMask exacto sin lectura implícita.
- Si la proyección privada falta o tiene otra revisión, la edición puede consultar sus relaciones propias para publicar correctamente. El seed previo evita ese arranque frío.
- KV tiene consumo propio; reducir Firestore no significa que todo servicio sea gratuito.
- Un PATCH de un documento cuenta como una escritura de documento, aunque incluya varios campos. Se comprueban ambas cosas: número de documentos y campos enviados.
- Las bajas/duplicaciones/moderaciones tienen accesos necesarios distintos de cambiar un nombre.
- Pendiente externo: credenciales reales, carga inicial real de KV, entrega de correo y recorridos con datos reales. No se desplegó producción.
