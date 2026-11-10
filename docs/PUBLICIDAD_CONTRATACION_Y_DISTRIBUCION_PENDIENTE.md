# Publicidad · contratación, formatos y distribución (definición en curso)

**Fecha:** 10/11/2026. **Estado:** documento de continuidad y decisiones por validar, NO especificación implementada. **Alcance:** separar parámetros generales de Gran Hermano, condiciones particulares de contratación, comportamiento de presentación y reglas de distribución. No modificar HTML ni Worker a partir de este texto sin cierre de definiciones.

## Criterios confirmados en conversación

1. La publicidad debe ser **relevante a la búsqueda** y su distribución depende del módulo, el espacio disponible, el nivel y las condiciones particulares del anunciante. La Guía general es un contexto distinto de búsquedas específicas y de Eventos/Actividades/Promociones. No asumir impresiones o lugares adicionales garantizados sin capacidad.
2. **Las posiciones publicitarias** son participaciones en un circuito de distribución; no equivalen por definición a cantidad de piezas, anuncios guardados, espacios físicos de pantalla ni impresiones garantizadas. Su prioridad/uso (incluido el posible beneficio de nivel 6) se definirá en las reglas de exhibición, separadas de la contratación.
3. **Formatos de la creatividad:** imagen (una imagen), carrusel del anunciante (varias imágenes del mismo anunciante), Short (video). Se pueden habilitar solos o combinados por contratación.
4. **Carrusel del espacio publicitario** no es lo mismo que **carrusel contratado**. El primero es un contenedor/espacio de pantalla que puede alternar anuncios de *distintos anunciantes*; el segundo es una creatividad con varias imágenes del *mismo anunciante*. No confundir ambas capacidades ni facturarlas como una sola.
5. **Destinos de una pieza:** seguir las reglas ya existentes del panel (web o ficha del anunciante); no añadir aquí un parámetro editable de cantidad de enlaces.
6. **Ediciones y cambios de estado manuales** pueden causar escrituras y deben tener límites configurables. La rotación automática de piezas ya cargadas se pretende calcular sin escritura periódica por cada aparición o cambio automático. Guardar URLs en una operación es un objetivo de diseño, no una medición confirmada.
7. Todas las funcionalidades tendrán casilla **Admite excepciones**, marcada por defecto; las excepciones son puntuales por anunciante y no cambian los parámetros generales.

## Separación de ámbitos

### Parámetros generales de Gran Hermano (a cerrar)
- Cupo de piezas por paquete, guardadas (activas/pausadas), límites de edición por día/semana/mes y cambios manuales de estado por semana.
- Formatos técnicamente habilitables y límites técnicos por formato, especialmente imágenes máximas por carrusel del anunciante; imagen simple = una sola imagen.
- Límites de caracteres de los campos publicitarios que existan y casilla «Admite excepciones».
- Los valores generales no establecen tarifas, módulo concreto, vigencia ni modalidad particular de cada anunciantes.
- No establecer aún rotación automática e intervalo como parámetros generales: se está evaluando tratarlos como beneficios/condiciones de contratación.

### Contratación particular del anunciante (se definirá por separado)
- Formatos permitidos: solo imágenes, solo carruseles, solo Shorts o combinaciones.
- Cantidad de cada formato, piezas activas, creatividad guardada, posibles beneficios de programación/rotación automática y modalidades mixtas.
- Cobertura por ciudades y por módulos (Guía, Eventos, Promociones, Actividades), fechas de vigencia y modalidad.
- Precio, promociones comerciales y niveles de servicio por formato: imagen simple más accesible, carrusel y Short con precio diferencial, paquetes combinados; **sin precios definidos**.
- La contratación no equivale a promesa de aparecer en todos los espacios ni a impresiones garantizadas.

### Presentación/distribución (otra definición, no introducir como «parámetro de cupo»)
- Intercalación de publicidad entre tarjetas de contenido y posibilidad de un carrusel de anuncios distintos dentro de un espacio; número de espacios y reglas de pertinencia deben comprobarse en implementación actual.
- El usuario propuso, como ejemplo a evaluar, un espacio carrusel con tres anuncios de anunciantes distintos; **no aprobado como capacidad fija**.
- Elegibilidad según búsqueda, módulos, ciudad, nivel y capacidad disponible; posible exposición adicional para nivel 6, sin desplazamiento automático de otras piezas ni garantía de frecuencia.
- Una creatividad «carrusel» del propio anunciante podría habilitar hasta cinco imágenes como ejemplo; **cantidad definitiva pendiente de fijar**.
- Ejemplo no aprobado de paquete comercial: tres imágenes, tres carruseles y tres Shorts, con exhibición alternada por el sistema y capacidades de piezas guardadas adicionales.

## Puntos aún no cerrados
1. Tabla definitiva de parámetros de Publicidad en el HTML de Gran Hermano, sin confundir límites técnicos con precio/beneficios.
2. Modelo de combinación de formatos y cantidad de creatividades por anunciante y contrato.
3. Si programación/rotación automática e intervalo son opciones incluidas en cada contratación o capacidades generales seleccionables; cómo alternar sin escrituras recurrentes.
4. Modelo de ocupación de los espacios, prioridad, filtrado por relevancia, y tratamiento preciso de «posiciones publicitarias».
5. Evidencia sobre consumos y escrituras antes de imponer límites por ahorro.

## Proceso convenido
Definir en conversación Promociones, Actividades, Eventos VIP, Eventos Free, Publicidad y Empleo. Una vez acordadas todas las tablas y reglas transversales, hacer **una única revisión integral del HTML de Gran Hermano**, comprobar la interfaz, después adaptar Worker y por último panel del anunciante. **Worker 169 instalado: no modificar aún por esta discusión.**

## Corrección transversal acordada · 10/11/2026

**Separación obligatoria para todas las funcionalidades:** Gran Hermano define parámetros y topes generales *por paquete* (cuando se trate de productos contratables), no cuántos paquetes adquirió un anunciante. La cantidad contratada (×1, ×2, ×3, ×4, cantidad personalizada, etc.) se asigna de manera individual en la contratación, **no** en el catálogo de parámetros generales. La posibilidad de una excepción particular se conserva mediante «Admite excepciones», marcado por defecto, sin modificar las reglas generales.

- **Promociones:** cantidad base por paquete, guardadas, ediciones, cambios de estado, caracteres e imágenes en la configuración general. Número de paquetes adquiridos y condiciones particulares en contrato.
- **Actividades:** mismo criterio, con sus límites específicos.
- **Eventos VIP:** eventos por paquete y demás límites generales; cantidad de paquetes en contratación.
- **Eventos Free:** límites de cupo mensual, activos simultáneos, guardados y demás reglas generales, sin multiplicadores comerciales de paquetes.
- **Publicidad:** parámetros generales de piezas/capacidades técnicas y formatos posibles; no establecer desde configuración general la mezcla de formatos contratados. Imagen simple es una imagen; se propone carrusel del anunciante de **3 a 5 imágenes** (valores a confirmar como topes generales), y Short con parámetros técnicos aún por definir. Paquetes mixtos, cantidad por formato, rotación como beneficio, cobertura, vigencia y precio van en la contratación individual. Las posiciones publicitarias son parte de reglas de distribución separadas.
- **Empleo:** pendiente de definición con este mismo criterio.

**Propuesta futura, no implementada:** interfaz de vendedor para generar presupuestos/contrataciones, vincularlos mediante ID del anunciante y reflejar sus derechos y capacidades en su ficha de Gran Hermano y en su panel de login. No confundir propuesta con funcionalidad existente.

**Proceso:** continuar diseño funcional aquí, sin más modificaciones al HTML ni al Worker 169 hasta la revisión integral acordada.


## Regla única de habilitaciones y contratación · 10/11/2026

**Corrección acordada/propuesta para revisión integral:**

- Separar tres capas: **parámetro general** (capacidad base por unidad del servicio en Gran Hermano), **contratación específica** (cantidad de unidades, formato y beneficios asignados al ID del anunciante) y **habilitación efectiva** (resultado único aplicado por Worker y mostrado en Gran Hermano y panel anunciante). No ejecutar cálculos paralelos diferentes en cada interfaz.
- El criterio general declarado por el usuario para servicios de publicaciones es **capacidad de guardado igual al doble de la cantidad contratada**, incluidos activos y pausados. No confundir «guardados» con una cifra absoluta global ajena al contrato. Revisar el tratamiento específico de Eventos Free, que no son un producto comercial, y de Publicidad por formato antes de implementar.
- Ejemplo: Eventos VIP con 10 eventos por unidad y 5 paquetes adquiridos → 50 eventos de capacidad contratada, 100 guardados si aplica la proporción 2×. Ejemplo ilustrativo, no cuota de producción.
- Publicidad: **retirar como criterio general indiferenciado «piezas publicitarias por paquete»**. Unidad básica por formato: imagen individual = 1 imagen; carrusel contratado = 1 pieza de varias imágenes (propuesta de 3 a 5); Short = 1 pieza por enlace de YouTube Shorts. La contratación decide cantidades de cada formato y combinaciones; no son sustituciones automáticas entre formatos.
- La **rotación automática** es un derecho adicional de contratación: una pieza activa de imagen podría alternar 3 creatividades ya cargadas sin convertirse en 3 piezas simultáneamente activas; «3» es ejemplo, no límite acordado. No confundir con «posiciones publicitarias» de distribución de anuncios ni con carruseles de anuncios de diferentes anunciantes.
- Casilla «Admite excepciones» marcada de manera predeterminada para todas las funcionalidades; desmarcarla impide habilitaciones particulares fuera de la regla. Las excepciones son por anunciante, no cambios del catálogo general.
- La **calculadora de vendedor y el circuito de presupuesto → contratación confirmada → habilitación en ficha del anunciante por ID** son prioritarios para esta semana según solicitud del usuario; no existen todavía como sistema de contratación integrado. La fecha objetivo no es evidencia de implementación.
- Pendientes antes del HTML y Worker: fórmula precisa del doble de guardados según servicios, jerarquía de excepciones y derechos comerciales, definición de reglas técnicas específicas de Publicidad, y contrato registrado sin escrituras repetidas. No tocar Worker 169 durante esta etapa de definición.


## Información del anunciante y límites por nivel · 10/11/2026

**Nueva necesidad transversal (todavía no implementada):**

- El ítem «Modificar» que el usuario ve dentro del catálogo de Funcionalidades **no corresponde a un producto/funcionalidad comercial**. Revisar su origen en el catálogo real antes de renombrarlo, y presentarlo como **«Información del anunciante»** o **«Edición de la ficha del anunciante»**; conservar el permiso de edición habilitado.
- Definir para la ficha del anunciante límites de modificaciones **por día, semana calendario de lunes a domingo y mes**, ajustables **según nivel** (en particular, no permitir ediciones ilimitadas por defecto en nivel gratuito). Convención −1 ilimitado, 0 ninguno, entero positivo máximo. Valores orientativos mencionados: 1/día, 2/semana, 4 o 5/mes, **no aprobados como valores definitivos**.
- Una edición consiste en **un guardado efectivo** con modificaciones; cambiar varios campos en un solo guardado se contabiliza como una edición. Guardar datos idénticos o simplemente visualizar la ficha **no debe consumir cuota de edición ni generar escrituras**.
- El mecanismo debe distinguir permisos y límites por nivel, excepciones individuales (si se admiten), derechos efectivos de contrato y escrituras reales. No duplicar reglas contradictorias entre GH, vendedor, panel anunciante y Worker.
- Precaución: una limitación comercial de cambios no debe impedir correcciones urgentes de datos falsos, protección o cumplimiento; permitir vía administrativa si procede.
- **Publicidad:** el criterio general de biblioteca guardada 2× no necesariamente basta para una rotación comercial de creatividades. Capacidad de rotación, número de creatividades y periodicidad deben ser derechos derivados del contrato y resueltos sin una escritura por cada presentación. Evitar confundir rotación automática con edición manual o estado.
- **Pendiente:** auditar en detalle parámetros de todos los niveles y el catálogo actual «Modificar», luego completar todas las definiciones y efectuar una sola implementación integral de HTML, después Worker y panel.
