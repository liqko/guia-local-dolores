# Guía Local 2 — mapa de dependencias funcionales (base viva v1)

**Sentido de las flechas:** A → B = B necesita A; un cambio en A puede afectar B. Las relaciones detalladas se completan contra requisitos y comportamiento existentes, no se inventan. El diagrama es la base transversal, NO certifica haber inventariado cada campo actual.

```mermaid
flowchart TD
  C[Configuración general / versiones] --> T[Territorio]
  C --> R[Motor único de reglas]
  ID[Identidad / sesiones] --> P[Permisos vigentes]
  P --> T
  P --> R
  P --> G[Gran Hermano]
  P --> A[Anunciante]
  P --> MOD[Moderación]
  T --> F[Fichas / sedes]
  T --> EV[Eventos]
  T --> AC[Actividades]
  T --> PR[Promociones]
  T --> AD[Publicidad]
  R --> F
  R --> EV
  R --> AC
  R --> PR
  R --> AD
  R --> MOD
  F --> EV
  F --> AC
  F --> PR
  F --> AD
  F --> PUB[Publicador de vistas]
  EV --> PUB
  AC --> PUB
  PR --> PUB
  AD --> PUB
  MOD --> PUB
  TX[Dato maestro + evento transaccional] --> PUB
  T --> TX
  F --> TX
  EV --> TX
  AC --> TX
  PR --> TX
  AD --> TX
  PUB --> M[Manifiesto / versiones por ciudad]
  M --> V[Caché y paquetes por módulo]
  V --> U[Usuario / directorio / agenda]
  F --> A
  R --> G
  T --> G
  ID --> S[Suscriptores]
  S --> FA[Favoritos]
  S --> NO[Notificaciones]
  FA --> U
  NO --> U
  O[Instrumentación por acción] -.-> ID
  O -.-> G
  O -.-> A
  O -.-> U
  O -.-> TX
  O -.-> C
  O -.-> P
  O -.-> T
  O -.-> F
  O -.-> EV
  O -.-> AC
  O -.-> PR
  O -.-> AD
  O -.-> PUB
  O -.-> M
  O -.-> V
  O --> Q[Cuotas / costos USD / conciliación]
  Q --> MON[Visor: desglose / faltantes / comparativa]
  X[Trabajo diferido / reintentos] --> PUB
  O -.-> X
```

## Qué significa cada cambio

| Origen de cambio | Quién lo inicia | Datos o reglas que consulta | Impacto posterior | Plazo | Medición imprescindible |
|---|---|---|---|---|---|
| País, provincia, ciudad | Gran Hermano autorizado | identidad y permiso vigente, territorio, reglas de unicidad | catálogo, selectores, índices de ciudad, paquetes pertinentes | maestro confirmado en transacción; paquete público solo tras publicación completa | autenticación, escritura, outbox, proyección, lecturas derivadas, bytes y reintentos |
| Nivel/funcionalidad/valor | Gran Hermano autorizado | catálogo de planes, dependencias y excepciones | formulario, prestaciones, límites, publicidad, precio y presentación | según regla | escritura de versión, evaluaciones e invalidaciones |
| Permiso del encargado | Propietario o Gran Hermano autorizado | identidad, relación con anunciante, rol | acceso a detalles, guardados y permisos delegados | **inmediato** | verificación, transacción, invalidación; prueba de acceso rechazado |
| Ficha de anunciante | propietario, delegado o Gran Hermano autorizado | permisos, nivel, cupo de edición, sedes, clasificación | vista privada, ficha pública, búsqueda, eventos/actividades/promociones/publicidad relacionados | guardado inmediato; publicación según política | validación, lectura, escritura, proyección, distribución |
| Sede | propietario, delegado o Gran Hermano autorizado | permisos de ficha, territorio, campos y reglas | ficha, búsqueda/localización, tarjetas públicas | según política | escritura, índices y paquetes afectados |
| Evento | creador autorizado / moderación | anunciante, territorio, categoría, publicación y cupos | agenda, publicidad vinculada, información del anunciante | según aprobación/vigencia | alta, edición, revisión y visualizaciones |
| Actividad | creador autorizado / moderación | anunciante, territorio, categorías, vigencia | agenda/actividades, publicidad, ficha relacionada | según política | alta, edición, revisión y visualizaciones |
| Promoción | anunciante autorizado / moderación | ficha, nivel, condiciones y vigencia | tarjetas, buscadores, exposición pública | según política | creación, cambio, vencimiento, presentación |
| Publicidad | anunciante elegible / Gran Hermano | niveles, contratos, formatos, frecuencia, relevancia | Guía, Eventos, Actividades y otros espacios habilitados | según contrato y vigencia | alta, edición, selección, impresiones si corresponde |
| Favorito | suscriptor autenticado | sesión, identidad, registro público | favoritos propios, interfaz de Usuario | inmediato | lectura/alta/baja y control de sesión |
| Cambio de ciudad en Usuario | usuario | catálogo/versiones y preferencias | descarga selectiva de datos públicos de ciudad | inmediato en cliente | peticiones, caché, transferencias, CPU disponible |

**Nota de dependencia:** un flujo puede volver sobre un módulo previo, por ejemplo `Fichas → Eventos → Publicador → vista del anunciante`. El grafo no impone linealidad ni exige reconsultar datos idénticos.

## Resultado de la primera inspección supervisora

- **CORREGIDO:** el primer recorrido territorial depende de autorización vigente.
- **CORREGIDO:** fuente maestra y evento durable se confirman juntos; la vista pública se actualiza después sin exponer una versión a medias.
- **CORREGIDO:** medición también comprende sesiones, los tres planos, operaciones diferidas, rechazos y reintentos.
- **PENDIENTE DE VALIDACIÓN:** el grafo representa categorías, no todos los campos, reglas visuales, políticas de publicación, permisos y efectos cruzados actuales. Completar para cada dominio antes de programarlo.
- **PENDIENTE DE PRUEBA:** ahorro de lecturas, consistencia ante fallos y conciliación con facturas; no son resultados medidos.

## Reglas para completar el grafo

Cada función debe registrar: **quién puede ejecutarla, disparador, entradas, fuente de verdad, reglas, escritura, evento emitido, módulos afectados, visibilidad, invalidez de caché y costo por operación**. Una dependencia no verificada se etiqueta pendiente, nunca se asume ausente.

El primer recorrido verificable será `Gran Hermano crea ciudad → reglas la validan → se guarda → se versiona y publica → Usuario la encuentra → visor presenta consumos y cuotas reales`. El recorrido se prueba completo antes de agregar las siguientes funcionalidades.
