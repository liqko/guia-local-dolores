# Worker138 — acciones compartidas

Base: Worker136 activo, SHA256 9b4530f90c33c4187023cb4bad0d2e9698d0545bbd3c341554568e70493d7bae.

Se reutilizan sesión y JSON durante una solicitud. La comparación de datos y el coordinador con adaptador se aplican inicialmente a Territorio. Las lecturas públicas y los contratos de datos se conservan. Las mutaciones de países, provincias, ciudades y reconstrucción territorial —también desde mantenimiento global— pasan por el mismo actor. El marcador durable permite recuperar alarmas sin depender de state.id.name.

El registro previo al guardado, el punto de control de Firestore y la publicación con progreso persistido evitan repetir escrituras confirmadas. Una confirmación ambigua se contrasta con la fuente; un conflicto externo se conserva para revisión. El registro no añade un medidor global ni escrituras a visitas públicas.

## Comprobación

`node worker/build-shared-actions138.mjs`

`node --test tests/shared-actions138/circuit.test.mjs`

21 pruebas locales aprobadas. Proveedores simulados y SQLite local; no equivalen a facturación ni validación de Cloudflare. 13/14 regresiones anteriores aprueban en136 y138; la prueba de consumo de etiquetas falla en ambas. Evidencia y desglose de operaciones en docs/evidencias/shared-actions138-*.

## Costo y límites

Cada mutación real agrega1DO y cuatro escrituras SQL del estado, más1unidad de escritura de alarma. La primera mutación agrega1marcador durable. Los guardados iguales no escriben Firestore/KV/SQL, aunque aún autentican y llaman al actor. La lectura pública no agrega DO/SQL. CPU, duración, espacio total y factura no están medidos en producción. La cancelación de alarma se informa como llamada, sin inventar un costo de filas.

El estado se limita a1.8MB antes de efectos; las alarmas tienen seis intentos automáticos como máximo. Recibos explícitos de Idempotency-Key: hasta24h y32recibos/48KB. Los catálogos KV continúan sujetos a propagación eventual y caché HTTP. No se certifica exactly-once universal entre servicios.

## Instalación y reversión

No desplegado. Exportaciones y bindingGLD_PUBLIC_CACHE existentes, sin migración nueva de clases. El TXT contiene todo el Worker, no un fragmento. Antes de restaurar136, consultar `/superadmin/territory/action-status` con rol superior y confirmar `pending:null` y `safe_to_restore_previous_worker:true`; no volver al136 con publicación138 pendiente porque136 no ejecuta su recuperación.
