# GUÍA LOCAL — ESTADO ÚNICO DE AUDITORÍA

Este archivo es el punto de continuación obligatorio de la auditoría de consumos. Se ACTUALIZA EN EL MISMO LUGAR; no se crean versiones, inventarios ni informes de avance adicionales. Para reanudar en otro chat o Work: leer primero este archivo y el Worker enlazado, y continuar sin reiniciar la auditoría.

## Objetivo fijo
Auditar y optimizar, una acción a la vez y de punta a punta, las tres interfaces: Usuario final, Anunciante y Gran Hermano. Medir operaciones de Cloudflare (Worker, KV, Durable Objects), Firebase/Firestore y cualquier otro servicio, con cuota y costo real por acción; identificar y corregir duplicaciones, comprobar ahorro. Sin datos medidos, marcar NO COMPROBADO.

## Estado actual — 2026-11-03
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
