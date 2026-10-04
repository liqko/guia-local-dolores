# Registro de continuidad — Guía Local Dolores
Actualizado: 4 de octubre de 2026, Argentina. Este registro debe leerse antes de continuar.

## Situación y reglas
- Rama: reconstruccion-total-03oct. No modificar main ni desplegar producción.
- Base histórica: 9e549f3eb397dffe2097f2ff52941792431f1946 (V35).
- Avance V36 publicado: 16ec4170e40346e0eac9c77051fce1532f95d4ba.
- Código V37 publicado: 77d3a01f369bda3138dc1d9df09a424894f9c5fc.
- CI de ese código aprobado: https://github.com/liqko/guia-local-dolores/actions/runs/37210400241 (incluye aislamiento y tres pruebas de navegador).
- Worker vigente: worker/app-main-v35.js; público V12, panel V15, administración V11.
- La reconstrucción NO está cerrada: las pruebas anteriores no acreditan aislamiento de todas las operaciones.
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

## Hallazgo que impide declarar el cierre
El frontend ya prepara cambios parciales, pero varios guardados del backend todavía:
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
Aplicar aislamiento de guardados en los seis módulos pendientes con pruebas de operaciones.
No usar una instantánea KV potencialmente obsoleta como sustituto de validación autoritativa de propiedad o borrado.

## Pruebas reales y continuidad
- Las pruebas técnicas ya existen; la candidatura para pruebas reales queda pendiente del cierre anterior.
- Correo real, credenciales, seed KV y datos reales de prueba requieren entorno controlado. No se probaron en producción.
- Si se corta el chat: recuperar esta rama, leer este archivo y ESTADO_DESPLIEGUE.md, comprobar git log/status y seguir desde el próximo bloque sin rehacer lo aprobado.
- Capturas de /tmp son intermediarios; las evidencias duraderas de navegador están en los artefactos del workflow.
