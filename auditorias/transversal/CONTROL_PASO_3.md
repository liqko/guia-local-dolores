# Control obligatorio de auditoría — Paso 3: COBERTURA

**Responsable de ejecutar y revalidar: ChatGPT.** El usuario no debe revisar código ni certificar resultados. **Estado general: ABIERTO.** Corte: `e6362836e6078a14a361732d79a8212258934056`. Catálogo: AUD-00001 a AUD-00987.

## Seguimiento obligatorio

- [ ] **3.1. Reconstruir los recorridos.** Rastrear las 1.691 funciones del anexo original, **incluidas las 608**, desde la acción de interfaz, disparador o inicio real, pasando por invocadores, condiciones, callbacks y dependencias. **Hecho:** cotejo de ubicación de las 1.691 con el código del mismo commit; clasificación preliminar por evidencia. **Falta:** rastreo completo entrada → función → dependencias para cada una. Evidencia: [reverificación original](COBERTURA_1691_REVERIFICACION_INTEGRAL.md).
- [ ] **3.2. Cruzar todos los recorridos con los 987 árboles y el catálogo.** Completar conexiones omitidas sin borrar recorridos ni renumerar unidades arbitrariamente. **Hecho:** catálogo generado de 987 unidades; cruces estáticos parciales. **Falta:** certificar la correspondencia exacta y cobertura completa de las 1.691 funciones, conexiones dinámicas y operaciones. Evidencia: [catálogo](CATALOGO_MAESTRO.md) y [cotejo](COBERTURA_FUNCIONES.md).
- [ ] **3.3. Resolver las brechas.** Para cada función sin recorrido comprobado: verificar su uso, posibles reemplazos, disparadores indirectos y condiciones; clasificarla individualmente como vinculada, posible código antiguo con evidencia o caso pendiente con prueba específica. **Hecho:** seis candidatos a desuso identificados pero **no confirmados**; el anexo mantiene todas las brechas. **Falta:** resolver y clasificar individualmente las brechas restantes. Evidencia: [cotejo de funciones](COBERTURA_FUNCIONES.md).
- [ ] **3.4. Revalidación independiente final, EJECUTADA POR CHATGPT.** Usar una comprobación cruzada distinta de la que produjo el catálogo, contra el código original, para detectar entradas, funciones, operaciones y dependencias omitidas. **Hecho:** controles automáticos anteriores de ubicación e identidad. **Falta:** revalidar **todo** después de resolver 3.1–3.3, comprobar que no falte nada, publicar diferencias y cerrar sólo con pruebas reproducibles.

**Avance 19/11/2026, ítems 3.1 y 3.2.** El [cotejo de cadenas](CADENAS_DEPENDENCIAS_PASO_3.md) recupera 17 manejadores y contrasta las 20 entradas restantes sin raíz de función. En 19 documenta la operación o barrera. Queda el callback de `AUD-00382` por botón creado y 207 acciones con al menos un sitio del árbol cuyo enlace requiere contraste. Las cuatro casillas continúan abiertas.

**Segunda ronda, 3.1–3.2.** Se resolvió el constructor de `AUD-00382` y se cotejaron los sitios pendientes de 30 acciones. Quedan 177 acciones con enlaces por contrastar. Los casos y las pruebas están en el anexo enlazado arriba. Las cuatro casillas de cierre siguen abiertas.

**Tercera ronda, 3.1–3.2.** Se cotejaron 132 de las 177 acciones que quedaban. Permanecen 45 con sitios por contrastar. Las 1.691 funciones mantienen su propio control de recorridos. Las cuatro casillas siguen abiertas.


**Control actualizado 21/11/2026 — [CI 44961483837 SUCCESS](https://github.com/liqko/guia-local-dolores/actions/runs/44961483837).** Se regeneró el grafo desde el corte congelado y se ejecutó `auditorias/control-cierre-paso3.py`: 1691 identidades únicas; 155 sin entrada acreditada (20 padre alcanzable, 76 globales, 59 locales). El informe de 155 identidades se adjuntó como artefacto [14729533786](https://github.com/liqko/guia-local-dolores/actions/runs/44961483837/artifacts/14729533786). En el consolidado 92 tienen evaluación específica, 63 no, aunque la familia causal estructural general esté identificada. **No se marcan [x] las casillas 3.1 a 3.4**: la verificación de la salida del propio reconstructor no sustituye una prueba independiente completa de entradas/operaciones. Próxima intervención precisa: examinar 63 sin evaluación específica, luego demostrar o justificar individualmente la ausencia de entradas para las 155; finalmente 3.4 y decisión de cierre. No trasladar a Paso 4 las conexiones no comprobadas.

## Reglas para marcar [x]

1. **Responsable de todas las acciones: ChatGPT.** Sólo solicitar al usuario intervención si una prueba real requiere permisos/acción que no pueda ejecutar.
2. Cada acción completada debe enlazar evidencia reproducible, identificar archivos/recorridos verificados y conservar las excepciones concretas con su justificación y prueba pendiente. Un conteo o un CI exitoso **no** acreditan un recorrido completo.
3. No descontar funciones sólo porque aparecen declaradas, tienen un callback o enlazan estáticamente con una unidad. Las 608 siguen abiertas dentro de las 1.691 hasta verificar el recorrido exigido.
4. Identidad exacta por archivo y rango AST: 114 nombres GPS repetidos afectan 240 filas que representan funciones distintas, no duplicaciones probadas.
5. No cambiar los cinco pasos ni pasar al paso 4 sin cierre verificable del paso 3. No tocar código productivo ni afirmar consumos reales durante el paso 3.

## Estado de los otros pasos

- **1. MAPA:** figura cerrado en el procedimiento vigente; **ChatGPT revalidará la evidencia de su cierre** como parte del control 3.4, sin presumir que fue perfecto.
- **2. CATÁLOGO:** generado (987 unidades); **ChatGPT revalidará su exhaustividad** en 3.2 y 3.4.
- **3. COBERTURA:** abierto; las cuatro casillas anteriores sin tildar.
- **4. EJECUCIÓN:** no iniciada sistemáticamente.
- **5. CIERRE:** pendiente.

**Regla de continuidad:** antes de declarar una acción terminada, actualizar aquí su casilla, evidencia y faltantes reales; no confundir progreso de análisis con cierre.
