# Farmacias de turno — reconstrucción modular (opción 2)

**Inicio:** 24/10/2026. **Estado:** diagnóstico del circuito + núcleo modular de prueba local. **No desplegado.**

## Alcance completo
1. **Administrador / Gran Hermano:** `TURNOS_FARMA` en `plataforma/granhermano.html`; habilitación y cobertura territorial por ciudades o todas las ciudades. **Hallazgo:** no aparece configurado un cupo numérico específico para turnos; confirmar si debe existir, sin inventarlo.
2. **Anunciante:** `plataforma/login.html`; consulta `/farmacias` con `getPanelData`, selección de sedes, ciudad, inicio, duración, cantidad simultánea, orden y guardado `guardar_ciclo`.
3. **Firestore:** `anunciantes_administracion`, `anunciantes`, `anunciantes_sedes`, `farmacias_ciclos` y `farmacias_ciclo_sedes`.
4. **Worker:** `allowedFarmCities2`, `farmaciasPanelDataV3`, `farmSaveCycleV3`, `syncFarmCyclePreparedV2`, `getFarmCityV2`, `farmTurnosPublicV3`.
5. **Usuario:** funcionalidad Farmacias de turno presentada en el contenedor visual Carcasa (`plataforma/carcasa.html`); consulta `GET /farmacias?action=turnos&ciudad_id=...&fecha=...`.

## Hallazgos en Worker actual (fuente revisada: copia local V137)
- `farmaciasPanelDataV3` busca farmacias en `guide:city:v1:<ciudad>`, aunque la selección debe derivar del catálogo y las sedes pertinentes de Firestore/preparación propia de Farmacias.
- `syncFarmCyclePreparedV2` y `prepareFarmSedes` consultan `guide:city:v1:<ciudad>` para nombres.
- `getFarmCityV2` consulta Guía y puede volver a escribir el paquete Farmacias durante una visita pública.
- `farmSaveCycleV3` llama siempre a sincronización incluso cuando el guardado no altera datos. **Debe decidirse por cambio efectivo de datos, no por la presencia de una solicitud.**
- La comprobación de ciudades `allowedCityIds.length && ...` no restringe cuando la lista autorizada está vacía. Hay que distinguir configuración global explícita de ninguna ciudad asignada y negar por defecto.
- `rebuildFarmAllV2` lee colecciones enteras: usar únicamente para reconstrucción administrativa excepcional, no para tráfico ni guardados ordinarios; comprobar limpieza de paquetes antiguos y consistencia de nombres.
- El modelo actual de panel identifica farmacias por etiquetas/categoría o nombre, incluyendo heurísticas. La reconstrucción requiere un criterio validado para reconocer quiénes pueden participar.

## Arquitectura de destino
- Gran Hermano establece permisos territoriales/funcionales (y cupos sólo si están realmente definidos).
- Anunciante administra ciclos a través de sesión autorizada; se valida también pertenencia territorial, existencia de sedes y permisos efectivos.
- Firestore mantiene la fuente de verdad, sin reutilizar paquetes de Guía para armar información Farmacias.
- El módulo Worker procesa mutaciones y publica el paquete propio `farmacias:city:v3:<ciudad>` cuando cambian datos relevantes.
- Usuario lee únicamente el paquete preparado de Farmacias. La ruta de lectura no tiene escritura KV ni acceso a Firestore o a Guía.
- Los cambios de nombre, contacto o domicilio de una sede deben invalidar/actualizar el paquete de Farmacias aunque no se edite un ciclo.

## Implementado y probado hoy
- Prototipo fuente: `farmacias-core.mjs` (archivo local de trabajo, **no integrado al Worker**).
- Archivo de pruebas: `farmacias.test.mjs`.
- **9/9 pruebas de lógica locales pasadas:** ciudad autorizada, ciudad denegada, funcionalidad denegada, ausencia de ciudades no implica acceso global, nombres desde datos fuente, sede de ciudad ajena denegada, lectura pública con un get KV y cero writes **en mock**, cero escrituras para paquete sin cambios, una escritura para paquete cambiado **en mock**.
- **Consumo real Cloudflare/Firebase de este prototipo:** SIN MEDIR. No hay afirmación de ahorro en producción.
- **Estado de la plataforma instalada:** SIN CAMBIOS; no se desplegó ni modificó el Worker.

## Trabajo pendiente antes de instalar
1. Reemplazar descubrimiento de farmacias en panel por datos Firestore y un criterio de elegibilidad explícito; verificar que el administrador de turnos puede gestionar sedes de terceros dentro del territorio habilitado.
2. Conectar validaciones y límites del administrador con acciones del anunciante. Resolver denegación cuando ciudades configuradas están vacías y aplicar rol/permisos coherentes tanto a consultas como a cambios.
3. Completar operaciones de creación, edición, bajas, cambios de ciudad, concurrencia e idempotencia con sincronización/rollback apropiados.
4. Integrar actualización de paquete al cambiar sedes o anunciantes; estudiar cambios por fecha y posibilidad de paquetes obsoletos.
5. Mantener API `/farmacias` compatible con el formulario y la vista pública; probar cálculo de turnos en fechas reales y zonas horarias.
6. Probar el circuito extremo a extremo en entorno no productivo; medir **consumos reales** por acción, separados por servicio y unidad. Sólo después preparar candidato único de Worker y someter a autorización de despliegue.

**Regla de continuidad:** el próximo paso es resolver el catálogo de sedes y el contrato de autorización en el panel del anunciante. No corregir otros módulos por iniciativa propia.
