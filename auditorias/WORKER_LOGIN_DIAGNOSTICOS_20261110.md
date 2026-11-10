# AUDITORÍA TÉCNICA — Cloudflare Worker `login` (Guía Local Dolores)
**Corte verificable:** 10/11/2026, Worker 178.  
**Rama de trabajo:** `audit/worker-diagnosticos-20261110` (NO fusionar ni desplegar automáticamente).  
**Versión de producción comprobada:** `worker/worker178_ids_historicos_funcionalidades.txt` — blob SHA `d9d36a06abed206fa9986450ea9eac44983347b0`.

## 1. Paridad completa de fuente: verificada dos veces
Se obtuvo `login` por `workers_get_worker_code` y el archivo de GitHub por `fetch_file`. Inicialmente ambos coincidían en **Worker 176** (782.005 caracteres). Durante la auditoría, el otro trabajo actualizó el Worker a **177** y después a **178**. Se recuperó y comparó íntegramente cada actualización: código instalado = GitHub 178, **782.322 caracteres, 12.183 líneas, igualdad carácter por carácter**. Se adoptó 178 como nueva base sin sobrescribir el origen. El nombre multipart `worker-v129.js` es una etiqueta heredada, no la versión ejecutada.

Archivos auditados en rama:
- `auditorias/worker178_base_snapshot.txt` — copia exacta de 178.
- `auditorias/worker178_diagnosticos_corregidos.txt` — copia corregida de 178; **193 caracteres adicionales, 1 línea adicional**, cuatro sustituciones exactamente verificadas.
- `auditorias/worker-login-analyzer.cjs` — ejecutor reproducible.
- `.github/workflows/audit-worker-diagnostics.yml` — CI sólo en la rama de auditoría, lectura y dry-run, sin despliegue.
- `auditorias/worker176_diagnosticos_corregidos.txt` y archivos de 177 — **HISTÓRICOS, NO INTEGRAR** porque ya existe 178.

## 2. Diagnósticos reales reproducidos bajo configuración documentada
Herramientas: **TypeScript 5.9.3** (`allowJs:true, checkJs:true, target ES2022, libs ES2022/DOM/WebWorker, skipLibCheck:true, noImplicitAny:false, strict:false`); **esbuild 0.25.12**; **Wrangler 4.160.0** con `--dry-run`. La CI inspecciona **todo** el texto, no sólo las primeras cinco líneas.

| Clasificación | Base Worker 178 | Candidato corregido | Observaciones |
| --- | ---: | ---: | --- |
| Parseo/sintaxis con esbuild | 0 | 0 | Ambos compilan sintácticamente |
| TypeScript/JSDoc con `checkJs` | **5** | **0** | 3 códigos y 3 causas |
| Análisis de JS sin `checkJs` | 0 | 0 | Diagnósticos dependen de checkJs |
| Errores TS2345: falta de `cache` en `quota()` | 2 | 0 | **Problema funcional real** al reanudar promociones |
| TS2339: tipo inferido `{}` sin `excepcion_cupo` ni `posiciones` | 2 | 0 | **Diagnóstico de tipado**, no se quitaron propiedades |
| TS8024: comentario JSDoc `@param admin` inválido | 1 | 0 | **Comentario incorrecto**, no alteró lógica |

Referencias de línea en 178:
- 3145 y 10282: llamadas a `quota()` sin `cache`. La función `quota()` llama `gldFuncPacket166(cache,db,false)`, que intenta `cache.get(...)`. Un doble de prueba demostró **`Cannot read properties of undefined (reading 'get')`** con la invocación antigua.
- 3366: firma `gldValidarDescripcionFree167(descripcion,policy)` tenía `@param {any} admin`, sustituido por nombres correctos.
- 6885 y 6888: `config={}` era inferido como objeto sin propiedades. Se añadió una firma JSDoc precisa de las propiedades `excepcion_cupo` y `posiciones`, sin modificar su lectura ni la regla.

**Los cinco diagnósticos reproducidos se resolvieron con cuatro cambios localizados**, sin suprimir condiciones, validaciones, propiedades ni funcionalidades.

## 3. Diagnósticos del editor NO confirmados
El dato original **«5 errores visibles y 501 errores/advertencias adicionales»** proviene de la interfaz Cloudflare observada por el usuario. **No existe un acceso a la lista interna de 501 marcadores desde los endpoints de fuente/observabilidad conectados.** El hecho de que un perfil TypeScript reproduzca exactamente cinco no demuestra identidad con los cinco visibles ni resuelve los 501 ocultos. NO marcar esta auditoría como 506/506 ni cerrar el expediente del editor sin extraer dichos marcadores.

**Inspección adicional del editor abierto en Opera:** la barra inferior de Cloudflare muestra **5 errores, 0 advertencias y 1 mensaje informativo** (indicadores independientes 5 / 0 / 1). No se observó en el estado accesible una lista de 501 diagnósticos ocultos. Esto plantea una posible confusión de lectura del indicador «5 0 1», pero no permite descartar que otro mensaje de la interfaz se refiera realmente a 501 avisos adicionales.\n\nSe ejecutaron perfiles adicionales, con resultados **NO sumables ni homologables** a marcadores reales del editor:
- `noUnusedLocals + noUnusedParameters`: **15 diagnósticos** en base (los mismos cinco más 10 variables aparentemente no usadas). Puede haber código legado, sin justificación para eliminarlo preventivamente.
- `strict:true`: **179 diagnósticos** de inferencia estricta, nulabilidad, tipos de arrays, etc. Su activación no consta en la configuración de Cloudflare; algunos merecen análisis de riesgo por separado.
- `target ES5 / lib ES5`: **1.049 diagnósticos**, mayormente faltan `Promise`, `Map`, `String.normalize` y APIs modernas. Es un desajuste de entorno: Wrangler y esbuild empaquetan el JavaScript ES2022 sin errores.
- `skipLibCheck:false` con DOM + WebWorker: **37 diagnósticos**, incluidos 32 conflictos entre declaraciones de bibliotecas + los cinco del Worker. Es necesario evitar bibliotecas incompatibles simultáneas, no alterar lógica comercial.

Ninguno de estos conteos demuestra que los 501 avisos del editor sean falsos, iguales a dichos conteos o estén ya solucionados.

## 4. Pruebas y regresión
**GitHub Actions:** [ejecución 42904616195](https://github.com/liqko/guia-local-dolores/actions/runs/42904616195), commit `5b15f5f8f4c1a486ec1ae1a232bf4e72b45a28c0`. Todas las etapas completas (incluido empaquetado).
- Original y corregido pasan esbuild y Wrangler `deploy --dry-run`; salidas: **847,36 KiB antes / 847,37 KiB después**, ambos gzip 186,45 KiB, sin publicación remota.
- Analizador verificó que la copia corregida equivale al texto original **más exactamente cuatro modificaciones conocidas**. No se alteraron otros endpoints ni contratos de datos ni interfaces. Referencias de código no documentales a `posiciones` y `excepcion_cupo` preservadas; `cache` se pasó en exactamente dos sitios previamente faltantes.
- Test con sustitutos para `quota()`: el caso antiguo falla al consultar caché; el corregido devuelve `max=3`, `active=1`; **1 lectura de caché, 1 consulta de documento, 1 consulta de promos, 0 escrituras** en este escenario simulado.
- Test con sustitutos para `publicitySaveV4()`: 2 posiciones contra límite 3 → permitido; 5 posiciones contra límite 3 → error 409; 5 posiciones con excepción autorizada → permitido. **1 lectura de configuración de caché por escenario, 0 escrituras de base realizadas por la prueba**. Se preservó el mecanismo que delega el guardado al motor mensual.

**Alcance honesto:** las pruebas son de compilación y unitarias con sustitutos. No se ejecutaron regresiones end-to-end de las tres interfaces, no se desplegó un entorno de preproducción ni se midieron consumos reales antes/después: **no es posible afirmar invariancia empírica de consumos en producción** sin ejecutar código nuevo. La comparación textual exhaustiva garantiza que no se tocó ninguna ruta fuera de cuatro puntos.

## 5. Integración segura y coordinación
1. Antes de integrar, consultar de nuevo el código Cloudflare `login`, última versión completa de GitHub y HEAD de `main`. **Si hay Worker 179 o posterior, rehacer el snapshot a partir del más reciente**; NO recuperar 176 ni usar 178 por defecto.
2. Trasladar **únicamente las cuatro modificaciones semánticas** a la última versión íntegra, con comprobación de unicidad y revisión de contexto. No copiar el Worker histórico ni sobrescribir cambios del otro chat.
3. Reejecutar pruebas de esbuild, TypeScript/JSDoc y Wrangler `--dry-run`, así como los escenarios `quota` y `publicitySaveV4`. Comparar diff exacto de cuatro intervenciones.
4. Conservar la rama independiente y no realizar merge/deploy automático. Necesaria autorización expresa para despliegue.
5. Obtener los 501 avisos reales del editor antes de afirmar cierre total; identificar configuración de análisis y diferenciar errores reales de editor de warnings por compilación/entorno.

## Estado
**Correcciones reproducibles preparadas y validadas sobre Worker 178 en rama aislada: 5 → 0.**  
**Auditoría integral de los 501 avisos ocultos: no verificable con las APIs actuales, por tanto ABIERTA.**  
**Producción: intacta por este trabajo.**  
**Última verificación de despliegue: Cloudflare login coincide completamente con GitHub 178.**
