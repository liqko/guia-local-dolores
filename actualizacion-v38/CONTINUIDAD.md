# Actualización de originales — 4/10/2026

El usuario autorizó expresamente reemplazar los HTML originales, después de trabajar
en paralelo en reconstruccion-total-03oct. Esta directiva reemplaza la restricción
anterior de no modificar main para estas nueve pantallas.

Se preserva main anterior 4b3f1b5cd4ee00d91c6f750484c2e562a4c933fd
en la rama respaldo-antes-v38-04oct.

Las nueve pantallas conservan sus nombres originales en plataforma/. La Carcasa
abre anunciantes.html, promos.html, eventos.html y actividades.html de esa carpeta.
La API permanece https://login.liqkoargentina.workers.dev.

worker/WORKER_COMPLETO_V38.js contiene el entry vigente app-main-v35.js y sus
102 módulos efectivos, empaquetados con esbuild 0.25.10, formato ESM, ES2022.
No necesita imports, npm ni otros archivos al pegarlo en el editor de Cloudflare.
El número del entry / sigue siendo 35: las correcciones V36/V37 están en sus módulos.

Pruebas del artefacto final: 43 comprobaciones públicas KV poblado/vacío/dos ciudades,
sin red Firestore ni escrituras; 9 HTML, 15 scripts con sintaxis válida y archivos
relativos existentes. No sustituye las pruebas reales de configuración y correo.
La evidencia previa de correcciones y navegador está en la rama de reconstrucción.

El usuario despliega el Worker manualmente. No se realizó ese despliegue desde aquí.
En main no hay actualmente .github/workflows: el workflow de Firebase existe
sólo en la rama de reconstrucción. Cambiar main no acredita publicación web.
Verificar el alojamiento real antes de afirmar que los HTML ya están activos.
Configuración necesaria en el Worker: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
FIREBASE_PRIVATE_KEY, SERVER_SECRET, SUSCRIPTORES_RECOVERY_URL y GLD_CACHE_KV.
No se incluyeron secretos en el código ni manifiesto.

Siguiente acción: confirmar que el usuario pegó el Worker completo y que el despliegue
de HTML terminó. Después comprobar API, login y preparación de KV antes de verificar
publicación. La carga integral POST /superadmin/rebuild-all-cache exige sesión
administrativa y es mantenimiento explícito; consume lecturas iniciales. No invocarla
automáticamente ni repetirla para cada cambio. Correo real todavía no probado.

No desarrollar pendientes históricos ni rehacer auditorías aprobadas. Registrar
fallos reales y correcciones puntuales desde este estado.

## Corrección V39 — errores del editor de Cloudflare
La captura mostró nueve diagnósticos TypeScript en el JavaScript empaquetado.
Reproducidos exactamente con TypeScript 5.9.3 checkJs/ES2022/DOM sobre V38.
Se declaran opcionales los parámetros previous, programacion y matchKey, y se
explicitan los campos de los valores de configuración por defecto. No se ocultan
errores con ts-nocheck ni se modifican los campos enviados a Firestore.
Worker actualizado: worker/WORKER_COMPLETO_V39.js. Compilador: cero errores.
Pasaron 75 casos de aislamiento, 15 mutaciones y ocho flujos existentes.
La captura también muestra Falta binding GLD_CACHE_KV: requiere vincular el
namespace KV con ese nombre en Cloudflare. Corregir el JS no crea esa vinculación.
Siguiente paso: entregar V39, usuario reemplaza código y revisa binding, después
comprobar arranque y seed/publicación/correo real.

## Incidencias reales — 5/10/2026
KV GLD_CACHE_KV creado y vinculado por el usuario al Worker login. Raíz responde
success:true. Namespace ID a3f3f31d7a3b44a9973767bfb033b5b7.
Hosting real del embed: https://anunciantes-guialocal.web.app/plataforma/granhermano.html.
Descarga del HTML publicado confirmó versión anterior: login mediante api('login'),
incompatible con /superadmin/session/login. No es evidencia de contraseña inválida.
GET /territory/public devuelve 503: Catálogo territorial no inicializado.
Se restaura el workflow histórico firebase-hosting-merge.yml en main, que publica
en anunciantes-guialocal usando el secreto existente, sin valores secretos nuevos.
Verificar resultado del workflow y HTML remoto antes de afirmar publicación.
Después login administrativo y carga inicial explícita de KV; todavía no ejecutada.

Publicación Firebase run 37334028552 terminó SUCCESS; HTML remoto confirmó
/superadmin/session/login. Usuario después recibió Mail o clave incorrectos.
Comparación con WORKER_GRAN_HERMANO_30SEP_CORREGIDO_LECTURAS.txt demostró error:
credenciales históricas en suscriptores; superadmins contiene permisos, no clave.
V40 restaura consulta acotada suscriptores.mail y compara clave allí; luego permiso
superadmins por documento sid, con fallback queryEqual suscriptor_id limit 5.
Rechaza suscriptor inactivo, permiso ausente/inactivo y roles no habilitados.
No escribe, elimina ni barre colecciones. Token firmado conserva sid del suscriptor.
Prueba TEST_LOGIN_ADMIN_V40 aprobada y aislamiento admin 24 casos aprobado.
Prueba visual no pudo arrancar: Chromium ausente en este workspace.
Artefacto worker/WORKER_COMPLETO_V40.js empaquetado con esbuild 0.25.10, sintaxis OK.
Usuario debe pegar V40 completo y desplegarlo. KV inicial todavía pendiente.
