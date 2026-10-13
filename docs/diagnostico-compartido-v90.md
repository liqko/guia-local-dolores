# Registro compartido B90

El administrador principal activa Pruebas privadas y pulsa Compartir registro. El servidor guarda una copia de hasta 160 filas en KV y devuelve un enlace aleatorio de 256 bits válido por una hora. Es una copia explícita, no sincronización automática. Actualizar enlace envía las filas actuales a la misma URL y conserva el vencimiento original. Revocar enlace elimina esa copia de KV. No usa Firestore y no activa mediciones en visitantes normales.

La respuesta compartida muestra únicamente campos de diagnóstico permitidos. No incluye cuerpos de solicitudes, cabeceras, credenciales, usuario propietario ni claves de caché. Conserva cero versus falta de medición. Consultas y documentos retornados no son el contador facturado de Firebase. El enlace permite solo GET; no sirve como sesión de administrador. Crear/actualizar/revocar exige sesión vigente del principal y propiedad del registro. El token del enlace se oculta en las trazas del Worker. HTML escapa texto y excluye scripts, marcos y referencias externas; respuestas sin caché ni indexación.

Rutas: POST /superadmin/diagnostics/share con action create/update/revoke; GET /diagnostics/shared/TOKEN (HTML) y ?format=json. KV diagnostics:share:v90:TOKEN con TTL y comprobación de expiración al leer. KV puede tardar unos segundos en propagar la copia o revocación entre regiones.

Instalar WORKER_COMPLETO_V90.txt completo en el Worker habitual conservando bindings y secretos. La interfaz se publica desde GitHub/Firebase. B90 incluye B89 y las correcciones previas; no cambia cuotas, registros comerciales ni circuitos de publicación.

Verificación: compartición, sanitización, solo lectura, actualización de misma URL, revocación por propietario, vencimiento y cero tráfico Firestore mediante fetch externo prohibido. Regresión de sesión, publicación/reglas, soporte y límites Promos aprobada. Prueba UI simula crear/actualizar/revocar. TypeScript 5.9.3: cero errores, advertencias y declaraciones sin uso; 995 sugerencias opcionales, por debajo del límite del editor. Despliegue manual y medición real pendientes.
