# Reconstrucción total — V32 (continuación de V31)

**NO DESPLEGAR TODAVÍA.** Rama: `reconstruccion-total-03oct`. No modificar `main`.

## Base verificada

V31: commit `203de30190ff69d8ced0bff67942e89d1541d160`.
El Worker vigente sigue siendo `worker/app-main-v31.js`, con rutas públicas V12,
panel V15 y administración V11. V32 corrige la integración de interfaces sobre ese Worker.

## Interfaces vigentes para revisión

- Carcasa: `plataforma/carcasa-territorio-v3.html`.
- Guía central: `plataforma/anunciantes-publico-v4.html`.
- Suscriptores: `plataforma/suscriptores-v2.html`.
- Panel anunciante: `plataforma/login-modular-v11.html`.
- Gran Hermano: `plataforma/granhermano-v2.html`.
- Promos/Eventos/Actividades: `plataforma/promos-public-v1.html`,
  `plataforma/eventos-public-v1.html`, `plataforma/actividades-public-v1.html`.
- Farmacias: `plataforma/farma-turnos-public-v1.html`.

La Carcasa V3 abre los archivos reconstruidos de su propia carpeta; no mezcla
los módulos anteriores de producción. Las direcciones del Worker siguen siendo
las previstas para el despliegue posterior. No se conectó producción a estas interfaces.

## Correcciones V32

- Guía y catálogos públicos de Carcasa usan `/guide` y `/catalogs/public/guide`.
- Promos siempre incluye `ciudad_id`.
- Eventos en el iframe de Guía genera su URL con `URL/searchParams`;
  antes concatenaba `&ciudad_id` sin un signo `?` y la ruta devolvía 404.
- Promesas y cachés auxiliares separadas por ciudad, con deduplicación de llamadas.
- Las respuestas fallidas no se guardan y permiten reintentar.
- Las relaciones de actividades/acciones/nodos preparadas dentro de cada sede
  se conservan durante la hidratación de las tarjetas.
- La Guía reconoce insignias booleanas del Worker además del valor histórico `x`.
- El timeout de Carcasa no muestra error si el módulo ya terminó de cargar.
- Nuevos prefijos de caché evitan recuperar los paquetes del circuito anterior.

## Validación

`node reconstruccion/auditoria/TEST_CARCASA_V32.mjs` ejecuta funciones extraídas
de ambas interfaces contra el entrypoint real V31 con KV de prueba: Guía,
catálogos, Eventos, Promos y Actividades, dos ciudades, deduplicación,
reintentos, relaciones, insignias y timeout. Bloquea llamadas externas y
escrituras: las lecturas probadas no acceden a Firestore ni escriben KV.

Las auditorías previas y la prueba de rotación de Farmacias se conservan.
El workflow V32 ejecuta estas verificaciones al subir cambios de reconstrucción.

## Próximo trabajo

1. Pruebas funcionales de mutaciones y moderación con datos de prueba:
   alta/edición/pausa/eliminación, aprobación/rechazo y reflejo público.
2. Revisar de punta a punta permisos, cuotas y correo de verificación/recuperación.
3. Prueba visual completa de carga inicial, cambio de módulos y reintento.
4. Preparar configuración y seed KV controlado para un entorno de prueba.

Estas pruebas locales no certifican el despliegue, credenciales, puente de correo
ni presentación visual en el navegador. Mantener sin desplegar hasta cerrar esos puntos.
