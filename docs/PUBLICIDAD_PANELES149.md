# Publicidad: publicación de Gran Hermano y Login sobre Worker149

Fecha: 02/11/2026. Base frontend: main `3d8994f`. Rama: `fix/publicidad-paneles149`.

Autorización: el usuario pidió corregir y publicar Gran Hermano inmediatamente y continuar con Publicidad del Login sin pedir una nueva instrucción. Se integra el cambio preparado147 sobre la versión actual de las páginas, conservando inbox, prestaciones, límites de carga, contactos y ubicación posteriores. No se publica un Worker nuevo.

## Recorrido

- Gran Hermano: habilitación, piezas activas y biblioteca2x; posiciones independientes; modalidad trimestral anticipada o excepción diaria con motivo; fechas; ciudades (manual, provincia, país, todas las habilitadas); Guía/Eventos/Actividades; formatos. Las categorías publicitarias dejan de ser una contratación separada para las reglas147. Un contrato nuevo parte de una ciudad del anunciante y Guía; si no tiene ciudad, exige elegirla. Abrir una ficha no convierte contratos anteriores ni amplía permisos. Los cambios por agrupación territorial también quedan registrados en el formulario para guardarse.
- Login: muestra posiciones y condiciones contratadas; permite seleccionar cobertura/formato dentro del permiso; copiar tags del perfil o cargar propios; acceder al perfil cuando faltan. Puede seleccionar/buscar un evento VIP o actividad y conservar su ID al entrar desde esos módulos. La pieza visual sigue siendo imagen/carrusel/Short. No se implementan precios ni un checkout sin condiciones comerciales definidas.
- Usuario: adaptación del selector de piezas a posiciones por anunciante y alternancia del contenido, con relevancia primero; conserva el recorrido anterior para contratos antiguos. Enlaces a ID de evento/actividad sobre sus paquetes públicos existentes, sin otra consulta para filtrar el destino. Promociones deja de solicitar publicidad.

## Servidor y dependencias

El Worker149 activo se obtuvo y comparó con147 corregido: sus12 bloques de reglas/enlaces/publicidad comparados son idénticos. SHA activo observado: `70a59f187df2533c852c9347f7e6a6fc19a5c8b06b436bf95f08e32597d36f65`. Mantiene validación por servidor de propiedad, permisos, cuotas, cobertura, estado, vigencia y recuperación. Los paneles usan las respuestas y rutas existentes, incluida `publicidad_reglas_version:147` del detalle administrativo. No se modifica código del Worker ni se migra la base de datos durante el despliegue.

Las funciones fuente147 se integraron mediante comparación de tres versiones, no reemplazando archivos con copias antiguas. Los cambios en Eventos/Actividades se limitan a entrar a Publicidad y resolver su destino específico. Anunciantes sólo actualiza la referencia al distribuidor publicitario. Promociones sólo retira la petición de publicidad. No se modifican los cupos de esas funcionalidades.

## Pruebas

- `node tests/publication-integrity.mjs`: navegación y scripts de páginas públicas PASS.
- `node tests/publicidad149/logic.cjs`: contratos, fechas, excepción diaria, posiciones frente a piezas, relevancia/singular/plural y sintaxis de scripts afectados PASS.
- `node tests/publicidad149/browser.cjs`: Chromium local a390/1280px. Gran Hermano configura3posiciones/5piezas sin mostrar Promociones. Contratos nuevos arrancan con una ciudad y Guía; abrir una configuración anterior no la convierte; las acciones del selector registran el cambio. Login limita la cobertura, reutiliza tags, selecciona y preselecciona un evento por ID. Guardar una pieza sin cambios envía0peticiones. Sin desbordamiento horizontal. Evidencia `docs/evidencias/publicidad149-browser.json`. Datos locales de prueba, sin mutaciones reales.
- Pruebas previas sobre una copia del Worker149: Publicidad, permisos, creación, guardado equivalente, paquetes persistentes, enlaces a Evento/Actividad, pausa y recuperación143: PASS. No se repiten porque este despliegue no modifica el servidor.

## Consumos y límites

Los nuevos campos, filtros de selección y agrupaciones territoriales reutilizan datos cargados. No agregan consultas al cambiar una opción. Gran Hermano conserva la ruta de guardado con delta/revisión; si no hay cambios, no envía petición. Login conserva la misma protección para las piezas y ahora evita confirmar una selección activa idéntica. Los tags consultan el perfil sólo si se pide copiarlos y no está cargado; los destinos cargan el módulo necesario sólo si hace falta, reutilizando su promesa existente. No hay sondeos nuevos ni contadores persistentes nuevos.

Gran Hermano añade un recurso estático de3087bytes; Login ese recurso y otro de4336bytes en la versión integrada. Son Hosting/CDN, no operaciones Firestore ni Worker. La retirada del pedido de publicidad en Promociones evita esa solicitud. Transferencia real, lecturas/escrituras facturadas al guardar un contrato real, CPU y consumo total del usuario autenticado siguen sin medirse en esta publicación; no se afirma ahorro global ni cero consumo. El Worker conserva su instrumentación para esa medición correlacionada posterior.

Sigue sin cerrarse la presentación permanente de todos los anuncios nivel6: se conserva el máximo de2espacios reservados del recorrido general, sin inventar un carrusel. Los límites de cambios mensuales existentes no se cambian a un ciclo del día5 por esta publicación. No se declara cerrado todo el módulo publicitario.

## Despliegue y reversión

Publicar frontend mediante el flujo existente de main a Firebase Hosting, verificar éxito de la ejecución y comparar los bytes publicados con los locales en las9rutas afectadas. Antes del despliegue se conserva la base y el commit del cambio. No restaurar todo main para revertir: revertir exclusivamente este commit, conservando trabajos concurrentes. Si se configuraron contratos147 durante su uso, el Worker sigue admitiéndolos; una reversión de la interfaz no debe declararse soporte completo del editor antiguo para esos contratos.

Estado: PUBLICADO Y VERIFICADO. PR39 fusionado en main, commit35b295f54e168d66cdc338fdff00a671c2b4b53d. Firebase Hosting terminó correctamente (run41538782414, job125597298105). A las19:38 de Argentina del02/11/2026 se comprobaron las9rutas afectadas: HTTP200 y bytes idénticos a los probados. Evidencia en docs/evidencias/publicidad149-publicacion.json. No se modificó el Worker ni contratos reales; la medición de guardados reales y del usuario autenticado sigue pendiente.
