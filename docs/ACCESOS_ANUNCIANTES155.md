# Acceso administrativo y delegación del propietario — candidato159

## Estado y alcance

Base: Worker158 descargado de Cloudflare, comparado con la fuente local completa; coincidencia exacta salvo terminador final. Frontend basado en main5dc878dd8cfddacbaeaf524192f9bbc832fd2f89. Candidato159 preparado y probado localmente. La instalación del único Worker `login` la realiza el usuario con `Worker_actual.txt`; no se cambia su fuente en GitHub. No afirmar funcionamiento159 en producción antes de instalarlo y comprobarlo.

Gran Hermano conserva la gestión comercial existente. Su bloque de acceso al anunciante muestra **Abrir panel del anunciante** y **Propietario**, con nombre, correo y teléfono cuando están registrados. Se retiraron de ese bloque la búsqueda de usuarios, edición de permisos, coadministrador y enlaces a recuperación. También se retiró la recuperación administrativa de contraseña añadida en158; el titular conserva su recuperación personal. No se devuelven contraseñas.

Dentro del panel del anunciante, solamente el propietario ve **Administradores y permisos**. La sección no solicita datos hasta abrirse. Permite buscar una persona por correo exacto, asignar administrador o manager, elegir funciones y habilitar/revocar. Al guardar se reutiliza el vínculo devuelto, sin recargar toda la ficha. Cancelar y guardar sin cambios no envían solicitudes nuevas. El propietario se identifica dentro del equipo, sin controles para modificar la titularidad.

La apertura administrativa usa una pantalla exclusiva de validación, sin formulario de contraseña. La ventana informa a Gran Hermano cuando abre el panel o falla. Se conserva la capacidad firmada de158: anunciante único,30min, revocable, identidad del administrador real y almacenamiento aislado de la sesión personal. No se atribuye a este cambio una causa demostrada de los dos rechazos de contraseña informados por el usuario: no hay traza que permita confirmarla.

## Permisos y compatibilidad

| Rol | Funciones | Información del anuncio | Delegación | Borrar anunciante |
| --- | --- | --- | --- | --- |
| Propietario | Todas las disponibles comercialmente | Sí | Sí | Único rol elegible; acción existente sin backend conectado |
| Administrador | Solo las asignadas | Solo si se asigna | No | No |
| Manager | Solo las asignadas | Nunca | No | No |

`COADMINISTRADOR` anterior se interpreta como administrador para compatibilidad, sin ofrecerlo como rol nuevo. Los vínculos nuevos/editados de delegados persisten `permisos_definidos:true`; una lista vacía no recupera automáticamente las funciones comerciales. El indicador se conserva en proyecciones, inicio de sesión, token y restauración. Administradores anteriores sin ese indicador conservan su acceso histórico hasta que el propietario los edite; no hay migración masiva ni revocación de personas ajenas al cambio.

Publicidad y Empleo conservan sus validaciones propias de elegibilidad comercial. Los delegados necesitan además el permiso de persona correspondiente. Empleo deja de depender implícitamente del permiso de editar información; un manager con EMPLEO puede gestionar únicamente ese módulo. No se modifican contratos ni cupos.

**Limitación previa, sin ocultar:** el botón Borrar anunciante ya mostraba un aviso de acción pendiente de conectar. Esta corrección define la elegibilidad de rol y no implementa un borrado definitivo ni afirma que funcione. No se ejecutó ningún borrado real.

## Circuito y datos

Interfaces: Gran Hermano consulta al propietario y abre el panel; Anunciante delega dentro del panel del propietario; Usuario público no cambia. Firestore: `suscriptor_anunciante` como fuente de vínculos, `suscriptores` como identidad, anunciantes y administración para contexto. Se reutilizan proyecciones privadas e invalidación existentes; no hay nueva tabla ni caché pública. Farmacias, Actividades, sus rutas públicas y almacenamiento persistente quedan sin cambios funcionales. La rama de reducción de cuotas5ce6535 no está integrada aquí.

- `GET /commerce/team?advertiserId=…`: solo propietario, equipo con identidad segura, revisiones y funciones disponibles.
- `GET /commerce/team/search?advertiserId=…&q=correo`: solo propietario; coincidencia exacta en índice preparado, sin catálogo general ni secretos.
- `POST /commerce/team/responsables`: solo propietario; administrador/manager, sin transferencia de titularidad. Revisión de documento y precondición Firestore, incluidas altas simultáneas.
- `POST /superadmin/advertisers/:id/panel-access`: acceso general existente, para un anunciante.
- Endpoint GH de responsables queda reservado a titularidad; no permite delegar administrador/manager. El bloque de la ficha no presenta editor de titularidad.
- Endpoint administrativo reset-access devuelve404. Recuperación personal permanece intacta.

Antes y después de cambiar un vínculo se revocan las sesiones de esa persona. El propietario no puede modificar un vínculo que es propietario, incluso si cambió después de cargar la proyección. Cambios de usuario/anunciante y respuestas tardías no se aplican a otra ficha.

## Comprobación

`tests/roles159/integration.mjs`, Worker completo, Firestore/KV simulados y SQLite local: acceso administrativo de lectura/guardado de web, alcance por anunciante, vencimiento, revocación, aislamiento; propietario con identidad; delegado sin acceso a equipo; búsqueda exacta sin Firestore; rechazo de titularidad/coadministrador/funciones inválidas; manager sin información; administrador con lista vacía mantiene denegación en logins repetidos; concesión de información solo a administrador; Empleo explícito; alta simultánea200/409; guardado sin cambios sin escrituras ni eliminaciones Firestore; revocación; recuperación administrativa retirada; reclamos existentes conservados.

`tests/roles159/ui.cjs`, HTML y scripts reales en jsdom26: inicio personal; reclamo por ID; intercambio entre ventanas; panel administrativo e información; token acotado en solicitudes y almacenamiento personal intacto; validación administrativa sin ofrecer/enviar contraseña; GH solo propietario/acceso; delegación solo propietario; carga bajo demanda; guardado sin recarga, segundo guardado sin solicitud; restricciones de información y borrado por rol. No equivale a navegador visual real ni a prueba con cuenta real.

Sintaxis de Worker y scripts y `tests/publication-integrity.mjs`: pasan. Regresiones de caché no se repiten porque su implementación no cambió. Evidencia local: `docs/evidencias/roles159-local.json`. No se escribieron datos reales.

Operaciones: apertura de dashboard no añade solicitud de equipo; abrir equipo añade1Worker y consultas privadas de equipo/identidad, con reutilización de cachés existentes. Identificar propietarios en GH puede leer la proyección privada de cada propietario activo; es una dependencia necesaria para los nombres/contactos solicitados, solo al abrir ficha. Búsqueda exacta usa índice preparado y ninguna lectura Firestore en fixture. Guardar invalida y revoca; no se elimina seguridad para reducir cuota. Contadores locales separados en evidencia; Firestore facturado, KV/SQL reales por acción, CPU, cuotas de cuenta y factura: **sin medir** para159.

## Publicación y reversión

Frontend compatible: `login.html`, `granhermano.html`, `accesos155.js`, `panel-administrativo155.js`, nuevo `equipo-anunciante159.js`. Son cinco archivos; la publicación de GitHub/Firebase la realiza el asistente. Worker: reemplazar el contenido del mismo `login` con el archivo único159. Frente a158 el resumen GH informa que requiere Worker actualizado y el equipo no puede operar hasta159. No se inventan nombres ni se usan IDs como identidad visible.

Comprobación pendiente después de instalar159: GH → anunciante existente → propietario por nombre/correo → abrir panel → verificar web; propietario personal → equipo → delegar/revocar con una cuenta real autorizada y restaurar cualquier modificación de prueba; comprobar consumo de esas acciones identificado por ruta y hora. Ninguna prueba local se presenta como validación de producción.

Reversión: restaurar los cinco archivos de frontend158 y el Worker158 descargado. Los vínculos159 son legibles por158, pero158 NO aplica completamente las restricciones nuevas de administrador explícito; por tanto no usar esa reversión como garantía de mantener la política159. Corregir hacia adelante si ya se delegaron restricciones nuevas. Mantener revocaciones; no reactivar sesiones anteriores.
