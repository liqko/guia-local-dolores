# ETAPA 01 — Medición previa y trazabilidad sobre código principal (17/11/2026)

## Fuente vigente comprobada
La referencia de las mediciones será **main**, NO la rama PR76 que contiene un inicio de GH diferente.
- Usuario/Carcasa `plataforma/carcasa.html` blob `67aba95361b598ecc3356262324762a7e028b677`.
- Usuario/Cuenta `plataforma/suscriptores.html` blob `4034aed6ae790c2abe1f16a9831cac2b73697e36`.
- Anunciante `plataforma/login.html` blob `df92f6cbb7a76fd960c9fac45cd02845548c5117`.
- Gran Hermano `plataforma/administracion.html` blob `34350e2840285e57149de09cbc75a5af00b7b94e`.
- Worker único fuente `worker/worker206.txt` blob `788a9cb79d536459fd01050a449cd85db4daaf54`; NO se supone desplegado hasta comparar el Worker real.

## Ruta concreta para la primera medición controlada
**Gran Hermano, acceso inicial**:
- Ingreso nuevo: `plataforma/administracion.html:1055` POST `/superadmin/session/login` → `:1067` `abrirApp(j.entry_version===195?...)` → `:1077` `abrirApp(prefetched)` → se reutiliza la respuesta cuando incluye `entry_version=195`, o se hace GET `/superadmin/dashboard` en `:1079` si la respuesta no contiene la entrada.
- Recuperación de sesión: `plataforma/administracion.html:3993` `if(TOKEN) abrirApp()` → `:1079` GET `/superadmin/dashboard`.
- `:1104` `ghRevisionUnificada(GH_DAILY_ENTRY195?.inbox||null)`: reutiliza inbox de la entrada diaria si viene incluida; de lo contrario puede consultar `/superadmin/inbox`.
- **No confundir con el árbol de botón** `7d6268c1e5a791f2`, que sólo corresponde a navegar a Inicio y NO certifica el inicio automático. La entrada automática se mantiene separada hasta ampliar el generador del mapa sobre main.

## Firebase — lectura directa de la pestaña Opera (proyecto anunciantes-guialocal)
Página abierta `https://console.firebase.google.com/project/anunciantes-guialocal/usage?hl=es-419`; panel del mes seleccionado **noviembre de 2026**, fecha de consulta **17/11/2026**. Valores visibles:
| Métrica de la consola | Valor visible | Advertencia |
|---|---:|---|
| Cloud Firestore: lecturas | 0 | Total mostrado por el panel, NO lecturas de una sesión |
| Cloud Firestore: escrituras | 0 | Total mostrado por el panel, NO escrituras de una sesión |
| Cloud Firestore: eliminaciones | 0 | Total mostrado por el panel |
| Firebase Hosting: descargas | 482,8 KB | Total mostrado; cuota referencial 360 MB por día; NO es tráfico de GH |
| Firebase Hosting: almacenamiento | 12,8 MB | Total mostrado; cuota referencial 10 GB |
| Costo del proyecto | USD 0,00 | La consola advierte retraso de hasta 24 h en costos |

**No hay una lectura por acción en ese panel**; una diferencia de totales sin correlación de tiempo y tráfico no demuestra costo por botón.

## Cloudflare — observabilidad del Worker `login` (agregación por ruta; acceso real a cuenta)
Consulta real de Observability, `datasets=['cloudflare-workers']`, servicio `login`, `view=calculations`, `count` agrupado por `$metadata.trigger`, filtros por servicio. Zona horaria de las ventanas **UTC**, no convertir en acciones particulares.
| Ruta | 16/11 00:00–23:59:59 UTC | 17/11 00:00–12:30 UTC |
|---|---:|---:|
| `POST /suscriptores` | 6 | 0 identificadas |
| `OPTIONS /suscriptores` | 9 | 0 identificadas |
| `GET /suscriptores` | 12 | 0 identificadas |
| `GET /territory/public` | 16 | 0 identificadas |
| `GET /catalogs/public/guide` | 4 | 0 identificadas |
| `POST /internal/city-books` | 4 | 0 identificadas |
| `POST /` | 100 | 0 identificadas |
| `GET /` | 4 | 0 identificadas |
| `GET /robots.txt` | 2 | 2 |
| `GET /superadmin/dashboard` | 0 observadas | 0 observadas |

**Estas cifras son eventos observados, no ejecución exclusiva del usuario, ni facturación**. No aparecen llamadas GH durante las ventanas. El acceso a logs individuales con `view=events` o `invocations` falla actualmente en el conector Cloudflare porque la respuesta carece del campo obligatorio `$workers.requestId`; la consulta agregada sí funciona, pero no muestra KV/DO/SQL/Firestore por invocación. No inventar esa información.

## Estado y puerta de salida
- **Fase cumplida:** recuperar fuente main actual; identificar una ruta de ingreso GH con variante de login y restablecimiento; capturar valores reales visibles en Firebase y conteos Cloudflare.
- **Fase NO cumplida:** medir **la misma acción real, antes/después** en Cloudflare por requestID y Hosting/Firebase; todavía NO hubo una operación de ingreso GH atribuible al experimento, ni una corrección basada en su costo. No se modifica Worker ni producción para conseguir la medida.
- **Siguiente paso exacto:** obtener una muestra trazable de **una sola entrada a GH** (login con sesión ya válida o acceso autorizado), delimitando hora de inicio y fin; medir GET `/superadmin/dashboard`, GET `/superadmin/inbox`, KV/DO/SQL en registros disponibles; contrastar con Firebase por la misma ventana; recién entonces resolver un error concreto de esa ruta y medir nuevamente. Si no es posible iniciar esa acción sin operar sobre sesión ajena, **solicitar una única intervención dirigida al usuario**, nunca afirmar que la consola sola sirve para medir cada clic.
