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
