# Tarjetas de anunciantes: descargas de imágenes142

Drive se conserva. No migración, reducción de resolución, transformaciones Cloudinary, copias a otro alojamiento ni publicidad. Logos/galerías reciben src sólo al entrar en proximidad160px visible mediante IntersectionObserver. En navegadores sin observer se conserva carga inmediata. Modal sigue usando URL original. HTML conserva fallback nativo loading=lazy si helper no carga. Re-render desconecta nodos anteriores. URLs Instagram resueltas y solicitudes pendientes se reutilizan dentro de la página; fallos permiten reintento posterior.

Registra fallos localmente en consola y gld_card_image_errors_v142, máximo50URLs por página. No envía telemetría ni realiza sondeos. No es monitoreo global de otros visitantes, ni garantiza anticipar una restricción de Drive. Datos públicos de imágenes se guardan solamente en navegador del visitante; disponibilidad de localStorage no es obligatoria.

Ahorro: evita descargar imágenes que no se llegan a ver. NO reduce bytes de cada original. Ver todas puede transferir mismo total. No porcentaje de ahorro real confirmado. Referencia histórica24/10:28solicitudes de27imágenes,15.699.475bytes de transferencia, sin publicidad. Medición posterior real requiere captura comparable.

Pruebas de lógica locales y Chrome real en GitHub Actions aprobadas: run40379913935,job121773038748. Se comprobó carga diferida vertical/horizontal, URL original, deduplicación, reintentos tras fallo y registro local sin informe de red. Solicitudes de imagen controladas en prueba: no medición de bytes de producción. Navegador local no disponible; se usó Chrome preinstalado del runner. La primera prueba de fallo usaba SVGválido conHTTP404 que Chrome mostraba; se corrigió fixture a fallo de red efectivo, sin cambiar producto para ocultarlo. No modificar Worker ni activar nuevos servicios. Navegador aprobado; reversión restaurando HTMLprevio.

El helper agrega una solicitud de archivo estático pequeño a Firebase Hosting por carga (sujeta a caché del navegador); no lecturaFirestore ni consultaWorker. No se afirma costo/transferencia totalcero de la página.
