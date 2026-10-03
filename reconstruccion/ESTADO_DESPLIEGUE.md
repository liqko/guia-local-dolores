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
