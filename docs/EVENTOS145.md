# Eventos FREE/VIP: alcance y consumo

Base: Worker143 instalado y comprobado. Frontend estable 8c1b758. Nueva versión145; no incluye la futura integración publicitaria de Eventos/Actividades.

## Circuito y responsabilidad

| Interfaz/capa | Recorrido |
|---|---|
| Usuario | Carcasa y Anunciantes consultan `/events-new?ciudad_id=...`; Eventos consume la misma ruta. Fechas pasadas se ocultan localmente. |
| Anunciante | `login.html`, formularios FREE y VIP; panel, alta, edición, pausa/reanudación y baja mediante POST `/events-new`. Duplicar en la interfaz prepara una copia local. |
| Gran Hermano | Pendientes, listados, moderación y excepción de cupo FREE existentes. La moderación normal de eventos usa el mismo coordinador del anunciante. Se mantienen permisos por ciudad y rol. |
| Firestore | `eventos`; programación nueva embebida, programación antigua en `evento_programacion`; administración, anunciante y sedes para permisos/cupos/lugares. No se consulta desde el público. |
| Cloudflare | Paquetes SQL por ciudad y uno VIRTUAL compartido; cobertura/relaciones, índices y cachés privados existentes. Intento durable en el actor existente `guide-save-v132:<anunciante>`, no un servicio nuevo. |
| Dependencias | Territorio preparado, catálogo de eventos, moderación, términos, permisos del anunciante y recientes. Publicidad conserva su funcionamiento actual. |

## Distribución virtual

`alcance_publicacion={version:1,modo,...}` admite CIUDAD (`ciudad_id`), CIUDADES (`ciudades`, únicas/ordenadas, hasta500), PROVINCIA (`pais_id` y `provincia_id`), PAIS (`pais_id`) y TODAS. La modalidad/ubicación sigue siendo virtual. La ciudad del anunciante es el valor inicial de un evento nuevo, nunca una selección global automática.

Los eventos virtuales siguen almacenados una sola vez en VIRTUAL. Al leer, se filtra el alcance, sin expandir ni escribir una copia por ciudad. Provincia y país se verifican contra el catálogo territorial actual: incluyen ciudades nuevas de esa zona. Se conserva la programación física de eventos mixtos; el alcance se aplica a su proyección virtual.

Validación en servidor y formulario. Selecciones inválidas fallan antes de la escritura original. Catálogo geográfico faltante produce503, no amplía el alcance. Los eventos anteriores sin alcance conservan su distribución global; no se modifica ningún registro automáticamente. En edición se muestra ese valor para que el propietario decida cambiarlo.

Los controles nuevos usan la consulta de capacidades ya existente y requieren Worker145. No añaden consultas de catálogos: reutilizan el territorio cargado por ambos formularios. El frontend es compatible con143, pero bloquea guardar eventos virtuales con la nueva selección hasta instalar145, evitando que el Worker anterior ignore el alcance.

## Operaciones y recuperación

Se extiende el paquete SQL persistente a Eventos: hasta1.5MB se guarda el contenido completo en la fila que ya existía. La primera lectura de un paquete antiguo puede convertirlo una vez; tras reiniciar el actor se reutiliza el paquete. Por encima de ese tamaño permanece el recorrido completo anterior por entidades, sin truncar eventos. No se promete un costo constante para paquetes mayores.

La sincronización compara el contenido antes de escribir paquetes/cobertura equivalentes. La consulta propia de eventos se reutiliza entre cupo y cupo mensual FREE. No cambia la cantidad contratada, la regla semanal de edición FREE ni la conservación del cupo mensual al borrar.

Las mutaciones normales FREE/VIP y moderación se serializan en el actor existente. El journal se guarda antes del original. Si falla una copia, la recuperación lee lo efectivamente guardado y repone proyecciones, cachés privados, pendientes y recientes; no repite escrituras originales. Se mantienen los límites143: seis fallos automáticos, retención del pendiente, cuotas agotadas diferidas y recibos24h/acotados. El journal admite120KB: si lo excede, rechaza antes de escribir, no omite recuperación.

El helper de pedidos reutiliza el identificador ante respuesta incierta y junta clics simultáneos. Las altas guardan identificador/huella para reconocer su repetición; los identificadores se excluyen de la proyección pública. Las ediciones del frontend145 envían la revisión recibida al abrir: una edición desactualizada devuelve409. El servidor conserva la precondición atómica de la versión original para actualizar/pausar/borrar. Clientes antiguos sin revisión conservan compatibilidad, sin prometer detección de su formulario desactualizado.

No restaurar143 mientras exista un pendiente de Eventos creado por145:143 no conoce su recuperación. Consultar el estado por anunciante y resolverlo primero. No hay garantía global de rollback basada en un solo anunciante.

## Consumo: evidencia y límites

Producción143, 26/10/2026 a17:58:13 y17:58:35 Argentina, request IDs `4903be5f-6431-4bd7-a869-5c84bce78ecc` y `4fc66530-02eb-4803-beae-1346f336919c`: cada GET de Eventos informó0 operaciones Firestore,0 lecturas/escrituras KV,2 llamadas a componentes públicos y12 filas SQL leídas/0 escritas. Son contadores del recorrido identificado, no factura ni total de cuenta. CPU y costos monetarios no medidos en esta evidencia.

Fixture145 tras reiniciar ambos actores:4 filas SQL leídas/0 escritas,0 operaciones Firestore. Hubo3 GET físicos KV:1 del territorio por alcances de provincia/país y2 comprobaciones de migración de la fixture `source-bootstrap`. Los contadores KV exteriores no incluyen por sí solos esos accesos interiores: se conservan separados y no se ocultan en un total. En producción145 aún debe medirse el modo efectivo de migración. Para ciudad/manual/TODAS no se necesita la lectura geográfica.

La coordinación de escrituras agrega llamadas de almacenamiento y alarma del actor; se informan como llamadas lógicas, no como filas SQL facturadas. La lectura de versión original para editar/pausar/borrar protege concurrencia y puede sustituir un acceso previo a caché por una lectura Firestore. No se presenta como ahorro universal ni como operación gratuita. No se activa R2 ni otro servicio pago.

## Comprobación

`tests/eventos145/integration.mjs`: alta FREE/VIP, ciudad inicial/manual/provincia/país/global, exclusión de Brasil, selección inválida, guardado equivalente, pausa/reanudación, recuperación tras escritura y pérdida del actor, repetición sin reescribir, baja, paquete persistente, edición desactualizada, moderación, usuario ajeno y sin sesión; FREE limitado conserva el cupo después de recuperación/borrado.

`tests/eventos145/client.cjs`: deduplicación/identidad, almacenamiento bloqueado, lecturas sin mutación, sintaxis. Chrome real en GitHub Actions40411764080/job121883972360: selectores FREE/VIP, móvil/escritorio, edición, alcance anterior y capacidad; una sola consulta de capacidad existente. Regresiones de recuperación de Publicidad/Promos, Guía y acceso Gran Hermano pasaron.

No se crearon ni modificaron datos de producción durante las pruebas. Los fallos inyectados son locales, no incidentes reales. No se declara cerrado todo Eventos: quedan la instalación145 y sus mediciones/acciones reales; apelaciones de Soporte y reconstrucciones administrativas globales conservan su circuito anterior y no se certifican mediante esta prueba.
