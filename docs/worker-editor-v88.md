# Worker B88: corrección del aviso del editor

El aviso observado en Cloudflare corresponde al límite de diagnósticos del editor, no a una excepción de la función de residencia. Con el servicio de lenguaje TypeScript 5.9.3 se reprodujeron 1.012 sugerencias en B87 y la sugerencia de parámetro `cache` en la línea 8586, columna 29, coincidente con la captura. El editor usa un límite de 1.000 diagnósticos por archivo y añade un aviso informativo al superarlo. La cifra exacta puede variar con la versión del servicio de lenguaje de Cloudflare.

B88 documenta los tipos reales de los parámetros de residencia, vínculo por ciudad y registro territorial. Tipifica también la respuesta del transporte. Retira siete bindings o parámetros sin uso y las dos funciones heredadas de publicidad que ya no tenían consumidores. Actualiza los llamadores del argumento posicional retirado para conservar el orden de argumentos de caché. No elimina validaciones ni desactiva comprobaciones.

Resultado local: cero errores sintácticos, cero errores semánticos, cero advertencias y cero declaraciones sin uso. Quedan 991 sugerencias opcionales de tipos en el código heredado, por debajo del límite. **No se afirma que todo el Worker esté completamente tipado ni que la comprobación del editor de Cloudflare esté verificada con la sesión real.** No se añadió `@ts-nocheck`, `@ts-ignore` ni un filtro de diagnósticos.

Las ocho suites simuladas pasaron: sesión/diagnóstico privado, interfaz de recuperación, funciones existentes, moderación por ciudad, conversaciones, duplicados, bandejas GH y soporte. Conservar sesión y activar/validar diagnóstico siguen usando únicamente KV y muestran cero operaciones Firestore en esas pruebas. La limpieza no añade consultas, escrituras o eliminaciones.

`tests/worker-editor-v88.cjs` reproduce la comprobación con TypeScript instalado; recibe la ruta del Worker como primer argumento. `GLD_TYPESCRIPT_LIB` permite indicar una instalación específica del comprobador. El test exige cero errores/advertencias, cero declaraciones sin uso y menos de 1.000 sugerencias. Ese control debe aplicarse a próximas versiones para evitar repetir el aviso.

El Worker completo está en `worker/WORKER_COMPLETO_V88.js`. La raíz y las cabeceras de observación informan versión 88. Incluye las funciones de B87; el despliegue del Worker sigue siendo manual. No hay cambios de interfaz en este bloque.
