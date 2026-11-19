# Paso 3 · Cadenas desde las acciones hasta sus dependencias

Corte `e6362836e6078a14a361732d79a8212258934056`. Continuación del rastreo en `982846b2`. El [anexo](CADENAS_DEPENDENCIAS_PASO_3.zip) conserva las 987 entradas AUD, 3.625 identidades de función, saltos con ubicación y sitios terminales. La generación cotejó las huellas de las 71 fuentes del grafo con el catálogo y con los archivos. Se verificó que las 6.238 trazas guardadas (incluidas las que terminan en una barrera) son continuas desde su raíz hasta el dueño del sitio.

| Cotejo del tramo desde la acción | Cantidad |
| --- | ---: |
| Entradas revisadas | 987 |
| Manejadores recuperados por símbolo léxico y asignación de evento | 17 |
| Entradas restantes sin raíz de función inicial | 20 |
| De esas 20, comprobadas directamente hasta la operación o barrera indicada | 19 |
| De esas 20, con callback cuyo destino depende del botón creado | 1 |
| Acciones con cadena hasta un sitio HTTP o de datos | 266 |
| Sitios HTTP o de datos del árbol con cadena identificada desde una acción | 797 |
| Acciones con sitios del árbol cuyo enlace aún debe explicarse | 207 |

Los grupos de 266 y 207 pueden coincidir en una misma acción. Confirmar el envío HTTP acredita la dependencia del cliente. El despacho interno y sus operaciones requieren cotejar la ruta, método, guardas y parámetros. El anexo conserva esos candidatos sin darles condición de terminal comprobada. El conteo se refiere a sitios de código. Este corte no midió consumo real.

## Cotejos directos

- **Gran Hermano, AUD-00001.** «Abrir panel del anunciante» envía POST a `/superadmin/advertisers/:id/panel-access`. El Worker valida sesión y rol, obtiene anunciante, administración y estado de sesión, y firma el acceso. La pestaña lo recibe mediante `postMessage` y contrasta origen, ventana y nonce. Se excluye de este recorrido la escritura de permisos de `saveAdvertiserRelation155`, que exige el sufijo `responsables`. La prueba local pasó las verificaciones de emisión y alcance anteriores a la ficha. El paso siguiente recibió 503 `COMMERCE_COPY_PREPARING` al abrir la ficha, de modo que la llegada al panel queda abierta.
- **Empleo, AUD-00330 y AUD-00332.** El envío del formulario activa `save`, que va a POST `/empleo`. El Worker valida titularidad, términos y estado, persiste la publicación en `empleos` y sincroniza las copias. Al editar el borrador, la otra acción guarda localmente con retardo y termina en `localStorage`.
- **Usuario, AUD-00195.** La condición de nivel habilita el botón de favorito. El POST de agregar guarda en `suscriptor_favoritos`; el de quitar consulta y elimina si existe. Sin sesión, el manejador pide acceso a la página contenedora.

## Despachos comprobados de Territorio

En **73 acciones** se vincularon **91 sitios de solicitud** al despacho de dos rutas territoriales. `GET /territory/public` llega a `territoryPublic` y consulta `territorio:public:v1`; el Worker devuelve 503 si falta la copia. `GET /superadmin/territory` llega a `territoryAdmin` con sesión de administración general y consulta `territorio:admin:v1`. Para `ADMIN_LOCAL`, una rama anterior consulta la copia pública y filtra las ciudades autorizadas. El anexo identifica los AUD y los sitios exactos. Esta comprobación acredita el destino territorial por solicitud. Las otras dependencias de cada acción conservan su estado propio.

## Segunda ronda · 24 acciones con sus dependencias pendientes resueltas

El cotejo pasó de **207 a 183 acciones** con sitios del árbol pendientes. Se agruparon las 207 por conjuntos de sitios exactos. Los 57 grupos iniciales se redujeron a 55 con alguna acción pendiente. Los casos de cada grupo conservan su método, parámetros y condiciones propios.

| Grupo | Acciones cotejadas | Resultado |
| --- | ---: | --- |
| Ventas y coeficientes | 6 | Cuatro cambios de pestaña terminan en pantalla. Sólo Configuración comercial, con rol principal, entra al flujo de lectura. Si falta la copia de coeficientes, recupera los datos y repone la copia. |
| Apertura de alta y reclamo | 6 | Alta usa el catálogo público de ficha y Territorio. Reclamo usa ciudades y opciones de anuncios. El catálogo público de ficha sólo consulta las copias de precios y reglas en las funciones auditadas. |
| Conversación y respuesta de soporte | 2 | Abrir consulta la solicitud y los mensajes. Enviar agrega el mensaje y una marca de deduplicación si corresponde; luego consulta la conversación. |
| Personal comercial y moderadores | 10 | Las lecturas, el guardado individual, la baja comercial y el guardado conjunto quedaron asociados a su ruta y método. |

**AUD-00382 resuelto como constructor.** Se identificaron las 12 invocaciones a `button` y los tres contextos de paginación. Anterior y Siguiente pueden repintar una lista local o solicitar otra página, según quién crea el botón. Preparar el listado puede leer la colección y publicar su copia. Los botones de Promociones y Publicidad ejecutan el envío que corresponde según el estado. El control «Editar permisos» de este constructor exige una clave de moderadores ausente del conjunto de listados que lo alimenta. El editor permanece disponible por su recorrido independiente. El anexo conserva los casos por botón y las dependencias de cada uno.

Pasaron las pruebas locales de paginación, preparación, navegación y operaciones de Promociones y Publicidad con transporte simulado; las de pestañas y coeficientes, recuperación del catálogo y soporte; y diez pruebas de regresión existentes de roles y configuración. El cotejo posterior confirmó las 987 acciones y las 3.625 identidades, con todos los sitios originales conservados. La ejecución en producción y el consumo real siguen pendientes.

## Continuidad

El paso 3 sigue abierto. Quedan **183 acciones** con sitios del árbol cuyo enlace exige cotejo. Priorizar el grupo de 18 acciones de Gran Hermano que comparte la expansión de la consulta de búsqueda y el guardado de ficha. Filtrar las rutas que corresponden a cada llamador y conservar los sitios descartados con la condición que impide alcanzarlos. El cotejo de funciones y la revalidación final del paso 3 continúan abiertos.
