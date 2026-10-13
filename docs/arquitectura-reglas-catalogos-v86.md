# Guía Local: arquitectura, reglas y catálogos

Revisión del código del 13 de octubre de 2026. Base: B85. Correcciones: B86.

Este documento identifica la estructura implementada. No certifica el contenido de las colecciones de Firebase ni el despliegue manual del Worker. Las pruebas usan Firestore y KV simulados; no consultan las cuentas de producción. El registro de asuntos y pruebas sigue siendo `Guia_Local_Checklist_Maestro.xlsx`.

## Responsabilidad de cada componente

| Componente | Función | Fuente del código |
| --- | --- | --- |
| Panel del anunciante | Editar ficha, sedes y publicaciones autorizadas; soporte y términos | `plataforma/login.html` |
| Guía | Mostrar fichas y sedes públicas, filtros y orden de niveles | `plataforma/anunciantes.html` |
| Gran Hermano | Administrar cuentas, clasificación, cupos, territorio y bandejas de revisión | `plataforma/granhermano.html` |
| Cuenta personal | Datos del usuario y vínculo con cada ciudad | `plataforma/suscriptores.html` |
| Worker | Autorización, validación, escrituras y actualización de cachés | `worker/WORKER_COMPLETO_V86.js` |
| Firestore | Registro duradero de cuentas, publicaciones, catálogos y aceptaciones | Colecciones identificadas por el Worker |
| KV | Catálogos, resultados públicos y proyecciones privadas | Claves identificadas abajo |

Actualizar HTML no instala el Worker. El despliegue de Hosting se realiza desde el repositorio; el usuario instala el Worker completo. La raíz y la cabecera de observación de B86 informan versión 86.

## Inventario de catálogos implementados

La reconstrucción `rebuildCatalogs` lee estas quince colecciones y prepara seis paquetes KV. Es una operación de reconstrucción, no una necesidad de cada visita. Las consultas habituales de catálogos usan KV.

| Colección Firestore | Identificador utilizado | Paquete y campo KV | Administración actual |
| --- | --- | --- | --- |
| `segmentos` | `segmento_id` | `catalogs:commerce:v1.segmentos` | GH: clasificación |
| `niveles_anunciante` | `nivel_id`, `numero` | `catalogs:commerce:v1.niveles_anunciante` | GH: niveles y reglas |
| `funcionalidades` | `funcionalidad_id` | `catalogs:commerce:v1.funcionalidades` | GH: funcionalidades |
| `categorias` | `categoria_id` | `catalogs:commerce:v1.categorias` | GH: categorías de anunciantes |
| `actividades_clave` | `actividad_id` | `catalogs:commerce:v1.actividades_clave` | GH: actividades clave |
| `acciones` | `accion_id` | `catalogs:commerce:v1.acciones` | GH: acciones por sede |
| `nodos` | `nodo_id`, `ciudad_id` | `catalogs:commerce:v1.nodos` | GH: pestaña Nodos |
| `promos_categorias` | `categoria_id` | `catalogs:promos:v1.categorias` | Sin editor en el conjunto de catálogos actual de GH |
| `eventos_categorias` | `categoria_id` | `catalogs:eventos:v1.categorias` | GH: categorías de eventos |
| `lugares` | `lugar_id` | `catalogs:eventos:v1.lugares` y `catalogs:actividades:v1.lugares` | Catálogo compartido entre módulos |
| `actividades_categorias` | `categoria_id` | `catalogs:actividades:v1.categorias` | GH: categorías de actividades |
| `publicidad_categorias` | `categoria_id` | `catalogs:publicidad:v1.categorias` | Sin nueva pestaña creada por esta revisión |
| `publicidad_ubicaciones` | `ubicacion_id` | `catalogs:publicidad:v1.ubicaciones` | Sin nueva pestaña creada por esta revisión |
| `publicidad_prioridades` | `prioridad_id` | `catalogs:publicidad:v1.prioridades` | Sin nueva pestaña creada por esta revisión |
| `eventos_moderacion_palabras` | `regla_id` | `admin:catalogs:v2.moderacion_18` | GH: configuración de barreras |

`admin:catalogs:v2` conserva la proyección administrativa de diez catálogos, incluyendo nodos y reglas de moderación. Los paquetes de módulo filtran los registros activos. El nombre heredado `moderacion_18` identifica barreras de moderación; no es el selector de clasificación adulta. Su posible renombrado requiere migración coordinada.

Guardar un catálogo actualiza un documento y sus paquetes afectados. Un guardado idéntico evita la escritura. Esta revisión no crea categorías, niveles ni nombres supuestos.

## Reglas de nivel unificadas en B86

`gldClassificationV86` es el mismo intérprete en `plataforma/clasificacion.js` y en el Worker completo. Una prueba compara ambos textos para detectar diferencias. Un ID explícito tiene prioridad sobre la coincidencia por número de otro registro. Se conservan los identificadores almacenados.

| Campo de catálogo | Regla configurada | Compatibilidad si está ausente |
| --- | --- | --- |
| `descripcion_max` | Entero no negativo; cero deshabilita el campo | 500 caracteres |
| `adicionales_max` | Entero no negativo; cero deshabilita el campo | 150 caracteres |
| `tags_max`, `tags_habilitados` | Límite y habilitación; cero o deshabilitación impiden nuevas etiquetas | 300 caracteres |
| `imagenes_max`, `imagenes_habilitadas` | Límite y habilitación; hasta cinco posiciones editables y visibles | Niveles 1 y 2: tres. Nivel 3: cero. Otros: cinco |

Estos valores de compatibilidad proceden del comportamiento anterior del código. **No se presentan como datos confirmados de Firebase ni se escriben automáticamente en los catálogos.** Vacío, nulo y ausente significan sin configurar. Cero y falso son explícitos. Las habilitaciones reconocen booleanos, números y las representaciones textuales utilizadas por el sistema. Un límite numérico inválido no habilita contenido.

GH muestra los límites ausentes como «Sin configurar». Cambiar el nombre no inventa límites ni convierte habilitaciones anteriores. Un valor heredado que supera cinco imágenes se conserva al renombrar; su uso efectivo queda limitado a cinco. Cambiar ese valor exige un entero válido. El número de nivel nuevo debe ser entero positivo.

El panel omite los campos que no muestra; no los envía como cadenas vacías. Un campo visible que se borra sí envía el borrado explícito. Las imágenes heredadas fuera del límite permanecen almacenadas al editar otro dato. La guía muestra las posiciones permitidas, evitando traer una imagen oculta de otra posición.

`commerceSetDatosV3` y `commerceSetSedesV3` comprueban solamente los campos modificados. No rechazan contenido anterior sin cambios al editar un teléfono o la actividad. Las sedes se validan completamente antes de comenzar a escribir. Una imagen nueva fuera del límite o un texto modificado que lo supera se rechazan antes de escribir.

## Reglas existentes que siguen fuera del catálogo de niveles

| Regla identificada | Ubicación / responsable | Estado de la revisión |
| --- | --- | --- |
| Orden de tarjetas del nivel 6 al 1 y destacados de nivel 6 | Guía, `compararNivelesGuia`, `getDestacadas` | Regresión simulada aprobada |
| Almacenamiento de publicaciones igual al doble del cupo asignado | Worker, `cupoGuardado`; GH y panel muestran la derivación | Regresión simulada aprobada |
| Una sede visible, un teléfono y un WhatsApp en nivel 3 | Guía, `renderContactoNuevo` | Política fija identificada; no se cambió ni se inventó su reemplazo |
| Redes con distinto tratamiento y diseños por nivel | Guía, `renderRedesBloque`, `renderRedesNivel3`, `renderRedesNivel4` | Política fija identificada; requiere contrastar criterio comercial |
| Descripción no mostrada en diseño de nivel 3 e información adicional no integrada en la tarjeta | Guía, ramas de `renderCard` | Diferencia identificada; pendiente definir exposición con reglas reales |
| Cinco posiciones de imágenes como máximo efectivo | Guía, panel y Worker | Regla técnica común B86 |
| Publicaciones normales directas; clasificación +18 y barreras independientes envían a revisión | Worker, publicación V77 | Regresión simulada aprobada |
| Acceso adulto exige sesión y fecha declarada válida; menor bloqueado | Worker y `contenido-adulto.js` | Regresión simulada aprobada; fecha declarada no acredita identidad |
| Novedades visibles durante diez días | Worker, bandeja de publicaciones recientes | Regla fija identificada; no requiere aprobar cada publicación |
| Eventos Free sin enlaces adicionales; VIP mantiene enlaces permitidos | Worker, `removeFreeEventLinks` | Política existente conservada |
| Modalidades presencial, virtual y mixta | Eventos y Worker | Implementación anterior conservada |
| Ciudad obligatoria de cada nodo y relaciones por sede | GH, territorio y Worker | Regresión simulada aprobada |
| Redes y web comunes opcionales, con información independiente por sede | Panel y Worker | Datos conservados; requiere comprobación real |
| Límites de texto propios de promociones, eventos Free y publicidad | Formularios del panel | Identificados; no se aplicó la regla de niveles a módulos ajenos |

No todos estos criterios deben convertirse automáticamente en configuración. Cambiar políticas comerciales sin verificar el catálogo real repetiría el problema de inventar reglas.

## Permisos, aceptación y edad

La sesión de suscriptor contiene relaciones autorizadas por anunciante. Propietario y administrador pueden modificar la ficha; el rol manager tiene restricciones. La moderación local se limita a las ciudades asignadas. Las pruebas de ciudad propia, ajena, no asignada y evento multiciudad siguen aprobadas.

La aceptación de términos se guarda por cuenta y versión, con fecha del servidor e historial. El texto exacto queda archivado en `terminos_anunciantes/{version}`. Repetir una aceptación vigente no escribe. Una nueva versión exige revisión y nueva aceptación. La declaración de una publicación sigue siendo un requisito separado.

La fecha de nacimiento ausente se puede completar una vez. Una fecha ya registrada requiere corrección por soporte; el formulario no permite que un menor la cambie para eludir el bloqueo. Residencia, ciudad natal y vínculo residente/visitante con cada ciudad se mantienen separados, sin reinterpretar campos anteriores.

## Consumo comprobado y límites de las pruebas

| Acción B86 en entorno simulado | Resultado |
| --- | --- |
| Guardar datos idénticos con ficha cacheada | Cero consultas y cero escrituras |
| Cambiar un dato válido de la ficha | Una escritura del documento afectado |
| Rechazar texto o imagen fuera del límite con datos administrativos cacheados | Cero consultas y cero escrituras |
| Renombrar nivel con reglas administrativas cacheadas | Cero consultas; una escritura; campos anteriores conservados |
| Sede ajena o segunda sede inválida | Cero escrituras de todas las sedes de la operación |
| Leer catálogos habituales | KV; no se añadió reconstrucción automática ni sondeo |

La primera lectura de una ficha, administración o lista sin caché puede requerir Firestore. B86 utiliza las proyecciones existentes para validar, sin añadir una consulta de colección para buscar el nivel. Estas pruebas no establecen consumo global, rendimiento a escala, ni coherencia inmediata entre regiones de KV.

## Pendientes para cerrar la auditoría original

1. Contrastar números, identificadores y reglas efectivamente almacenados en Firebase: PEN-019, PEN-020, PEN-021 y PEN-024.
2. Decidir qué diferencias de exposición comercial identificadas deben mantenerse o corregirse: PEN-022, PEN-057 y PEN-058.
3. Verificar nombres/filas de los quince catálogos reales; el inventario del código está hecho, el contenido real sigue abierto: PEN-056.
4. Comprobar B86 instalado, editar una ficha de prueba y registrar trazas reales: PEN-060, pruebas P89–P92.
5. Retirar código de migración o ramas antiguas solamente después de comprobar los caminos efectivos: PEN-059.

PEN-061 sigue como mantenimiento continuo de documentación. Los desarrollos futuros conservan su estado; esta revisión no los marca realizados.

## Pruebas reproducibles

`tests/catalog-rules-frontend-v86.mjs` comprueba payloads sin campos ocultos, borrado explícito, ID exacto, reglas con cero y booleanos, edición de GH que conserva valores heredados, galerías y equivalencia del intérprete. `tests/existing-functions-v86.mjs` usa Firestore/KV simulados y comprueba validación antes de escritura, guardado idéntico, permisos y regresiones de términos, edad, territorio y publicación. Los tests restantes de B85 siguen documentando los circuitos anteriores.
