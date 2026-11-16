# GUÍA LOCAL — ARQUITECTURA Y CONTROL OBLIGATORIOS

**Estado:** contrato técnico objetivo, NO implementación. Se aplica a todas las acciones de Usuario, Anunciante y Gran Hermano.
**Seguimiento de ejecución y estado real:** [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md). Nunca reemplazar comprobación por una declaración de diseño.

## Arquitectura única

1. **Datos:** Firestore es la fuente de registros modificables. La autorización es responsabilidad exclusiva del servidor. Ninguna interfaz consulta registros individuales de Firestore para repetir información ya publicada sin cambios.
2. **Mutaciones:** un núcleo por entidad, en el Worker vigente, define alta, edición, activación, desactivación y eliminación, relaciones, permisos, dependencias, recuperación e idempotencia; las interfaces no duplican reglas.
3. **Publicación:** ante cambio real se recompone una versión de lectura de los conjuntos afectados; un dato idéntico no origina escritura. La publicación nunca precede a la persistencia confirmada. Un fallo se detecta y se puede reintentar sin repetir operaciones.
4. **Catálogo territorial:** una autoridad lógica país→provincia→ciudad. El campo activo define qué se publica. La administración puede visualizar inactivos. Los campos no públicos y los permisos siguen protegidos, sin mantener por defecto copias completas redundantes del catálogo en KV.
5. **Distribución:** catálogo público y paquetes por ciudad como archivos publicados, versionados y persistidos en el navegador. Abrir un paquete vigente no exige lectura Firestore/KV. La comprobación de cambios no requiere consultar las bases por cada apertura.
6. **Paquetes por funcionalidad:** Usuario obtiene la ciudad elegida y sus módulos aplicables; el anunciante autenticado obtiene primero un índice de sus anunciantes y después el seleccionado, dividido por módulo si el tamaño real lo justifica. Los paquetes privados no se entregan como archivos públicos.
7. **Clientes:** Usuario, Anunciante y Gran Hermano comparten identidad y utilidades. No hay lectores paralelos de las mismas entidades sin un motivo documentado, medido y temporal. Si existe una contingencia, se registra cada activación y se retira al verificarse el sistema normal.
8. **Criterio de programación:** DRY, KISS, responsabilidades separadas, mínima complejidad y una sola implementación por función; no agregar una capa para ocultar otra rota.

## Ciudades: contrato funcional

- Crear país de manera **independiente**; crear provincia/estado ligada a país; crear ciudad/partido ligada a provincia y país. No exigir un alta conjunta.
- Gran Hermano: tres pestañas **Ciudades | Provincias | Países**; búsqueda, selección, edición, activación/desactivación y eliminación segura, con verificación de referencias.
- **Actualizar** verde y siempre al final de los controles. **Eliminar** rojo.
- Modificar activo actualiza lo visible públicamente; no expone datos administrativos ni contraseñas.
- Al cambiar una ciudad, recomponer solo paquetes afectados. Validar Usuario, Anunciante, Gran Hermano, sedes, Guía, Eventos, Actividades, Promociones, Publicidad, Farmacias, Empleo y Efemérides según dependencia real.
- El sistema `paquete-ciudad.js` y `territorio-cache.js` se analiza como **lector y catálogo relacionados**; conservar sólo funciones necesarias. Completar publicación y versiones antes de eliminar consultas alternativas.

## Auditoría integral: cómo evitar problemas que reaparecen

**Una fila por problema**, identificador estable `CIU-001`, etc. No crear varias filas por el mismo síntoma. Cada fila exige:
- **Síntoma visible** y acción/rol afectados.
- **Causa raíz confirmada**, ubicación y cadena completa desde escritura hasta todas las interfaces.
- **Dependencias**; determinar si la misma causa explica otros problemas, enlazarlos.
- **Corrección definitiva propuesta**; marcar **diseño / implementada / comprobada en pruebas aisladas / comprobada en navegador / desplegada** sin mezclarlos.
- **Pruebas de aceptación** y prueba negativa, incluidas las tres interfaces cuando correspondan.
- **Consumo antes/después**, por servicio (Firestore, KV, Durable Objects, Worker, CPU, USD); distinguir estimación de dato medido.
- **Evidencia reproducible** (commit, request, respuesta, contador), responsable y **siguiente paso exacto**.

**Tres pasadas por acción, obligatorias antes del cierre:**
1. **Auditor de recorrido:** descubre todos los puntos de entrada, escritura, consulta, caché y presentación; los ordena en un mapa de dependencias.
2. **Auditor adversarial:** busca fallos, duplicación, permisos, invalidaciones, contingencias, datos desactualizados y consumos en ese mapa; si aparece algo nuevo, añade su causa al mismo registro y repite las pruebas afectadas.
3. **Auditor de resultados:** comprueba extremo a extremo en las interfaces con datos reales controlados, sin asumir que el código o las pruebas aisladas equivalen a funcionamiento; compara consumos reales antes/después.

**Puerta de cierre:** no se termina una acción hasta que el inventario de recorridos esté completo, todas las incidencias conocidas estén resueltas o identificadas como bloqueo explícito, no se detecten nuevas regresiones en las tres pasadas y el responsable pueda observar el resultado y la medición. Una auditoría no puede garantizar matemáticamente ausencia de errores: se controla su alcance y evidencia.

## Incidencias actualmente identificadas (estado al 16/11/2026)

| ID | Causa y efecto | Estado verificable | Corrección y comprobación pendiente |
|---|---|---|---|
| CIU-001 | `territorio-cache.js`: índice de paquetes vacío y catálogo embebido nulo en GitHub | Confirmado en rama y main; producción no verificada | Implementar el publicador de versiones, publicar archivo real y probar carga sin contingencias |
| CIU-002 | No existe ruta de archivos `plataforma/paquetes-ciudad/` en ramas inspeccionadas | Confirmado en GitHub; alojamiento no verificado | Generar archivos de paquetes por ciudad y validar URL/publicación |
| CIU-003 | Anunciantes y Carcasa tienen consultas alternativas por módulo cuando no hay paquete | Código confirmado; frecuencia y costo no medidos | Instrumentar, completar CIU-001/002 y retirar duplicaciones tras prueba |
| CIU-004 | Dos paquetes KV territoriales completos, administrativo/público, se reescriben tras cambios | Confirmado en código; costo físico sin medir | Diseñar y migrar un catálogo lógico/versionado; reducir operaciones sin exponer datos no públicos |
| CIU-005 | Gran Hermano tiene caché entre sesiones implementada en rama, no sincronizada por cambio externo | Parcial, no desplegada ni comprobada en navegador | Versiones e invalidación sin lecturas de DB por visita; probar dos dispositivos |
| CIU-006 | Alta de ciudad en rama obliga/propone flujo conjunto con país y provincia; no coincide con alta independiente acordada | Confirmado en HTML/Worker de rama | Corregir alta independiente y relaciones; probar con país/provincia ya creados |
| CIU-007 | Faltan pestañas funcionales para provincias y países y operaciones completas de edición/baja | Pendiente | Implementar y probar, incluido bloqueo por referencias |
| CIU-008 | HTML hace DELETE de ciudad; ruta equivalente no localizada en Worker revisado | Riesgo confirmado por búsqueda textual, requiere rastreo de todos los dispatchers | Determinar ruta efectiva, implementar/verificar eliminación sin pérdida de registros relacionados |
| CIU-009 | Estilos y orden Actualizar/Eliminar modificados en rama | Sintaxis comprobada; navegador/producción pendientes | Verificación visual en todas las pantallas afectadas |
| CIU-010 | Contadores de consumos reales no levantados en pruebas de Usuario/Anunciante/Gran Hermano | Pendiente | Escenarios frío/caliente/cambio, Firestore/KV/DO/CPU/USD antes/después |

**Siguiente paso único:** completar el mapa de recorridos de Ciudades en las tres interfaces y corregir la cadena CIU-001→CIU-002→CIU-003 con publicación verificable; después continuar CIU-004 a CIU-010 y la prueba transversal. No cambiar de acción ni acumular parches sin resolver causa raíz.
