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
