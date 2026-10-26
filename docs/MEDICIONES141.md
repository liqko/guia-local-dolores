# Medición desde ahora y comparación separada

Autoriza26/10/2026: medir desde un inicio explícito, sin mezclar históricos; conservar datos para comparar y exportar a Sheets.

Botón Empezar medición desde ahora: identificador de sesión local y hora de inicio, sin petición servidor. Sólo captura nuevas respuestas de esa sesión; una respuesta iniciada antes de reiniciar no entra en la nueva. Terminar medición detiene captura y deja resultados. Una sesión nueva no muestra filas anteriores; persiste al recargar. La capacidad de diagnóstico/autorización existente sigue siendo necesaria, no se amplían permisos ni se inicia telemetría global.

CSV actual y CSV anteriores separados, con fechaUTC, fechaArgentina, identificación de sesión/pedido, métricas recibidas Firestore/Cloudflare y versión. Exportación local con BOM y comillas/escape CSV; valores que comienzan con fórmulas protegidos. No sube a Google Sheets automáticamente; usuario descarga e importa archivo. Campos desconocidos vacíos, no cero. Compartir copia existente usa sólo la sesión actual y conserva su autorización y acción explícita.

El límite preexistente sigue160respuestas en total en ese navegador: no es archivo permanente. Descargar CSV permite conservar comparaciones antes de que nuevos registros desplacen anteriores. No se borran históricos al iniciar, pero pueden salir por el límite160 o al borrar almacenamiento del navegador. Sin consultas, escrituras ni sondeo de proveedores nuevos; exportación tampoco hace fetch. No cambia Worker ni reglas de negocio.

Prueba VM completa: iniciar/terminar/reiniciar, separación y conservación anterior, contadores y null, fecha completa, captura detenida, CSV de cada conjunto y cero solicitudes extra al controlar/exportar. Comprobación de sintaxis de scripts GH y publicación HTML aprobada.
