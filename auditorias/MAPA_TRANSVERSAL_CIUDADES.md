# GUÍA LOCAL — MAPA TRANSVERSAL DE CIUDADES

**Fecha:** 16/11/2026  
**Alcance:** relaciones de Ciudad en Usuario, Anunciante y Gran Hermano; fuentes inspeccionadas: `worker/worker206.txt`, `plataforma/login.html`, `plataforma/carcasa.html`, `plataforma/anunciantes.html`, `plataforma/administracion.html`, `plataforma/territorio-cache.js`, `plataforma/paquete-ciudad.js`.  
**Estado:** mapa de dependencias **identificadas**, no auditoría exhaustiva de cada llamada ni prueba en producción. No confundir líneas coincidentes con lecturas facturadas. **Contrato técnico**: [ARQUITECTURA_Y_CONTROL.md](ARQUITECTURA_Y_CONTROL.md); **estado de ejecución**: [ESTADO_ACTUAL.md](ESTADO_ACTUAL.md).

> **26/11/2026 — P4-0019, prueba `a8dd326f`.** Gran Hermano abre los tres formularios territoriales. Guardar País o Provincia muestra el aviso del cliente y envía cero POST. Ciudad filtra provincias al cambiar el país, envía un POST interceptado y cierra tras confirmación. Cancelar envía cero solicitudes. Las rutas de País y Provincia existen en el Worker y el camino exitoso ejecuta un patch, dos lecturas y dos escrituras de su abstracción de caché según fuente. Falta comprobar su costo físico y compatibilidad con el corte diario y P4-0021. Diagnóstico sin habilitación de altas ni cambios al código de la rama independiente.

## Unidad de corrección: UNA CADENA TRANSVERSAL

```
GRAN HERMANO: País → Provincia → Ciudad (crear / editar / activar / desactivar / eliminar)
       ↓ validar identidad, vínculos, permisos y referencias
WORKER: fuente de datos y reglas de modificación
       ↓ actualizar solo cuando haya cambios efectivos
PUBLICADOR: catálogo territorial + revisión por ciudad + capítulos de ciudad afectados
       ↓ distribuir sin lectura Firestore/KV por visita
CLIENTES: Login/selección de ciudad → Carcasa y Anunciante → módulos públicos
       ↓ 
CONTENIDOS: Guía, Eventos, Actividades, Promociones, Publicidad,
            Farmacias, Efemérides, Empleo
       ↘
OPERACIONES PRIVADAS: sedes, suscripciones, permisos, moderación,
                       cobertura y segmentación
```

## Mapa de conexiones verificadas en código (no significa que estén funcionando en producción)

| Zona de la plataforma | Dónde se encontró | Dependencia de Ciudad | Obligación de la corrección |
|---|---|---|---|
| Alta de país/provincia/ciudad | Worker ~1139–1315; Gran Hermano ~1573–1631 | jerarquía, activo, cambios de catálogo | Alta independiente país→provincia→ciudad; permisos, integridad y paquete actualizado |
| Edición, desactivación, eliminación | Gran Hermano ~1341–1432; Worker ~1199–1268 | consulta/admin y repercusión pública | Verificar rutas de baja, impedir eliminación con referencias, actualizar consumidores |
| Inicio/elección de ciudad | Login ~1890–1904; Carcasa ~1657–1719 y ~2135–2266 | lista de ciudades y contexto elegido | Una sola carga territorial, conservar selección y revisar activo |
| Registro y sedes | Login ~2280–2284, ~3569–3595, ~6421–6423 | ciudad válida y ciudad de cada sede | Validar sin lecturas redundantes, impedir referencias inválidas |
| Guía de anunciantes | Anunciante ~1259–1275, ~1532–1565; Worker ~1339–1354 | tarjetas de la ciudad elegida | Datos ciudad empaquetados, sin consulta alternativa sistemática |
| Eventos y programación | Login ~2948–3270, ~7175; Worker ~1494–1537 | ciudad física o alcance virtual, horarios/fechas | Actualizar solo ciudades afectadas; probar alcance virtual |
| Actividades y horarios | Login ~3814–4295; Anunciante ~1641–1644 | sede, horarios y selección territorial | Respetar ciudades asignadas; módulo público y capítulo correspondiente |
| Promociones | Anunciante ~1637–1640; Worker ~1416–1444 | pertenencia de la promoción a la ciudad | Reutilizar paquete, invalidar ciudad afectada |
| Publicidad y segmentación | Login ~4614–4646; Worker ~568–650, ~1588–1607 | cobertura y relaciones con evento/actividad/ciudad | Validación central, evitar distribución fuera de cobertura |
| Farmacias | Login ~6132–6222; Carcasa ~1741–1744; GH ~1443 | turnos por ciudad | Reutilizar paquete cuando esté disponible; medir fallback |
| Efemérides | Login ~5532–5928; Carcasa ~1944–1959; Worker ~1617–1647 | general, provincial y local | Publicar en las ciudades alcanzadas y no en otras |
| Empleo | Worker contiene consultas a catálogo territorial (p. ej. ~11624) | disponibilidad, ciudad/oferta | Inventario detallado y prueba pendiente |
| Suscriptores/residentes | Gran Hermano ~1564, ~1642; Worker contiene enlaces ciudad/usuario | ciudad de referencia y filtros de permisos | Conservar vínculo aun cuando cambia estado; validar filtros |
| Moderación y roles | Gran Hermano ~976–980, ~1307–1317; Worker ~344–385 | alcance de moderador y ciudad asignada | No ampliar acceso al unificar catálogos |
| Catálogo público y caché | `territorio-cache.js` (44 líneas); Worker ~1139–1196 | listado territorial con activo | Definir única publicación versionada, conservar en navegador |
| Paquetes públicos de ciudad | `paquete-ciudad.js` ~89–116, ~139–194 | necesita revisión y archivo por ciudad | Completar productor/archivo; probar lectura desde IndexedDB |
| Uso de paquetes y contingencias | Anunciante ~1259–1275 y ~1633–1648; Carcasa ~1741 y ~1954 | alternativa de red si falta paquete | Corregir publicación, medir fallback, evitar consultas redundantes |
| Catálogo privado de GH | Gran Hermano ~1223–1268; Worker ~1192–1196 | caché por administrador | Actualización segura entre sesiones/dispositivos sin abrir datos privados |

**Nota:** líneas aproximadas de la rama inspeccionada, pueden variar con nuevos commits.

## Problemas agrupados por causa, NO por pantalla

| Grupo | Causa transversal | Incidencias asociadas | Una solución | Resultado exigido |
|---|---|---|---|---|
| **A. Identidad y reglas** | Distintos caminos para alta/edición y relación país-provincia-ciudad | CIU-006, CIU-007, CIU-008 | Núcleo único de escritura, altas independientes, validación de relaciones, bajas con bloqueo de referencias | Crear/modificar desde GH y comprobar vínculos en Login, Carcasa y Anunciante |
| **B. Catálogo y publicación** | Dos representaciones KV completas y ausencia de paquete territorial versionado efectivamente publicado | CIU-001, CIU-004, CIU-005 | Una autoridad lógica y un publicador; reconstruir solo cuando cambia, publicar vistas autorizadas | Cero lecturas Firestore/KV para reutilizar catálogo público vigente; medir escrituras |
| **C. Paquetes por ciudad** | Consumidor programado sin referencias de paquetes ni archivos accesibles en GitHub | CIU-001, CIU-002 | Publicar índice de revisiones y capítulos por ciudad, conservar `paquete-ciudad.js` como lector | Apertura de ciudad con paquete válido y sin fallback |
| **D. Lectores/fallbacks dispersos** | Múltiples caminos para obtener guía/eventos/promos/actividades/farmacias/efemérides | CIU-003 | Una entrada compartida al paquete, contingencia explícita y medida | Misma ciudad/módulo/resultado en Usuario y Anunciante con menos red |
| **E. UI, autorización y prueba** | Pantallas incompletas, estilos diferentes y ausencia de prueba transversal y medición | CIU-007, CIU-009, CIU-010 | Tres pestañas, botones uniformes, pruebas reales por rol y contadores completos | UI comprobada, permisos intactos, consumo antes/después por servicio |

## Secuencia de trabajo irreversible (un grupo depende del anterior)

1. **A + B:** fijar el contrato de ciudad (datos, relaciones, activo, permisos), detectar todas las rutas de mutación y sus lectores. Corregir altas independientes, edición y bajas antes de publicar información potencialmente inválida.
2. **B + C:** implementar o recuperar el publicador de paquetes; generar el catálogo y el paquete de una ciudad existente; exponer revisión efectiva y archivo que realmente pueda descargarse.
3. **D:** migrar lectores por módulo y por interfaz a esa única entrega; medir y desactivar llamadas alternativas cuando la ruta empaquetada esté verificada.
4. **E:** implementar pestañas y operaciones, probar escenario frío, caliente, cierres de sesión, dos dispositivos, activo/inactivo, alta/cambio/baja, múltiples roles y sedes.
5. **Cierre:** medir Firestore, KV, Durable Objects, requests, CPU y USD en cada escenario antes/después. No afirmar reducciones sin contadores físicos. No desplegar a ciegas.

## Auditoría por tres pasadas

- **Pasada 1 — Estructura:** inventario de *todas* las rutas, escrituras y consumidores del campo `ciudad_id` y relaciones pais/provincia; clasificar los accesos que solo usan la etiqueta vs. los que validan/consultan/escriben.
- **Pasada 2 — Adversarial:** buscar simultaneidad, fallos parciales, publicación desactualizada, cachés sin invalidación, permisos, fallbacks encubiertos y duplicados del mismo dato o regla.
- **Pasada 3 — Comprobación:** ejecutar en navegador y Worker reales, medir en caliente/frío, cambiar ciudad, cerrar/abrir sesión, cambiar activo y probar todas las funcionalidades; registrar evidencia y resultado por rol.

**Control de no dispersión:** un hallazgo nuevo se incorpora al grupo A-E y a su causa raíz antes de escribir un parche. Toda corrección requiere lista de lectores afectados y pruebas de regresión correspondientes. Si el mapa muestra otros módulos relacionados, se prueban como dependencias de Ciudades; no se abren nuevas acciones independientes.

**Próximo paso exacto:** completar el inventario de todas las mutaciones y validaciones de `ciudad_id` para el grupo A; corregir el flujo independiente país→provincia→ciudad y su prueba de referencias antes de proceder al publicador B/C. Ningún grupo está cerrado.

## Recorrido de los tres botones de alta: ejecución preparada 16/11/2026

| Acción visible en Gran Hermano | Frontend | Ruta del Worker | Validaciones aplicadas | Operaciones planificadas en test simulado |
|---|---|---|---|---|
| + País → Guardar país | `ghNuevoTerritorio('pais')` → `ghGuardarTerritorio('pais', id)` | POST `/superadmin/countries/create` → coordinador `GLD_ACTIONS138` → `saveCountry` | ID y nombre; rechaza duplicados; privilegio administrador | Alta válida: 1 `db.patch('paises')`, 2 `cache.put` |
| + Provincia → Guardar provincia | `ghNuevoTerritorio('provincia')` → `ghGuardarTerritorio('provincia', id)` | POST `/superadmin/provinces/create` → coordinador → `saveProvince` | ID, nombre, país existente y activo; rechaza duplicados | Alta válida: 1 `db.patch('provincias')`, 2 `cache.put` |
| + Ciudad → Guardar ciudad | `ghNuevoTerritorio('ciudad')` → `ghGuardarTerritorio('ciudad', id)` | POST `/superadmin/cities/create` → coordinador → `saveCity` | ID, nombre, país y provincia activos, país correspondiente; rechaza duplicados | Alta válida: 1 `db.patch('ciudades')`, 2 `cache.put` |
| Actualizar | `ghCargarCiudades(true)` | GET `/superadmin/territory` → `territoryAdmin` | Sesión administrativa | Lecturas físicas no medidas; reconsulta deliberada |
| Editar / activar / desactivar ciudad | `ghGuardarCambioCiudad` | PATCH `/superadmin/cities/{id}` → coordinador → `saveCity` | Relaciones, estado, permiso | Escrituras según cambios; falta prueba física |
| Eliminar ciudad | `ghEliminarCiudad146` | PATCH desactivar + DELETE `/superadmin/cities/{id}` | La ruta DELETE debe comprobarse antes de usar: aún no encontrada | No comprobado; NO DECLARAR FUNCIONAL |

**Contrapruebas ejecutadas en JavaScript con DB/KV simulados**: alta país, duplicado de país, alta provincia, provincia sin país, alta ciudad y ciudad con provincia equivocada: **6/6 PASS**. Las altas correctas planifican 1 escritura de documento + 2 publicaciones KV; las tres rechazadas planifican 0 escrituras. **No son costos medidos ni pruebas de navegador.** Worker: commit `e0e830f51cfef431562a83eb5ef6f3e9692f551f`. HTML: commit `530b412c418524078591e3be09e39cd826a07492`. Sin despliegue.

**Deuda de consumo sin ocultar:** los tres recorridos siguen escribiendo **dos paquetes KV** por cambio; el publicador único aún no está ejecutado. Próxima corrección central (grupo B/C): preparar un solo paquete público versionado y su distribución; conservar la administración autorizada sin duplicación innecesaria.  
