# Contrato rector de ingeniería — Guía Local
**Vigencia: 24/10/2026. Prioridad: estas reglas prevalecen sobre instrucciones técnicas antiguas de este archivo si hay contradicción.**
**Estado de aplicación:** reglas documentadas, NO equivalen a pruebas automatizadas ni garantizan por sí mismas cumplimiento.

## 1. Responsabilidad y límites
- El asistente es responsable del análisis técnico, diseño, implementación, revisión, depuración y evidencia. El usuario define producto, prioridades y valida la experiencia funcional; NO debe programar, auditar código, interpretar métricas técnicas ni repetir instrucciones ya establecidas.
- No describir como realizado, probado, validado, optimizado, instalado o desplegado nada que no cuente con evidencia comprobable del estado correspondiente.
- Jamás desplegar ni modificar producción sin autorización explícita del usuario. GitHub se utiliza para HTML, documentación, ramas y pruebas; el Worker de producción no se modifica en GitHub sin una nueva autorización expresa. Un candidato nuevo no reemplaza al Worker vigente.
- Trabajar en un solo circuito autorizado a la vez. Registrar otros problemas como pendientes sin abandonar el objetivo ni incorporarlos por iniciativa propia.

## 2. Arquitectura de referencia y separación de responsabilidades
- La plataforma tiene tres interfaces con responsabilidades distintas: Gran Hermano (administración/configuración), Anunciante (ingreso y mantenimiento de datos habilitados) y Público (Carcasa y módulos internos).
- La Carcasa NO es la Guía. Farmacias y Efemérides pertenecen a la Carcasa. No introducir dependencias con Guía por compartir pantalla, ciudad o repositorio.
- Firestore/Firebase es fuente de datos operativos en los circuitos que corresponda. El Worker valida autorizaciones y mutaciones, prepara y publica paquetes derivados en el almacenamiento/cache de Cloudflare. El público consume paquetes preparados, sin recomponerlos ni consultar Firestore en cada visita.
- Preparación o invalidación del paquete: ante altas, modificaciones, bajas, cambios relevantes, vencimientos programados o cambios administrativos; considerar atomicidad, errores parciales, reintentos, idempotencia y concurrencia. Documentar explícitamente cualquier excepción.
- No copiar ni heredar código anterior sin justificarlo y verificar su contrato; usarlo como referencia de comportamientos existentes. Preferir módulos de fuente independientes con interfaces claras, aun si la entrega final requiere un único Worker.
- Optimizar operaciones y costos reales (Firestore, KV, SQL, Worker, CPU), SIN sacrificar permisos, consistencia, trazabilidad, seguridad ni exactitud de datos.

## 3. Unidad mínima de trabajo: circuito completo
Antes de cambiar un módulo, mapear y documentar:
1. Configuración y permisos en Gran Hermano.
2. Captura, consulta, edición y baja en Anunciante.
3. Colecciones/documentos Firestore y contrato de datos.
4. Rutas y funciones Worker: validación, mutaciones, preparación, caché e invalidación.
5. Paquete Cloudflare y contrato público de lectura.
6. Consumo y presentación en la interfaz pública correspondiente.
7. Dependencias reales con otros módulos (si existen), sin asumir ninguna.
8. Operaciones/costo por acción y fuentes de medición.
Si un punto no existe, registrar «no aplica» con motivo; si no se comprobó, registrar «pendiente/sin medir». No confundir ausencia de evidencia con resultado correcto.

## 4. Regla antipa rches y gestión de cambios
- Prohibido acumular funciones duplicadas, sobrescrituras al final de archivos, rutas paralelas o excepciones ad hoc para disimular una falla.
- Antes de corregir un síntoma, identificar causa, propietario del dato, dependencias, escenarios afectados y posibles regresiones. Corregir la ruta original o rediseñar el módulo completo cuando la causa sea estructural.
- Cambios limitados al alcance autorizado; no mezclar Guía, Farmacias, Publicidad u otros circuitos. Si hay infraestructura compartida, analizar impacto transversal y no modificarla sin explicitar alcance y obtener autorización.
- Conservar comportamientos válidos. Registrar cualquier migración de datos o cambios de contrato, compatibilidad y mecanismo de reversión.
- El hallazgo de un error no constituye permiso para cambiar código; distinguir diagnóstico, corrección preparada y despliegue autorizado.

## 5. Comprobación técnica antes de declarar terminado
Cubrir, según aplique, permisos por rol/ciudad, alta, consulta, modificación, eliminación, duplicación, cancelación, datos nulos y ausentes, vencimientos, cambios de ciudad, concurrencia, reintentos, errores parciales, caché fría/caliente, invalidación, coherencia entre las tres interfaces y ausencia de dependencias indebidas.
- Pruebas de lógica automatizadas y pruebas de integración del circuito; los mocks o contadores simulados NO son prueba de consumo real.
- Comparar antes/después con tráfico o acciones efectivas identificables y métricas de origen; no atribuir un contador agregado a una acción aislada sin correlación.
- Identificar cada afirmación con versión, entorno, acción, fecha/hora, resultado esperado, observado y evidencia. Distinguir lectura/escritura/eliminación por cada servicio. «Sin medir» nunca significa cero.
- Una prueba que pasa NO garantiza ausencia total de errores; comunicar cobertura y límites concretos.
- Si faltan pruebas esenciales, el estado debe seguir «no validado». No promover a producción.

## 6. Registro de continuidad obligatorio
Para cada circuito mantener un documento o ficha versionada con:
- objetivo, alcance incluido/excluido, versión activa y candidata;
- mapa de dependencias y contratos;
- cambios realizados con commit o archivo;
- casos probados, resultados y evidencias;
- consumos medidos y no medidos;
- fallas abiertas y siguiente paso técnico exacto;
- estado: diagnosticado / implementado / probado / validado / autorizado para despliegue / desplegado.
Antes de cualquier intervención, leer este contrato y la ficha del circuito; al finalizar, actualizar ambos si corresponde. No declarar memoria perfecta ni control automático donde sólo existen documentos.

## 7. Regla de Farmacias (primer módulo a reconstruir)
- Fuente: datos de farmacia/sedes y ciclos de turno en Firestore, con configuración y permisos de Gran Hermano y gestión del anunciante.
- Preparación: Worker genera/actualiza un paquete completo de turnos por ciudad en Cloudflare al producirse cambios o eventos de vigencia pertinentes.
- Consulta pública: Carcasa lee solamente ese paquete preparado; no consulta Guía, ni reconstruye, ni escribe por cada visita.
- Cualquier dependencia con `guide:city:*` o con el paquete de Guía es un hallazgo de arquitectura que debe resolverse en el diseño del módulo, considerando actualización de nombres, domicilios, sedes y horarios.
- No tocar otras funciones o circuitos salvo dependencias compartidas expresamente justificadas y autorizadas.
- No asumir que las versiones 137/138 son bases limpias ni desplegar candidatos 138. Tomar el código existente únicamente para inventariar contratos y comportamiento.

## 8. Puerta de entrega
Cada entrega debe contestar concretamente: **qué se hizo; qué no se hizo; qué se probó; qué falló; qué se midió realmente; qué queda pendiente; qué está instalado**.
Si no hay evidencias suficientes, informar estado parcial en vez de presentar solución terminada.

---

# Reglas históricas y específicas de interfaz

- Hacer correcciones puntuales. Conservar registros, acciones existentes (editar, pausar, reanudar, duplicar y eliminar), IDs de controles, validaciones y límites.
- Ordenar formularios y botones en una columna tanto en escritorio como en móvil. Mantener campos obligatorios visibles y agrupar opciones secundarias en desplegables con títulos claros.
- Usar áreas de texto de al menos cuatro renglones para texto libre y aclaraciones; permitir ampliar su altura. Mantener controles específicos para fechas, enlaces, teléfonos y búsquedas.
- Los cambios de presentación no deben agregar lecturas, escrituras ni eliminaciones en Firestore. Reutilizar los datos ya cargados.
- Al cambiar la presentación de listas, comprobar que los registros y sus acciones siguen visibles en escritorio y móvil; revisar reglas CSS anteriores que puedan ocultarlos.
- Corregir la función o regla original; no acumular bloques de parche que sobrescriben otros. Centralizar reglas compartidas y conservar una única ruta para cada comportamiento.
- Las imágenes publicitarias y sus CTA deben navegar en la pestaña actual, usando el mismo enlace nativo con target _top cuando estén embebidos. No forzar window.open desde sus controladores.
- Usar las mismas etiquetas en todos los módulos de anunciantes: Editar, Pausar, Reanudar, Duplicar y Borrar. Para confirmar un borrado, usar Confirmar borrado. Mantener los IDs y acciones internas existentes.

- En listas de registros del anunciante, mostrar título y estado en la cabecera; agrupar datos secundarios y acciones dentro de un desplegable por registro. Aplicar por módulo conservando los controles y verificando su funcionamiento.

- Reducir operaciones en todos los circuitos: reutilizar datos ya cargados y caché válida; preparar altas, ediciones y duplicaciones localmente; no crear registros temporales al pulsar Duplicar; guardar sólo al confirmar. Cancelar y guardar sin cambios no deben generar operaciones Firestore. Evitar consultas y recargas redundantes sin eliminar validaciones de autorización, consistencia o concurrencia del servidor. Medir cada mutación real y no equiparar consultas/documentos retornados con lecturas facturadas.

## Trabajo sistemático en todos los módulos

- Aplicar siempre `docs/CONTROL_MODULOS.md`. Mantener la matriz del módulo con evidencia y versiones, y trabajar cada recorrido completo en usuario, anunciante y Gran Hermano, incluido su consumo.
- No dar por terminado un recorrido por funcionar si falta revisar sus operaciones evitables. No repetir pruebas aprobadas sin un cambio que las afecte. Registrar el motivo de las repeticiones necesarias.
- El trabajo de Guía pública se mantiene aislado en su rama. Por instrucción del usuario del 24/10/2026, otros problemas de Publicidad, Empleo u otros módulos pueden avanzar en ramas independientes sin esperar el cierre global de Guía. El orden de instalación se decide por cambios comprobados y dependencias reales; no mezclar correcciones de módulos distintos. El control actual de Guía está en `docs/estado-guia.json`.

## Criterios vigentes para avanzar sin alterar lo que funciona

- El ingeniero presenta alternativas, recomienda una y explica alcance, efecto operativo, consumo y limitaciones. No delegar decisiones de programación al usuario ni cambiar de propuesta sin nueva evidencia concreta.
- Una rama por problema, basada en la versión estable. Registrar archivos afectados y contratos compartidos antes de editar. No usar como base otro candidato no instalado. Los cambios compartidos del Worker se integran de forma controlada; no sobrescribir versiones con copias completas de otro trabajo.
- Un hallazgo no es automáticamente una falla: registrar comportamiento esperado, resultado observado, reproducción y localización. Si la expectativa no está confirmada, conservarlo como observación. El usuario confirmó que Favoritos no se activa sin sesión y pidió no modificar Corazón ni Compartir; ambos quedan fuera de la corrección de consumo.
- Las correcciones visuales no agregan lecturas, escrituras, borrados ni llamadas a Firestore o Cloudflare. Para cambios funcionales, contar todas las operaciones de la acción en ambos servicios y justificar cualquier incremento antes de instalar. No eliminar controles de permisos o concurrencia para reducir contadores.
- Diferenciar cantidad por acción, porcentaje de cada cuota (con su período), uso total de cuenta y factura. No presentar un conteo de SQL local como consumo facturado de Cloudflare ni una consulta como un documento leído.
- Reutilizar comprobaciones aprobadas. Repetir solamente recorridos afectados por el cambio o evidencia contradictoria, registrando el motivo. Usar registros reales existentes; no inventar anunciantes, cuentas ni datos para pruebas.
- Ninguna corrección se instala automáticamente en producción. Primero preparar el cambio completo en una rama, comprobar el recorrido afectado y conservar una vía de reversión. No declarar una mejora instalada si sólo existe un candidato.
- No congelar toda la plataforma por una comprobación de otro módulo. Cada entrega informa cambio, evidencia, consumo, límites concretos y estado de instalación; las tareas abiertas permanecen identificadas para retomarlas sin repetir el diagnóstico.

## Contrato obligatorio de medición y entrega (24/10/2026)

- Antes de probar, fijar la acción exacta, alcance completo (pantalla y dependencias, perfil y favoritos si hay sesión), versión instalada e intervalo horario. No medir una parte y presentarla como toda la pantalla.
- Usar siempre la misma tabla por componente/acción: Firestore lecturas, escrituras, eliminaciones; Cloudflare SQL filas leídas y escritas (borrados incluidos en escritas); Cloudflare KV lecturas, escrituras, eliminaciones y listados; solicitudes Worker, llamadas Durable Objects y CPU cuando se midan. No llamar a todas estas unidades indistintamente "consultas" o "lecturas".
- KV y SQL son contadores separados y adicionales. No ocultar ninguno en un total genérico. Indicar unidad, servicio, cuota y período al calcular porcentajes. Un consumo no observado es "sin medir", nunca cero.
- Vincular cada resultado a evidencia identificable: ruta/acción, versión, hora, contador y fuente. Diferenciar resultado observado de inferencia. No deducir el reparto de un total entre varias dependencias sin evidencia.
- Mantener una lista persistente de acciones, hallazgos, cambios y comprobaciones en docs/estado-guia.json. Antes de cada entrega, cotejarla con el alcance; conservar lo abierto y no reiniciar pruebas ya aprobadas.
- No declarar comprobación cerrada, ahorro confirmado o cobertura completa si falta algún componente del alcance. Una respuesta HTTP correcta no demuestra exactitud de datos ni recuperación persistente. Un despliegue por sí solo no prueba que la consulta medida ocurrió sin memoria temporal.
- La recuperación persistente de Guía 135 sigue NO CONFIRMADA en producción: la recarga de 14:39:24 UTC tuvo /guide con cero filas leídas; /farmacias a las 14:39:23 UTC informó seis filas entre sus dependencias sin desglose. No presentar ese total como prueba aislada de Guía.
- Las obligaciones de este contrato son del asistente. No pedir al usuario que recuerde el formato, detecte omisiones o repita pruebas por fallas del instrumento. Las reglas escritas no equivalen a un medidor implementado: distinguir ambos estados.
