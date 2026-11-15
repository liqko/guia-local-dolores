# Dependencias verificadas en el código existente — reconstrucción de requisitos GLD2
Fecha 2026-11-15. Evidencia del árbol `main`; NO implica copiar implementación antigua. Alcance: primer rastreo técnico comprobable. No es inventario completo.

## R-001 — Territorio: administración y selectores GH
**Fuente:** `plataforma/administracion.html` → `ghTerritoryApply195(j)`.
**Entrada real:** respuesta `j.paises`, `j.provincias`, `j.ciudades` de `GET /superadmin/territory` o `GH_DAILY_ENTRY195.territory`.
**Campos usados:** `ciudad_id|id`, `ciudad_visible|nombre|ciudad`, `provincia_visible|provincia`.
**Consumidores comprobados:** selectores `#evCiudad` (Eventos) y `#anuCiudad` (Anunciantes) reciben las opciones desde `ghTerritoryApply195`.
**Impacto real:** una actualización de catálogo territorial puede modificar ambos filtros; no demuestra que deba regenerar los datos de Eventos o de Anunciantes. Verificar cada dependencia de consulta antes de invalidar.
**Caché actual:** `ghCargarCiudades` usa primero `GH_DAILY_ENTRY195.territory`; en ausencia consulta el endpoint y deduplica la solicitud en curso (`GH_TERRITORY_PENDING195`). No es evidencia de costo facturado.
**Estado:** CONFIRMADA en código de interfaz. Backend, costo y autorización exactos aún no trazados.

## R-002 — Territorio: alta de Ciudad (NO se confunde con País/Provincia)
**Fuente:** `plataforma/administracion.html` → `ghNuevoTerritorio(tipo)` y `ghGuardarTerritorio(tipo,id)`.
**Datos capturados:** `ciudad_id`, `nombre`, `ciudad`, `ciudad_visible`, `pais_id`, `provincia_id`, `activa`.
**Validación visible:** nombre no vacío; país y provincia seleccionados; las provincias se filtran por país en `ghFiltrarProvinciasAlta`; bloqueo de doble envío por `GH_TERRITORY_PENDING`.
**Operación backend:** `POST /superadmin/cities/create`, autorización Bearer TOKEN, cuerpo `{item}`. Solo se actualiza la lista local cuando se confirma `j.success` y el ID devuelto coincide.
**Hallazgo de supervisión:** aunque se muestran botones de País y Provincia, `ghGuardarTerritorio` **bloquea explícitamente ambos** y dice que sólo está implementando Ciudades. Por eso el primer circuito de GLD2 `crear país → crear provincia → crear ciudad` NO puede darse por funcional en la plataforma actual. GLD2 debe construir los tres circuitos según requisitos propios; no presumir que los antiguos existen completos.
**Estado:** CONFIRMADA hasta el envío frontend y confirmación; la transacción del servidor y costos no se verificaron aquí.

## R-003 — Territorio público: del catálogo al consumidor
**Fuente:** `plataforma/territorio-cache.js`.
**Contrato:** `GLD_CATALOGO_TERRITORIAL.load()` entrega `{success:true,paises:[],provincias:[],ciudades:[]}`. Puede usar `/* GLD_TERRITORY_SNAPSHOT */` embebido, copia `localStorage` o fallback `GET /territory/public`. Deduplica peticiones concurrentes con `pending`.
**Consumidor confirmado:** `plataforma/anunciantes.html` → `jsonpApi({action:'ubicaciones'})` llama `GLD_CATALOGO_TERRITORIAL.load(timeoutMs)`.
**Publicador de referencia:** `scripts/prepare-public-territory.mjs` obtiene `GET /territory/public`, canoniza `paises,provincias,ciudades`, calcula hash SHA256 de contenido y prepara inyección de `GLD_TERRITORY_SNAPSHOT`. El script separa preparación de publicación instalada.
**Impacto:** actualizar territorio requiere sincronizar el catálogo visible y su versión. La lectura pública puede resolverse sin consulta remota cuando la copia está disponible; el costo de descarga y validación debe medirse.
**Estado:** CONFIRMADA entre archivos; el disparo real del publicador nocturno aún no verificado.

## R-004 — Ciudad y contenido público de Guía
**Productor/contrato de lectura frontend:** `plataforma/anunciantes.html` → `gldPaquetePublico(city)` → `GLD_PAQUETE_CIUDAD.get(city)` cuando la autorización de contenido adulto no fuerza otro recorrido. `jsonpApi(action='guia')` devuelve `paquete.modules.guide`; de otro modo consulta `GET /guide?compact=1&ciudad_id=...`.
**Caché versionada:** `plataforma/paquete-ciudad.js` → `client.get(city)` consulta manifiesto mediante `GLD_CATALOGO_TERRITORIAL.paqueteCiudad(city)`, conserva versión en IndexedDB, aplica delta compatible si hay versión anterior y manifiesto adecuado; si no, descarga paquete completo.
**Vínculo confirmado:** `ciudad_id` determina qué paquete Guía puede mostrarse. La disponibilidad de paquete cacheado reduce recorridos remotos, pero NO permite asegurar cero costo ni ocultar bytes descargados.
**Limitación observada:** `jsonpApi` puede recurrir al Worker de Guía al faltar paquete. GLD2 debe definir explícitamente si permite ese fallback o muestra edición anterior, conforme al corte diario y seguridad; no copiar decisiones por accidente.
**Estado:** CONFIRMADA en frontend, no en costos internos de almacenamiento.

## R-005 — Reglas de roles no equivalen a asignación de personas
**Fuente:** `plataforma/administracion.html` → `ghRolesGuardar183()`.
**Entrada:** `GH_ROLES_PACK183.roles`, controles `data-gh-rule-role183`, acciones `data.ghRuleAction183`. UI permite editar reglas de `MODERADOR` y `VENDEDOR` si `GH_ADMIN_ACCESS.rol==='SUPERADMIN_PRINCIPAL'`.
**Lecturas/escritura:** `ghAdminRequest_('/roles')` antes de guardar, compara contra la copia cargada para evitar cambios concurrentes, luego `ghAdminRequest_('/roles',{roles},'POST')`.
**Dato importante:** el texto de interfaz distingue reglas generales de perfiles y asignaciones individuales de personas; GLD2 no debe tratar «editar regla de rol» como «conceder acceso a una persona».
**Estado:** CONFIRMADA en frontend. Aún falta rastrear backend, casos de revocación y cuota.

## Corrección transversal derivada de este rastreo
- Toda flecha del mapa requiere evidencia equivalente: **origen, campo, operación, destinatario y condición**. Una pantalla existente no es prueba suficiente.
- Existe una dependencia funcional verificable `Territorio → filtros GH de Eventos y Anunciantes`, pero no se debe inferir `Territorio → reconstruir todos los registros de Eventos y Anunciantes`.
- El catálogo público territorial y el paquete Guía de ciudad son productos **distintos**, aunque ambos estén relacionados con territorio. No mezclarlos ni asumir un costo común de una lectura.
- GLD2 preserva los tres planos y su comportamiento; el código actual se usa exclusivamente para recuperar estos contratos. Ninguna cifra aquí constituye medición real.
