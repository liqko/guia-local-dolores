# Índice único de pendientes 147 — implementación en curso

## Objetivo autorizado (30/10/2026)
En Gran Hermano sustituir las consultas automáticas separadas a moderación normal,
publicaciones bloqueadas, revisión +18 y soporte por **una sola lectura administrativa**
de índice persistente. Navegación entre categorías sobre los datos ya recibidos:
sin nuevas solicitudes Worker/Firestore/KV/SQL. Mutaciones reales actualizan el índice
con la misma garantía de recuperación que los originales.

## Evidencia del estado activo antes del cambio
- Worker activo: 145, fuente obtenida de Cloudflare; el repositorio no conserva
  en la rama principal el artefacto generado login-eventos145.mjs.
- Frontend: abrirApp() llama dashboard, ghRevisionUnificada() y ghCargarSoporteV73().
- ghRevisionUnificada hace GET separados a /superadmin/moderation/pending,
  /superadmin/publications/blocked y /superadmin/adult-review.
- El último de esos endpoints consulta seis colecciones por estado.
- La lectura de /superadmin/support/requests también puede ejecutar cache.put
  si detecta divergencia con sus entradas existentes.
- 30/10: observación de 1 GET por ruta con KV get 10, 10, 14 y 6 respectivamente.
  Son operaciones internas, no personas ni páginas vistas.

## Código entregado en esta rama
- worker/modules/indice-pendientes147.mjs: estructura, actualización determinista
  y proyección por rol; rechaza mostrar un cero si el índice no fue validado.
- tests/indice-pendientes147/run.mjs: invariantes básicos de la estructura.
Este código todavía NO está conectado al Worker ni a Gran Hermano; por sí solo no ahorra cuota.

## Integración imprescindible antes de despliegue
1. Anclar la generación a la fuente exacta de Worker145 y evitar reemplazar código activo
   con versiones anteriores. Mantener journal, recibos y recuperación ya implementados.
2. Definir un snapshot durable por ámbito autorizado, versión y checkpoint de cambios.
   No usar una única caché global que pueda filtrar datos entre administradores locales.
3. En cada mutación real: incluir actualización del índice en el mismo ciclo de
   persistencia/recuperación; idempotencia por identificador de operación; no escribir
   si el estado previo y el nuevo son equivalentes.
4. Incluir: anunciantes, reclamos de titularidad, FREE/VIP, actividades, publicidades,
   promociones, empleo, revisión normal, revisión +18, bloqueados, soporte y acceso.
5. Añadir GET autenticado del índice que verifique rol y ámbito de ciudades.
   Si falta o está desactualizado, devolver SIN_COMPROBAR y facilitar reconstrucción
   controlada. Nunca afirmar cero en falla.
6. Cambiar frontend para una sola lectura del índice al ingresar, mantenerla en memoria,
   filtrar localmente y actualizar en operaciones aprobadas o en Actualizar manual.
   Los detalles ausentes del resumen pueden requerir lectura por demanda.
7. Medir en producción Worker, KV, Firestore, SQL, DO, CPU y escrituras antes/después,
   tanto al abrir GH como al generar y resolver un pendiente. No aceptar una mejora
   de aperturas si encarece las mutaciones o introduce pérdida de datos.
8. Verificar recuperación ante error entre original e índice, permisos locales,
   simultaneidad, cambios de ciudad, revisión doble normal/+18 y cero confirmado.
9. Sólo retirar consultas viejas al certificar equivalencia de listados y permisos.

## Estado
NÚCLEO LOCAL EN RAMA. NO INTEGRADO, NO PUBLICADO, NO VALIDADO EN PRODUCCIÓN.
