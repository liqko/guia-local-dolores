# GUÍA LOCAL — ESTADO ÚNICO DE AUDITORÍA

Este archivo es el punto de continuación obligatorio de la auditoría de consumos. Se ACTUALIZA EN EL MISMO LUGAR; no se crean versiones, inventarios ni informes de avance adicionales. Para reanudar en otro chat o Work: leer primero este archivo y el Worker enlazado, y continuar sin reiniciar la auditoría.

## Objetivo fijo
Auditar y optimizar, una acción a la vez y de punta a punta, las tres interfaces: Usuario final, Anunciante y Gran Hermano. Medir operaciones de Cloudflare (Worker, KV, Durable Objects), Firebase/Firestore y cualquier otro servicio, con cuota y costo real por acción; identificar y corregir duplicaciones, comprobar ahorro. Sin datos medidos, marcar NO COMPROBADO.

## Estado actual — 2026-11-04
- **Acción vigente:** 001 — INGRESAR, tres interfaces.
- **Estado:** ABIERTA. No comenzar la 002.
- **Problema:** al ingresar a Gran Hermano, el resumen de cumpleaños recorría repetidamente claves KV.
- **Corrección incorporada:** el resumen se conserva temporalmente, con invalidación al modificar cumpleaños. Comprobación aislada: segunda consulta, 0 listados adicionales; modificación de cumpleaños, 1 reconstrucción.
- **Worker:** versión 155, archivo único en rama `feature/gran-hermano-roles-permisos-20261103`: `worker/worker155_roles_permisos.txt`; commit del ajuste `9c6890121d6bf5df58bd624c124a978c6acff1c9`.
- **Despliegue:** NO realizado. No afirmar que el ahorro esté medido en producción.
- **Pendiente para cerrar 001:** desplegar y verificar consumos reales por ingreso completo en las tres interfaces; correlacionar una pulsación con todas las solicitudes; revisar escrituras/lecturas y operaciones facturadas; validar caché e invalidación de cumpleaños; corregir más hallazgos de la 001 si los hubiera.
- **Dato importante:** usuario y anunciante comparten `POST /suscriptores` (`action=login`), sin marcador de origen en métricas actuales; Gran Hermano llama `POST /superadmin/session/login`, luego `GET /superadmin/dashboard` y `GET /superadmin/inbox` para cargar pantalla. Las dos últimas son funciones de la pantalla, no validación de credenciales; no representan datos duplicados idénticos.

## Regla invariable de ejecución
1. Leer este archivo antes de continuar, aunque se cambie de chat o modo.
2. Trabajar SOLAMENTE en la acción vigente. Si surge un fallo, corregirlo como subproblema de la misma acción.
3. Tras cada cambio, actualizar únicamente este registro y el archivo único del Worker; no crear archivos numerados transitorios.
4. No cerrar acción hasta haber verificado funcionalidad, todas las operaciones y consumo por pulsación; distinguir prueba aislada, código guardado y producción desplegada.
5. Al cerrar una acción, registrar resultado y ahorro comprobado en una línea en `Acciones cerradas`; recién entonces cambiar `Acción vigente` a 002, luego 003, etc.
6. Al responder al usuario, dar solamente: acción actual, qué se corrigió, si está probado/desplegado, y siguiente tarea concreta. No trasladar informes técnicos.
7. Un cambio no despliega por sí solo el Worker. El número 155 se conserva durante la revisión; solo pasar a 156 cuando se cierre la versión conforme al acuerdo.

## Acciones cerradas
Ninguna todavía.

## Verificación de continuidad — 2026-11-04
- **Acción 001 sigue ABIERTA.** Intervención de solo lectura sobre producción; no se desplegó ni modificó el Worker.
- GitHub: archivo único `worker/worker155_roles_permisos.txt` en `feature/gran-hermano-roles-permisos-20261103`, blob `5cd3addb093bd714e484614ecffc4a49b66fbbea`. Conserva caché de cumpleaños por día con TTL 300 s e invalidación al cambiar fecha/estado o crear un cumpleaños activo.
- Cloudflare: Worker `login`, última modificación declarada `2026-11-03T23:39:11.240947Z`. Código recuperado directamente del despliegue: **NO contiene** `BIRTHDAY_SUMMARY_CACHE_V155`; el resumen sigue enumerando KV en cada consulta. La cabecera dice 155 pero el reporte principal emite `worker_version:154` y la raíz `version:147`. No identificar el despliegue por su cabecera solamente.
- Línea base observada: consulta de las 24 h anteriores a esta intervención, ruta exacta `/superadmin/dashboard`: 7 observaciones, 65 listados KV, 42 lecturas KV y 0 lecturas/escrituras Firestore según los contadores emitidos; versión reportada 154. Son agregados de esa ruta, **no** costo por pulsación ni cantidad atribuida exclusivamente a cumpleaños, ni comprobante de facturación.
- Segunda consulta (2026-11-03T13:15:00Z a 2026-11-04T12:24:50.412Z): `/suscriptores`, `action=login`, estado 200: 3 observaciones, 60 lecturas KV, 0 listados/escrituras KV y 0 lecturas/escrituras Firestore reportadas. No permite distinguir Usuario de Anunciante. Hallazgos adicionales a correlacionar con INGRESAR: 9 respuestas 500 de `perfil` y 10 de `favoritos`; no se atribuyen al ingreso sin trazas.
- Limitaciones comprobadas: consulta de eventos individuales falla en el conector por validación de `$workers.requestId` ausente; las agregaciones sí responden. No hay herramienta de despliegue en el conector de Cloudflare disponible. El navegador conectado devuelve “Browser access requires the originating browser context”; no se pudo usar esa sesión para desplegar ni ejecutar ingresos autenticados. No hay acceso directo a métricas/facturación de Firebase/Firestore en las herramientas disponibles. Costo monetario integral y ahorro: **NO COMPROBADOS**.
- **Próximo paso exacto:** recuperar acceso al navegador conectado desde ChatGPT abierto con su extensión; comparar nuevamente el código activo con el archivo único de GitHub para evitar sobrescribir desarrollo concurrente; verificar impacto y desplegar el ajuste pendiente; ejecutar un ingreso controlado por interfaz y un segundo ingreso, correlacionando solicitudes y contadores; comprobar invalidación de cumpleaños con cuenta autorizada y revisar los 500 de perfil/favoritos si forman parte de la carga inicial. Contrastar contadores con consumo de proveedor antes de cerrar 001.
- Registro actualizado a 2026-11-04T12:25:17.768Z; no iniciar Acción 002.
