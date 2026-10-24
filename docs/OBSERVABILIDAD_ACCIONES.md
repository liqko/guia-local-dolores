# Registro automático de acciones y consumos

## Implementación
Funcionalidad transversal de observabilidad, solicitada expresamente por el usuario el 24/10/2026. Interfaces: Usuario, Anunciante y Administrador. Visor independiente `plataforma/observabilidad.html`, accesible desde el enlace «Consumos y errores» en Gran Hermano; no requiere simulación ni activación local. Lectura reservada a SUPERADMIN_PRINCIPAL mediante verifyAdmin vigente, con control de revocación existente.

Base: commit 92c2e3c0b0c1b4e5ee6f6daf2ca338692e42973a del frontend y Worker activo obtenido por Cloudflare, versión declarada 136. El archivo base es una instantánea inmutable de esa fuente observada, no la versión135 del repositorio. SHA256 de la base: 9b4530f90c33c4187023cb4bad0d2e9698d0545bbd3c341554568e70493d7bae. El generador agrega el módulo de observabilidad en la ruta original sin reescribir funciones de negocio ni cambiar las claves de datos existentes. Archivo generado: `worker/login-observabilidad137.mjs`.

## Circuito
- Todas las páginas HTML de `plataforma/` incluyen telemetria.js antes de los otros scripts. Acciones de controles, navegación inicial, recursos y errores técnicos se envían en lotes de hasta35 registros cada5 segundos y al ocultar/salir. Reintentos limitados y deduplicación por UUID. No se capturan valores de formularios, textos escritos, cuerpos de API, credenciales, IP ni identidades.
- La cabecera X-GLD-Trace vincula acción, vista y sesión aleatoria a las solicitudes API. No cambia URL, parámetros ni cuerpo del negocio. Puede agregar preflight CORS; éstos se registran como solicitudes Worker sin acción atribuida y se permite caché de preflight600 segundos.
- El Worker conserva los contadores técnicos propios de cada ejecución y distingue ejecución interna de petición entrante para no duplicar Worker requests. Registra también HTTP fallidos y peticiones de clientes sin JavaScript (éstas quedan sin asociación a clic).
- Se reutiliza GLD_PUBLIC_CACHE exclusivamente como namespace de objetos: los objetos `telemetry-v1:YYYY-MM-DD` tienen una base SQLite separada de la de cada ciudad o coordinador. Su constructor y alarma se desvían al módulo nuevo; los objetos de negocio conservan sus rutas y tablas. No hay migración ni lectura/escritura de documentos Firestore por almacenar telemetría.
- Un registro por ejecución de servidor y lotes separados de navegador. Acciones y recursos del navegador son evidencia de cliente; contadores de servidor son evidencia de servidor. Etiquetas de acción son no confiables a efectos de seguridad. No se usan para conceder permisos.
- Retención máxima72h desde el inicio del día UTC: las últimas acciones de un día pueden conservarse menos. Alarma elimina solamente el objeto de observabilidad. Límite150000 secuencias por día,6000 eventos/minuto en actor y4000 eventos de navegador/minuto. Saturación o fallas emiten gld_telemetry_gap; no se declara cobertura total.
- Consulta paginada de los últimos300 registros, lectura de registros anteriores y actualización incremental. Filtra interfaz, errores, Firestore, SQL y mediciones faltantes. Señala desviación de lecturasSQL por acción/página/interfaz sólo con al menos5 muestras y valor superior al triple de la mediana, con mínimo10filas. Es una señal para investigar, no una falla demostrada.

## Consumo del propio medidor
Registrar tiene costo: cada persistencia agrega una llamada al DO y sus filasSQL físicas; cada envío del navegador agrega una solicitud Worker. Esos costos se publican en logs gld_telemetry_overhead, separados de contadores del negocio. El visor muestra el costo de su consultaSQL. La autorización del visor también puede usar KV; su consumo no está aún desglosado en el visor. La alarma tiene consumo propio. No afirmar que el medidor es gratuito ni que su propio consumo ya está íntegramente conciliado.

## Límites explícitos, sin convertirlos a cero
- Atribución automática de clic/recurso por tiempo: es aproximada frente a tareas diferidas o concurrentes. La función gldTelemetry.action permite etiqueta explícita; no se afirma causalidad perfecta para cada await o temporizador.
- Cubre documentos plataforma instrumentados. El contenedor exterior Jimdo/Vercel no se instrumenta desde sus iframes; requiere incorporar el mismo capturador en el documento exterior. El visor dice ese alcance.
- PerformanceResourceTiming no revela bytes de servidores externos sin Timing-Allow-Origin. Sus ceros no se presentan como consumo cero. No reconstruye recursos que el navegador no exponga.
- CPU real, duración facturableDO y almacenamiento persistente se mantienen null. El código de negocio no obtiene esos valores del proveedor. No sustituir con duración de red, performance.now o número de filas.
- Conserva contadores disponibles del Worker136, no convierte llamadasFirestore en lecturas facturadas. Escrituras facturadas quedan null cuando el contador original no las conoce. Operaciones directas del coordinador/alarma no cubiertas por los contadores siguen faltando; no hay cierre integral de facturación.
- No se configuraron tarifas ni plan real: muestra unidades técnicas, no importes monetarios inventados.
- Reintentos/cierre abrupto pueden dejar lotes sin entregar; los reportes del navegador no son garantía de recolección universal. No reconstruye actividades anteriores a la instalación.

## Verificación realizada
`node worker/observabilidad/build.mjs`; `node --check worker/login-observabilidad137.mjs`; `node --test tests/observabilidad/*.test.mjs`:20 comprobaciones locales aprobadas. Cubren normalización del HAR público real (0Firestore/4KV/985SQL), preservación de cuerpos/cabeceras/URL, controles sin backend, no captura de valores, errores saneados, permisos, deduplicación, reapertura SQLite, cursores, expiración y aislamiento de fallo del medidor. AdaptadorSQLite de prueba verifica conducta, no costosCloudflare. `node tests/publication-integrity.mjs`: ambas páginas verificadas.

La prueba con navegador Chromium local no pudo iniciarse: el entorno carece del ejecutable y la descarga oficial devolvió un archivo incompleto. No se presenta el arnésJS como una ejecución de navegador ni como consumo real. Falta comprobación en runtimeCloudflare y navegador real del nuevo visor/capturador.

## Publicación y reversión
1. Construir el Worker y verificar que producción sigue siendo136. Si cambió, integrar sobre la nueva fuente antes de publicar.
2. Publicar137 conservando bindings del Worker136. No hace falta una migración de namespace: los nuevos objetos usan el binding existente y un prefijo distinto. Confirmar CORSX-GLD-Trace y rutas /telemetry/events y /superadmin/telemetry.
3. Sólo entonces publicar frontend. Hacerlo antes rompería CORS en clientes nuevos. GitHub main despliega Firebase automáticamente; no fusionar antes de completar paso2.
4. Comprobar uso real Usuario/Anunciante/GH sin inventar cuentas ni mutar datos originales sólo para medir. Verificar lectura anónima401, administradorlocal403 y principal autorizado; acciones locales y red, asociación temporal, recursos ocultos y error aislado. Medir costo propio antes de afirmar cobertura o ahorro.
5. Reversión: retirar capturador del frontend primero, restaurar Worker136 después. No borrar datos originales de negocio. GLD_TELEMETRY_ENABLED=0 detiene persistencia, pero no retira el script del navegador ni sus intentos de envío.

## Estado
Código implementado y20 pruebas locales aprobadas; NO instalado ni validado en producción. La conexiónCloudflare disponible sólo permite observar; el navegador de publicación muestra inicio de sesión. Publicación pendiente de acceso autenticado. No reemplaza ni cierra el estadoGuía135 ni la auditoríaCiudades.

Fuentes técnicas: https://developers.cloudflare.com/durable-objects/api/id/ y https://developers.cloudflare.com/changelog/post/2026-03-15-durable-object-id-name/ (ctx.id.name también en alarmas). No se usa endpoint ni credencial nueva para facturación.
