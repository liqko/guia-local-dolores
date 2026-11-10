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
- **Actualización posterior:** quedó acordado un máximo de tres piezas por carrusel compartido; ver sección «Reglas generales de distribución y adicionales».
- Elegibilidad según búsqueda, módulos, ciudad, nivel y capacidad disponible; posible exposición adicional para nivel 6, sin desplazamiento automático de otras piezas ni garantía de frecuencia.
- **Actualización posterior:** carrusel propio de 3 a 5 imágenes; ver sección de reglas generales.
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

## Reglas generales de distribución y adicionales · Actualización 10/11/2026

**Jerarquía documental:** esta sección reúne las decisiones y propuestas más recientes. Cuando alguna descripción anterior de este documento indique que un criterio sigue pendiente (por ejemplo, densidad de publicidad, carrusel compartido o tamaño de carrusel propio), prevalecen los acuerdos expresos consignados aquí. **Esto no prueba implementación:** es definición para documento comercial, vendedor y posterior desarrollo técnico.

### A. Reglas generales acordadas

1. **Relevancia primero ante búsquedas específicas.** Los anuncios con coincidencia directa con la búsqueda tienen prioridad aun si son Nivel 5 y compiten con anunciantes Nivel 6 no relacionados. Ejemplo: «casa crematoria» con un único anunciante relevante de Nivel 5: se muestra primero ese anuncio. Un anuncio Nivel 6 no relacionado no lo desplaza; puede presentarse después en el circuito general.
2. **Categoría relacionada como segundo criterio.** Si no existe publicidad de coincidencia directa, se buscan anuncios de actividades/categorías vinculadas. Ejemplo: «carnicería» → primero carnicerías; si no hay, anuncios de «alimentos y bebidas», como almacenes o supermercados. **Dentro de la misma banda de relevancia**, tiene preferencia Nivel 6 frente a Nivel 5.
3. **Publicidad general y búsqueda amplia.** Cuando se muestra la Guía general, una actividad clave amplia (ej., turismo) o no existen anuncios de pertinencia suficiente, la distribución general ordena Nivel 6 → Nivel 5 → otros niveles autorizados como excepción; al completar los anuncios elegibles el circuito vuelve a empezar. La presencia de un anunciante excepcional Nivel 1 no lo convierte por sí sola en Nivel 6.
4. **Densidad fija acordada:** un espacio publicitario cada dos tarjetas de resultados. Una página de diez tarjetas produce cinco espacios publicitarios. El reparto exacto de formatos y anunciantes entre esos espacios es parte de la especificación técnica por cerrar.
5. **Carrusel compartido del espacio publicitario: MÁXIMO TRES piezas visibles/entradas por carrusel, no más.** Se exhibe **una sola pieza por anunciante** dentro de ese carrusel. Un anunciante que contrató un carrusel propio de 3 a 5 imágenes no introduce todas sus imágenes dentro del carrusel compartido: se utiliza una imagen representativa cuando participe en ese formato. Si técnicamente se habilita un Short como pieza, su incorporación debe respetar igualmente el límite de tres participantes/piezas. **Nunca construir un carrusel compartido ilimitado.**
6. **Carrusel propio del anunciante:** es una creatividad individual compuesta por **3 a 5 imágenes del mismo anunciante**, distinta del carrusel compartido de anuncios. No aplicar el máximo de tres del carrusel compartido a este formato.
7. **Formatos comerciales:** imagen individual, carrusel propio y Short. Los tres formatos no son intercambiables sin definición de contratación, y los límites de edición/guardado de Publicidad siguen vigentes.
8. **Nivel 6 tiene prioridad comercial, pero no anula la relevancia.** Si se requiere una segunda exhibición general de Nivel 6 después de un anuncio directamente relevante, esta debe integrarse en los espacios permitidos y sin sustituir la primera coincidencia relevante. El mecanismo concreto de esa segunda exhibición queda por diseñar y comprobar.
9. **Excepciones individuales:** pueden permitir publicidad de anunciantes de niveles inferiores (campañas solidarias o institucionales, entre otras), pero no conceden automáticamente prioridad del Nivel 6. Deben registrarse como excepción autorizada por anunciante.
10. **Sin escrituras por exhibición ni rotación.** Las creatividades se cargan por URLs; al presentar anuncios se selecciona entre las piezas ya habilitadas usando datos disponibles o caché, sin persistir cambios por cada impresión. Las cargas y ediciones manuales siguen los topes configurados; tener rotación contratada NO permite reemplazar continuamente material ni eludir el número de ediciones permitidas.

### B. Primer adicional comercial acordado: Rotación automática

- **Catálogo único:** se crea en **Gran Hermano → Resumen comercial y valores → Valores → Adicionales**; se asocia con la funcionalidad **Publicidad**. Allí deben definirse nombre, descripción, estado y precio cuando se decida. No duplicar creación o precio en Configuración comercial ni en la calculadora.
- **Modalidad comercial:** un adicional contratado, con **precio fijo por la prestación de rotación** (importe todavía sin definir), no un cobro individual por imagen.
- **Imagen individual contratada:** la pieza visible puede alternar automáticamente entre **2 imágenes como mínimo y 3 como máximo**, ya cargadas y autorizadas, sin multiplicar la cantidad simultánea contratada.
- **Carrusel propio contratado:** la pieza visible puede alternar automáticamente entre **2 carruseles completos como mínimo y 3 como máximo**, cada uno de **3 a 5 imágenes**. Rota el carrusel completo; no se mezclan arbitrariamente imágenes entre carruseles.
- **Momento de selección:** la rotación se realiza cuando el motor tenga que elegir una pieza para exhibir, de acuerdo con la distribución; **no se acordó un temporizador por minutos u horas**. La técnica exacta para procurar alternancia y evitar favoritismos queda por cerrar.
- **Edición y carga:** el beneficio de rotación no amplía la cantidad de ediciones, cambios de estado o guardados manuales permitidos. La compra debe informar al anunciante cuántas piezas debe preparar y subir antes de agotar sus oportunidades de edición.
- **No confundir:** rotación de creatividades del mismo anunciante, circulación de anunciantes por los espacios, carrusel compartido y venta de posiciones destacadas son cuatro cuestiones distintas.

### B.1. Rotación ordinaria entre anunciantes del mismo nivel (regla general acordada)

- **El orden dentro de un mismo nivel no es fijo.** Si hay cinco anunciantes de Nivel 6 elegibles para un contexto, cada uno participa de la rotación de posiciones: uno que hoy se presentó primero puede aparecer en quinto lugar en otra presentación, y quien estaba quinto puede presentarse primero. Se aplica independientemente del formato contratado (imagen, carrusel propio o Short), dentro de los espacios y condiciones de elegibilidad.
- Esta rotación es **automática y forma parte de la distribución general**: **no requiere contratar el adicional «Rotación automática de creatividades»**, que tiene otra finalidad (alternar piezas del mismo anunciante).
- En búsquedas específicas, **la rotación solo reordena anuncios comparables por relevancia y nivel**. Nunca debe adelantar una publicidad no relacionada por delante de otra directamente relevante solo porque «le toca» rotar.
- El ejemplo «hoy primero, mañana quinto» explica el cambio de posiciones, **no establece una frecuencia diaria**. La frecuencia, el método de alternancia y la forma de evitar escrituras por cada exhibición serán objeto de especificación técnica.
- **Excepción futura por evaluar:** se podría comercializar la reserva de **las tres primeras posiciones publicitarias**, asociadas especialmente a la primera página de resultados (diez tarjetas, cinco espacios de publicidad). Esa reserva **no está aprobada**, ni se debe prometer al vendedor/anunciante, y habría que resolver cómo convive con la relevancia de una búsqueda y la rotación del resto.

### C. Decisiones comerciales y proyectos aún NO aprobados

1. **Posiciones publicitarias privilegiadas:** evaluar si en el futuro se podrán vender, por ejemplo, **tres primeras posiciones** en distintas páginas de diez tarjetas; no están aprobadas como producto ni pueden prometerse. Evaluar también si la contratación de rotación sería obligatoria para tal producto. La relevancia debe seguir siendo prioritaria en búsquedas específicas.
2. **Método técnico de la rotación ordinaria:** la alternancia de posiciones entre anunciantes del mismo nivel **ya está acordada**; falta definir el algoritmo, sus garantías de equilibrio, su comportamiento entre páginas y la posible ponderación de posiciones adicionales, sin escrituras por impresión ni promesas de impresiones no verificadas.
3. **Exposición de Nivel 6 no pertinente:** concretar cómo presentar una pieza general de Nivel 6 después de anuncios relevantes, cuándo queda fuera de un carrusel y cómo no desplazar anuncios de categorías próximas.
4. **Unificación de Short, imagen y carrusel propio en espacios de pantalla:** definir elección de pieza, reproducción, representación en carrusel compartido y límites visuales; no inventar una equivalencia entre un carrusel propio y un Short.
5. **Cobertura y excepciones por contrato:** revisar combinaciones de ciudades, módulos, cantidad contratada y derechos especiales. La calculadora debe leer el catálogo central, no recrearlo.
6. **Documentación para ventas:** antes de comercializar, redactar una ficha clara con casos de búsqueda específica, categoría relacionada y Guía general, límites y condiciones de las excepciones. Sin garantías implícitas de primera posición.

**Alcance de esta actualización:** registro de decisiones y proyectos. No se modificaron reglas ejecutables, contratos, anuncios, pantallas ni Worker. La integración técnica requiere pruebas de relevancia, distribución, paginación, caché, seguridad de datos y ausencia de escrituras por impresión.


## Formatos de contratación y síntesis para Planes y servicios · 10/11/2026

### Decisiones comerciales acordadas

- **La publicidad tiene tres formatos de contratación diferenciados y con importes propios** (todavía no se fijan aquí los valores):
  1. **Imagen individual:** una imagen del anunciante en un **carrusel compartido** con publicidad de otros anunciantes. El carrusel compartido conserva el máximo acordado de **tres piezas y una pieza por anunciante**.
  2. **Carrusel propio:** una pieza del anunciante compuesta por **3 a 5 imágenes** del mismo anunciante. Es diferente del carrusel compartido.
  3. **Short:** una pieza audiovisual del anunciante en formato Short; se contrata como formato independiente.
- **No valen lo mismo:** cada formato requiere precio comercial independiente en **Resumen comercial y valores → Valores**. No inventar importes ni tratarlos como productos equivalentes.
- **Rotación automática de creatividades** es un **adicional** al formato contratado y **no sustituye** el precio de imagen, carrusel propio ni Short. Se mantienen las condiciones acordadas para rotar 2–3 imágenes individuales o 2–3 carruseles propios; no extrapolar aún al Short sin definirlo expresamente.
- **Unidad publicitaria / módulo contratado:** se contrata una unidad de un formato (imagen individual, carrusel propio o Short), y pueden adquirirse varias unidades; por ejemplo, dos unidades duplican la cantidad de ese componente contratado. Los tres formatos pueden combinarse según contratación. **No convertir una cantidad de unidades en una garantía de espacios simultáneos, posiciones fijas ni impresiones:** la exhibición respeta las reglas de relevancia, nivel, espacios disponibles y rotación ordinaria ya documentadas.
- **Límites máximos de unidades contratables:** todavía no acordados; no establecer un máximo arbitrario.

### Cambio posterior de presentación pública (pendiente de implementar)

En **Planes y servicios**, sumar una síntesis legible, alimentada por **los parámetros reales vigentes de las funcionalidades** y sus valores comerciales, sin duplicar otro catálogo de cupos ni fijar cantidades manuales desactualizables:

- **Eventos Free:** indicar que es **gratuito** y sintetizar los límites existentes, por ejemplo **hasta 2 eventos simultáneos y 4 altas por mes**, si esos siguen siendo los valores configurados.
- **Eventos VIP:** mostrar cupo de eventos simultáneos y, si existe una cuota mensual definida en parámetros, esa cuota. **No inventar una cuota mensual cuando no esté parametrizada**.
- **Actividades y Promociones:** mostrar cupos simultáneos y demás límites comerciales pertinentes (y mensuales solamente si existen como parámetros efectivos).
- **Publicidad:** explicar la unidad publicitaria y los tres formatos diferenciados: **una imagen individual en carrusel compartido**, **un carrusel propio de 3 a 5 imágenes** o **un Short**; aclarar que la cantidad de unidades contratadas escala lo adquirido, mientras la exhibición se rige por distribución. No prometer un lugar fijo.
- La implementación de esta síntesis corresponde a una tarea posterior: **no modificar ahora Planes y servicios mientras se cargan los valores**.

**Estado:** definiciones registradas para ventas y desarrollo; sin cambios de Worker, HTML, importes ni contratos.
