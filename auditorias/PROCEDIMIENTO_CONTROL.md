# Procedimiento fijo de auditoría integral — Guía Local Dolores

**Referencia obligatoria para retomar el trabajo.** Orden y alcance acordados. No cambiar etapas, criterios ni objetivos sin decisión expresa del usuario. Trabajar contra un commit de código identificado; actualmente Worker 211. No confundir análisis estático, pruebas instrumentadas y verificación real. No tocar producción sin autorización.

## Cuatro objetivos de la auditoría (aplican a cada comprobación)

1. **Duplicaciones:** detectar código, funciones, recorridos, solicitudes y operaciones que hacen el mismo trabajo; distinguir reutilización correcta de repetición innecesaria. Conservar archivo, línea, dependencias y evidencia antes de eliminar o unificar.
2. **Código obsoleto y parches:** identificar implementaciones abandonadas, reemplazadas, soluciones temporales y dependencias innecesarias; comprobar su utilización real antes de retirarlas.
3. **Errores:** detectar y corregir fallas de funcionamiento, conexiones y lógica para que la plataforma funcione según el diseño establecido.
4. **Consumos reales:** medir lecturas, escrituras, llamadas y otros costos reales; localizar trabajo innecesario y garantizar que no haya consumos sin justificación.

**Objetivos funcionales permanentes:** que la plataforma funcione como fue diseñada; no haga trabajo innecesario; no consuma recursos cuando no corresponde; no conserve código duplicado, abandonado o reemplazado.

## Procedimiento de cinco pasos — secuencia inalterable

### 1. MAPA
Utilizar los árboles existentes, completar sus conexiones y contrastarlos con el código. Ninguna rama, llamada, condición, operación ni dependencia puede desaparecer silenciosamente. Identificar y mantener visibles los vínculos dinámicos, manejadores y destinos no resueltos. **No cerrar** si falta comprobar cobertura efectiva de un recorrido o existen dudas sin clasificación y evidencia. El resultado debe diferenciar conexiones verificadas de hipótesis estáticas.

### 2. CATÁLOGO
Generar automáticamente un catálogo único y numerado de todas las comprobaciones necesarias, incluyendo funciones, datos, conexiones y dependencias de las tres interfaces y del Worker. Identificadores únicos y trazables a fuente/árbol; evitar duplicar comprobaciones aunque varias entradas reutilicen el mismo código. No elegir unidades por pantalla, importancia aparente ni por lo descubierto incidentalmente. El catálogo provisional no significa paso 1 cerrado.

### 3. COBERTURA
Comparar exhaustivamente catálogo, árboles y código. Toda parte relevante debe asociarse a una comprobación; lo no cubierto debe figurar explícitamente como faltante. Prohibido ocultar o descartar recorridos incompletos. Demostrar cobertura con evidencias reproducibles y diferencias registradas.

### 4. EJECUCIÓN
Auditar las unidades estrictamente del 001 al último, conforme al catálogo. En **cada unidad**, comprobar los cuatro objetivos: duplicaciones, código obsoleto/parches, errores y consumos **reales**. Registrar qué se probó, evidencia, resultados y pendientes. Corregir lo confirmado, volver a probar y comprobar que la corrección no provoca regresiones. No equiparar conteos de análisis con consumos facturados.

### 5. CIERRE
Solo cuando estén ejecutadas todas las comprobaciones, con problemas resueltos o expresamente identificados y sus evidencias, determinar el estado real de la plataforma. No declarar una fase o auditoría completa a partir de un CI exitoso o de árboles estáticos únicamente.

## Estado de referencia, 18/11/2026

- **Paso 1 MAPA: REVALIDACIÓN PENDIENTE FRENTE A `main`.** El [bloque de 44 entradas dinámicas](transversal/MAPA_DINAMICO_PUNTO_1.md) quedó cerrado el 18/11/2026 y los siete fallos conservan su lugar en ejecución. La corrida 44210648484 cotejó 983 árboles en `f6ea8fe2`. El [registro maestro](ESTADO_ACTUAL.md) identifica las diferencias de fuente pendientes de revalidar en el MAPA general.
- **Paso 2 CATÁLOGO: PROVISIONAL** (generado durante el paso 1; pendiente de comprobación y consolidación). Última generación: 983 árboles, incluidos 280 arranques y entradas del Worker; los árboles de interfaz actuales son 703, frente a 701 en un corte anterior. No confundir árboles con unidades funcionalmente auditadas.
- **Paso 3 COBERTURA: NO CERRADO.** Hay verificaciones estáticas, faltan controles efectivos de los elementos dinámicos y evidencias pertinentes.
- **Paso 4 EJECUCIÓN: NO INICIADO sistemáticamente desde 001.**
- **Paso 5 CIERRE: PENDIENTE.**

**Regla de continuidad:** al retomar, leer este documento y consultar la revisión y la evidencia más reciente; anunciar el número del paso en curso, qué está efectivamente hecho y qué falta, sin cambiar de paso mientras el anterior esté abierto.
