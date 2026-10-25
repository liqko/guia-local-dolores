# Farmacias de turno — auditoría 25/10/2026

Estado: diagnosticado con fallas reproducidas; no corregido ni certificado en producción. Worker activo obtenido del proveedor:138, SHA2561717bd43e8e54451c7c495790368bb04e80bd9fb87784ebf6678e7b92797f8e5. Frontend referencia main57eda8a: el bloque Farmacias coincide byte a byte con la copia usada en las reproducciones. No se verificó el despliegue Firebase de ese commit.

## Circuito y propietarios

- Administrador/Gran Hermano: habilita TURNOS_FARMA y ciudades mediante configuración de anunciante. Colección anunciantes_administracion, funcionalidades_config.TURNOS_FARMA y campos históricos turnos_farma/farmacias_ciudades. Las modificaciones usan el circuito compartido administrativo; no son las consultas públicas de Farmacias.
- Anunciante, plataforma/login.html: POST /farmacias action=getPanelData → routePanelV15 → routePanelV14…routePanelV4 → requirePanel2 → allowedFarmCities → farmaciasPanelDataV3. Consulta administración, ciclos por anunciante, participantes por ciclo, territorio y catálogo de comercios; obtiene farmacias seleccionables de los paquetes Guía de las ciudades habilitadas. Campos preparados y cachés privadas/panel pueden evitar acceso físico a Firestore; no sumar consultas lógicas como lecturas facturadas.
- Guardado: POST /farmacias action=guardar_ciclo → routePanelV15 → verifySubscriberSession/sessionAllows → allowedFarmCities2 → farmSaveCycleV3. Firestore farmacias_ciclos, farmacias_ciclo_sedes y lectura anunciantes_sedes. Publicación syncFarmCyclePreparedV2, paquete farmacias:city:v2:<ciudad> y relations:prepared:v1:farm:<ciclo>. Los paquetes públicos pasan por coordinatedCities119/DO; no confundir cache.put lógico con escritura física KV.
- Usuario: plataforma/carcasa.html pide hoy al iniciar; semana sólo al abrir, siete fechas en paralelo. GET /farmacias?action=turnos&ciudad_id=…&fecha=… → routePublicV12 → farmTurnosPublicV3 → getFarmCityV2 → paquete Farmacias y paquete Guía para nombres → turnosForCycle → filtro/render. No consulta Firestore ordinariamente; cada fecha accede a dos actores públicos. El coordinador territorial nuevo138 no procesa este guardado de Farmacias.
- También existe plataforma/farma_turnos.html, una vista de Usuario independiente por fecha; no es una cuarta interfaz. Usa la misma ruta y puede añadir publicidad/activos propios; su costo total de pantalla no fue medido.
- Reconstrucción administrativa: POST /superadmin/pharmacies/rebuild-cache → autorización administrativa → rebuildFarmAllV2. Recorre las tres colecciones, relaciones preparadas y paquetes por ciudad.

## Fallas reproducidas y operaciones evitables

1. Semana parcial fallida: cada fecha fallida se convierte en null, pero farmaSemanaCargada=true. La interfaz promete reabrir para reintentar; reabrir no hace ningún pedido. Reproducción con una fecha fallida:7 pedidos iniciales,0 al reabrir, mensaje permanece.
2. Cambio de ciudad durante carga: farmaFetchTurnos construye URL con una ciudad y farmaGuardarCache calcula la clave usando la ciudad global vigente al resolver. Reproducción:7 respuestas de D guardadas bajo claves de E. La respuesta antigua también puede sobrescribir la pantalla de la nueva ciudad; no existe control de generación/identidad.
3. Caché reciente: cada hit dispara igualmente revalidación; una nueva carga de la semana genera7 pedidos adicionales aunque las7 respuestas estén frescas. Cerrar/reabrir en la misma carga ya completa no vuelve a pedir; distinguir de recargar/reiniciar módulo.
4. Semana filtra sólo fecha_desde===fecha: para un turno válido de48h iniciado el día anterior, el servidor devuelve el turno pero el día aparece vacío. Reproducción de la lógica con48h. La intención de mostrar sólo comienzos puede servir con24h, pero no demuestra cobertura de todo el día para duraciones permitidas diferentes.
5. Guardado equivalente: changedFieldsV1 evita escrituras fuente equivalentes, pero syncFarmCyclePreparedV2 se ejecuta siempre y actualiza updated_at/publicación. La pantalla del anunciante ya evita enviar un formulario idéntico; no atribuir ese envío evitado a cada clic. El servidor sigue repitiendo trabajo ante repetición del pedido.
6. Consulta pública con revisión de nombres distinta puede escribir paquete para refrescar nombres; GET no es incondicionalmente de sólo lectura. Con revisión vigente lee ambos paquetes sin escribir. Preparación de nombres/relación con Guía es funcional actualmente; no eliminarla sin preservar datos y actualización.
7. Reconstrucción: si una ciudad queda sin ciclos activos, no entra en byCity y no se limpia su paquete previo. Reproducción: fuente inactiva, reconstruir, consulta sigue devolviendo2 turnos del paquete viejo.
8. Permisos territoriales: farmSaveCycleV3 sólo restringe si allowedCityIds.length>0. Lista vacía acepta guardado; allowedFarmCities y allowedFarmCities2 resuelven vacíos de forma diferente. Caso de función reproducido; no se probó explotación con cuenta real. Definir vacío como ninguna ciudad y distinguir explícitamente todas, preservando autorización vigente.
9. Fallo parcial: participantes se escriben/eliminan antes de guardar ciclo/publicación. Si falla el guardado posterior, queda orden2 en fuente y1 en paquete. No hay registro recuperable en esa ruta equivalente al nuevo coordinador territorial. Reproducción con fallo fuente inyectado; no atribuir fallo a una acción real no registrada.

La capa DO existente combina actualizaciones de entidades por revisión: una prueba con cache de Map sin esa capa no basta para afirmar pérdida concurrente en producción; no se registra ese supuesto como falla.

## Consumo real recuperado

Evento39cf93e1-c2ad-4fe8-9047-83ad08ca0473,24/10/2026 15:38:31.027UTC (12:38:31 Argentina), Worker136, GET /farmacias action=turnos, HTTP200:1 solicitud Worker; Firestore0 lecturas/0 escrituras/0 eliminaciones; KV0 lecturas/0 escrituras/0 eliminaciones;2 llamadas DO públicas;6 filas SQL leídas (Farmacias4, Guía2),0 escritas. Log de observabilidad por request_id, desglosado por módulo. No equivale a factura ni a toda la pantalla/semana. CPU no se atribuyó sin unión inequívoca.

En34 eventos recuperados de136/137:25 de136 y9 de137, todos GET turnos200;0 operaciones Firestore/KV,68 llamadas públicas,110 filas SQL leídas,0 escritas. Conservar como conjunto de tráfico, nunca como acción individual o prueba de138. El estado previo del proyecto menciona semana con602 filas; la consulta de esa ventana no devolvió eventos ahora y ese número no se usa como medición recuperada en esta auditoría.

## Pruebas y límites

12 reproducciones locales con código real: casos de funciones, pantalla en VM y GET de Worker completo con SQLite local/proveedores simulados. GET local con paquetes preparados:2DO,0KV/Firestore; memoria caliente0filas, memoria vaciada3filas con1ciclo y1anunciante, caliente otra vez0. No son facturación Cloudflare ni volumen real de Dolores. El caso vacío de memoria limpia actor.cached; no se declara reinicio de proceso.

Cruce de mes/año correcto. La semana no se carga anticipadamente y los toggles completos reutilizan información en la misma sesión. No modificar estos comportamientos válidos.

No se hicieron guardados reales ni reconstrucciones sobre producción. La lectura HTTP desde el entorno devolvió403 y Opera está desconectado; no se inventó una navegación actual ni se pidió repetir una acción al usuario. Consumo completo real de guardados, permisos, reconstrucción, publicidad de vista independiente, CPU, duración DO, almacenamiento y factura sigue sin medir. No se declara cierre integral de las tres interfaces.

## Corrección técnica recomendada

Primero aislar ciudad/fecha/generación y rechazar respuestas tardías; reintentar sólo días fallidos y reutilizar cache válida según política de frescura. Añadir consulta de rango semanal que lea los mismos dos paquetes una vez y calcule los7 días; conservar ruta diaria. Potencial por semana no cacheada:7→1 solicitudes Worker y14→2 llamadas DO, antes de CORS/caché HTTP; ahorro real de filas/CPU debe medirse, no prometer mismo porcentaje. Usar intervalo de vigencia para turnos de más de24h.

Después corregir no-op del servidor, publicación recuperable del guardado y limpieza de ciudades sin activos en rebuild; unificar permisos sin exponer ciudades. Cada cambio debe preservar nombres/contactos, datos y permisos, y comparar operaciones completas antes/después. No se implementaron correcciones de Farmacias bajo una orden de auditoría.
