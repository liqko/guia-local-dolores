# Método obligatorio de cierre por módulo

Orden vigente: Guía, Eventos, demás módulos y Publicidad al final.

1. Antes de cambiar código, registrar los recorridos del módulo en usuario, anunciante y Gran Hermano, con evidencia existente y comprobaciones faltantes.
2. Cada recorrido se trabaja completo: comportamiento, validaciones, permisos, concurrencia, recuperación de fallos y consumo. Medir antes, eliminar operaciones evitables y volver a medir la misma acción.
3. Contar juntos Firestore, Worker, KV, llamadas y almacenamiento de Durable Objects/SQL. Separar pruebas locales, registros reales de producción y factura. Una llamada exterior y su ejecución interior no son dos acciones del usuario; sí se suman sus operaciones físicas.
4. No repetir una prueba aprobada salvo que un cambio afecte su comportamiento o dependencias. Registrar versión, resultado y razón de cualquier repetición.
5. Cada corrección debe quedar en GitHub; verificar publicación de los componentes compatibles y versión realmente ejecutada. Un archivo local no equivale a un cambio publicado.
6. Restaurar los datos modificados durante pruebas y comprobarlo antes de concluir.
7. Cerrar sólo con todos los recorridos de ese módulo cubiertos y ningún error conocido. Si falta algo, nombrar la acción exacta y su evidencia faltante; no usar una lista abierta de revisiones indefinidas.
8. No iniciar otro módulo antes de cerrar el actual, salvo instrucción explícita del usuario. No introducir funcionalidades nuevas durante el cierre.

Control vigente de Guía: `estado-guia.json`. Actualizarlo en el mismo cambio que avance el módulo.
