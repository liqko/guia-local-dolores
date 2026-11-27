# Worker único — continuidad verificada, 15/11/2026

- Consultar primero `auditorias/ESTADO_ACTUAL.md`.
- ÚNICO archivo de Worker en el árbol vigente: `worker/worker206.txt`. Su nombre permanece fijo; la versión interna se actualiza DENTRO del mismo archivo.
- El antiguo `worker/worker200.txt` es una referencia histórica desactualizada. No trabajar sobre ese archivo ni generar copias numeradas. Confirmar por separado la versión realmente instalada en Cloudflare, porque el encabezado del archivo en GitHub no acredita despliegue.
- No crear archivos de Worker alternativos, numerados, temporales ni de entrega. No utilizar rutas históricas mencionadas más abajo como base vigente.
- Antes de editar, leer esta ruta en main y comprobar su SHA, contenido y versión. Integrar sobre esa revisión los cambios concurrentes; no reemplazarla por una copia completa de otra rama o chat.
- Para HTML y otros archivos compartidos se aplica el mismo control: partir de su contenido fresco en main y aplicar SÓLO los cambios de esta intervención. No interpretar como cambios propios la diferencia completa entre main y una copia local atrasada. Conservar referencias, versiones de recursos y arreglos ajenos. La integridad previa a publicar incluye Administración; mantener su comprobación.
- Publicar con comprobación del SHA esperado; si main cambió, volver a leer e integrar antes de escribir. Documentar versión preparada, instalada y cambios pendientes en el registro maestro.
- Las versiones anteriores se consultan en el historial Git, sin restituir copias al árbol de trabajo. Preparar y probar un cambio no autoriza instalarlo en Cloudflare.


## Referencia de incorporación y ejecución — 27/11/2026

**Leer esta sección al iniciar una sesión de desarrollo.** Es la entrada única a las fuentes existentes, no una nueva auditoría ni un estado paralelo. Aplicable a cualquier agente (Devin, Codex, ChatGPT). No releer todo el repositorio ni regenerar inventarios para adquirir contexto.

### Plataforma y contrato técnico

Guía Local es una plataforma territorial escalable por país, provincia y ciudad, con tres interfaces: Usuario (consulta pública, búsqueda, filtros y funciones de cuenta), Anunciante (ficha, sedes, equipo, publicaciones y condiciones comerciales) y Gran Hermano (administración, configuración, moderación, permisos y listados generales). Funcionalidades: Guía comercial, Eventos, Actividades, Promociones, Publicidad, Farmacias, Efemérides, Empleo, Favoritos, Reclamos y Territorio, según cobertura y estado de implementación. Carcasa es un contenedor, no una interfaz adicional. No asumir que cada función está implementada o validada en las tres interfaces.

Firestore es la fuente de registros modificables; un único Worker controla permisos, operaciones y proyecciones; KV y Durable Objects/SQL sirven almacenamiento derivado y coordinación; Firebase Hosting distribuye la aplicación y paquetes públicos versionados por ciudad/módulo; el navegador conserva datos autorizados y recupera diferencias. La publicación pública ordinaria se realiza al corte común 01:00 Argentina, sólo si hay cambios; urgencias autorizadas y revocaciones de seguridad son excepciones. Las mutaciones privadas confirmadas se reflejan en su circuito operativo sin esperar el corte público, con proyección diferencial y sin repetir lecturas; la edición diaria administrativa conserva sus reglas y no sustituye la vigencia de permisos. Los límites, niveles y cupos provienen de configuración real. Conservar identidades, datos, historial y reglas del producto. Estos son requisitos de arquitectura, no certificación de que cada recorrido ya los cumpla.

### Dónde consultar, según la intervención

| Fuente existente | Uso |
| --- | --- |
| [Estado actual](auditorias/ESTADO_ACTUAL.md) | Leer el bloque operativo vigente y las decisiones relacionadas: versión instalada/candidata, pruebas aprobadas, dependencias, bloqueos y siguiente acción. No recorrer todo el historial si no es necesario. |
| [Arquitectura y control](auditorias/ARQUITECTURA_Y_CONTROL.md) | Contrato funcional/económico vigente del 26/11, E1–E7, reglas de ingreso, sincronización, publicación y costos. |
| [Paso 1: mapa dinámico](auditorias/transversal/MAPA_DINAMICO_PUNTO_1.md) | Entradas de interfaz, controles, condiciones, acciones dinámicas y excepciones. Consultar la fila afectada. |
| [Paso 2: catálogo maestro](auditorias/transversal/CATALOGO_MAESTRO.md), [recorridos](auditorias/transversal/RECORRIDOS-PUNTO-2.md) | Identificar IDs AUD y árboles de acciones. El catálogo de 987 es un corte histórico; el definitivo de 989 se documenta en el control del Paso 3. No renumerar ni reconstruir por rutina. |
| [Paso 3: control de cobertura](auditorias/transversal/CONTROL_PASO_3.md), [cadenas](auditorias/transversal/CADENAS_DEPENDENCIAS_PASO_3.md) | Dependencias, funciones sin consumidor acreditado y excepciones. La clasificación documental no acredita funcionamiento real. Consultar la cadena afectada y sus anexos cuando corresponda. |
| [Paso 4: inventario único](auditorias/PASO4_INTERVENCIONES.json) | Seleccionar ID P4, tarea y número en orden_ejecuciones; conservar correlativos, evidencia, estado y pruebas. Leer sólo la intervención y dependencias necesarias; calcular totales desde el inventario vigente, no desde cifras históricas. |
| [Control de módulos](docs/CONTROL_MODULOS.md) | Criterios de cierre de cada recorrido y verificación económica. |

E1: cobertura de recorridos; E2: operaciones comunes; E3: publicación pública; E4: copias privadas/sincronización; E5: integración de clientes y retiro de duplicaciones; E6: pruebas y consumos; E7: entrega integrada y reversión. Son entregables de ingeniería, no nuevas auditorías.

### Forma de ejecutar sin repetir trabajo

1. Tomar la intervención autorizada y su siguiente acción comprobada; si se trata de desarrollo nuevo, identificar el contrato funcional aplicable y enlazarlo al inventario existente cuando corresponda.
2. Cotejar únicamente el código vigente y los árboles/dependencias afectados. Reutilizar diagnósticos, resultados aprobados, pruebas y mecanismos compartidos. Resolver causas comunes en un solo cambio funcional completo, no una sucesión de parches por archivo o interfaz.
3. Implementar y probar en la misma intervención con la puerta preventiva de la sección 5.1. No dedicar una sesión a inventariar nuevamente el proyecto ni repetir pruebas sin cambio que las afecte; los controles automáticos obligatorios de integración/publicación permanecen vigentes.
4. Registrar evidencia, consumos, estado y siguiente acción en el inventario y estado maestro existentes; no crear otro informe de avance ni declarar cierres sin comprobación. El usuario autoriza publicación; cuando falte acceso productivo, registrar el bloqueo y continuar únicamente sobre trabajo independiente autorizado. No pedir ni almacenar credenciales en texto o en el repositorio.

## Continuidad y comunicación — instrucción vigente del usuario, 12/11/2026

- Informar resultados concretos y bloqueos verificables, sin disculpas ni promesas de trabajo en segundo plano al terminar la sesión.
- Reanudar desde el bloque «Estado operativo vigente» al principio del registro maestro. El historial no sustituye ese bloque ni reinicia la acción. Actualizar allí el punto exacto, estado de pruebas y limitación externa antes de terminar cada intervención.
- La regla diaria comprende Usuario, Anunciante y Gran Hermano. Las excepciones de publicación están PENDIENTES DE DEFINICIÓN por el usuario; no inventarlas, declararlas aprobadas ni introducir botones de publicación inmediata por comodidad. Mantener los controles de seguridad existentes no constituye una autorización nueva para publicar datos fuera del corte.

## Publicación diaria transversal — aclaración vigente del usuario, 12/11/2026

- La incorporación de novedades a las copias consultables usa el mismo sistema diario de la 01:00 Argentina en toda la plataforma, no un horario independiente por funcionalidad. Abrir una pantalla, vencer una memoria de minutos o detectar una copia ausente no dispara una nueva publicación.
- Acción actual: INGRESAR → Inicio completo de Gran Hermano. No reabrir Publicidad ni condicionar la entrega de GH a sus pendientes históricos. Preservar el código anterior al integrar; separar historial de cambios, estado real instalado y comprobación de la acción actual.
- Preparar fuentes ausentes pertenece al publicador/mantenimiento inicial autorizado y su costo se registra aparte; la consulta de Inicio sólo lee la edición vigente. Seguridad y validación de las operaciones conservan sus controles actuales.

## Regla general de caché de Gran Hermano — instrucción del usuario, 12/11/2026

- Todo Gran Hermano debe consultar copias privadas preparadas y reutilizables, sin reconstruir información ni volver a leer Firestore por cada apertura, pestaña, filtro o repetición. Aplicar esta regla al auditar cada acción completa; no declarar que ya está implementada en todo el panel.
- Separar configuración estable (catálogos, niveles, valores, parámetros generales y reglas de moderación) de colas cambiantes (soporte, problemas de acceso, altas, reclamos y publicaciones pendientes). Los consumidores de un mismo dato comparten su copia y su mecanismo de actualización, sin multiplicar fuentes por pestaña.
- Instrucción posterior del usuario: todos los datos consultados en GH usan una edición diaria de 24 horas. Altas, cambios y novedades se incorporan una sola vez al día mediante el publicador existente de la 01:00 Argentina; no reconstruir al ingresar ni usar vencimientos de dos/cinco minutos. Los cambios operativos alimentan su fuente; la consulta publicada se renueva en el corte diario común. Esta regla sustituye la frecuencia discrecional de colas y la publicación inmediata de configuración descritas en versiones anteriores.
- Cumpleaños es una vista de nombres y fechas de los próximos siete días sobre el mismo listado general privado de suscriptores. No crear un índice ni un publicador independiente para esa vista.
- Autorización, contraseñas, permisos y revocación de sesiones conservan sus controles vigentes y no esperan la publicación diaria de moderación. La copia de una bandeja no autoriza ejecutar decisiones sobre una versión antigua del registro.
- Distinguir reglas de moderación (configuración) de pendientes de moderación (cola). Mostrar la fecha de preparación cuando la información admita demora; una copia ausente no equivale a una bandeja vacía.
- La posible atención por WhatsApp no autoriza eliminar ni desviar flujos existentes del panel sin una definición expresa. Auditar el funcionamiento que existe y registrar decisiones de canal pendientes.
- No confundir caché con consumo monetario total cero: registrar por separado Firestore, KV, Worker, Durable Objects, SQL, CPU y descargas. La preparación inicial o recuperación se mide aparte de la consulta repetida.

## Vigencias de anunciantes — definición permanente del usuario, 27/11/2026

- Nivel 1 (Gobierno) y 2 (ONG): sin vencimiento sin titular; con titular, renovación cada 90 días. Nivel 3: sin vencimiento sin titular; con titular, cada 30 días. Niveles 4, 5 y 6: 90 días desde la contratación, salvo excepciones expresamente autorizadas.
- En 1–3, asignar titular inicia el período. La edición ordinaria no reinicia la vigencia. Vencer no elimina anunciante, datos, titularidad ni historial, ni bloquea el panel para renovar.
- Fuente única: catálogo `niveles_anunciante`, editado en Gran Hermano → Configuración de plataforma → Niveles → «Vigencia y renovación de anuncios» (por nivel: con titular y sin titular = permanente, cantidad de días o determinada por contratación; y si admite excepciones). Los valores anteriores son sólo iniciales. Las excepciones individuales se administran únicamente desde la ficha del anunciante en GH y no modifican la regla del nivel.
- Cada vigencia se otorga con la regla vigente al asignar/quitar titular, contratar o renovar, y queda guardada en el anunciante: cambiar una regla no altera vigencias ni contrataciones ya otorgadas. Un único mecanismo en el Worker resuelve las reglas para Worker, Anunciante, GH y publicador; no crear circuitos por nivel. Los vencimientos se procesan en el corte ordinario de 01:00 con el publicador existente, sin consultas masivas ni reconstrucciones.

# Contrato rector de ingeniería — Guía Local
**Vigencia: 24/10/2026. Prioridad: estas reglas prevalecen sobre instrucciones técnicas antiguas de este archivo si hay contradicción.**
**Estado de aplicación:** reglas documentadas, NO equivalen a pruebas automatizadas ni garantizan por sí mismas cumplimiento.

## 1. Responsabilidad y límites
- El asistente es responsable del análisis técnico, diseño, implementación, revisión, depuración y evidencia. El usuario define producto, prioridades y valida la experiencia funcional; NO debe programar, auditar código, interpretar métricas técnicas ni repetir instrucciones ya establecidas.
- No describir como realizado, probado, validado, optimizado, instalado o desplegado nada que no cuente con evidencia comprobable del estado correspondiente.
- Jamás desplegar ni modificar producción sin autorización explícita del usuario. GitHub se utiliza para HTML, documentación, ramas y pruebas; el Worker de producción no se modifica en GitHub sin una nueva autorización expresa. Un candidato nuevo no reemplaza al Worker vigente.
- Trabajar en un solo circuito autorizado a la vez. Registrar otros problemas como pendientes sin abandonar el objetivo ni incorporarlos por iniciativa propia.

## 2. Arquitectura de referencia y separación de responsabilidades
- **La plataforma tiene exactamente tres interfaces de usuario:** **Usuario**, **Anunciante** y **Administrador (Gran Hermano)**. Cada funcionalidad puede tener operaciones o vistas en una o varias de esas interfaces. No confundir interfaz con funcionalidad, contenedor visual o servicio técnico.
- **El objeto de trabajo es la funcionalidad seleccionada** y su circuito completo en las interfaces que correspondan. **Carcasa es un contenedor visual**, no una cuarta interfaz ni una funcionalidad universal. **Guía (anuncios), Eventos, Actividades, Farmacias de turno y Efemérides son funcionalidades distintas.** Registrar dónde aparece cada una sin inferir dependencias entre ellas por compartir contenedor.
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
6. Consumo y presentación de **la funcionalidad seleccionada en la interfaz Usuario**, y sus interacciones con Anunciante y Administrador cuando corresponda. Indicar el contenedor visual utilizado, sin tratarlo como una interfaz diferente.
7. Dependencias reales con otros módulos (si existen), sin asumir ninguna.
8. Operaciones/costo por acción y fuentes de medición.
Si un punto no existe, registrar «no aplica» con motivo; si no se comprobó, registrar «pendiente/sin medir». No confundir ausencia de evidencia con resultado correcto.

## 4. Regla antiparches y gestión de cambios
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

## 5.1. Puerta preventiva obligatoria por intervención — 27/11/2026

Aplicar durante el desarrollo original y antes de integrar o presentar un candidato, no como una segunda auditoría posterior. Elegir casos por contrato y dependencias reales; reutilizar pruebas aprobadas no afectadas. Cuando un escenario no corresponda, indicar el motivo brevemente.

- **Integridad de extremo a extremo:** comprobar entrada, autorización, validación, persistencia confirmada, respuesta, proyección privada/pública y lectura final. Las copias deben derivarse del registro confirmado, no de un borrador anterior al guardado. Probar el efecto en los consumidores afectados, no sólo HTTP 200 o presencia de un botón.
- **Datos y estados:** comprobar datos completos, mínimos, ausentes e incompatibles; rechazo explícito de combinaciones inválidas sin limpiar el formulario ni perder datos; conservar identidad, historial y condiciones otorgadas. Una acción sin cambios o cancelada no debe producir escrituras ni consumo de cupo.
- **Transiciones y reversibilidad funcional:** probar tanto el cambio como su inversa (alta/edición, activar/desactivar/reactivar, asignar/revocar, aplicar/retirar excepción, renovar/vencer) cuando apliquen; comprobar transición entre reglas, fechas límite, estados anteriores y efectos programados. No confundir quitar una excepción con sobrescribir la condición base.
- **Concurrencia y permisos:** comprobar cambios de estado, revisión, sesión y permisos entre consulta, preparación, confirmación y guardado; validar con precondición vigente en servidor. Una simulación no autoriza ejecutar sobre datos cambiados. Probar respuestas tardías, solicitudes duplicadas y revocaciones.
- **Recuperación:** comprobar interrupción antes/después de persistir y antes de actualizar proyecciones; reintento idempotente que repare sólo lo pendiente sin repetir escrituras confirmadas, perder datos ni publicar copias obsoletas. Verificar recuperación tras recarga o desde otro dispositivo cuando aplique.
- **Economía:** contar operaciones de todos los servicios afectados, incluyendo dependencias y efectos diferidos; justificar incrementos y evitar duplicaciones. No eliminar permisos, validaciones o consistencia para reducir costos. Distinguir simulación de medición real.
- **Integridad estática:** ejecutar los controles vigentes del Worker completo (`tests/worker/diagnosticos-editor.cjs`, cuando se modifica el Worker), de sintaxis y de los archivos cambiados. No agregar diagnósticos ni ocultarlos con supresiones, exclusiones o cambios de configuración injustificados. Si un verificador difiere del editor productivo, no afirmar equivalencia ni ausencia de errores históricos sin evidencia.
- **Pruebas de regresión:** incluir prueba positiva, negativa y de cada transición o fallo relevante; para correcciones, acreditar que la prueba reproduce el defecto anterior y pasa con el arreglo cuando sea técnicamente posible. No cambiar expectativas para hacer pasar CI: justificar con el contrato aprobado, conservar las garantías y comprobar la diferencia funcional/económica. Los aumentos de operaciones no se aceptan por actualizar contadores sin explicación.
- **Revisión antes de integrar:** revisar el diff propio y los resultados de revisión automática del PR antes de fusionar. Confirmar o refutar hallazgos con evidencia; corregir los fallos funcionales nuevos del alcance y volver a ejecutar las pruebas afectadas. No fusionar ni recomendar publicación con defectos nuevos confirmados sin resolver o sin una excepción expresa del usuario debidamente registrada. Los problemas ajenos no se corrigen por iniciativa propia: se vinculan al inventario existente y se conserva el objetivo.
- **Entrega:** separar candidato implementado, pruebas aprobadas, instalación, verificación autenticada y consumo real. Una prueba verde o una publicación de archivos no demuestra funcionamiento integral. Mantener reversión, autorización expresa y pruebas finales en producción controlada, sin introducir un entorno QA separado.

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

## 7. Regla general aplicable a la funcionalidad seleccionada
- **No fijar ninguna funcionalidad ni contenedor como objeto permanente de este contrato.** Al comenzar cada trabajo, registrar la funcionalidad concreta, sus operaciones en Usuario, Anunciante y Administrador (cuando apliquen), su origen de datos y el contenedor visual de presentación.
- Rastrear el circuito completo de ese módulo: origen de datos, permisos, altas/cambios/bajas, Worker, preparación y almacenamiento de paquetes si corresponde, lectura y presentación en su destino real.
- La caché es una capa técnica, no una interfaz, un contenedor ni una funcionalidad. Su utilización se define según el circuito y los objetivos de eficiencia, sin agregar operaciones redundantes.
- No conectar funcionalidades diferentes por comodidad o por compartir contenedor visual. Una dependencia sólo es válida cuando está justificada por el modelo de datos y está comprobada.
- No tocar otras funciones o circuitos salvo dependencias compartidas expresamente justificadas y autorizadas.
- El código existente es referencia para inventariar contratos y comportamientos, no garantía de diseño correcto. Ningún candidato se instala sin pruebas y autorización.

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
