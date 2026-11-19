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

## Continuidad

El paso 3 sigue abierto. Para continuar **3.1 y 3.2**, desplegar las alternativas de `AUD-00382` por cada botón creado y contrastar las ramas de petición de las 207 unidades que aún incluyen sitios sin cadena probada. Empezar por las bifurcaciones cuya guarda cambia el destino de datos, como la de `AUD-00001`, y conservar las demás brechas. La revisión completa del conjunto de funciones y la revalidación independiente de **3.4** se mantienen pendientes. La cobertura de los lotes anteriores continúa en sus anexos originales.
