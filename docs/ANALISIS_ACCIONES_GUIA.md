# Análisis de acciones de Guía — versión 133

## Alcance y decisión vigente

Este documento analiza lo publicado, sus acciones y sus consumos. No autoriza correcciones, despliegues, migraciones ni pruebas que modifiquen datos. La versión 134 está detenida. El usuario indicó utilizar pruebas reales; no se ejecutaron pruebas simuladas para este análisis. No se eliminó evidencia histórica ni código de pruebas.

Objetivo: que una ficha se pueda administrar desde anunciante y Gran Hermano sin perder cambios, que el público reciba lo guardado y que se conozca el consumo completo del recorrido.

## Inventario de acciones

| ID | Plano y acción | Qué hace el código actual | Qué debe incluir su medición |
|---|---|---|---|
| U1 | Público: abrir Guía o cambiar ciudad | Solicita la lista de la ciudad y conserva una promesa para reutilizarla durante esa apertura. Puede añadir territorio, catálogos, anuncios y favoritos según contexto y caché. | Separar lectura de la lista del total de apertura de pantalla. Contar también las solicitudes complementarias que realmente se disparen. |
| U2 | Público: buscar, filtrar y cambiar página | Filtra y pagina los anunciantes ya descargados en el navegador. | El cálculo local no requiere otra lectura de la lista. No confundir eso con ausencia de otras solicitudes de la página, imágenes o contenido incrustado. |
| U3 | Público: abrir una ficha o una sede | Utiliza los datos recibidos; imágenes, videos y enlaces pueden generar otras solicitudes. | Separar datos de Guía de la carga de archivos y de destinos externos. |
| U4 | Público identificado: leer, agregar o quitar favoritos | Usa la sesión y la ruta de suscriptores; guardar favoritos sí modifica datos. | Medir aparte de abrir la lista. Una visita identificada puede hacer más que una anónima. |
| A1 | Anunciante: ingresar, recuperar sesión y elegir anunciante | Valida identidad, relación y permisos; el panel también consulta términos y otros servicios de inicio. | Contar el ingreso una vez y separar la apertura posterior de Modificar datos. No multiplicar el ingreso por cada campo editado. |
| A2 | Anunciante: abrir Modificar datos | Lee ficha, administración, sedes, catálogos y territorio con las copias disponibles. | Comparar primera apertura y reapertura. Los registros agrupan varias acciones GET bajo /commerce. |
| A3 | Anunciante: escribir, agregar o duplicar sede sin guardar | Mantiene el borrador en el navegador. Duplicar sede vacía su ID. | No crear registros por preparar un borrador. El guardado es una acción diferente. |
| A4 | Anunciante: pulsar Guardar sin cambios | El controlador compara el formulario y retorna antes de enviar save_ficha. | Confirmar ausencia de petición de guardado; separar cualquier actividad ajena de la pantalla. |
| A5 | Anunciante: guardar datos de ficha | Comprueba permisos, aceptación y versión; prepara el cambio, escribe el original y actualiza las copias. | Una acción de usuario comprende la entrada al Worker, el coordinador del anunciante, Firestore, KV y la actualización de ciudad. |
| A6 | Anunciante: guardar sede nueva, duplicada o editada | Usa el mismo botón Guardar y la acción save_ficha, con uno o más registros de sede. Puede ir junto con cambios de ficha. | Separar alta de edición y cantidad de sedes. Un guardado con varias sedes no equivale al costo de modificar un solo texto. |
| A7 | Anunciante: borrar sede | Si es un borrador, la quita localmente. Si ya existe, envía delete_sede inmediatamente después de confirmar; comprueba la versión y actualiza público. | Separar quitar borrador de borrar registro. Contar lectura de control, borrado del original y actualización de copias. |
| G1 | Gran Hermano: buscar anunciante | Consulta el índice de búsqueda; cada solicitud depende de los filtros y límites. | Medir búsqueda aparte de abrir detalle y de guardar. |
| G2 | Gran Hermano: abrir ficha | Obtiene ficha, administración, sedes y relaciones. También devuelve resúmenes de uso de otros módulos. | Medir todas las consultas que provoca abrir esa pantalla aunque sólo se vaya a editar Guía. Esto identifica dependencias; no autoriza modificar otros módulos. |
| G3 | Gran Hermano: guardar datos de Guía | Calcula cambios por bloques de clasificación, perfil y relaciones de sedes; envía una sola acción /save con los bloques cambiados. | Separar cada bloque y el guardado combinado. Medir también Guardar sin cambios, que retorna antes de enviar /save. |
| C1 | Cruce anunciante–Gran Hermano: guardar desde copia anterior | El servidor compara las revisiones y rechaza un bloque desactualizado. | Probar el mismo dato compartido. Cambiar actividad en un panel y Gold en el otro no demuestra conflicto sobre el mismo dato. Registrar conservación del primer cambio y ausencia de escritura del segundo. |
| C2 | Respuesta perdida o actualización pública fallida | El coordinador conserva un comprobante y programa recuperación. Reintentar debe reconocer el guardado anterior. | Contar reintento y recuperación aparte del guardado normal. No provocar una avería en público como parte de este análisis. |

Fuentes inspeccionadas: plataforma/anunciantes.html (prefetchGuia, cargarGuiaSeleccionada, iniciarAnunciantes y render); plataforma/login.html (loadCommerceUI, commerce_post, deleteSedeCard y btnGuardarDatosComercio); plataforma/granhermano.html (ghSaveAdvertiserDelta_); worker/login-guia133.mjs (commercePanelDataV3, commerceSetDatosV3, commerceSetSedesV3, commerceDeleteSedeV3, advertiserDetailV2, routeAtomicAdvertiserInternal y routeGuideDispatch132).

## Consumo confirmado en registros reales existentes

Consultas de sólo lectura a Cloudflare Observability. Ventana consultada: 2026-10-23 18:00 UTC a 2026-10-24 06:00 UTC; filtro worker_version=133. Se separaron gld_guide_dispatch y gld_firestore_observation para sumar sus operaciones sin presentar dos registros internos como dos acciones del usuario.

| Acción observada | Muestras | Firestore por acción | KV por acción, incluyendo entrada y ejecución | Almacenamiento público de Cloudflare observado |
|---|---:|---|---|---|
| Leer lista pública /guide | 10 | 0 consultas, escrituras y borrados | 0 lecturas, escrituras y borrados | 1 llamada; entre 0 y 598 filas leídas; 0 escritas |
| Guardado de ficha del anunciante /commerce | 2 | 1 lectura de documento y 1 escritura; 0 borrados | 10 lecturas (1 entrada + 9 ejecución), 5 escrituras; 0 borrados | 2 llamadas; 602 filas leídas y 2 escritas por guardado |
| Guardado probado desde Gran Hermano /save | 4 | 1 lectura de documento y 1 escritura; 0 borrados | 7 lecturas (2 entrada + 5 ejecución), 4 escrituras y 1 borrado | 2 llamadas; 602 filas leídas y 2 escritas por guardado |

Son muestras de acciones específicas, no tarifas uniformes para cualquier ficha, ciudad o cambio. En los guardados hay además una llamada al coordinador del anunciante. La tabla NO es un total completo de Durable Objects: las operaciones del comprobante y su alarma no están incluidas en public_store. No se deben sumar las cifras de esta tabla y llamarlas costo total de Cloudflare.

Totales que sustentan la tabla: público 10 registros, 4784 filas leídas y 0 escritas; anunciante 2 registros de ejecución con 18 lecturas KV, 10 escrituras KV, 2 lecturas y 2 escrituras Firestore, 1204 filas leídas y 4 escritas, más 2 lecturas KV de entrada; Gran Hermano 4 registros de ejecución con 20 lecturas KV, 16 escrituras KV, 4 borrados KV, 4 lecturas y 4 escrituras Firestore, 2408 filas leídas y 8 escritas, más 8 lecturas KV de entrada.

Otras consultas v133 observadas, sin atribuirlas a un clic individual: 14 GET /commerce suman 53 lecturas KV y 0 escrituras KV/Firestore; 3 aperturas de detalle de Gran Hermano suman 51 lecturas KV, 1 escritura KV y 1 consulta Firestore; 6 búsquedas de Gran Hermano suman 18 lecturas KV y 0 operaciones Firestore. No convertir estos totales en un costo fijo por apertura: falta distinguir estado de caché y acción GET exacta.

## Hallazgos del análisis

1. **La medición anterior era incompleta.** public_store mide la actualización de las ciudades, pero beginGuide132 y finishGuide132 también ejecutan storage.put, storage.get, setAlarm y deleteAlarm en el coordinador. Esas operaciones no tienen un contador equivalente en el informe del guardado. No hay base para afirmar que 602 filas leídas y 2 escritas sean TODO el almacenamiento consumido.
2. **Falta identificación de acciones en el registro.** observationActionV43 no incluye save_ficha, delete_sede, set_relaciones_sede, anunciante ni permisos_panel. /commerce agrupa operaciones distintas. El costo de guardar datos, guardar sedes y abrir permisos no se puede separar confiablemente sólo por esa ruta.
3. **Un guardado actualiza varias copias.** Intervienen el original Firestore, la copia privada del panel, la base de la ficha pública, la ciudad y, según el cambio, la búsqueda administrativa. El guardado del anunciante también actualiza dos entradas de publicaciones recientes. Corresponde justificar cada copia y sus consumidores antes de quitarla. No está demostrado que las cinco escrituras sean mínimas.
4. **Cambiar una sola ficha puede leer la lista de la ciudad.** La implementación de ciudad usa SELECT de entities para reconstruir su paquete cuando no tiene copia en memoria. Los 602 registros leídos por guardado son consumo real observado de esa actualización, no 602 consultas a Firestore ni 602 visitantes. El tamaño de la ciudad y el estado del proceso influyen.
5. **Abrir una pantalla cuesta más que su consulta principal.** Público puede solicitar anuncios y favoritos; Gran Hermano devuelve resúmenes de varios módulos; anunciante valida sesión y términos. Esas dependencias se cuentan cuando son causadas por la acción estudiada, sin abrir una revisión funcional de esos módulos.
6. **Las solicitudes OPTIONS no aparecen en el informe estructurado.** El Worker responde antes de crear los contadores y excluye OPTIONS del log final. El navegador puede generar estas solicitudes previas. Contar sólo los informes gld_* no demuestra el total de solicitudes del Worker ni de alojamiento.
7. **Un informe de operaciones no es el saldo de la cuenta.** Los registros revisados no proporcionan plan contratado, almacenamiento ocupado, transferencia, CPU/duración completa por acción ni saldo diario. No deducir esos datos de una muestra ni de las cuotas públicas gratuitas.

## Cuotas públicas de referencia

Estas cifras describen los niveles gratuitos documentados; no se verificó que sean el plan y saldo actuales de las cuentas del usuario.

| Servicio | Lecturas | Escrituras | Borrados/otras unidades |
|---|---:|---:|---|
| Workers KV gratuito | 100000 claves/día | 1000 claves/día | 1000 borrados/día; 1000 listados/día; 1 GB almacenado |
| Worker gratuito | — | — | 100000 solicitudes/día; 10 ms CPU por ejecución |
| Durable Objects SQLite gratuito | 5000000 filas/día | 100000 filas/día | 100000 solicitudes/día; duración 13000 GB-s/día; 5 GB totales |
| Firestore Standard gratuito | 50000 documentos/día | 20000 documentos/día | 20000 borrados/día; 1 GiB almacenado; salida 10 GiB/mes |

Fuentes oficiales: https://developers.cloudflare.com/kv/platform/pricing/ ; https://developers.cloudflare.com/workers/platform/pricing/ ; https://developers.cloudflare.com/durable-objects/platform/pricing/ ; https://firebase.google.com/docs/firestore/quotas .

Consecuencia aritmética, sólo si aplica KV gratuito: cinco escrituras por guardado permiten como máximo 200 de esos guardados con las 1000 escrituras diarias, antes de descontar cualquier otro uso. Con cuatro escrituras serían 250. No es una capacidad garantizada ni el saldo actual: las demás acciones y módulos comparten recursos y pueden reducirla. Esta diferencia de presupuesto entre KV y Firestore obliga a analizar el conjunto; una reducción de lecturas Firestore no demuestra por sí sola mejora de capacidad.

## Orden de trabajo derivado del análisis

1. Acordar este inventario y el alcance: Guía, tres planos, acciones de lectura y guardado, consumo y conflicto. La protección no requiere rediseñar otros módulos.
2. Antes de otro arreglo funcional, definir una medición completa para esas acciones: identificador de recorrido, solicitudes de navegador, entrada, coordinador, KV, SQL/comprobantes/alarmas, Firestore, CPU/duración y uso real frente al plan aplicable. Leer documentación no sustituye consultar el saldo de cuenta.
3. Registrar el estado original y medir el recorrido real de una acción. Conservar las pruebas funcionales ya aprobadas; no repetirlas para aparentar progreso.
4. Evaluar juntas las operaciones evitables y la consistencia de las copias. Preparar un cambio coherente sólo después de explicar qué elimina, qué conserva y qué acciones afecta. La 134 aislada no resuelve el análisis de capacidad.
5. Ejecutar y verificar el mismo recorrido completo en anunciante, Gran Hermano y público; medir antes/después y restaurar datos. El cruce de edición usa el mismo campo compartido; las sedes se diferencian en alta, edición y eliminación.
6. Publicar sólo el conjunto compatible comprobado y comprobar su versión y resultado real. Cerrar Guía con la evidencia por acción; después pasar a otro módulo.

Este documento es el resultado del análisis, no un anuncio de correcciones nuevas ni de cierre de Guía. No se hicieron guardados de prueba, cambios de código ni despliegues durante este análisis.
