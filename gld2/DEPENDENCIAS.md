# GLD2 · MAPA DE DEPENDENCIAS — auditoría independiente de segundo pase
Estado: **NO APROBADO PARA IMPLEMENTACIÓN GLOBAL**. Revisado el 15/11/2026 contra `AGENTS.md`, `docs/CONTROL_MODULOS.md`, `plataforma/administracion.html` y `docs/PUBLICIDAD_CONTRATACION_Y_DISTRIBUCION_PENDIENTE.md` de main. No implica prueba de ejecución ni exhaustividad de los campos.

## Convención indispensable

- **C — confirmada:** hay evidencia concreta del vínculo en un contrato o código inspeccionado (productor/campo/consumidor); **una pestaña visible solo confirma existencia de interfaz, no dependencia funcional**.
- **D — definida:** decisión de arquitectura GLD2, aún sin implementación ni prueba.
- **P — pendiente:** relación posible, **NO afirmarla como obligatoria**.
- Flecha A → B significa que **B consume el dato/regla A**. No significa automáticamente que un cambio de A exija reconstruir B: la invalidación depende de los campos realmente usados.
- La relación puede ser bidireccional y transitar varios módulos. La explicación de cada ruta debe identificar lectura, escritura, regla, origen, actor, caducidad e instrumentación.
- Cada dependencia debe tener identificador, evidencia y prueba de cambio. Un diagrama sin esas pruebas no acredita cobertura.

## Mapa 1: estructura técnica transversal (D, diseño aún no probado)

```mermaid
flowchart TD
  U[Usuario] --> API[API única]
  A[Anunciante] --> API
  GH[Gran Hermano] --> API
  API --> ID[Identidad y sesión]
  ID --> AUT[Permisos vigentes]
  AUT --> VAL[Validación de acciones]
  CFG[Configuraciones versionadas] --> VAL
  VAL --> DOM[Servicios por dominio]
  DOM --> DATA[Datos maestros y transacciones]
  DATA --> OUT[Eventos de cambio / outbox]
  OUT --> PROJ[Proyecciones de publicación]
  PROJ --> MAN[Manifiestos versionados]
  MAN --> CACHE[Caché de paquetes públicos]
  CACHE --> U
  API -. instrumentado .-> MET[Medición por operación]
  DATA -. instrumentado .-> MET
  OUT -. instrumentado .-> MET
  PROJ -. instrumentado .-> MET
  CACHE -. instrumentado .-> MET
  MET --> COST[Cuotas, USD y conciliación]
```

La capa de autorización controla mutaciones y accesos privados, **no obliga a consultar una base de permisos por cada lectura pública anónima**. La identidad no se impone indiscriminadamente a contenido abierto. La publicación no se interpreta como permiso para difundir antes del corte previsto.

## Mapa 2: configuración y producto (EXISTENCIA DE CONTROLES comprobada; **todas las flechas funcionales no rastreadas son P**)

```mermaid
flowchart TD
  GH[Gran Hermano] --> T[País / provincia / ciudad]
  GH --> N[Nodos]
  GH --> S[Segmentos]
  GH --> L[Niveles]
  GH --> PRES[Prestaciones disponibles]
  GH --> F[Funcionalidades]
  GH --> CAT[Categorías de anunciantes]
  GH --> AK[Actividades clave]
  GH --> ACC[Acciones]
  GH --> CE[Categorías de eventos]
  GH --> CA[Categorías de actividades]
  GH --> RO[Roles internos]
  GH --> MOD[Moderación y +18]
  GH --> TER[Términos de anunciantes]
  GH --> VAL[Valores y comerciales]
  T --> SEL[Selector de ciudad]
  T --> INDEX[Índices territoriales públicos]
  RO --> AUTH[Autorizaciones vigentes]
  L --> CONTR[Planes y condiciones]
  F --> CONTR
  PRES --> CONTR
  CONTR --> ADV[Anuncios y fichas]
  CAT --> ADV
  S --> ADV
  CE --> EVT[Eventos]
  CA --> ACT[Actividades]
  CONTR --> PUB[Publicidad]
  PUB --> SPACE[Espacios de exhibición]
  EVT --> DISPLAY[Vista pública de Eventos]
  ACT --> DISPLAY2[Vista pública de Actividades]
  ADV --> GUIDE[Vista pública de Guía]
```

**Precaución:** las flechas del mapa 2 que nacen de Gran Hermano representan controles visibles, no prueba de lectura, escritura ni invalidación. Las flechas entre catálogos y funciones son hipótesis **P** hasta identificar productor, nombre de campo, consumidor y acción concreta.  Por ejemplo: `Nodos`, `Acciones`, `Actividades clave` y `Segmentos` existen, pero sus efectos exactos sobre cada pantalla deben localizarse en código y contrato antes de cerrar el mapa. El documento de Publicidad contiene explícitamente decisiones aún abiertas: no elevarlas a reglas técnicas aprobadas.

## Matriz de impacto por operación: fuente, consecuencia, urgencia, estado

| ID | Cambio | Quién y dónde | Lecturas/dependencias | Escritura o efecto | Cuándo | Evidencia/estado |
|---|---|---|---|---|---|---|
| DEP-01 | Crear/editar territorio | Gran Hermano, Configuración | sesión y rol; jerarquía territorial; reglas vigentes | maestro de país/provincia/ciudad, revisión de catálogo y vista pública | maestro al confirmar; publicación según política vigente | C existencia de controles y jerarquía; D mecanismo técnico |
| DEP-02 | Actualizar reglas de plataforma | Gran Hermano, Configuración | rol, versión anterior, dependencias del campo | regla versionada; invalidación selectiva | confirmar escritura; distribución conforme a política | C categorías de configuración; P impactos por campo |
| DEP-03 | Revocar encargado | propietario o Gran Hermano | relación con ficha, identidad, rol, permisos | permiso vigente y rechazo de posteriores accesos privados | **inmediato** | C requisito de negocio; D implementación |
| DEP-04 | Cambiar nivel o beneficios | Gran Hermano/autorizado | niveles, prestaciones, funcionalidades, adicionales, excepciones y contratación | derechos efectivos, representación de ficha, exposición comercial | según vigencia y política | C existencia de niveles/prestaciones; P contratos concretos |
| DEP-05 | Modificar ficha | propietario/delegado/GH con capacidad | permisos, límite de edición, clasificación, sede, versión | maestro y, si corresponde, futuras vistas públicas | límite de cambios al confirmar | C necesidad; P campos/efectos detallados |
| DEP-06 | Crear/editar sede | titular autorizado/GH | ficha madre, territorio, permisos, versión | sede y proyección cuando corresponda | política del módulo | C entidad y dependencia de ficha; P campos |
| DEP-07 | Crear/editar evento | anunciante u operador autorizado | reglas de evento, categoría, territorio, eventualmente anunciante | registro de evento, moderación, paquete de agenda | aprobación y corte aplicables | C funcionalidad; P vínculo obligatorio con anunciante, no asumirlo |
| DEP-08 | Crear/editar actividad | anunciante u operador autorizado | categoría, territorio, vigencia y reglas | actividad, moderación, proyección | aprobación y corte aplicables | C funcionalidad; P otros cruces |
| DEP-09 | Crear/editar promoción | anunciante autorizado | nivel, límites, ficha y catálogo aplicable | promoción y vistas habilitadas | política vigente | C funcionalidad; P relación exacta |
| DEP-10 | Gestionar publicidad | anunciante/GH autorizado | nivel, elegibilidad, ciudad, contrato, posiciones, relevancia, formato | contratación/creatividad y distribución | contrato, vigencia y publicación | C conceptos; **P decisiones de reglas aún abiertas** |
| DEP-11 | Favoritos | Usuario autenticado | identidad, anuncio publicado | relación privada Usuario↔registro | inmediato | C funcionalidad; P almacenamiento destino |
| DEP-12 | Cambiar ciudad/navegar | Usuario | catálogo y manifiesto público | lectura de paquetes y preferencias | al elegir; reutilizar sin cambios | C producto; D segmentación/versionado |
| DEP-13 | Notificaciones | Usuario/Anunciante/GH según caso | sesión y hechos relevantes | bandeja y estados de lectura | según evento | C funcionalidad; P disparadores exactos |
| DEP-14 | Soporte y reclamos | Anunciante/Usuario/GH según circuito | identidad, tipo de solicitud, roles y asignaciones | solicitud, bandeja, estados y avisos | según flujo | C existencia; P detalle |
| DEP-15 | Roles internos y asignaciones | Gran Hermano según capacidad | definición de rol, usuario y ámbito | permisos vigentes y efectos sobre acciones | seguridad inmediata | C UI; P matriz exhaustiva de capacidades |
| DEP-16 | Suscriptores | Usuario/GH | sesión, consentimiento, ciudad, reglas | perfil, preferencias y vistas autorizadas | según tipo de dato | C funcionalidad; P dependencias restantes |
| DEP-17 | Farmacias de turno | administración/fuente propia | ciclo/turno, territorio, vigencia | publicación específica de farmacia | vigencia/actualización propia | C funcionalidad diferenciada; P origen preciso |
| DEP-18 | Efemérides | administración/fuente propia | calendario, categorías/territorio si aplican | calendario publicado | corte/vigencia específica | C funcionalidad diferenciada; P origen preciso |
| DEP-19 | Empleo | módulos autorizados | reglas, clasificación y territorio | búsquedas/publicaciones de empleo | según política | C presencia en Gran Hermano; P contrato |
| DEP-20 | Información visual/identidad | Usuario, Anunciante y GH | diseño, colores, formato de tarjetas y reglas de presentación | renderización, recursos estáticos y egreso | por versión de interfaz | C requisito de preservación; P inventario de elementos |

## Correcciones del supervisor 2 que invalidan el grafo anterior

1. **Dependencias falsas:** se retiran como obligaciones universales `Ficha → Evento`, `Ficha → Actividad`, `Ficha → Publicidad`. Pueden existir vínculos por anunciante, pero no son universales ni obligan a reconstruir todos los módulos por cada cambio de ficha.
2. **Configuración incompleta:** se agregan Nodos, Segmentos, Actividades clave, Acciones, Categorías específicas, Roles internos, Términos y Moderación +18; también Valores y prestaciones.
3. **Módulos ausentes:** se incorporan Suscriptores, Notificaciones, Soporte, Farmacias, Efemérides, Empleo y relaciones visuales.
4. **Seguridad y lectura pública:** no toda lectura pública requiere sesión o verificación privada. Las operaciones privadas sí deben comprobar permiso vigente.
5. **Publicación diferida:** un outbox durable NO autoriza publicación inmediata si la regla comercial/operativa exige corte diario. Se separan escritura, autorización, programación y exposición.
6. **Costos y cuotas:** cada acción incluye procesos indirectos y servidor, y el costo de entregar paquetes y medios; el grafo obliga a incluir ambas direcciones de cambios sólo cuando estén verificadas.

## Auditoría independiente 3: correcciones del grafo y cobertura

**Hallazgo crítico 3.1 — confirmación falsa por presencia de botones.** Las filas que dicen «C funcionalidad» confirman la EXISTENCIA del módulo, pero NO sus relaciones ni sus efectos. Se prohíbe cambiar la marca de una dependencia a C basándose sólo en un rótulo de navegación. Para elevar a C se exige localizar el dato en origen, el punto exacto de consulta y su empleo en una acción. **Corrección aplicada a la convención y a la interpretación del mapa 2.**

**Hallazgo crítico 3.2 — mapa unidireccional y omisión de efectos al administrar.** Usuario, Anunciante y Gran Hermano pueden actuar sobre datos compartidos, y el cambio resultante afecta proyecciones, colas de moderación o capacidad comercial según caso. La flecha gráfica aislada no basta: el contrato de cada operación debe incluir *quién escribe*, *a quién notifica*, *qué versión invalida*, *quién vuelve a consultar* y *qué datos privados deben permanecer aislados*. No completar flechas automáticas entre funcionalidades sin prueba.

**Hallazgo crítico 3.3 — temporalidad confundida.** Separar cuatro fechas/revisiones: momento de escritura del maestro, momento de efecto de la regla, publicación de la copia diaria 01:00 y lectura/cache del usuario. Revocaciones y seguridad actúan inmediatamente, pero no sustituyen las reglas de publicación. La copia preparada ausente no equivale a lista vacía.

**Hallazgo crítico 3.4 — grafo de consumo insuficiente.** El grafo debe cubrir *consulta del manifiesto*, *cache hit/miss*, *descarga de paquetes e imágenes*, *autorización*, *guardado*, *outbox*, *reintentos*, *tareas nocturnas* y *instrumentación misma*. Para cada circuito separar costo de ejecutar la acción, costo de publicar y costo de lecturas posteriores; las cifras posteriores se ponderan por volumen de usuarios, no se imputan arbitrariamente al autor de la publicación.

**Hallazgo 3.5 — no confundir Carcasa con módulo.** Se conserva la distinción del contrato rector: Usuario/Anunciante/GH son los tres planos; Guía, Eventos, Actividades, Farmacias, Efemérides y demás son funciones; Carcasa es presentación. Compartir Carcasa no prueba dependencia.

**Evidencia cotejada en la tercera revisión:**
- `plataforma/administracion.html` contiene botones de `Configuración de plataforma` para territorio, nodos, segmentos, niveles, prestaciones, funcionalidades, categorías, actividades clave, acciones, categorías de eventos/actividades, roles, moderación +18 y términos. **Confirmación de controles, no de efectos reales sobre otros módulos**.
- La misma interfaz muestra módulos de Eventos, Promociones, Publicidad, Actividades, Empleo, Farmacias y Efemérides; no acredita que todos tengan el mismo flujo ni el mismo almacenamiento.
- `AGENTS.md` documenta separación de las tres interfaces y un corte diario común a las 01:00, con autorización y revocación inmediatas.
- `docs/PUBLICIDAD_CONTRATACION_Y_DISTRIBUCION_PENDIENTE.md` advierte decisiones no cerradas: no presentar relaciones publicitarias pendientes como confirmadas.

**Punto todavía NO resuelto:** las 20 filas son un mapa de alto nivel, no un inventario íntegro de relaciones. Ningún campo de producto puede migrarse usando sólo estas flechas. La siguiente verificación técnica es rastrear vínculos verdaderos por entidad/campo/endpoint y adjuntar casos comprobables.

## Puerta de aprobación del mapa

Por cada fila anterior completar un contrato verificable: campos maestros afectados, reglas, roles, caso real, entradas/salidas, dependencias C/P, caducidad, caché, invalidación, costo de lectura/escritura/borrado y prueba de propagación. Se debe comprobar el circuito de cada funcionalidad en los **tres planos pertinentes**, sin inventar un cuarto plano llamado Carcasa. **No aprobado** si sólo hay diagrama sin relaciones verificadas a nivel de datos. Primera cadena propuesta: `identidad GH → alta de país/provincia/ciudad → fuente maestra → preparación según corte → lectura pública → medición`.
