# B87: sesiones persistentes y pruebas privadas

Las cuentas de suscriptor y de Gran Hermano conservan el ingreso al cerrar la pantalla. Los tokens nuevos son persistentes y firmados: no caducan a las ocho horas. Cada petición autenticada sigue comprobando firma, versión de sesión y revocación mediante KV. El administrador conserva además la comprobación de su política de acceso. Cambiar contraseña, eliminar la cuenta o revocar permisos invalida las sesiones correspondientes. Cerrar sesión borra las credenciales de este navegador; no borra la ciudad.

Un token anterior que todavía es válido se sustituye automáticamente por uno persistente en la respuesta de una petición autenticada. La interfaz guarda ese token sin operaciones Firestore y adapta las llamadas que todavía usan la variable anterior. Un token anterior que ya venció no se reactiva: requiere un último ingreso. Un fallo temporal de conexión o del servicio no borra la sesión guardada; una respuesta de autenticación 401 confirmada sí permite retirarla.

La portada usa la última ciudad guardada, conservando país y provincia cuando están disponibles. Si no hay contexto guardado utiliza la ciudad predeterminada de la cuenta. Entrar de nuevo no modifica el perfil ni consulta el catálogo para repetir la elección. Cambiar ciudad explícitamente mantiene abierto el selector.

## Diagnóstico privado

Gran Hermano ofrece «Activar pruebas privadas» al administrador principal autenticado. El Worker valida la sesión y emite una autorización de diagnóstico limitada a ocho horas. Esa autorización **no permite operaciones administrativas**: tiene tipo propio, sin rol administrativo. No se debe confundir su duración con la sesión de la cuenta, que es persistente.

El panel ofrece simulación de visitante, Mi Guía y anunciante en un iframe del mismo entorno. Esto conserva el registro incluso cuando el navegador particiona el almacenamiento de las páginas embebidas. Las otras pantallas del mismo entorno también pueden registrar con esa autorización válida. Los registros no agregan tráfico a Firestore: se guardan en el navegador y se reúnen en GH. La validación de la autorización usa firma y KV. El público habitual no ve ni registra mediciones. Un valor inventado en localStorage no habilita el panel. Al desactivar las pruebas o cerrar sesión en GH se retira la autorización local.

El registro abarca las llamadas al Worker de este navegador mientras el modo está activo, hasta 160 llamadas. No mide otros usuarios ni otros navegadores. No es un contador global de facturación Firebase. Las acciones reales de guardar o eliminar siguen teniendo las operaciones necesarias para persistir los datos; el monitor muestra esas operaciones, sin generar operaciones propias.

## Comprobaciones

- `tests/session-persistence-v87.mjs`: migración válida; sesión tras 365 días; revocación; rechazo de sesión antigua vencida; diagnóstico del administrador principal; autorización alterada o revocada; ningún fetch externo y contadores Firestore en cero.
- `tests/session-ui-v87.mjs`: interfaz simulada; monitor ausente para público; validación del servidor; registro compartido; sesión y ciudad conservadas al reabrir; sustitución del token; error temporal sin borrado; 401 confirmado borra sesión y conserva ciudad.
- Suites simuladas existentes: ficha y límites, edad, términos, territorio, moderación por ciudad, duplicados, conversaciones y soporte. Scripts de las diez páginas editadas comprobados sintácticamente.

La prueba con Chromium no pudo ejecutarse en este entorno porque falta el navegador instalado. La prueba real con la sesión del usuario sigue pendiente y no se marca cerrada. El Worker requiere instalación manual de B87; publicar HTML no cambia el Worker activo.

## Criterio para cambios posteriores

Recuperar sesión, recordar ciudad, navegar, diagnosticar y repetir un guardado sin cambios deben evitar operaciones Firestore. No reconstruir cachés ni sondear colecciones por visita. Las mutaciones reales requieren únicamente las escrituras o eliminaciones indispensables, con validación antes de escribir y actualización de caché. No presentar «sin medición» como cero ni confundir consultas con documentos devueltos.
