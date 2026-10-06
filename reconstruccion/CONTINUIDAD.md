# Registro de continuidad — Guía Local Dolores
Actualizado: 4 de octubre de 2026, Argentina. Este registro debe leerse antes de continuar.

## Situación y reglas
- Rama del código modular: reconstruccion-total-03oct. El 4/10 el usuario autorizó actualizar los nueve HTML originales en main y pidió el Worker completo para desplegarlo él manualmente. Ver última sección: reemplaza la restricción anterior para ese alcance.
- Base histórica: 9e549f3eb397dffe2097f2ff52941792431f1946 (V35).
- Avance V36 publicado: 16ec4170e40346e0eac9c77051fce1532f95d4ba.
- Código V37 publicado: 77d3a01f369bda3138dc1d9df09a424894f9c5fc.
- CI de ese código aprobado: https://github.com/liqko/guia-local-dolores/actions/runs/37210400241 (incluye aislamiento y tres pruebas de navegador).
- Worker vigente: worker/app-main-v35.js; público V12, panel V15, administración V11.
- V37 es candidata con aislamiento comprobado en los casos registrados. Falta validación del entorno real; no declarar producción aprobada.
- Tres planos coordinados: usuario final, anunciante y administrador Gran Hermano.
- Revisar las acciones administrativas existentes que afectan los mismos datos y su publicación en KV. No confundir esto con desarrollar retoques pendientes de Gran Hermano.
- No implementar los 61 pendientes históricos, altas incompletas ni nuevas funciones.
- Un anunciante puede no tener sede física. Eliminar la última sede no elimina su cuenta.
- Mensajes al usuario breves, en español sencillo, con resultados comprobados.

## Qué se hizo
| Versión / commit | Trabajo | Evidencia y límites |
| --- | --- | --- |
| V32 / c5a2312 | Carcasa/Guía: rutas, ciudad, iframe, caché separada por ciudad, reintentos | TEST_CARCASA_V32: funciones reales en entorno simulado, cero acceso Firestore en los casos cubiertos |
| V33 / fd65cf4 | Mutaciones, cuotas, moderación, duplicación y fechas | TEST_MUTACIONES_V33: 15 circuitos simulados; no garantiza aislamiento de cada campo |
| V34 / cb14362 | Suscriptores, revocación de sesiones, puente correo, errores visuales | TEST_SUSCRIPTORES_V34 y TEST_VISUAL_V34; entrega real de correo pendiente |
| V35 / 5d2624c + 9e549f3 | Sedes sin borrado de anunciante, eventos por ciudad, conservación de filas, cambios de imágenes, categorías | TEST_FLUJO_EXISTENTE_V35: 8 circuitos; TEST_PANEL_VISUAL_V35: navegador simulado; AUDITAR_HTML_V35: 9 HTML sin Firebase directo |

## Hallazgo histórico corregido en V36/V37
Antes de V36/V37, el frontend preparaba cambios parciales pero varios guardados del backend:
1. Combinan datos previos y nuevos y envían campos intactos a db.patch.
2. Consultan programación, horarios, media, segmentación o participantes aunque se cambie sólo un dato general.
core/db.js genera updateMask con todos los campos recibidos. Reescribir campos intactos no equivale a múltiples escrituras facturadas, pero viola el aislamiento exigido.
Las consultas de documentos relacionados sí pueden agregar lecturas innecesarias.
No eliminar controles necesarios de propiedad, permisos, ciudad o cupos para reducir consumo.

## Recorrido fijo
Cada bloque se revisa en los tres planos donde existe. No declarar cerrado un bloque sólo por corregir una imagen.
| Orden | Bloque | Estado |
| --- | --- | --- |
| 1 | Carcasa: ciudades, navegación, cargas y caché | Consultas públicas y navegación comprobadas V36/V37 |
| 2 | Anunciantes: listado, tarjetas y ficha pública | KV, ciudad y reflejo de ediciones comprobados |
| 3 | Modificar datos y sedes | Panel + administración corregidos y probados; última sede conservada |
| 4 | Promociones | Guardado diferencial y aislamiento comprobados V36 |
| 5 | Eventos | Guardado/programación/moderación corregidos y probados V37 |
| 6 | Actividades | Guardado/horarios/moderación corregidos y probados V37 |
| 7 | Farmacias | Ciclo/participantes corregidos y probados V37 |
| 8 | Efemérides | Guardado diferencial y ciclo de vida probados V37 |
| 9 | Publicidad existente | Guardado/media/segmentación/selección activa corregidos y probados V37 |
| Compartido | Suscriptores y correo | Aislamiento probado V37; correo real pendiente |

## Cómo cerrar cada bloque
- Enumerar acciones efectivamente alcanzables desde HTML y rutas vigentes; distinguir alias de acciones distintas.
- Anotar por acción campos implicados y lecturas, escrituras, eliminaciones y actualización KV esperadas.
- Seguir pantalla -> ruta -> módulo -> Firestore/KV en usuario/anunciante/administración según corresponda.
- Corregir excesos y verificar campos exactos de cada patch, no sólo cantidad de documentos escritos.
- Pruebas deben rechazar barridos o consultas de colecciones ajenas al dato cambiado.
- Verificar publicación y retiro público tras editar, pausar, reactivar, moderar o eliminar.
- Registrar aquí resultado, prueba, límites y commit al cerrar el bloque.
- No prometer cero Firestore en toda mutación: algunas lecturas de autorización y una escritura del dato cambiado son necesarias.
- No pasar a nuevas funcionalidades ni repetir auditorías globales sin una razón.

## Punto de partida del registro (antes de V36/V37)
Se repitieron el 4/10:
- TEST_FLUJO_EXISTENTE_V35: 8 circuitos aprobados.
- TEST_CARCASA_V32: aprobado, cero lecturas Firestore/cero escrituras en sus casos.
- AUDITAR_HTML_V35: aprobado, 9 HTML / 15 scripts sin Firebase directo.
No hubo nuevas correcciones de código durante estos turnos de aclaración.
No se ha contado todavía el total de acciones existentes. No inventar un número ni una estimación horaria.

## Avance V36 — 4/10
- Inventario y evidencia: auditoria/INVENTARIO_AISLAMIENTO.md.
- TEST_AISLAMIENTO_PUBLICO_V36: 43 casos, 9 familias de consulta; cero DB/red externa/escrituras incluso con KV vacío.
- TEST_CARCASA_V32 actualizado al entrypoint vigente V35; aprobado.
- Perfil y relaciones administrativas ya no reconstruyen la tarjeta leyendo anunciante/administración/sedes completos.
- Relaciones administrativas validan todo el lote antes de escribir y omiten campos intactos.
- Edición de sede envía sólo campos cambiados, sin repetir identidad ni dirección intactas.
- TEST_AISLAMIENTO_COMMERCE_V36: 6 circuitos con operaciones y campos exactos.
- Promos: cambio general no consulta sede/cupo; sólo patch diferencial. Sin cambios no escribe.
- TEST_AISLAMIENTO_PROMOS_V36: 47 casos / 21 campos generales y operaciones de ciclo de vida.
- TEST_MUTACIONES_V33 (15 circuitos) y TEST_FLUJO_EXISTENTE_V35 (8) siguen aprobados.
- No declarar toda administración cerrada: configuración comercial/búsqueda/ficha y otros módulos necesitan cobertura restante.

## Avance V37 — 4/10
- Eventos, Actividades, Publicidad, Farmacias y Efemérides usan patch diferencial. No rellenan campos históricos ausentes ajenos a la edición.
- Las relaciones intactas para publicación tienen copia preparada en KV asociada al timestamp de la versión del padre.
- Si esa copia falta/no coincide, se consulta sólo la relación del padre indicado; no se inventa una lista vacía ni se hace un barrido.
- Editar/eliminar relaciones usa filas autoritativas de Firestore. La copia KV no sustituye propiedad, permisos ni comprobaciones de cupo.
- Seed explícito prepara también contenido pendiente, pausado/inactivo. Se probó la preparación y edición posterior sin consultas de relaciones.
- Cambiar horas o imágenes modifica sólo el campo de la fila cambiada. Lotes intactos no reescriben las filas ni el padre.
- Eventos deja de consultar anunciante/administración al editar/borrar/pausar; el cupo se carga al reanudar realmente.
- Repetir una edición intacta no retira un evento aprobado.
- Moderación de Eventos/Actividades comparte la copia preparada y actualiza su versión; no relee programación/horarios intactos si está vigente.
- Farmacias no reescribe participantes intactos, valida duplicados/simultaneidad y no crea accidentalmente un ID de edición inexistente.
- Gran Hermano tenía acciones de búsqueda/ficha/catálogo/guardado apuntando a /superadmin?action=... sin ruta vigente. Su adaptador ahora usa las rutas reales.
- Guardar la ficha administrativa compara con lo mostrado al abrir y separa únicamente diferencias comerciales, de perfil y de relaciones. Guardar sin cambios no llama al servidor.
- Se conserva lo implementado; no se desarrollaron bajas de anunciante, altas pendientes ni retoques históricos nuevos.
- Catálogos administrativos envían/escriben sólo diferencias; búsquedas/dashboard leen KV.
- Perfil vacío de suscriptor no escribe un timestamp inútil.

Pruebas nuevas aprobadas localmente:
1. TEST_AISLAMIENTO_PUBLICO_V36: 43 casos.
2. TEST_AISLAMIENTO_COMMERCE_V36: 6 circuitos.
3. TEST_AISLAMIENTO_PROMOS_V36: 47 casos.
4. TEST_AISLAMIENTO_MODULOS_V37: 75 casos (22 campos generales, históricos incompletos, relaciones, moderación y ciclo de vida).
5. TEST_AISLAMIENTO_SUSCRIPTORES_V37: 24 casos.
6. TEST_AISLAMIENTO_ADMIN_V37: 24 casos.
Total: 219 comprobaciones de aislamiento; NO son 219 acciones diferentes.
Además: TEST_FIRESTORE_PATCH_V37 (máscara REST exacta), TEST_PREPARACION_KV_V37
(seed y relaciones de cuatro módulos), y pruebas Chromium pública/panel/admin.
Las pruebas anteriores de 15 mutaciones, 8 flujos existentes, 8 circuitos de
suscriptores, Farmacias, HTML e imports siguen aprobadas.
Las pruebas de navegador usan rutas reales con datos/servicios aislados; no certifican producción ni correo real.

## Próxima acción concreta
CI del código V37 ya terminó SUCCESS, incluidos todos sus pasos.
Preparar pruebas reales controladas con configuración y seed, sin desplegar producción.
No volver a repetir el recorrido desde cero ni agregar pendientes históricos.
La corrección central tiene evidencia automática; no presentarla como garantía de factura/correo/configuración real.
No falta repetir el inventario/corrección común desde cero. Las pruebas reales
podrán descubrir correcciones adicionales; registrarlas por separado con su evidencia.
No usar una instantánea KV potencialmente obsoleta como sustituto de validación autoritativa de propiedad o borrado.

## Pruebas reales y continuidad
- Las pruebas técnicas ya existen y V37 es candidata para pruebas reales controladas.
- Correo real, credenciales, seed KV y datos reales de prueba requieren entorno controlado. No se probaron en producción.
- Si se corta el chat: recuperar esta rama, leer este archivo y ESTADO_DESPLIEGUE.md, comprobar git log/status y seguir desde el próximo bloque sin rehacer lo aprobado.
- Capturas de /tmp son intermediarios; las evidencias duraderas de navegador están en los artefactos del workflow.

## Avance V38 — preparación de pruebas controladas, 4/10
- Confirmada la última ejecución ecb8376: los cuatro workflows terminaron SUCCESS, incluido V35 run 37210512033. No estaba colgada.
- pruebas/preparar-entorno.mjs genera nueve HTML y copia el grafo vigente del Worker a una carpeta nueva. Reemplaza API y navegación por destinos de prueba separados; preserva originales.
- Entry exclusivo app-controlled-test.js rechaza configuración incompleta/proyecto distinto antes de DB/KV y marca respuestas válidas con X-GLD-Controlled-Test: V38. No modifica el entry original.
- Manifiesto registra hashes originales/generados, proyecto, destinos y variables necesarias sin secretos.
- TEST_ENTORNO_CONTROLADO_V38 aprobado: nueve pantallas con scripts válidos, navegación, rechazo de origen habitual/sobrescritura, protección de proyecto y conservación del Worker. Incluido en workflow V35.
- Recorrido concreto: pruebas/RECORRIDO_REAL.md. Cubre seed explícito, tres planos, última sede, moderación, correo real, móvil/escritorio y evidencia de consumos.
- No hubo despliegue, seed ni envío de correo real. Faltan destinos/proyecto/KV/puente y credenciales de prueba configurados en un entorno separado. No hay evidencia de acceso disponible a Cloudflare en esta sesión.
- Siguiente paso: recibir o localizar configuración del entorno de pruebas, generar paquete con esos valores, verificarlo y ejecutar el recorrido. No rehacer V37 ni ampliar pendientes históricos.

## Cambio autorizado de destino — originales y entrega manual del Worker
El usuario pidió expresamente cambiar los archivos originales, conservando su flujo,
y recibir un único Worker completo para copiar/pegar y desplegar él en Cloudflare.
- Main actualizado: bcbc0c209800013376c09df6a6b7f1fb4092b0d5.
- Respaldo creado: respaldo-antes-v38-04oct, commit anterior 4b3f1b5cd4ee00d91c6f750484c2e562a4c933fd.
- Nueve HTML en plataforma/ con nombres originales. Actividades ya coincidía con la candidata, por eso sólo ocho muestran diff. Carcasa usa las rutas originales.
- Main contiene worker/WORKER_COMPLETO_V38.js, artefacto ESM único de 102 módulos, sin imports externos. esbuild 0.25.10, ES2022. Entry original versión 35 incluye correcciones V36/V37.
- Artefacto final comprobado con los 43 casos públicos KV de la prueba existente; nueve HTML/15 scripts y destinos relativos válidos.
- Registro operativo de main: actualizacion-v38/CONTINUIDAD.md y manifest.json con hashes.
- El asistente no desplegó Cloudflare. Se entregará el archivo al usuario para ese paso.
- No asumir que actualizar main acredita publicación web: comprobar estado del alojamiento y despliegue del Worker. Seed y correo real siguen pendientes.
- Continuar desde este punto y dejar de pedir un proyecto de pruebas separado como requisito de preparación del código: el usuario eligió los archivos originales.

Aclaración de publicación: el worktree real de main no contiene .github/workflows.
El workflow Firebase visto antes pertenecía a la rama de reconstrucción.
No afirmar publicación automática de estos HTML: están actualizados en GitHub;
la activación web todavía no está comprobada.

## V39 — nueve errores de comprobación del Worker
- Captura de Cloudflare reproducida: TypeScript 5.9.3 reportó exactamente nueve errores en V38.
- Corrección en cinco módulos fuente: parámetros opcionales previous, programacion, matchKey y campos por defecto de configuración Publicidad. Semántica de valores omitidos conservada.
- Bundle final V39: cero errores con --allowJs --checkJs --noEmit --target ES2022 --module ESNext --lib ES2022,DOM. Sin ts-nocheck.
- Repetidas por el cambio: 75 casos de aislamiento, 15 mutaciones y ocho flujos existentes, aprobados.
- Main recibe worker/WORKER_COMPLETO_V39.js. V38 se conserva como histórico.
- Error de arranque separado observado: Falta binding GLD_CACHE_KV. El usuario debe vincular KV con ese nombre; el código no puede crear bindings.
- Luego confirmar despliegue manual V39 y avanzar pruebas reales; correo/seed aún pendientes.
# Incidencia real 5/10 — login GH V40
V41 añade observación DB en memoria por solicitud/colección, documentos devueltos
y errores, sin parámetros/correos/claves/cuerpos ni llamadas adicionales. Raíz V41.
Usuario exige mantener carga automática de pendientes; intento local de quitarla
se revirtió sin publicar. GH sigue idéntico al publicado; no seed ejecutado.
Captura confirma 1.9K lecturas desde cero; causa pendiente. No equivaler documentos
devueltos con lecturas facturadas exactas. Logs sólo cubren este Worker.
Pruebas observación V41, login V40 y público 43 casos aprobadas. Usuario debe pegar
V41 y observar registros Cloudflare al acceder para identificar consultas reales.
Hosting original Firebase ya actualizado: run 37334028552 SUCCESS.
KV GLD_CACHE_KV vinculado; catálogo no inicializado todavía.
Login GH reconstruido consultaba clave en superadmins. Worker histórico prueba
que clave reside en suscriptores y superadmins sólo tiene permisos por suscriptor_id.
Corrección superadmin-session-v2.js usa consulta indexada de suscriptor + permiso
por sid (fallback queryEqual limitado a 5), sin barridos ni mutaciones.
TEST_LOGIN_ADMIN_V40 y aislamiento admin 24 casos aprobados. Visual no arrancó
por falta de Chromium. Worker completo V40 en main para despliegue manual del usuario.

## V42 — 5/10 20:22 Argentina, diagnóstico visible por acción
Usuario exige poder atribuir cualquier nuevo pico sin rastreo manual ambiguo.
Log de cada solicitud ahora incluye message visible en tabla Cloudflare, inicio UTC,
versión, estado HTTP y totales de llamadas de lectura/documentos devueltos/patch/delete/fallos.
Conserva desglose por colección y request_id. No registra cuerpos ni secretos ni
agrega operaciones Firestore/KV. No confundir conteos con factura exacta.
TEST_OBSERVACION_V41 ampliado valida resumen/errores/estados HTTP/cero llamadas extra.
Worker completo V42 generado y sintaxis aprobada; despliegue manual del usuario pendiente.
Causa histórica de 1900 sigue NO demostrada. Worker histórico 30SEP tenía fallback
loadPublicLocations_ que barría países/provincias/ciudades cuando caché estaba vacía;
no demuestra que esa versión estaba activa en el instante del salto. Pendientes
histórico también barría colecciones, V41 usa cuatro consultas vacías observadas.
Inicio original corregido main 6b4c85d, hosting run37387184457 SUCCESS.
No seed todavía. Próximo iniciar KV explícitamente y comprobar pruebas reales.


## 6 octubre: consumo del login, V43 preparado
- Usuario informa contador 669 tras tarjetas, Actividades y login. Diferencia respecto de 644: 25, no 5. No atribuir el delta a una operación sin log completo.
- Hallazgo en subscriberLoginV2: leía anunciantes y anunciantes_administracion para cada relación activa aun cuando la relación ya contenía nombre/permisos. Corrección: sólo consultar el documento necesario cuando falta ese dato; conserva los fallbacks y permisos.
- Medición de código con DB instrumentada: sin relaciones, 2 consultas/1 documento devuelto; 8 relaciones completas, 2 consultas/9 documentos (antes 18/25); una relación sin nombre ni permisos, 4 consultas/4 documentos. Estos casos no son pruebas del consumo real de la cuenta del usuario ni lecturas facturadas exactas.
- V43 identifica action de POST /suscriptores y acciones seguras GET: login/session/favoritos/autorizados, sin registrar correo/clave ni agregar I/O. Validar sesión/listar autorizados siguen sin Firestore; favoritos sí consulta suscriptor_favoritos (límite 500). Login consulta suscriptores por correo (límite 5) y relaciones de ese suscriptor (límite 100). No son barridos globales.
- Tests LOGIN_CONSUMO_V43, observación, aislamiento suscriptores (24), circuitos suscriptores (8), aislamiento público (43) y sintaxis bundle aprobados.
- Entregar WORKER_COMPLETO_V43.js completo para despliegue MANUAL del usuario. No está desplegado por publicar GitHub. V42 sigue instalado hasta confirmación.
- Registro maestro único recuperado: Guia_Local_Checklist_Maestro.xlsx, Library ID libfile_3c33f82390bc8191a7c62f6966bc5415. Conserva 61 históricos y 3 asuntos de consumo; no crear listados paralelos. Ruta: consumo/trazabilidad → usuario → anunciante → administrador → prueba integrada.
- Incidentes 644 y delta 25 siguen abiertos; no afirmar resueltos por esta reducción de lecturas evitables.
