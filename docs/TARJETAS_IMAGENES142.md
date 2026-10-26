# Tarjetas de anunciantes: descargas de imágenes142

Drive se conserva. No migración, reducción de resolución, transformaciones Cloudinary, copias a otro alojamiento ni publicidad. Logos/galerías reciben src sólo al entrar en proximidad160px visible mediante IntersectionObserver. En navegadores sin observer se conserva carga inmediata. Modal sigue usando URL original. HTML conserva fallback nativo loading=lazy si helper no carga. Re-render desconecta nodos anteriores. URLs Instagram resueltas y solicitudes pendientes se reutilizan dentro de la página; fallos permiten reintento posterior.

Registra fallos localmente en consola y gld_card_image_errors_v142, máximo50URLs por página. No envía telemetría ni realiza sondeos. No es monitoreo global de otros visitantes, ni garantiza anticipar una restricción de Drive. Datos públicos de imágenes se guardan solamente en navegador del visitante; disponibilidad de localStorage no es obligatoria.

Ahorro: evita descargar imágenes que no se llegan a ver. NO reduce bytes de cada original. Ver todas puede transferir mismo total. No porcentaje de ahorro real confirmado. Referencia histórica24/10:28solicitudes de27imágenes,15.699.475bytes de transferencia, sin publicidad. Medición posterior real requiere captura comparable.

Pruebas de lógica locales aprobadas. Prueba de navegador Playwright pendiente en GitHub Actions: navegador local no disponible y su descarga no pudo completarse; no se presenta como aprobación del navegador. No modificar Worker ni activar nuevos servicios. Desplegar sólo tras aprobación de navegador; reversión restaurando HTMLprevio.
