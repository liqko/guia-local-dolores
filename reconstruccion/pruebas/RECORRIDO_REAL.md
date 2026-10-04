# Candidata para pruebas controladas — V38

La corrección de datos es V37. V38 prepara un paquete separado para probarla.
No despliega, no carga datos y no envía correo. No cambia las nueve interfaces originales.

## Configuración que falta recibir

- URL del Worker exclusivo de pruebas.
- URL de las pantallas exclusivas de pruebas, servidas en la raíz de ese origen.
- ID del proyecto Firebase de pruebas y namespace KV separado.
- Credenciales de servicio, secreto exclusivo y puente de correo configurados dentro del entorno de pruebas; no incluirlos en el repositorio.
- Cuenta de administrador de pruebas y anunciante ficticio con permisos para los módulos existentes.

El proyecto de pruebas debe contener los catálogos y datos ficticios necesarios.
Elegir dos ciudades con contenido conocido: una respuesta vacía no prueba publicación.
El puente de correo también debe estar separado: la protección del proyecto del Worker
no controla los datos que utiliza internamente ese puente.

## Preparación reproducible

Desde la raíz del repositorio, sustituyendo los valores de ejemplo:

```sh
node reconstruccion/pruebas/preparar-entorno.mjs \
  --worker-origin https://worker-pruebas.example.com \
  --site-origin https://pantallas-pruebas.example.com \
  --project-id gld-pruebas-aislado \
  --out /tmp/gld-candidata-pruebas
```

La salida contiene las nueve pantallas, todo el grafo del Worker y manifest.json
con hashes del contenido original y generado. Rechaza URLs habituales, orígenes
con rutas y carpetas existentes. Las navegaciones internas apuntan a las pantallas
de pruebas, incluidos Suscriptores e ingreso del anunciante.

Entry del Worker: worker/app-controlled-test.js. Configurar GLD_CONTROLLED_TEST=true,
FIREBASE_PROJECT_ID igual al elegido, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
SERVER_SECRET, SUSCRIPTORES_RECOVERY_URL y binding GLD_CACHE_KV exclusivo.
No copiar tokens ni sesiones del entorno habitual.
El entry rechaza el proyecto incorrecto o configuración incompleta antes de acceder
a DB/KV. La respuesta válida incluye X-GLD-Controlled-Test: V38 para identificar
el paquete. No comprueba permisos efectivos de credenciales ni identidad del namespace:
eso se verifica en el entorno real.

## Orden de ejecución y registro

1. Comprobar identificación del Worker y login administrativo con credenciales reales de prueba.
2. Preparar KV una sola vez con POST /superadmin/rebuild-all-cache y el token administrativo
   de pruebas. Es mantenimiento explícito: lee las colecciones para preparar la capa y
   no debe repetirse como parte de cada acción. Registrar su resultado completo.
3. Abrir Carcasa en dos ciudades y comprobar contenido conocido de Guía, Promos,
   Eventos, Actividades, Farmacias y Efemérides. Revisar también Publicidad existente.
4. Ingresar como anunciante: editar un dato general, una imagen y una fila de horario o
   programación donde corresponda. Guardar sin cambios. Verificar reflejo público y
   conservación de los demás datos. Revisar pausa, reanudación y baja de contenido.
5. Eliminar la última sede: la cuenta debe conservarse. Agregar una nueva sede y verificar
   publicación. Revisar las mismas ediciones existentes desde Gran Hermano y su moderación.
6. Registrar un suscriptor usando una dirección de prueba controlada; comprobar recepción
   real del código, verificación, favoritos, ciudad y recuperación con un segundo código.
   Cambiar contraseña y comprobar que la sesión anterior deja de funcionar; probar la baja.
7. Repetir navegación en móvil y escritorio. Registrar errores, capturas y peticiones por acción.

Para consumos, registrar lecturas/escrituras/eliminaciones del proyecto de pruebas
antes y después de cada bloque con su ventana temporal. Distinguir seed, carga inicial,
acciones y herramientas de observación. El código ya tiene pruebas de aislamiento;
el tráfico HTTP visible en el navegador por sí solo no acredita operaciones internas
de Firestore. Los contadores reales pueden tener demora y no sustituyen esa evidencia.

Por cada bloque guardar: fecha, URL y candidata, datos/ciudades/IDs de prueba,
resultado esperado y observado, correo recibido o fallo, errores, operaciones y corrección
si corresponde. No declarar aprobado lo no ejecutado.

Estado actual: preparación automática aprobada; entorno, seed y correo reales sin ejecutar.
