# Actualización de originales — 4/10/2026

El usuario autorizó expresamente reemplazar los HTML originales, después de trabajar
en paralelo en reconstruccion-total-03oct. Esta directiva reemplaza la restricción
anterior de no modificar main para estas nueve pantallas.

Se preserva main anterior 4b3f1b5cd4ee00d91c6f750484c2e562a4c933fd
en la rama respaldo-antes-v38-04oct.

Las nueve pantallas conservan sus nombres originales en plataforma/. La Carcasa
abre anunciantes.html, promos.html, eventos.html y actividades.html de esa carpeta.
La API permanece https://login.liqkoargentina.workers.dev.

worker/WORKER_COMPLETO_V38.js contiene el entry vigente app-main-v35.js y sus
102 módulos efectivos, empaquetados con esbuild 0.25.10, formato ESM, ES2022.
No necesita imports, npm ni otros archivos al pegarlo en el editor de Cloudflare.
El número del entry / sigue siendo 35: las correcciones V36/V37 están en sus módulos.

Pruebas del artefacto final: 43 comprobaciones públicas KV poblado/vacío/dos ciudades,
sin red Firestore ni escrituras; 9 HTML, 15 scripts con sintaxis válida y archivos
relativos existentes. No sustituye las pruebas reales de configuración y correo.
La evidencia previa de correcciones y navegador está en la rama de reconstrucción.

El usuario despliega el Worker manualmente. No se realizó ese despliegue desde aquí.
En main no hay actualmente .github/workflows: el workflow de Firebase existe
sólo en la rama de reconstrucción. Cambiar main no acredita publicación web.
Verificar el alojamiento real antes de afirmar que los HTML ya están activos.
Configuración necesaria en el Worker: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
FIREBASE_PRIVATE_KEY, SERVER_SECRET, SUSCRIPTORES_RECOVERY_URL y GLD_CACHE_KV.
No se incluyeron secretos en el código ni manifiesto.

Siguiente acción: confirmar que el usuario pegó el Worker completo y que el despliegue
de HTML terminó. Después comprobar API, login y preparación de KV antes de verificar
publicación. La carga integral POST /superadmin/rebuild-all-cache exige sesión
administrativa y es mantenimiento explícito; consume lecturas iniciales. No invocarla
automáticamente ni repetirla para cada cambio. Correo real todavía no probado.

No desarrollar pendientes históricos ni rehacer auditorías aprobadas. Registrar
fallos reales y correcciones puntuales desde este estado.

## Corrección V39 — errores del editor de Cloudflare
La captura mostró nueve diagnósticos TypeScript en el JavaScript empaquetado.
Reproducidos exactamente con TypeScript 5.9.3 checkJs/ES2022/DOM sobre V38.
Se declaran opcionales los parámetros previous, programacion y matchKey, y se
explicitan los campos de los valores de configuración por defecto. No se ocultan
errores con ts-nocheck ni se modifican los campos enviados a Firestore.
Worker actualizado: worker/WORKER_COMPLETO_V39.js. Compilador: cero errores.
Pasaron 75 casos de aislamiento, 15 mutaciones y ocho flujos existentes.
La captura también muestra Falta binding GLD_CACHE_KV: requiere vincular el
namespace KV con ese nombre en Cloudflare. Corregir el JS no crea esa vinculación.
Siguiente paso: entregar V39, usuario reemplaza código y revisa binding, después
comprobar arranque y seed/publicación/correo real.

## Incidencias reales — 5/10/2026
KV GLD_CACHE_KV creado y vinculado por el usuario al Worker login. Raíz responde
success:true. Namespace ID a3f3f31d7a3b44a9973767bfb033b5b7.
Hosting real del embed: https://anunciantes-guialocal.web.app/plataforma/granhermano.html.
Descarga del HTML publicado confirmó versión anterior: login mediante api('login'),
incompatible con /superadmin/session/login. No es evidencia de contraseña inválida.
GET /territory/public devuelve 503: Catálogo territorial no inicializado.
Se restaura el workflow histórico firebase-hosting-merge.yml en main, que publica
en anunciantes-guialocal usando el secreto existente, sin valores secretos nuevos.
Verificar resultado del workflow y HTML remoto antes de afirmar publicación.
Después login administrativo y carga inicial explícita de KV; todavía no ejecutada.

Publicación Firebase run 37334028552 terminó SUCCESS; HTML remoto confirmó
/superadmin/session/login. Usuario después recibió Mail o clave incorrectos.
Comparación con WORKER_GRAN_HERMANO_30SEP_CORREGIDO_LECTURAS.txt demostró error:
credenciales históricas en suscriptores; superadmins contiene permisos, no clave.
V40 restaura consulta acotada suscriptores.mail y compara clave allí; luego permiso
superadmins por documento sid, con fallback queryEqual suscriptor_id limit 5.
Rechaza suscriptor inactivo, permiso ausente/inactivo y roles no habilitados.
No escribe, elimina ni barre colecciones. Token firmado conserva sid del suscriptor.
Prueba TEST_LOGIN_ADMIN_V40 aprobada y aislamiento admin 24 casos aprobado.
Prueba visual no pudo arrancar: Chromium ausente en este workspace.
Artefacto worker/WORKER_COMPLETO_V40.js empaquetado con esbuild 0.25.10, sintaxis OK.
Usuario debe pegar V40 completo y desplegarlo. KV inicial todavía pendiente.

Usuario confirmó ingreso exitoso con V40 el 5/10 13:26 Argentina.
Se preparó localmente un botón de carga inicial y una supresión de carga automática
pendientes, pero no se publicaron. Usuario exige conservar pendientes automáticos;
se restableció el HTML publicado íntegro. NO afirmar que se quitó la funcionalidad.

## V41 — observación de consultas, sin cambiar funciones
Usuario confirma desde cero hasta 1.9K lecturas diarias, retraso 10–15 minutos.
Captura 5/10 muestra 1.9K lecturas, cero escrituras/eliminaciones. Origen aún no
identificado; no hubo carga inicial KV ejecutada por este agente ni publicada UI de seed.
Carcasa Firebase descargada coincide byte por byte con main actualizada.
Worker V41 registra por solicitud método/ruta, operaciones DB por colección,
invocaciones/documentos devueltos/errores. Sin IDs de documento, valores de filtros,
correos, claves, cuerpos ni tokens. No crea escrituras ni lecturas para instrumentar.
X-GLD-Request-Id permite correlacionar respuesta con registro de Cloudflare.
Estas cifras son operaciones observadas, NO medición exacta de facturación Firebase:
no incluyen mínimos de consultas vacías, indexación ni clientes externos al Worker.
Login V40 conservado; carga automática de pendientes conservada. Raíz informa V41.
TEST_OBSERVACION_V41 y login V40 aprobados; 43 casos públicos KV frío/poblado sin DB.
Siguiente: usuario pega Worker V41, activa vista de registros Cloudflare y reproduce
un acceso; comparar operaciones observadas con aumento Firebase. Catálogo KV todavía
no inicializado. No afirmar origen de 1900 ni problema de consumo resuelto.

## 5/10 20:10 Argentina — medición real y corrección de inicio
Registro aportado por usuario de V41 /superadmin/moderation/pending:
queryEqual eventos 2 llamadas; actividades 1; solicitudes_anunciante 1.
Todas devolvieron cero documentos y cero fallos. Esto no identifica el origen
histórico de 1900 lecturas; documentos devueltos no equivale a facturación exacta.
Se mantiene íntegra la carga automática de pendientes. No se agregó caché obsoleta
sin resolver invalidación de todos los productores.
Inicio.html quedó fuera de la migración de nueve HTML y usaba commerce?action=ubicaciones.
Corregido en el mismo archivo original a territory/public (KV), sesión v2 y campos
provincia_visible/pais_visible. Una solicitud inicial, búsquedas locales, sin fallback
Firestore ni reintentos. TEST_INICIO_KV aprobado con éxito/error de catálogo.
KV sigue sin inicializar: esta corrección por sí sola no carga ciudades hasta seed.
Próximo: detalles de logs dashboard y commerce del mismo acceso, luego inicialización
explícita KV. No repetir barridos de auditoría ni afirmar causa de 1900 identificada.

## V42 — registro visible por acción, 5/10 20:22 Argentina
Worker completo V42 añade resumen message en tabla Cloudflare con ruta, estado,
consultas, documentos devueltos, escrituras, eliminaciones y fallos; fecha UTC/versión/ID
más detalle por colección. No agrega operaciones DB/KV ni registra claves/cuerpos.
Prueba del resumen y cero operaciones adicionales aprobada; sintaxis del bundle aprobada.
Despliegue V42 manual pendiente; causa histórica de 1900 no demostrada.
Worker antiguo tenía carga completa territorial con caché vacía; es una hipótesis,
no prueba de la versión activa entonces. Inicio corregido y hosting SUCCESS run37387184457.

## 5/10 21:00 Argentina — carga inicial KV desde GH
Usuario confirma Worker V42 desplegado. Se agrega botón manual Cargar datos iniciales
en Inicio de GH, POST /superadmin/rebuild-all-cache mediante helper Bearer existente.
No se ejecuta al entrar, no recarga pendientes/colecciones luego, bloquea doble clic
mientras ejecuta y al completar. Error ambiguo queda bloqueado para evitar reintento
accidental; usuario debe aportar registro antes de repetir. Backend conserva roles.
Explicación visible: lee Firestore explícitamente y copia KV sin modificar/eliminar
originales. TEST_CARGA_INICIAL_KV valida script completo y flujo éxito/error sin carga automática.
No se ejecutó seed desde herramientas; siguiente acción usuario pulsa UNA VEZ botón
y reporta mensaje final; observación V42 identificará esa carga y sus documentos.

## Evidencia real 6/10 12:55 Argentina
Usuario aporta /territory/public success:true updated_at=2026-10-06T00:04:33.391Z,
cuatro ciudades; equivale al 5/10 21:04:33 Argentina. Carga KV fue AYER.
No atribuir las 644 lecturas del período actual (6/10 04:00 Argentina en adelante)
a esa carga. Hipótesis previa de retraso del seed hoy queda descartada para ese período.
Hoy usuario confirma 644 lecturas; ayer informa final 5000. Causas NO identificadas.
Captura Cloudflare 6/10 11:14 muestra GLD GET promos/events-new/actividades/publicidad:
HTTP200 consultas0 documentos0. Sólo certifica esas cuatro solicitudes, no todo el ingreso.
No existe POST rebuild-all-cache en últimas12h según búsqueda usuario: coherente con
seed AYER, no exigir seguir buscando en ese intervalo ni repetir seed.
URLs históricas ciudad_id completas DOL (BUE - ARG) son reales y no deben acortarse.
Ciudad pública ya contiene provincia_visible BUENOS AIRES, pais_id ARG: falta ajuste
visual bandera/provincia en inicio. Copia territorial no modifica nombres/códigos originales.
Intento lectura remota GoogleCloud browser devolvió Site Unavailable; HTTP público
Worker desde herramientas respondió403. Sin acceso directo a métricas/logsCloud.
Siguiente investigar consumo restante del ingreso sin trasladar al usuario búsquedas
indefinidas ni afirmar que 644 sea carga de ciudades/seed. Datos reales KV sólo cuatrociudades.

## 6/10 13:00 Argentina — información de tarjetas
Usuario confirma navegó: tarjetas aparecen pero falta información (campos exactos aún
no especificados). No tratar navegación como prueba aislada sólo de ciudades.
Hallazgo reproducido: modelo KV da categoria_ids/categorias, HTML usa categoria_id/categoria
para clasificación/filtros. hidratarItem adapta listas a campos antiguos conservando
valores legacy existentes; cero llamadas adicionales. TEST_GUIA_CATEGORIAS_KV aprobado.
No afirmar ficha completa corregida sin conocer qué datos extra faltan al usuario.
Diagnóstico GLD funciona por Worker; no cubre toda la facturación Firebase. POST de seed
fue ayer21:04Argentina, no tiene por qué estar en últimas12h de hoy.
644 lecturas hoy y5000ayer siguen sin origen identificado. No prometer cero facturado
por sólo cuatro endpoints públicos observados.


## 6 octubre: tarjetas generales sin imágenes (corrección frontend)
- El usuario informa que faltan imágenes en todas las tarjetas. Se comprobó una incompatibilidad común: buildGuideCardBaseV2 conserva img1..img10 y contactos en sedes, mientras renderGaleria y redes de la tarjeta general leen esos campos en la raíz.
- Corregidos carcasa.html y anunciantes.html: hidratarItem recupera campos vacíos desde la primera sede de la misma ciudad. Conserva campos propios y tarjetas individuales de sede; no agrega peticiones ni requiere reconstruir KV. Categorías por arrays también adaptadas en carcasa.
- Prueba TEST_GUIA_SEDES_KV.mjs: imágenes en galería general y sede específica, contactos, categorías, conservación de datos propios y anunciante sin sede, sin red. Sintaxis de scripts validada. Prueba previa de categorías y aislamiento público V36 (43 casos) aprobados. Verificación local adicional con buildGuideCardBaseV2 confirmó selección de sedes sólo de la ciudad solicitada.
- NO se afirma resuelto todo el faltante visual en producción: queda verificar datos reales después del despliegue.
- 644 lecturas de hoy siguen sin causa probada. Registro V42 sólo observa llamadas realizadas mediante createDb dentro de este Worker; no cubre otros clientes ni atribuye toda la facturación Firestore. No atribuir al seed de ayer, a Firebase console ni al usuario sin evidencia. Revisión estática del flujo público no encontró SDK Firestore directo en inicio/carcasa/guía/promos/eventos/actividades/farmacias; esto no prueba qué originó las 644.


## 6 octubre: consumo del login, V43 preparado
- Usuario informa contador 669 tras tarjetas, Actividades y login. Diferencia respecto de 644: 25, no 5. No atribuir el delta a una operación sin log completo.
- Hallazgo en subscriberLoginV2: leía anunciantes y anunciantes_administracion para cada relación activa aun cuando la relación ya contenía nombre/permisos. Corrección: sólo consultar el documento necesario cuando falta ese dato; conserva los fallbacks y permisos.
- Medición de código con DB instrumentada: sin relaciones, 2 consultas/1 documento devuelto; 8 relaciones completas, 2 consultas/9 documentos (antes 18/25); una relación sin nombre ni permisos, 4 consultas/4 documentos. Estos casos no son pruebas del consumo real de la cuenta del usuario ni lecturas facturadas exactas.
- V43 identifica action de POST /suscriptores y acciones seguras GET: login/session/favoritos/autorizados, sin registrar correo/clave ni agregar I/O. Validar sesión/listar autorizados siguen sin Firestore; favoritos sí consulta suscriptor_favoritos (límite 500). Login consulta suscriptores por correo (límite 5) y relaciones de ese suscriptor (límite 100). No son barridos globales.
- Tests LOGIN_CONSUMO_V43, observación, aislamiento suscriptores (24), circuitos suscriptores (8), aislamiento público (43) y sintaxis bundle aprobados.
- Entregar WORKER_COMPLETO_V43.js completo para despliegue MANUAL del usuario. No está desplegado por publicar GitHub. V42 sigue instalado hasta confirmación.
- Registro maestro único recuperado: Guia_Local_Checklist_Maestro.xlsx, Library ID libfile_3c33f82390bc8191a7c62f6966bc5415. Conserva 61 históricos y 3 asuntos de consumo; no crear listados paralelos. Ruta: consumo/trazabilidad → usuario → anunciante → administrador → prueba integrada.
- Incidentes 644 y delta 25 siguen abiertos; no afirmar resueltos por esta reducción de lecturas evitables.


## 6 octubre: sesión compartida usuario → panel anunciante
- Usuario aclara que su cuenta sí administra comercios. Debe reutilizar su sesión, no volver a pedir contraseña sólo por cambiar de plano.
- Fallo comprobado en login.html: obtenerAutorizaciones_ validaba POST session (0 Firestore) pero ignoraba data.autorizaciones y leía sólo localStorage. Login público suscriptores.html no guarda esa copia; resultado podía ser selector vacío/no autorizado y limpieza de sesión.
- Corregido panel original: usar autorizaciones verificadas devueltas por el servidor, actualizar copia local y eliminar validación POST session duplicada al restaurar. Prueba sin copia local/permiso obsoleto/sesión vencida y sintaxis aprobadas.
- Mantener una única sesión HMAC (8 h). Autorizaciones en sesión ya permiten consulta sin Firestore; persistencia compartida requiere mismo origen y almacenamiento permitido. No afirmar funcionamiento real del iframe/Jimdo hasta prueba.
- El índice KV administrativo de suscriptores NO contiene credenciales ni relaciones completas; no equivale a caché del login. Primera autenticación sigue leyendo suscriptor y relaciones Firestore. Cache privado incremental de relaciones aún no implementado; no prometer cero lecturas de autenticación.
- V43 sigue preparado, despliegue manual no confirmado. Esta corrección de panel funciona con V42/V43 y no requiere seed. Propuesta anterior de separar logins se corrige: diferenciar cargas por plano conservando sesión común.


## 2026-10-06 — V44: barrera pública y comprobación visible
- Cronología confirmada por Diego: 0 → 644 exclusivamente al entrar y elegir ciudad; luego tarjetas → login de usuario → actividades produjo otras 25, total 669. No atribuir las 644 a las acciones posteriores. Causa histórica todavía sin prueba.
- Worker completo V44 preparado, pendiente de instalación manual. Conserva V43 (reducción de consultas en login y acción segura) y añade contadores en cabeceras CORS: versión, request_id, consultas, documentos devueltos, escrituras, eliminaciones y fuente. No equivalen a lecturas facturadas.
- Router público recibe barrera sin cliente Firestore: bloquea get/queryEqual/listCollection/patch/delete antes de ejecutarlos. Panel y administración conservan su cliente observado. No reconstruye KV ni hace seed.
- Los diez HTML originales cargan consumo-v44.js antes de sus llamadas. Registro local acotado a 80 respuestas del Worker; no almacena cuerpos, claves, correo, ciudad ni tokens. Inicio, carcasa, suscriptores, anunciante y Gran Hermano muestran “Ver comprobación de consultas”. Sin contadores aparece “Sin medición”, nunca cero supuesto.
- Verificación local: 43 casos públicos, 24 casos suscriptores, observación/barrera, sesión compartida, login y recorder. Bundle V44 probado en cuatro rutas iniciales sin red Firestore. Prueba real y comparación con Firebase pendientes de instalar V44.
- Caché privada V44 anterior sigue retirada en scratch; no forma parte de esta V44. Próximo bloque: medir llamadas reales login/favoritos/actividades y corregir caché privada con coherencia de permisos y mutaciones.


## 2026-10-06 — Duplicación real de favoritos en Suscriptores
- Usuario confirmó V44 desplegado. Base antes de prueba: 669 lecturas, 0 escrituras, 0 eliminaciones; descargas 3,9 MB y almacenamiento 124,2 (unidad sin confirmar).
- Registro suministrado: pantalla /plataforma/suscriptores; territorio público 0 consultas y dos GET favoritos con request_id distintos, una consulta/11 documentos devueltos cada uno. Usuario aclara que sólo cerró sesión para volver a plataforma. No atribuir este registro a selección de ciudad ni usarlo para explicar 644 iniciales/25 históricas.
- Causa identificada: renderSession al inicio llamaba renderMiGuia; loadCities.then volvía a llamarla. Ahora renderSession(false) muestra cuenta sin favoritos, y tras ciudades hay una sola carga. Si sesión se cerró antes, no carga favoritos.
- saveCity también duplicaba renderMiGuia tras saveSession, que ya actualiza la vista: eliminada llamada redundante.
- Test ejecuta arranque con promesa de ciudades controlada: una consulta de favoritos, cero al cerrar sesión antes de resolución, actualización explícita conservada; sintaxis válida. Persistencia privada de favoritos en KV todavía pendiente. Esto elimina duplicación, no la consulta única restante.


## 6 octubre — V45: corrección del login de suscriptor
- Evidencia real separada: 691 → 708 tras login común, Worker44 indicó 10 consultas /17 documentos; 0 escrituras y eliminaciones. Los644 iniciales y25 posteriores siguen sin atribución histórica demostrada.
- V45 guarda en KV durante1hora solamente vínculos del login y complementos mínimos de comercios. La contraseña y el estado de cuenta se verifican frescos en Firestore. No se cachean credenciales.
- Mutaciones invalidan solamente la relación del suscriptor o el complemento del anunciante afectado. Revisión por entidad evita que una carga antigua repueble una caché invalidada. Si falta propietario de un vínculo se lee ese documento específico, sin barrido.
- KV tiene consistencia eventual; los cambios pueden tardar en propagarse entre ubicaciones. Esta corrección no convierte las sesiones HMAC existentes en revocación instantánea de permisos.
- Pruebas: simulación equivalente10/17 en frío y1/1 repetido; contraseña incorrecta/nueva, permisos, bajas, caducidad, carga antigua tras mutación, lecturas frescas del panel. Bundle completo probado con REST simulado y headers reales.43casos públicos y24suscriptores aprobados.
- Primera carga y caducidad aún requieren lecturas de los datos faltantes. Cero lecturas en el login no se promete: se mantiene autenticación contra cuenta actual.
- Worker completo: worker/WORKER_COMPLETO_V45.js. Pendiente copia/despliegue manual y prueba del login real repetido. No afirmar producción verificada antes.
- Favoritos: HTML corregido para carga única; caché privada de favoritos todavía pendiente. Publicidad sin medición en registro anterior pendiente comprobar. Eventos/Actividades se prueban después del login, sin mezclar consumos.


## 06 octubre — V46 caché privada persistente y favoritos
- Login real V45 confirmado por usuario: primer ingreso10consultas/17documentos; segundo1/1. V46 elimina caducidad1hora de vínculos/complementos y migra entradas V45 aún vigentes sin releer Firestore. Cuenta/contraseña siguen comprobándose frescas; sesión conserva vencimiento8h.
- Favoritos autenticados: primer listado carga sólo los favoritos del sid del token; lista base privada persistente. Lecturas siguientes0Firestore. Tipos/filtros/relaciones activas se conservan. Cada mutación guarda delta por favorito; no sustituye toda la lista y conserva cambios concurrentes de IDs diferentes.
- Alta1PATCH sin lecturasFirestore; baja1GET pertenencia+1DELETE. DeltasKV y marcador por suscriptor se juntan en respuesta antes de completar petición. Navegación sin cambios usa KVget, no KVlist repetido. Tras cambios se fusiona índice sólo del suscriptor; revalidaciónKV durante propagación, sin consultasFirestore. No prometer visibilidad instantánea entre ubicaciones por consistencia eventualKV.
- Baja de cuenta elimina también proyecciónKV de favoritos. Caché no guarda contraseñas. Modificaciones externas directas aFirestore necesitan invalidación/republicación explícita; V46 coordina las mutaciones hechas a través de este Worker.
- Pruebas unidad:11favoritos frío1/11,repetido0/0; duración2h sin recarga, migración45→46, altas/bajas, filtros, sid ajeno rechazado, cambios concurrentes, limpieza de cuenta. Bundle completo REST simulado confirma login10/17→1/1 y favoritos1/11→0/0.43casos públicos/24suscriptores/paquete aislado pasan. Worker completo worker/WORKER_COMPLETO_V46.js listo para copia manual.
- Pendiente despliegue manual y prueba real de favoritos repetidos. No cerrar644iniciales/25históricas sin atribución. Eventos/Actividades después de esta prueba; Hosting transfer4.1MB/storage124.2MB última captura. Contador708 antes de impacto nuevas llamadas, pendiente reconciliar.


## 06/10/2026 20:12 — Panel anunciante, permisos V47
- Usuario confirmó registro visible y cuatro comprobaciones session V46 con 0/0/0/0. Handoff usuario → anunciante sin contraseña confirmado.
- Aperturas comercio: 20:05:39 y 20:07:07, 20:08:00, 20:08:01 /commerce V46 1 consulta/1 documento cada una. Usuario volvió al primero tras visitar otro. No atribuir estos datos a carga pública ni a las 644 históricas.
- Causa de código encontrada: seleccionarAnunciante_ llama /commerce?action=permisos_panel y lee anunciantes_administracion cada vez. Datos de administración fuera del caché privado V46.
- V47 agrega panelAdministration por anunciante en KV persistente, autenticación previa preservada. Patch/delete de anunciantes_administracion invalidan sólo su clave. Sin vencimiento horario. KV tiene propagación eventual; escrituras directas externas no pasan por invalidación del Worker.
- Pruebas bundle: primera permisos 1/1, repetida 0/0, sin sesión 401 sin lectura. Pruebas caché: distintas solicitudes reutilizan; cambios y eliminación invalidan.
- Worker completo V47 TXT entregado; despliegue MANUAL pendiente. Primera carga de administración en nueva clave puede ser 1/1, repetidas deben ser 0/0. Esto NO certifica carga/edición de todos los módulos.
- Próximo paso: desplegar V47 y abrir primero el mismo anunciante dos veces. Luego continuar Modificar datos/Promos/Eventos/Actividades y administrador, sin rehacer el inventario existente.


## 06/10/2026 20:46 — Cierre de pruebas y revisión de cargas
- V47 real confirmado: /commerce 20:22:42 1 consulta/1 documento, repetido20:23:20 0/0; sin escrituras/eliminaciones. PanelAdministration caché compartido validado en recorrido real.
- Modificar datos20:34:25 /commerce3/3; ciudades /territory/public0/0 con cabeceraV46 almacenada. Al volver de Farmacias/Publicidad no apareció llamada nueva de Modificar datos: reutilización local de ficha comprobada en ese recorrido, no caché compartido de ficha completa.
- Farmacias20:42:26 2consultas/2docs y Publicidad20:42:49 5consultas/9docs; ambas0write/0delete. Cargas privadas aún NO certificadas como resueltas desdeKV.
- Revisión autónoma realizada: loadFarmaciasUI POST getPanelData; loadPublicidadUI GET getpaneldata. publicidadPanelDataV2 lee admin, consulta publicidades propias, por cada publicidad consulta media y segmentación, y lee publicidad_cambios del día. Catálogos publicidad síKV. Fórmula del código3+2N llamadas; 5 compatible con1publicidad, inferencia no desglose observado de esta solicitud.
- FarmaciasPanelDataV3 y allowedFarmCities leen administración, sedes/ciclos y participantes por ciclo. No atribuir todavía el total real2/2 a colecciones concretas: hay que verificar la cadena efectiva de routers y su log por request; el camino estático V4 incluye más operaciones que el total reportado.
- Pendiente concreto siguiente: resolver las cargas privadas de Farmacias/Publicidad con caché e invalidación por cambios, sin quitar funcionalidades, y probar rutas reales del bundle. No hacer otro inventario ni pedir al usuario comprobar cada campo.
- Usuario termina pruebas por hoy. No afirmar que tareas siguen ejecutándose después de responder. Próxima sesión retoma este bloque.


## 07/10/2026 — V48: cargas privadas Farmacias/Publicidad
- Trabajo ejecutado sobre panel anunciante. No confundir con público: público ya devuelve KV sin operaciones Firestore.
- V48 usa caché KV persistente de listas por anunciante y de medios/segmentación por publicidad y participantes por ciclo. Administración conserva V47; contador diario de publicidad se prepara por ID y fecha. Sin vencimiento horario. Primera preparación de claves faltantes requiere consultas propias, no un barrido global ni una recarga por cada visitante.
- Lecturas de panel usan adaptador exclusivo de lectura; mutaciones mantienen comprobaciones frescas de propiedad, permisos y cupos. Cada patch/delete actualiza delta del documento en sus listas, incluidos cambios de propietario. No invalidar/releer toda la lista al cambiar un campo o imagen. Listas hijas de entidades nuevas se preparan al crear, sin consultar IDs nuevos.
- Prueba Worker COMPLETO V48 con REST Firestore simulado: Publicidad inicial5consultas y repetida0; Farmacias inicial3 con administración ya preparada y repetida0. Contenido/medios/segmentación/ciclos/participantes conservados. Estos son fixtures locales, NO consumo real de producción ni explicación de los2/2 previos del usuario.
- Prueba real del bundle en entorno simulado: editar/crear ciclo; crear publicidad; editar nombre sólo escribe documento padre; editar imagen conserva nombre/estado; activar/pausar actualiza estado y contador; eliminar publicidad elimina sólo sus hijos y documento. Lecturas posteriores0, incluida primera carga tras alta. Publicidad activa publicada con imagen correcta y0Firestore. Sin sesión401 y anunciante ajeno403, sin lectura.
- Tests pasan: caché48, privado46, Farmacias30, aislamiento módulos37(75casos), observación41, paquete38 e imports105archivos. Prueba de caché incluye tombstones/cambio propietario/concurrencia de IDs distintos. KV sigue con consistencia eventual; cambios externos directos a Firestore requieren invalidación explícita.
- Worker completo: worker/WORKER_COMPLETO_V48.js y TXT descargable. Despliegue Cloudflare MANUAL PENDIENTE. No afirmar producción comprobada. HTML no requiere cambios para usar estas rutas.
- Próximo paso concreto: instalar V48 y comprobar carga y repetición de Farmacias/Publicidad del mismo anunciante. Después continuar panel anunciante y administración con inventario existente, sin solicitar comprobar cada campo. Las644 iniciales/25históricas siguen SIN atribución. No cerrar esos pendientes ni certificar todos los módulos.


## 07/10/2026 13:43 Argentina — 644 lecturas antes de abrir plataforma
- Usuario informa hoy: temprano0 lecturas, luego644 ANTES de abrir/navegar plataforma y antes de desplegar nuevo Worker según su descripción. No atribuir a selección de ciudad ni a tarjetas/login. Repite644 del día anterior. Baseline actual0escrituras/644lecturas/0eliminaciones; descargas5MB, almacenamiento139.8MB (unidades reportadas por usuario).
- Revisión código completo V47/V48: sin scheduled, cron, setInterval o waitUntil. createDb crea funciones y no consulta al construirse. Rebuild integral exige POST /superadmin/rebuild-all-cache y autorización; no se invoca en arranque.
- Prueba ejecutada sin acceso real a Google: importación de ambos bundles0 red; GET raíz200, OPTIONS204, ruta inexistente404, dashboard sin sesión401, rebuild sin sesión401, todos0 red/Firestore. No prueba quién ejecutó operaciones reales en producción.
- Hipótesis de rebuild/otra petición al Worker/otro cliente siguen NO CONFIRMADAS. Necesario correlacionar logs Cloudflare del intervalo de aumento. No añadir código ni bloquear funcionalidad basándose sólo en644; conservar funcionalidades. Pausar navegación de prueba hasta resolver atribución o conseguir evidencia.


## 07/10/2026 16:12 ART — Retoma del panel y prueba ampliada V48
- V48 desplegada confirmada por lectura del código de Cloudflare. Se ejecutó de nuevo la prueba del Worker completo contra REST simulado, sin consultar Firestore real.
- Cobertura nueva: alternar Farmacias/Publicidad tras mutaciones conserva cargas repetidas con 0 consultas; pausar/reactivar ciclo sólo modifica farmacias_ciclos del ID indicado, conserva fecha, hora, observaciones, duración y participantes; Publicidad queda intacta. Acceso a Farmacias sin sesión401 o anunciante ajeno403 sin operaciones Firestore. Todo aprobado.
- Esto es validación automatizada con fixtures; carga fría y repetida real de Farmacias/Publicidad V48 sigue pendiente de recorrido del usuario. No requiere un nuevo Worker.
- Incidente de cuota separado: contador reportado16:07ART 2000 lecturas/0 escrituras/0 eliminaciones; Hosting5MBdescargas/139.8MBalmacenamiento. Plataforma no abierta hoy por el usuario. Audit DATA_READ habilitado15:28ART; no reconstruye historial de mañana. JSON de tarde registra usuario Google/navegador y ListDocuments anunciantes300 entradas + listeners, no servicio del Worker. Usuario confirma que al abrir Firebase aparece Datos antes de pasar a Uso. Eso explica un origen de consultas; NO se atribuyen las644 matinales ni el total2000 como cifra exacta demostrada. Cloudflare sin llamadas disponibles15:28–16:02ART. Para observar cuota usar enlace directo Usage, sin abrir Datos.
- Continuar desde prueba real Farmacias/Publicidad del mismo anunciante y después los módulos existentes con inventario de aislamiento; no rehacerlo. No mezclar detalles visuales ni nuevas funcionalidades administrativas.


## 07/10/2026 16:21 ART — Farmacias: autorización histórica V49
- Capturas reales: usuario abrió plataforma16:11; público0operaciones, login1consulta/1documento, session0, permisosCommerce0. Farmacias16:12:33/38 y16:16:09/46 devuelveHTTP200 y0operaciones, pero successfalse visible «Farmacias de turno no habilitado». No certificar funcionamiento de Farmacias por contadores0 cuando se rechazó la carga.
- Publicidad16:15:16 carga4consultas/8documentos,0escrituras/0eliminaciones; al alternar no aparecen nuevas llamadas Publicidad (reutilización local del HTML, no prueba de segunda petición al Worker). Primera carga compatible con preparación V48; repetición entre solicitudes requiere confirmación posterior.
- Diferencia comprobada: frontend y permisos sesión admiten nombres históricos FARMACIAS/FARMACIA; routePanelV4 sólo aceptaba TURNOS_FARMA para habilitación comercial. V49 admite alias concretos equivalentes del módulo con normalización; conserva autenticación, permisos de persona y rechazo de anunciante no habilitado. Sin ampliar permisos por presencia de configuración territorial.
- Test del bundleV49 con administraciónFARMACIAS reproduce autorización correcta, además seis variantes y tres negativas. Conserva pruebas alta/edición/pausa/reactivación/bajaPublicidad, ciclosFarmacias, aislamiento cruzado y401/403 sin DB. PASSED con REST simulado. TXT completo361137bytes entregado; aún pendiente despliegue MANUAL y prueba real del rechazo de esa cuenta. No afirmar que su documento de administración fue inspeccionado: no se accedió aFirestore real.
- Siguiente: usuario copia V49 en Workerlogin, despliega y reabreFarmacias. Si continúa rechazo, verificar habilitación exacta del anunciante y antigüedad de caché administrativa con lectura específica autorizada, sin barrer colecciones.


## 07/10/2026 17:06 ART — Verificar resultado además de cuotas
- Usuario confirma V49 desplegado: Farmacias16:46:45 2consultas/1documento y16:47:48/52 0/0, tresPOST reales confirmados enCloudflare. Publicidad no tiene llamadas nuevas al alternar. Usuario no ve aviso rojo. No atribuir reintentos necesariamente al rechazo histórico ni afirmar funcionamiento porHTTP200/contadores0.
- Prueba controlada del código HTMLoriginal: éxito de servicio y cargaUI completada = una llamada al abrir y ninguna en tresalternancias; rechazoHTTP200 o fallo de renderUI = estadoerror y nuevas llamadas al regresar. Se verificó enVM con DOM simulado; Chromium no disponible, no afirmar prueba de navegador real ni diagnóstico exacto de su cuenta.
- Registrador agrega Respuesta (Aceptada/Rechazada/ErrorHTTP/Sin comprobar) leyendo copia delJSON sin alterar respuesta original y Vista (Lista/Error) informada por el cargador del panel. Los registros históricos quedan sin comprobar. No guarda cuerpos ni mensajes ni datos personales; sin peticiones adicionales, sinFirestorereal. HTTP200successfalse no equivale a pantalla correcta. Lecturas0 mantienen su sentido limitado.
- login.html carga consumo-v44.js?v=49.1 para recibir diagnóstico actualizado. No se modificaWorker49 ni permisos adicionales. Pruebas de recorder, carga/reintento y sesión compartida aprobadas. PendienteHostingCI y recarga del panel para obtener resultados reales y resolver el motivo particular deFarmacias.


## 2026-10-07 — V50: catálogo de farmacias del panel (18:23–18:28 ART)
- Respuesta real de qjvmsyue recibida por el usuario: permisos_panel contiene FARMACIAS; /farmacias getPanelData success:true pero devuelve SED-qjvmsyue-01 (ACP CONTENIDOS, Salta 560) como única farmacia. La denegación anterior ya no es la respuesta actual; no confundir con errores históricos de consola.
- Causa confirmada en código: reconstrucción consultaba sedes por anunciante_id del administrador, sustituyendo el catálogo territorial de farmacias. El Worker antiguo clasificaba sedes por nombre, categoría o participación; recuperar esa función sin sus barridos globales.
- V50 selecciona farmacias desde guide:city:v1:<ciudad> y catalogs:commerce:v1 en KV; clasifica por nombre/categoría o participación en sus ciclos, excluye sedes inactivas y otras ciudades. No consulta sedes del administrador ni usa fallback/barrido Firestore si el catálogo está vacío. Ciclos y participantes conservan consultas privadas por propietario y caché V48.
- HTML login: respeta data.ciudades autorizado por Worker, en lugar de mostrar todo el territorio.
- Pruebas locales full Worker PASS: autorización y alias, repetición cero operaciones, alternancia, mutaciones por ID, preservación de horarios/participantes/publicidad. Prueba específica PASS: farmacias de otros propietarios, por nombre y categoría, excluye ACP; catálogo vacío no dispara Firestore. No equivalen a prueba visual en cuenta real.
- Pendiente inmediato: usuario despliegue Worker V50 TXT y abra Farmacias → Dolores; comprobar lista real y controles. No dar por cerrada funcionalidad visual antes de verificar.
- Auditoría adicional: Efemérides aún usa indicadores legacy booleanos en efemPermisos pese a permisos/config nuevos presentes (EF LOCAL / EF GENERAL / EF PROVINCIAL y funcionalidades_config). Hallazgo pendiente de corregir, no mezclado con V50.
- Incidente 644 lecturas históricas sigue sin atribución exacta; auditoría de Google sí identifica consultas del visor Datos de Firebase por cuenta del usuario. No atribuir a la plataforma sin evidencia.


## 2026-10-07 — V51: nombres en farmacias públicas (18:43 ART)
- Captura real carcasa: turnos y direcciones correctos, nombre genérico Farmacia. Ciclos preparados conservan sede sin nombre_sede/nombre_ref; plantilla usa fallback genérico.
- V51 completa nombres por sede_id desde guide:city:v1:<ciudad> en KV; respeta nombre propio de sede, usa nombre del anunciante cuando sede está vacío/genérico. No cambia orden, fechas, horarios, participantes o direcciones; cero Firestore público.
- Carcasa: trim de cada alternativa de nombre y compatibilidad nombre; cache local de turnos sin nombre/genérico ya no se reutiliza 24h. Esto genera nueva llamada pública KV, no Firestore.
- Prueba full Worker V51 PASS: /farmacias turnos devuelve Farmacia Test desde guía con sede sin nombre y conserva ID/hora, 0 reads; regresiones del panel y mutaciones PASS. Pendiente despliegue manual y verificación visual real; no afirmar que ya fue desplegado por el usuario.


## 2026-10-07 — V52: cerrar origen y ciclo existente, sin recreación
- Usuario confirma ciclo ya cargado; exige solución en origen, no fallback de texto. V51 sólo completaba la respuesta pública. V52 prepara y conserva nombres en el paquete KV y relaciones preparadas al guardar y rebuild.
- Rebuild integral espera guía preparada antes de Farmacias (dependencia explícita), sin volver a consultar anunciantes ni sumar scans Firestore.
- getFarmCityV2 normaliza paquete legacy existente sólo en KV, conserva ciclos/participantes/fechas/horarios/direcciones, y guarda revisión SHA256 de nombres de las sedes usadas. Segunda visita no reescribe; cambio de nombre ajeno al ciclo no reescribe; cambio de nombre de farmacia refresca únicamente paquete territorial KV. Sin Firestore, sin regenerar ciclo.
- Función pública vuelve a calcular sobre paquete preparado completo (se retira join duplicado de V51). Carcasa corregida en V51 sigue vigente.
- Prueba de ciclo existente, guardado, rebuild, renombrado puntual y segunda visita PASS; integración full Worker V52 PASS con rutas públicas 0 Firestore y regresión de mutaciones/autorización. Pendiente despliegue manual de V52 y verificación visual real. No pedir al usuario borrar/rearmar ciclos ni ejecutar seed global.


## 2026-10-07 — Registro de consultas visible dentro del iframe anunciante (18:54 ART)
- Usuario no ve registro. HTML login ya indica data-gld-consumo-container=.container, pero consumo-v44.js ignoraba atributo y montaba al final de body. Iframe calcula altura de .container, dejando diagnóstico fuera del área visible.
- Recorder ahora respeta host indicado; se monta dentro de .container, abierto con altura según contenido, sin límite fijo. HTML login usa cachebuster49.2. No modifica Worker ni ejecuta llamadas nuevas.
- TEST_CONSUMO_V44 PASS con prueba DOM de host: contenedor recibe diagnóstico, body no; queda abierto; 0 llamadas nuevas. Privacidad, respuestas intactas y contadores siguen PASS.


## 2026-10-08 — prueba real V52 y corrección V53
- Baseline confirmado por usuario: Firestore 0 lecturas/escrituras/eliminaciones. Entrada pública Dolores, farmacias con nombres visibles: cero operaciones. Login suscriptor: 1 consulta/1 documento, Firebase confirma 1 lectura. Promos/eventos/actividades/publicidad públicas: KV cero; luego de espera Firebase sigue en 1.
- Sesión panel anunciantes y acceso ACP CONTENIDOS: cero operaciones. Modificar datos: 3 consultas/3 documentos, sin mutaciones.
- Causa comprobada en código: commercePanelDataV3 omitía panelReadDb; datos, administración y sedes iban directamente a Firestore aunque existieran cachés privadas. La ficha completa del anunciante tampoco tenía caché de panel (login guarda sólo resumen).
- V53 conecta sólo la carga a panelReadDb, reutiliza caché administración y sedes, agrega caché ficha completa por ID con actualización/baja mediante mutaciones. No cambia comprobaciones de autenticación ni lecturas necesarias al guardar.
- Pruebas locales: sintaxis, TEST_COMMERCE_CACHE_V53 y TEST_WORKER_PANEL_V53 PASS. Solicitudes independientes repetidas cero, datos completos, modificación puntual preserva otros campos, baja sin respuesta obsoleta. Regresión farmacias/publicidad/autorización PASS.
- Entregable manual: WORKER_COMPLETO_V53.txt. Pendiente despliegue usuario y medición real. Una caché ausente puede requerir carga inicial; no afirmar cero en primera carga ni que las 3 observadas eran modificación.


## 2026-10-08 — V54 Promos panel
- Prueba real V53 14:48 ART: session/access commerce cero; Promos getPanelData 4 consultas/4 documentos; Modificar datos luego 1/1 (primera ficha completa cacheada V53). No asumir todos los módulos terminados.
- Causa: promosPanelDataV2 omitía panelReadDb y consultaba administración, ficha, sedes y promos directamente. getPromos también omitía caché. Límites implícitos impedían reutilizar listas v48.
- V54 usa caché de panel para ambas cargas Promos, lista por anunciante con límite explícito 500, reutiliza ficha/administración/sedes. Mutaciones mantienen deltas por promo ID; alta declara newDocument para no leer un ID recién generado. No se cachean ni cambian las validaciones autorizantes de las mutaciones.
- TEST_WORKER_PANEL_V54 PASS (mock REST, no navegador): carga repetida cero; getPromos comparte listado; edición de texto sólo PATCH promos, sin query; preserva imagen/otros; pausa/alta/baja reflejadas en caché; ajeno 403 cero; regresión commerce/farmacias/publicidad PASS. Sintaxis PASS.
- WORKER_COMPLETO_V54.txt entregable manual. Pendiente desplegar y prueba real. Lista nunca preparada puede requerir lectura inicial, no se prometió cero universal.


## 2026-10-08 — V55 Eventos, Actividades, Efemérides
- V54 desplegada por usuario: Promos primera carga 1/1; recarga posterior 0/0, session/commerce también cero. Prueba real confirmada. Eventos luego 7 consultas/6 documentos V54. Usuario reporta consumo Efemérides/Actividades, sin fila numérica adjunta aún.
- Causa eventos/actividades: funciones de carga omitían panelReadDb. Se agregan listas privadas eventos+programación y actividades+horarios al caché incremental v48, por anunciante/padre, límites500 explícitos; reutilizan ficha/permisos/sedes ya preparados. No cachear verificaciones críticas de escritura.
- Efemérides: admin en lectura pasa por caché; catálogo privado cacheado por campo+valor (tipo/provincia/ciudad, claves distintas), mutaciones actualizan todos los índices afectados mediante deltas por ID. Permisos unificados aceptan flags históricos y funcionalidades/config actuales EF GENERAL/LOCAL/PROVINCIAL; no se habilitan territorios fuera de autorización.
- Declarar altas generadas newDocument evita GET inútil al ID nuevo en creación de eventos/programación/actividades/efemérides. Validaciones y edición/baja siguen verificando documentos existentes.
- TEST_WORKER_PANEL_V55 PASS con REST mock: cargas repetidas nuevas solicitudes 0; VIP/FREE con programación conservada; pausa/baja y separación anunciante ajeno; Actividades horarios preservados y pausa/baja visibles sin volver a consultar; Efemérides 3 ámbitos, repetición0, desactivar, cambiar ámbito, eliminar actualizan caché; regresión commerce/promos/farmacias/publicidad PASS. Sintaxis PASS.
- Entregable WORKER_COMPLETO_V55.txt. Pendiente despliegue y validación real. Si aún faltan listas privadas, primera carga puede requerir lecturas acotadas; las recargas deben reutilizarlas. No atribuir exactas 7 al registro agregado sin operaciones individuales.


## 2026-10-08 17:27 ART — comprobación real panel V55
- Usuario compartió primera vuelta 17:23: Eventos4consultas/3documentos y repetición0; Efemérides3/474; Actividades3/6; Publicidad1/0. Session, entrada comercio, Promos, Modificar datos y Farmacias0.
- Tras recargar página, segunda vuelta17:26: session, commerce acceso, Promos, Eventos (dos cargas), Farmacias, Efemérides, Actividades, Publicidad y Modificar datos: todas0consultas/0documentos/0escrituras; filas completas0eliminaciones. Todas HTTP200 Aceptada; módulos Vista Lista. V55.
- Confirmado en navegación real: caché del panel persiste entre recargas. No afirmar verificación de guardar/editar/eliminar real: sólo pruebas locales existentes de mutaciones; próximo bloque pruebas reales de cambio puntual y actualización de vistas, comenzando Modificar datos con campo reversible.
- Contador Firebase total posterior aún no informado; no deducir facturación exacta sumando documentos/consultas. Carga inicial Efemérides474 provino catálogo administrativo incluyendo desactivadas, distinto del público. Repetición constatada0; cache compartido por ámbito y sin TTL diario, sujeto a modificaciones/borradoKV.


## 2026-10-08 — contadores de caracteres panel
- Usuario solicitó límites efectivos y contador por recortes en tarjetas. Código original: descripcion/tags/adicionales limitados por niveles; otros maxlength explícitos (Promos300, alta descripcion500, publicidad título100/nombre80/CTA35). No inventar máximos en campos sin regla.
- Añadido plataforma/contadores-caracteres.js y referencia original login.html: contador dinámico n/max en campos maxlength, aviso al alcanzar/exceder, conserva textos antiguos sin truncarlos, valida exceso en submit visible, permite browser maxlength limitar escritura/pegado. Sin polling ni red/Firestore. MutationObserver adapta formularios dinámicos y respeta altura .container existente.
- Sintaxis JS comprobada. Pendiente verificar visual en navegador tras Hosting; no se modificaron límites por nivel ni truncado de tarjetas. Worker55 no requiere cambio por este ajuste.


### 2026-10-08 — Espacio para editar descripciones
- Ampliados los cuadros de descripción del panel original: Modificar datos, alta, Eventos, Eventos Free, Efemérides y Actividades.
- Altura mínima 160 px, interlineado 1.5 y redimensionamiento vertical manual. Se conserva el ancho disponible y el ajuste dinámico del iframe.
- Cambio únicamente visual; conserva límites y contadores, sin nuevas llamadas al Worker.
- Publicación y verificación visual pendientes al crear este commit.


### 2026-10-08 — Aviso de guardado claro en todas las pestañas
- Aviso compartido: Guardando… durante altas/ediciones y Cambios guardados al confirmar éxito; sin título Listo ni explicación duplicada.
- Corregido el error que convertía mensajes de progreso emitidos con setMsg(ok) en resultados finales antes de recibir la respuesta.
- Se conservan mensajes de error y de resultado no confirmado; nunca se presentan como guardados.
- Verificación local del aviso: progreso, éxito, error, resultado no confirmado y otras acciones aprobada. Publicación/visual pendiente.


### 2026-10-08 — Gran Hermano: pendientes y aprobación V56
- Hoja maestra reemplazada en su misma identidad, versión 9. Se dejan pendientes prueba de varios campos y alta nueva; descripción real V55: 0 consultas, 1 escritura.
- GH: pendientes se obtenían pero abrirApp sólo dibujaba la portada; Actividades no renderizaba al cambiar de pestaña. Corregido render común de eventos, actividades y anunciantes, botones actualizar y error visible sin mostrar falsos vacíos. Se agrega el contenedor de pendientes faltante de la portada.
- Evita doble envío mientras resuelve una aprobación. Conserva nivel obligatorio en altas y ajuste dinámico de altura.
- Worker V56: pendientes leen listas compartidas KV por estado/aprobado. Cambios por documento actualizan las mismas listas; conserva caches anteriores por anunciante. Primer llenado cuatro consultas acotadas, repetición cero.
- Pruebas completas del bundle: regresiones V55 aprobadas. GH local: pendientes, aprobar evento/actividad, rechazar evento, aprobar reclamo; sincronización pública KV cero y listas actualizadas; sesión requerida y documento faltante sin escritura. Aprobación evento/actividad con relaciones preparadas: 1 lectura del documento + 1 escritura.
- HTML probado con DOM simulado: entrada dibuja las tres listas y botones; fallo de carga visible y recuperación sin cerrar sesión. Sintaxis aprobada. No equivale a prueba visual en navegador.
- Worker completo TXT56 entregable para instalación manual; no repetir carga inicial/seed. Pendiente despliegue del usuario y aprobación real. Gran Hermano completo (publicidad, editor, roles locales, otros pendientes) NO certificado terminado.


## 2026-10-08 — Eventos Free V57
- Prueba real usuario GH V56: login 2 consultas/2 documentos; dashboard0; pendientes primera4/0, actualización siguiente0/0. Aprobación real todavía pendiente: falta crear el evento de prueba.
- Eventos Free: ciudades obtenidas de KV territorial no se pasaban al formulario; categorías con objetos se trataban como texto; sedes sin nombre se descartaban. Adaptador común convierte categorías a nombres, combina ciudades y normaliza lugares/sedes propias. Sin nuevas consultas a Firestore.
- Entrada getFreeEventsPanelData separada para usar permisos Free.
- Descripción Free máximo200: maxlength + contador existente + validación cliente y servidor al crear/editar. No se trunca texto histórico silenciosamente; VIP conserva sus límites.
- Pruebas locales V57: catálogo/formulario PASS; límites200/201 crear/editar y VIP PASS; regresiones panel y GH PASS. No equivale a comprobación visual publicada ni aprobación real.
- Entrega Worker completoV57 TXT; Diego debe reemplazar/desplegar login y recargar panel. Después verificar selectores Free, crear evento y aprobar desde GH. No pasar a otros módulos antes de cerrar este recorrido.
