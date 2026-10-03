# Reconstrucción total Guía Local — Estado de despliegue

**NO DESPLEGAR TODAVÍA.**

La rama `reconstruccion-total-03oct` es un entorno de construcción aislado de producción.

## Qué ya existe en esta rama
- `reconstruccion/worker/WORKER_NUEVO_TERRITORIO_V1_03OCT.js`
- `reconstruccion/plataforma/granhermano-territorio-v1.html`
- `reconstruccion/plataforma/carcasa-territorio-v1.html`

## Qué significa
Estos archivos forman el primer bloque de la arquitectura nueva de Territorio/Ciudades. Todavía no reemplazan los archivos de producción ni el Worker desplegado.

## Regla de trabajo
No pedir al usuario que copie o despliegue piezas sueltas. El primer despliegue se hará cuando el bloque mínimo coherente esté cerrado:
1. Worker nuevo con Territorio.
2. Capa KV configurada.
3. Gran Admin conectado.
4. Carcasa pública conectada.
5. Inicialización controlada del catálogo territorial.
6. Prueba integrada fuera de producción.

Hasta ese punto, todo cambio queda únicamente en la rama de reconstrucción.
