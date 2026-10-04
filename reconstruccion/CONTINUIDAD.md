# Registro de continuidad — Guía Local Dolores
Actualizado: 4 de octubre de 2026, Argentina. Este registro debe leerse antes de continuar.

## Situación y reglas
- Rama: reconstruccion-total-03oct. No modificar main ni desplegar producción.
- Base de código: 9e549f3eb397dffe2097f2ff52941792431f1946 (V35).
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
| 1 | Carcasa: ciudades, navegación, cargas y caché | Pruebas parciales aprobadas; inventario y cierre de aislamiento pendientes |
| 2 | Anunciantes: listado, tarjetas y ficha pública | Pruebas parciales aprobadas; cierre pendiente |
| 3 | Modificar datos y sedes | Pruebas parciales aprobadas; cerrar inventario anunciante/administrador |
| 4 | Promociones | Corregir guardado parcial y consultas de contexto innecesarias |
| 5 | Eventos | Corregir guardado parcial y consultas de programación en ediciones ajenas |
| 6 | Actividades | Corregir guardado parcial y consultas de horarios en ediciones ajenas |
| 7 | Farmacias | Corregir guardado parcial y consultas/escrituras de participantes intactos |
| 8 | Efemérides | Corregir guardado parcial y comprobar rutas administrativas compartidas |
| 9 | Publicidad existente | Corregir guardado parcial y consultas de media/segmentación en ediciones ajenas |
| Compartido | Suscriptores y correo | Pruebas simuladas aprobadas; inventario de aislamiento y correo real pendientes |

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

## Estado al guardar este registro
Se repitieron el 4/10:
- TEST_FLUJO_EXISTENTE_V35: 8 circuitos aprobados.
- TEST_CARCASA_V32: aprobado, cero lecturas Firestore/cero escrituras en sus casos.
- AUDITAR_HTML_V35: aprobado, 9 HTML / 15 scripts sin Firebase directo.
No hubo nuevas correcciones de código durante estos turnos de aclaración.
No se ha contado todavía el total de acciones existentes. No inventar un número ni una estimación horaria.

## Próxima acción concreta
Comenzar el inventario de Carcasa y Guía desde sus HTML vigentes y el grafo público V12.
Después cerrar Modificar datos siguiendo tanto panel como administración.
Aplicar aislamiento de guardados en los seis módulos pendientes con pruebas de operaciones.
No usar una instantánea KV potencialmente obsoleta como sustituto de validación autoritativa de propiedad o borrado.

## Pruebas reales y continuidad
- Las pruebas técnicas ya existen; la candidatura para pruebas reales queda pendiente del cierre anterior.
- Correo real, credenciales, seed KV y datos reales de prueba requieren entorno controlado. No se probaron en producción.
- Si se corta el chat: recuperar esta rama, leer este archivo y ESTADO_DESPLIEGUE.md, comprobar git log/status y seguir desde el próximo bloque sin rehacer lo aprobado.
- Capturas de /tmp son intermediarios; las evidencias duraderas de navegador están en los artefactos del workflow.
