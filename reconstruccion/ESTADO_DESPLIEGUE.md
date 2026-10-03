# Reconstrucción total — estado técnico

## NO DESPLEGAR TODAVÍA

Rama: `reconstruccion-total-03oct`

### Núcleo nuevo
- `reconstruccion/worker/app.js` — router modular V2.
- `reconstruccion/worker/core/db.js` — Firestore sin efectos laterales.
- `reconstruccion/worker/core/cache.js` — KV.
- `reconstruccion/worker/core/http.js`
- `reconstruccion/worker/core/auth-admin.js`
- `reconstruccion/worker/core/catalogs.js`
- `reconstruccion/worker/core/contracts.js`

### Módulos nuevos
- Territorio: implementado y conectado al router.
- Commerce: panel data modular creado.
- Promos: panel data modular creado.
- Eventos: panel data modular creado.
- Actividades: panel data modular creado.
- Publicidad: panel data modular creado.
- Efemérides: panel data modular creado.
- Farmacias: panel data modular creado.

### Interfaces de reconstrucción
- `reconstruccion/plataforma/inicio-territorio-v1.html`
- `reconstruccion/plataforma/carcasa-territorio-v1.html`
- `reconstruccion/plataforma/granhermano-territorio-v2.html`
- `reconstruccion/plataforma/login-territorio-v1.html`

### Regla ya aplicada
Los módulos del panel del anunciante dejan de recibir catálogos propios de ciudades. Todos usan el mismo `/territory/public`, cacheado una vez en navegador y servido desde KV/CDN.

### Auditoría
`reconstruccion/auditoria/AUDITAR_RECONSTRUCCION.js` detecta la reaparición de patrones prohibidos como:
- `territorios` viejo;
- `resumen_ciudad`;
- `ubicaciones` viejo;
- polling;
- commerce usado como catálogo territorial.

### Próximo segmento
Integrar autenticación del anunciante al núcleo modular y conectar los módulos panel-data al router nuevo. Después, eliminar de los backends reconstruidos cualquier carga de ciudades/catálogos que ya venga de KV.


## Avance 03OCT — bloque sesión / Commerce / Promos / Eventos

- `modules/suscriptores.js`: login con sesión HMAC. El login ya no necesita escribir `ultimo_acceso`.
- `plataforma/login-modular-v3.html`: token firmado persistido, restauración de sesión y Authorization en llamadas privadas.
- `modules/commerce-v2.js`: lecturas y mutaciones puntuales de datos/sedes.
- `core/guide-read-model.js`: proyección pública por ciudad en KV.
- `core/promos-read-model.js` + `modules/promos-v2.js`: Promos públicas por ciudad e invalidación incremental.
- `core/events-read-model.js` + `modules/eventos-v2.js`: Eventos públicos por ciudad e invalidación incremental.
- `modules/moderacion-eventos.js`: pendientes por query `estado_moderacion=PENDIENTE`; aprobación/rechazo sobre ID exacto.
- `routes/public.js`, `routes/panel.js`, `routes/admin.js`: separación física de rutas.
- `app-main-v6.js`: entrypoint modular nuevo.

### Validación HTML
La auditoría de `login-modular-v3.html` no detecta llamadas privadas sin `Authorization`. Las únicas llamadas sin token son las deliberadamente públicas: Territorio y búsqueda pública.

### Estado
**NO DESPLEGAR TODAVÍA.**
Faltan cerrar programación de Eventos, FREE completo, mutaciones de Actividades/Publicidad/Efemérides/Farmacias y pruebas integradas del entrypoint V6.
