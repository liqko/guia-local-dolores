# Guía Local — criterio obligatorio de reconstrucción
Fecha: 15/11/2026
Estado: BASE DE TRABAJO; NO ES ARQUITECTURA COMPLETA NI CÓDIGO IMPLEMENTADO.
Rama: arquitectura-base-20261115. Producción no se modifica.

## Alcance irrenunciable: TODO EL PRODUCTO
Se debe preservar y sistematizar la totalidad de las decisiones de producto existentes, no sólo «Configuración de plataforma»: identidad visual, colores, formatos y composición de fichas, estructura de tarjetas, navegación y experiencia de las tres interfaces (Usuario, Anunciante y Gran Hermano); entidades y relaciones; niveles, prestaciones, funcionalidades, valores, adicionales y excepciones; publicidad y su distribución; contenido público y privado; eventos, actividades, promociones, sedes, suscriptores, propietarios, managers, roles, permisos, seguridad, favoritos, notificaciones, soporte, términos, moderación; restricciones y ventanas de edición, publicación y actualización; y reglas territoriales. Esta enumeración es ilustrativa, NO un límite.

## Fuente de requisitos, no plantilla de código
La plataforma actual, sus interfaces, configuraciones, decisiones documentadas y pruebas funcionales son evidencia de requisitos. No copiar su arquitectura interna, duplicaciones o parches. Las reglas contradictorias, incompletas u obsoletas se marcan como PENDIENTES DE DECISIÓN en vez de inventar una respuesta. No sustituir reglas comerciales ni de diseño por supuestos técnicos.

## Método de preservación integral
Para CADA capacidad actual identificar:
- resultado que debe ver/obtener la persona y su comportamiento visible (incluidos aspecto, colores y formato);
- quién la utiliza y quién puede configurarla, aprobarla o revocarla;
- de qué datos y otras reglas depende y qué planos se ven afectados;
- cuándo se actualiza y qué debe ocurrir ante cambios, revocaciones o errores;
- volumen mínimo y extremo (cuentas con 1, 14, 500 anunciantes; sedes múltiples);
- límite y costo económico objetivo para consultar, navegar, guardar, publicar y administrar;
- evidencia de que el diseño nuevo preserva lo anterior y elimina lecturas/escrituras innecesarias.
Toda funcionalidad nueva deberá respetar estos mismos contratos.

## Arquitectura objetivo
Una fuente de autoridad por tipo de dato, cambios autorizados y trazables, vistas derivadas para cada plano, paquetes agrupados o segmentados según la necesidad real, reutilización en el dispositivo cuando corresponda, actualización selectiva y revocación segura inmediata. Se separan los datos públicos de los privados. La programación a la 1:00 y el límite actual de edición diaria se examinan como reglas diferentes; no se asumen ventajas económicas sin medición.

## Economía desde la base
Contabilidad automática por acción completa (incluidos procesos internos y costos del propio medidor): lecturas, escrituras, borrados, SQL/DO y filas, CPU/tiempo facturable si disponible, almacenamiento, transferencia y servicios externos. Tarifas configurables para calcular USD por acción y escenarios de 1, 1.000 y 700.000 operaciones; no descontar cuotas gratuitas en la proyección. Si un componente no puede observarse, el costo se marca PARCIAL, no cero. No generar actividad de producción sólo para medir sin necesidad y autorización.

## Orden obligatorio y salvaguarda
1. Primero inventariar los comportamientos y reglas efectivamente vigentes en los TRES planos, incluyendo sus dependencias visuales y de datos, sin rediseñarlos ni parchear código.
2. Después consolidar los contratos de estructura e información; identificar contradicciones de reglas sin trasladarlas silenciosamente.
3. Diseñar el mecanismo de datos, permisos, actualización, reparto de paquetes y costos a partir de esos contratos.
4. Construir en paralelo con pruebas de funcionamiento, volúmenes y costos. La plataforma actual continúa publicada.
5. Sustituir progresivamente sólo las partes demostradas, sin perder datos, experiencia ni decisiones previas.

No declarar etapas completas si no tienen evidencia. No llamar «terminado» a un documento o una prueba parcial. No crear Worker nuevo ni modificar HTML de producción durante esta fase.
