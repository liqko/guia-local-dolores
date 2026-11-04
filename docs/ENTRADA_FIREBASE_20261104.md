# Entrada directa desde Firebase Hosting — candidato 2026-11-04

**Estado:** IMPLEMENTADO EN RAMA, NO INSTALADO EN PRODUCCIÓN.
**Rama:** `fix/entrada-firebase-sesion-selector-20261104`.
**Alcance autorizado:** ingreso público desde dominio Firebase; selección de ciudad; continuidad al contenedor carcasa; cierre de sesión y cambio de ciudad.
**Fuera de alcance:** traslado DNS, baja Jimdo, cambios de Worker/Firestore/Cloudflare, módulos Anunciante/Gran Hermano, mejoras de título y PWA.

## Contrato de navegación
1. Ruta raíz `/` abre `/plataforma/inicio.html` sin duplicar pantalla.
2. Sin sesión autenticada, siempre aparece selector de ciudad; el almacenamiento local de la última ciudad no autoriza ingreso automático.
3. Con sesión válida, se conserva la preferencia de ciudad y puede accederse a carcasa.
4. Al elegir ciudad sin cuenta, se puede navegar la Guía pública con parámetros de ubicación explícitos.
5. Cerrar sesión devuelve a selector y no recupera automáticamente la última ciudad.
6. Cambiar ciudad vuelve al selector.
7. Las rutas de entrada, carcasa y selección se resuelven en el mismo dominio; no exigen Jimdo ni fuerzan `web.app`.

## Archivos afectados
- `index.html`: entrada raíz.
- `plataforma/entrada-recordada.js`: distingue sesión válida de contexto de navegación pública.
- `plataforma/inicio.html`: helper actualizado y navegación a carcasa en mismo origen.
- `plataforma/carcasa.html`: ruta al selector en mismo origen, elimina última ciudad como acceso implícito, cambia ciudad en mismo origen.
- `plataforma/suscriptores.html`: cierre de sesión al selector, enlaces de acceso a Guía sin Jimdo.

## Evidencia y límite
- Código de rama leído nuevamente tras los commits: rutas y condiciones presentes.
- Ensayo aislado de `gldRecuperarEntradaV92` con token ausente y contexto guardado: `recordada=false`.
- Ensayo aislado con token válido y perfil de ciudad: `recordada=true`, ciudad de perfil.
- Comprobación estática de rutas y botón cerrar sesión: aprobada.
- **No hay todavía prueba en navegador de una versión desplegada de esta rama**, ni pruebas de integración completas en producción.
- **Sin medición nueva** de Firestore, Cloudflare o Firebase; el cambio no añade peticiones de datos salvo las ya existentes en los recorridos.
- Producción permanece sin cambios. Jimdo y DNS permanecen sin cambios.

## Restricciones previas al cambio de DNS
- Revisar los enlaces todavía absolutos a `guialocal.ar` en carcasa (suscriptores, Promos, Eventos) y comprobar que no requieran las páginas Jimdo actuales.
- Verificar manualmente y/o automáticamente navegación con sesión, sin sesión, cambiar ciudad, salir, acceso a Guía pública e identidad de la ciudad.
- Validar comportamiento integrado del sitio y regresiones existentes antes de instalar este candidato.
- Comparar tráfico Firebase/externos tras la instalación autorizada.
- Reversión: mantener dominio y Jimdo en su estado actual hasta validar Hosting; descartar rama si falla.


## Resultado de vista previa (4 de noviembre de 2026)
- GitHub Actions ejecución `41897994876` terminada correctamente (vista previa, no canal live).
- URL de prueba: https://anunciantes-guialocal--prueba-sin-jimdo-we5f65xw.web.app
- El canal tiene expiración de 7 días.
- Dos recursos gráficos originales recuperados del HAR y guardados como `plataforma/assets/marca/fondo-ciudad.jpg` y `logo-guia-local.png`; ahora se sirven desde Hosting y no desde el sitio Jimdo.
- Identidad corporativa común `plataforma/marca-global.js` en inicio y carcasa: fondo, logo y eslogan.
- Pie original `plataforma/pie.html` reutilizado en iframe mismo origen y altura dinámica por postMessage.
- Comprobado con navegador conectado: la raíz de vista previa redirige a inicio; se visualiza búsqueda de ciudad, logo y eslogan; la carcasa de Dolores se abre con su nombre, módulos y pie presente.
- El canal de producción `live` y los DNS de `guialocal.ar` no se modificaron.
- Aún pendientes: ensayo completo de sesión real y cierre de sesión, navegación de todos los módulos con sesión, y control de estilo responsive; no conectar DNS hasta validarlos.
