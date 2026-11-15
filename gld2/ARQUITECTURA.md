# GUÍA LOCAL 2 — ARQUITECTURA RECTORA
Estado: DISEÑO INICIAL / no implementado / no desplegado. Producción: sin cambios.
Objeto: reconstrucción en paralelo, desde cero en lo técnico, conservando TODO el comportamiento y la identidad del producto existente. Este documento es la regla del diseño, no un informe de progreso.

## Decisión de estructura

**Tres interfaces, un solo sistema de negocio.** Usuario, Anunciante y Gran Hermano comparten contratos, entidades, reglas y servicios. Ninguna pantalla decide permisos, límites o reglas comerciales. DRY y KISS son obligatorios. El código anterior es referencia de requisitos y comportamiento, NO base de código ni modelo de almacenamiento.

```text
     USUARIO        ANUNCIANTE         GRAN HERMANO
         \              |                 /
          └────────── API ÚNICA ──────────┘
                       │
          IDENTIDAD + AUTORIZACIÓN VIGENTE
                       │
        REGLAS VERSIONADAS + DOMINIOS
                       │
      DATOS MAESTROS + TRANSACCIONES + EVENTOS
                       │
         PROYECCIONES / PAQUETES PÚBLICOS
                       │
          CACHÉ DE SERVIDOR Y DISPOSITIVO

  MEDICIÓN DE CONSUMOS Y COSTOS: ENVUELVE CADA CAPA
```

## Capas y contratos

**0. Operación instrumentada (primera capa transversal).** Toda petición entra con id de operación, tipo de acción, sesión (seudonimizada), ámbito, origen y versión. Las operaciones internas, tareas posteriores, reintentos y errores heredan el mismo identificador de correlación. La operación termina con un recibo de consumo y costo; los efectos posteriores se anexan al recibo original. No se generan consultas de diagnóstico por cada visita. El propio medidor tiene consumo imputable.

**1. Identidad y autorización.** Sesión verificada en el servidor, roles internos y delegaciones por recurso y capacidad. Propietario o Gran Hermano pueden revocar permisos de administración inmediatamente. Revocaciones y bloqueos se confirman antes de responder y se verifican contra fuente vigente antes de cada acción privada, particularmente dentro de la transacción de escritura. La copia privada del cliente nunca concede autorización. Evitar usar un paquete diario para permisos. Roles: Gran Hermano, supervisor, moderador, vendedor, propietario, administrador delegado; capacidades específicas configurables, sin inventar equivalencias.

**2. Reglas y configuración.** Un registro autoritativo versionado para territorio, clasificación, fichas, niveles, prestaciones, funcionalidades, valores, adicionales, publicidad, formatos, límites de cambios, excepciones, políticas de publicación, permisos de módulos y presentación. Todas las interfaces consultan el MISMO evaluador de reglas. Las configuraciones definen qué capacidades existen, cómo se ven y quién puede utilizarlas. No duplicar las reglas en HTML o en varios módulos. Cambios administrativos invalidan únicamente sus dependencias declaradas.

**3. Núcleo de datos.** Fuente maestra transaccional por entidad y propietario, con revisión, ámbitos territoriales, datos privados y datos publicables separados. Escrituras atómicas, validación de reglas, límite de ediciones, concurrencia optimista, idempotencia y auditoría. Publicación y borradores son estados diferentes. Nunca tomar un archivo de caché como dato maestro. La estructura de entidades y sus relaciones se formaliza en el mapa paralelo antes de implementar cada módulo.

**4. Servicios de dominio.** Territorio; anuncios/fichas/sedes; eventos; actividades; promociones; publicidad; usuarios/suscriptores; favoritos; notificaciones; soporte; moderación; comercial/niveles/valores; auditoría. Los servicios reutilizan las capas 0–3, no crean su propia autenticación, caché genérica, lógica de límites ni mecanismo de medición.

**5. Publicación y distribución.** Cada cambio autorizado genera un evento interno durable de publicación, con revisión y dependencias afectadas. Se produce la vista pública mínima necesaria por ciudad, módulo y segmento. Un índice/manifiesto liviano anuncia versiones; el cliente descarga sólo segmentos que no conserva. Se puede elegir compilación diferida para contenido que admita espera; revocaciones y medidas de seguridad jamás se difieren. Proyecciones fallidas se reintentan de forma idempotente sin cobrar una supuesta segunda publicación a la cuenta.

**6. Interfaces.** Tres clientes sobre una misma API. Reutilizan utilidades de fechas, validación de presentación, componentes y contratos; conservan colores, formatos de fichas, orden, textos y prestaciones vigentes tras relevamiento funcional. Gran Hermano configura y audita; Anunciante administra lo que le corresponde; Usuario consume datos publicados y ejecuta acciones autorizadas. No inventar una interfaz distinta para facilitar la implementación.

## Almacenamiento y política de infraestructura

No copiar Firestore + KV por herencia. **Candidato inicial para la nueva instancia aislada: base SQL transaccional como fuente maestra; objetos/versiones públicas en almacenamiento de lectura económica + caché HTTP/navegador.** Selección final de D1, KV, R2 u otro servicio subordinada a prueba reproducible de costos y límites del proveedor, incluidos los costos cuando se agota la cuota gratuita. Firebase del sistema anterior no participa automáticamente en GLD2. No reutilizar Worker `login` ni `ancient-flower-c6e0`, claves, credenciales o namespaces de producción. Ninguna migración de datos ni cambio de DNS hasta pasar pruebas.

## Control de actualización

- **Inmediato obligatorio:** permisos, roles, revocaciones, suspensión de cuentas, seguridad y cualquier cambio cuya regla exija efecto inmediato.
- **Regulado por negocio:** actualmente existe un máximo general de una modificación diaria para fichas, eventos, actividades y publicidad, con excepciones delegadas por Gran Hermano. El límite se evalúa al confirmar cambios, NO al descargar información, ni se interpreta como una publicación por día. Se debe conservar la regla específica vigente de cada módulo.
- **Programable:** reconstrucción nocturna de segmentos públicos sólo si no introduce información incorrecta ni esperas no permitidas. Las 01:00 NO son requisito arquitectónico ni garantía de ahorro. Una modificación aceptada debe quedar persistida de inmediato; su difusión depende de la política explícita de publicación y no puede confundirse con permisos.
- **Sin cambios:** verificar revisión liviana; si coincide, reutilizar caché local; filtros y búsquedas dentro del conjunto descargado no ejecutan nuevas operaciones remotas.
- **Grandes carteras:** 500 anunciantes se manejan con índice paginado y consulta individual; no descargar 500 fichas privadas por abrir sesión.

## Medición económica obligatoria

Para cada acción en los tres planos, emitir:
1. solicitudes Worker, rutas, reintentos, errores y trabajo interno; KV get/put/delete/list, tamaño de clave/valor y operaciones de caché;
2. consultas SQL, filas leídas/escritas, transacciones, Durable Objects (solicitudes, filas SQL, duración facturable donde esté disponible), Firestore si efectivamente se usa (operaciones facturables según proveedor), almacenamiento y transferencias de red/hosting;
3. CPU, duración facturable, egreso, imágenes/archivos y servicio de identidad cuando la plataforma o telemetría del proveedor los exponga;
4. consumo de cuota por operación, total por día/mes y proyección ante 1/1.000/100.000/700.000 operaciones;
5. costo en USD por operación y costo total mensual usando tarifas efectivas, **sin descontar beneficios gratuitos**. El informe distingue medido, estimado, conciliado y desconocido; jamás convierte faltantes a cero.

Las cuotas de distintos planes o servicios se informan separadas. Las métricas internas deben conciliarse con los agregados facturados por proveedor; si hay diferencias, se reportan, no se ocultan. Una lectura SQL y una lectura KV no son unidades intercambiables. Medir además la propia instrumentación para no hacer más caro el diagnóstico.

## Método de prueba por módulo

Primero cadena completa y observable, después siguiente módulo. Cada entrega requiere: ejecución real en infraestructura paralela, captura de consumos por acción, consulta de cuotas, costos según tarifas configuradas, permisos/revocaciones, límites de edición, consistencia de datos, comprobación visual y escala. Se compara con el comportamiento del producto vigente; no se copian sus defectos. Sin entorno real desplegado no se afirma ahorro.

## Orden técnico elegido por el desarrollador

**Fase A: base**: arquitectura transversal + grafo de dependencias + modelo de datos/reglas/seguridad + definición de medición y costos. No pantallas ni Worker de negocio improvisados.

**Fase B: mínimo completo**: infraestructura GLD2 aislada, medición que funcione en el propio servidor y visor operativo; ciclo `crear país → crear provincia → crear ciudad → publicar paquete → consultar como Usuario → actualizar configuración como Gran Hermano`. Antes de expandir, registrar operaciones reales, cuotas y costo.

**Fase C: accesos y anuncios**: sesión, propietario, delegación/revocación, índice paginado, ficha y sede, vista pública, control de modificaciones, prueba de todas las operaciones instrumentadas.

**Fase D: ampliación por dependencias**: eventos, actividades, promociones, publicidad y el resto de funcionalidades según grafo y sin duplicar código.

**Fase E: tres interfaces y migración por cortes comprobados**: preservar identidad visual y reglas; probar cadena completa; importación reversible y lanzamiento gradual sólo con resultados medidos.

## Política de continuidad

Este archivo y el grafo constituyen el criterio rector de la rama nueva. Una implementación que no cumpla una regla de arriba es rechazada. Problemas detectados se resuelven en la capa correspondiente; no se añaden parches en pantallas como sustituto. Las decisiones nuevas se incorporan a la estructura antes del código. Cualquier punto de la plataforma anterior todavía no inventariado se marca PENDIENTE DE RELEVAMIENTO TÉCNICO; no se supone eliminado.
