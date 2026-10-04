# Reconstrucción total — V35 (continuación de V34)

**NO DESPLEGAR TODAVÍA.** Rama: `reconstruccion-total-03oct`. No modificar `main`.

## Base verificada

V31: commit `203de30190ff69d8ced0bff67942e89d1541d160`.
V32: commit `c5a231281196ebd0bccbc8f14880ee212a73d96e`.
El Worker vigente es `worker/app-main-v35.js`, con rutas públicas V12,
panel V15 y administración V11. V33 corrige los módulos compartidos de ese grafo.

## Interfaces vigentes para revisión

- Carcasa: `plataforma/carcasa-territorio-v3.html`.
- Guía central: `plataforma/anunciantes-publico-v4.html`.
- Suscriptores: `plataforma/suscriptores-v3.html`.
- Panel anunciante: `plataforma/login-modular-v11.html`.
- Gran Hermano: `plataforma/granhermano-v2.html`.
- Promos/Eventos/Actividades: `plataforma/promos-public-v1.html`,
  `plataforma/eventos-public-v1.html`, `plataforma/actividades-public-v1.html`.
- Farmacias: `plataforma/farma-turnos-public-v1.html`.

La Carcasa V3 abre los archivos reconstruidos de su propia carpeta; no mezcla
los módulos anteriores de producción. Las direcciones del Worker siguen siendo
las previstas para el despliegue posterior. No se conectó producción a estas interfaces.

## Correcciones V32

- Guía y catálogos públicos de Carcasa usan `/guide` y `/catalogs/public/guide`.
- Promos siempre incluye `ciudad_id`.
- Eventos en el iframe de Guía genera su URL con `URL/searchParams`;
  antes concatenaba `&ciudad_id` sin un signo `?` y la ruta devolvía 404.
- Promesas y cachés auxiliares separadas por ciudad, con deduplicación de llamadas.
- Las respuestas fallidas no se guardan y permiten reintentar.
- Las relaciones de actividades/acciones/nodos preparadas dentro de cada sede
  se conservan durante la hidratación de las tarjetas.
- La Guía reconoce insignias booleanas del Worker además del valor histórico `x`.
- El timeout de Carcasa no muestra error si el módulo ya terminó de cargar.
- Nuevos prefijos de caché evitan recuperar los paquetes del circuito anterior.

## Validación

`node reconstruccion/auditoria/TEST_CARCASA_V32.mjs` ejecuta funciones extraídas
de ambas interfaces contra el entrypoint real V31 con KV de prueba: Guía,
catálogos, Eventos, Promos y Actividades, dos ciudades, deduplicación,
reintentos, relaciones, insignias y timeout. Bloquea llamadas externas y
escrituras: las lecturas probadas no acceden a Firestore ni escriben KV.

Las auditorías previas y la prueba de rotación de Farmacias se conservan.
El workflow V32 ejecuta estas verificaciones al subir cambios de reconstrucción.

## Correcciones y pruebas V33

- Duplicar un evento conserva las instancias del original; cada copia obtiene IDs
  nuevos. Altas/ediciones devuelven la programación realmente guardada.
- El alta de Promos genera su propio ID y rechaza un ID de edición recibido.
- Reanudar/renovar Actividades valida el cupo y la habilitación antes de escribir.
- Las lecturas públicas de Actividades filtran también las vencidas desde KV;
  no necesitan una nueva mutación para dejar de mostrarlas.
- Guardar Publicidad respeta el máximo de piezas guardadas; editar un ID inexistente
  devuelve error y no crea una pieza por accidente.
- Efemérides normaliza `MÓVIL`, conserva `ULTIMA`, valida fechas reales y comprueba
  el permiso territorial del contenido original además del destino de una edición.

`TEST_MUTACIONES_V33.mjs` prueba **15 circuitos**: Promos, Eventos VIP/FREE,
Actividades, Publicidad y Efemérides. Las mutaciones pasan por las rutas privadas
reales con sesiones HMAC de prueba; el reflejo público se consulta en el Worker
V33. Firestore y KV usan datos aislados en memoria: no se tocó producción.
Se comprueban alta/edición/pausa/reanudación/baja, moderación, cambio de ciudad,
cuotas, permiso, límite diario y conservación de programación original.
La prueba de intento de sobrescritura de Promo también llama directamente al módulo.

El workflow V33 corre las auditorías anteriores, la integración de Carcasa,
Farmacias, estos 15 circuitos y los 98 archivos del grafo efectivo del Worker.

## Correcciones y pruebas V34

- Las rutas de Suscriptores preservan el cuerpo de la petición al pasar entre módulos:
  favoritos, sesión y cambio de contraseña ya alcanzan su acción correcta.
- El puente confirma los códigos de correo y el Worker sincroniza verificación o
  contraseña mediante una actualización puntual. Código incorrecto no escribe.
  Se envía el secreto servidor según el contrato histórico y hay timeout de 15 segundos.
- Recuperación, cambio de contraseña y baja revocan sesiones mediante estado en KV;
  comprobar una sesión revocada no agrega lecturas Firestore.
- Suscriptores V3 reconoce los nombres visibles del catálogo territorial y abre
  el formulario de verificación cuando una cuenta pendiente intenta ingresar.
- La Guía móvil incluye padding y borde dentro del ancho del buscador y paginador;
  evita que queden recortados dentro del iframe.
- Eventos inicializa la ciudad antes de construir la URL de publicidad. El orden
  anterior detenía el JavaScript y dejaba Carcasa bloqueada en “Cargando Eventos”.

`TEST_SUSCRIPTORES_V34.mjs` prueba ocho circuitos con rutas reales y datos aislados:
registro/login, comercios autorizados, favoritos, ciudad/perfil, verificación,
recuperación, cambio de clave, eliminación y fallos del puente. Comprueba la revocación tras recuperación.
`TEST_VISUAL_V34.mjs` ejecuta Chromium: registro, código, login, ciudad,
recuperación, cuenta pendiente y navegación Guía/Promos/Eventos/Actividades en
Carcasa. Comprueba errores JavaScript y desbordes horizontales en escritorio/móvil.
Las capturas se conservan como artefacto del workflow V34.

La prueba de navegador intercepta peticiones y utiliza KV/Firestore y correo
simulados. **No certifica la entrega de correo real**, credenciales ni despliegue.
Las pantallas se revisaron con datos de prueba; no se tocó producción.

## Cierre del flujo existente V35

Alcance confirmado: Carcasa con Farmacias/Efemérides, Guía y tarjetas,
Promos, Eventos y Actividades; panel del anunciante y Modificar datos.
Los 61 pendientes históricos, solicitudes de anunciante y retoques de Gran
Hermano quedan fuera de este cierre. No se agregaron esas funciones.

Correcciones:
- Quitar la última sede conserva el anunciante, sus datos y su presencia territorial
  en KV; la tarjeta puede quedar sin sede física. Mover una sede retira su ubicación
  anterior. Agregar otra sede utiliza los datos conservados.
- El panel genera una sede nueva aunque ya no quede ninguna plantilla en pantalla.
  Usa el ID devuelto por el guardado, sin releer todo el anunciante.
- Guardar sin cambios no realiza llamadas desde el panel; una sede intacta no escribe.
- Un lote de sedes se valida completo antes de escribir. Ciudad inválida o sede ajena
  no deja la primera sede modificada parcialmente.
- La programación de eventos publica sólo las instancias de cada ciudad y retira
  las anteriores al editar/pausar/borrar. La cobertura se conserva en KV.
- Editar imágenes/datos conserva instancias de Eventos y horarios de Actividades
  que no cambiaron; ya no los borra y recrea completos.
- Actividades valida los lugares existentes contra su ciudad y el panel conserva
  el ID de cada horario. Cambiar de lugar limpia las referencias anteriores.
- Publicidad actualiza sólo las imágenes modificadas; conserva imágenes y
  segmentaciones intactas. Un cambio parcial de segmentación conserva la otra dimensión.
- El panel reconoce los nombres visibles del catálogo territorial y vuelve al
  ingreso después de un cambio de contraseña que revoca su sesión.

Validación añadida: `TEST_FLUJO_EXISTENTE_V35.mjs` (8 circuitos),
`TEST_PANEL_VISUAL_V35.mjs` (Chromium: login, datos e imagen, borrar última sede,
agregar otra sin recarga global, guardar sin cambios y abrir/reabrir siete módulos),
`AUDITAR_HTML_V35.mjs` (9 interfaces vigentes, 15 scripts, sin Firebase directo).
Se conservan las 15 pruebas de mutaciones, Farmacias, Suscriptores y navegador
público. Las lecturas públicas se comprueban sin acceso Firestore; las mutaciones
se comprueban con contadores de documentos de prueba. Esto no mide la factura real.

## Paso siguiente: pruebas en entorno real controlado

El código de este alcance queda preparado para comenzar pruebas con configuración,
KV inicializado y datos reales de prueba. Sigue sin desplegar a producción.
Hay que validar credenciales, carga inicial KV, llegada real del correo y los
recorridos con datos completos. Las pruebas actuales usan DB/KV aislados y correo
simulado. No certifican que la aplicación desplegada ya funcione.

Los pendientes históricos siguen pendientes; por ejemplo, la eliminación definitiva
del anunciante conserva el aviso de acción no conectada que ya tenía el panel.
