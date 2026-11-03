# Auditoría de consumos por acción — Gran Hermano
Fecha: 2026-11-03. Estado: diagnóstico inicial con evidencia real histórica y consulta real actual. Sin cambios de producción.

## Qué se mide en cada acción
Una fila por acción humana (abrir, buscar, guardar, borrar, etc.), con las solicitudes externas e internas correlacionadas. Separar: Firestore (lecturas facturables, escrituras, borrados); Worker (solicitudes y CPU); KV (get/put/delete/list); Durable Objects SQL público/administrativo y coordinadores (llamadas, filas leídas/escritas, alarmas); caché (acierto/fallo); solicitud previa OPTIONS; dependencia de otras interfaces. Un campo desconocido = SIN MEDIR, nunca cero. No sumar dos veces una misma operación física.

## Gran Hermano — acciones concretas identificadas
| Acción | Evidencia histórica de producción (Worker 133, 23–24/10/2026) | Decisión |
|---|---|---|
| Buscar anunciante | 6 búsquedas: 18 lecturas KV en total, sin operación Firestore informada | Sin duplicación demostrada; falta separar cada búsqueda |
| Abrir detalle anunciante | 3 aperturas: 51 lecturas KV, 1 escritura KV y 1 consulta Firestore sumadas | Examinar qué resúmenes adicionales se cargan y si ya estaban disponibles |
| Guardar datos de Guía | 4 guardados: por guardado, 1 lectura + 1 escritura Firestore; 7 lecturas, 4 escrituras y 1 borrado KV; 2 llamadas SQL público, 602 filas leídas y 2 escritas | Revisar copias, actualización de ciudad y cargas de 602 filas; NO eliminar sin comprobar dependencias |
| Guardar sin cambios | El controlador documentado retorna antes de /save; cero peticiones de guardado previstas según código v133 | Confirmar en Worker 154 y registros actuales; no confundir ausencia de pedido con cero costo de toda la pantalla |
| Preparar copias de paneles | Interfaz actual advierte lectura completa de colecciones Firebase | No ejecutar automáticamente ni usar como prueba rutinaria |

Fuente: docs/ANALISIS_ACCIONES_GUIA.md, plataforma/granhermano.html (main consultado 03/11/2026). Los datos históricos NO se extrapolan al Worker 154. Falta medir el coordinador y las solicitudes OPTIONS para cerrar el costo completo.

## Consulta actual a Cloudflare — 03/11/2026 18:00–19:35 UTC
Agrupación observability por acción (tráfico real, no una prueba de Gran Hermano):
- publicas: 15 ejecuciones, 30 KV get, 60 filas SQL públicas leídas, 0 operaciones Firestore registradas.
- favoritos: 6 ejecuciones, 12 KV get, 0 SQL público y 0 Firestore registrados.
- perfil: 4 ejecuciones, 6 KV get, 0 SQL público y 0 Firestore registrados.
- session: 1 ejecución, 1 KV get, 0 SQL público y 0 Firestore registrados.
Estos promedios NO prueban duplicación. El conjunto de eventos no cubre todas las rutas y puede omitir procesos no instrumentados.

## Primera tarea de implementación
1. Leer flujo real de cada botón/acción de Gran Hermano en Worker 154 y vincularlo a un ID de acción con cada petición interna.
2. Reutilizar contadores existentes y completar cobertura de coordinadores, llamadas previas OPTIONS, operaciones de Firebase y CPU. No crear consultas a Firestore para auditarlo.
3. Correlacionar logs y resultados por ID; registrar estado de caché y conteos de todas las capas, con origen de evidencia y cobertura.
4. Clasificar cada operación en necesaria, redundante comprobada, eliminable comprobada o pendiente de evidencia; proponer eliminación únicamente con prueba de equivalencia funcional.
5. Medir antes/después sobre la MISMA acción y sin ensayos repetitivos que consuman cuota; comprobar permisos, datos y coherencia de Usuario y Anunciante.

## Límites actuales
No se habilitó ni desplegó telemetría. La telemetría automática de plataforma/telemetria.js está desactivada. El medidor local consumo-v44.js conserva hasta 160 registros del navegador y no representa la cuenta entera. La API de observabilidad entregó agregaciones pero el listado de eventos devolvió error de esquema (requestId faltante); no afirmar trazabilidad individual completa. Aún no se acreditaron costos facturados ni eliminaciones seguras.
