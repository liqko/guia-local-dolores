# Punto 3 — Revisión directa de cobertura, lote 001

**Corte de fuente:** `e6362836e6078a14a361732d79a8212258934056` (el mismo que el catálogo maestro de 987 unidades). **Alcance:** verificación textual exhaustiva por símbolo en el archivo que declara cada función, sin tocar la aplicación, desplegar ni medir consumos. Estos seis casos provienen del grupo prioritario de orígenes de red previamente marcado como **candidatos a desuso** en `COBERTURA_FUNCIONES.md`. Sin cruzar aún cada identidad con `COBERTURA_ACTIVACIONES.zip`, **no se afirma que los seis pertenezcan inequívocamente al subconjunto de 1.691**.

| Función | Archivo y línea | Coincidencias exactas en ese archivo | Comprobación | Estado |
|---|---|---:|---|---|
| `ghBuscarModeradores` | `plataforma/administracion.html:958` | 1 | Solo declaración; no aparece llamada directa en el archivo | Abierto: descartar invocación externa/indirecta |
| `ghComercialBuscar186` | `plataforma/administracion.html:3764` | 2 | Una declaración y una referencia **a ID de elemento** en el cuerpo propio; no demuestra llamada | Abierto: módulo comercial pendiente, revisar activación indirecta |
| `events_get` | `plataforma/login.html:3089` | 1 | Solo declaración; ninguna llamada directa en ese archivo | Abierto: revisar adaptador vigente de Eventos |
| `farmacias_get` | `plataforma/login.html:5904` | 1 | Solo declaración; ninguna llamada directa en ese archivo | Abierto: revisar adaptador vigente de Farmacias |
| `fetchInstagramImage` | `plataforma/carcasa.html:1022` | 1 | Solo declaración en Carcasa; no consta invocación en el archivo | Abierto: revisar uso global/dinámico y tarjetas |
| `fetchInstagramImage` | `plataforma/eventos.html:773` | 1 | Solo declaración en Eventos; no consta invocación en el archivo | Abierto: revisar uso global/dinámico y tarjetas |

## Resultado verificable

- **Seis declaraciones revisadas individualmente** en su fuente; **seis sin llamada directa detectada en ese mismo archivo**. No se encontraron pruebas suficientes para clasificarlas como «sin uso» ni «cubiertas».
- El caso de `ghComercialBuscar186` tiene **dos menciones**, pero la segunda es un ID de interfaz, **no un segundo llamador**.
- **Ninguna declaración se elimina ni se quita del catálogo**. Candidatas y revisión pendiente permanecen visibles.
- **Próximo cotejo:** verificar si son importadas o invocadas por otros scripts y HTML generados, y confrontar sus identidades AST con el anexo individual de las 1.691, antes de cambiar el contador de cobertura.
