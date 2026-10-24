# Reglas de trabajo de Guía Local

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
