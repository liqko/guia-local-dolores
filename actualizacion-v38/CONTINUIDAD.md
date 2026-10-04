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
El workflow de main publica los HTML mediante Firebase Hosting.
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
