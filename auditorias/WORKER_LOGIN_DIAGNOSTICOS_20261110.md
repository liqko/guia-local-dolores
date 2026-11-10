# Auditoría Worker login — registro inicial 2026-11-10

## Alcance y protección
Rama exclusiva: `audit/worker-diagnosticos-20261110`. No modificar `main`, ni desplegar `login`. Referencia: `worker/worker176_adicionales_valores.txt`, blob GitHub `27578a500ce9cfea47abbbe21a0fc1784d4fabf0`.

## Verificación efectiva
- Fuente recuperada del Worker `login` con API de Cloudflare (parte multipart `worker-v129.js`) y del archivo de GitHub.
- Contenido extraído de la parte multipart: **782005 caracteres y 12179 líneas**.
- Comparación íntegra de cadenas: **idénticas**; primera diferencia: ninguna.
- Cabecera interna: **Worker 176**. El nombre heredado de la parte multipart (`worker-v129.js`) no es una prueba de versión 129.
- Coincidencia validada en el momento del análisis, no implica que futuras versiones de otros chats mantengan la coincidencia.

## Diagnósticos: estado verificable
El editor muestra 5 + 501 adicionales **según reporte del usuario**. No existe en las APIs de acceso usadas un volcado de esos diagnósticos del editor. Por tanto, 506 no constituye un conteo recalculado ni clasificación validada. **Total real, errores, avisos y duplicados: aún no determinado**.

Exploración textual: no aparecen directivas `@ts-check` ni `@ts-nocheck`; se encontraron 6 ocurrencias de `@typedef`, 43 `@param`, 172 `@type`. Estos son conteos textuales, no diagnósticos de TypeScript.

## Hallazgo concreto para investigar
- Líneas 6888-6889: parece repetida la misma validación sobre `global.posiciones_max` y `cfg.posiciones`; las dos llamadas arrojan la misma excepción 409. No alterar hasta revisar contexto de negocio y confirmar regresión.

## Invariantes obligatorias
Preservar `posiciones`, `excepcion_cupo`, `cache`, permisos, endpoints, contratos, lecturas/escrituras y reglas existentes. No inferir éxito a partir de ausencia de errores de parseo. Ninguna corrección de código aprobada ni desplegada todavía.

## Matriz de verificación
| Categoría | Inicial | Posterior | Estado |
| --- | ---: | ---: | --- |
| Sintaxis | N/D | N/D | Pendiente compilador/parser de fuente íntegra |
| Tipos TS/JSDoc | N/D | N/D | Pendiente análisis con opciones equivalentes a Cloudflare |
| Avisos del editor | N/D | N/D | Pendiente exportar/configuración del editor |
| Funcionales | N/D | N/D | Pendiente pruebas no destructivas |
| Diagnósticos derivados | N/D | N/D | Pendiente agrupación por causa |
| Regresión | N/D | N/D | No ejecutada |
| Consumos | N/D | N/D | No comparados |

## Integración segura futura
1. Verificar nuevamente código desplegado, archivo y HEAD del trabajo paralelo.
2. Rebasar rama de auditoría sobre el commit más reciente sin sobrescribir archivos; resolver diferencias y reevaluar cada cambio.
3. Ejecutar la misma batería de análisis estático y regresión sobre el Worker final fusionado.
4. Comparar métricas reales de lectura/escritura antes/después.
5. Solicitar autorización explícita antes de desplegar.

**Estado: auditoría abierta.** No confundir verificación de paridad de fuente con certificación funcional.
