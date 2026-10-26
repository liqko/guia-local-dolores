# Gran Hermano: historial legible y contadores recibidos

Cambio autorizado26/10/2026: retirar acceso Consumos y errores al visor detenido y mejorar mediciones locales. El visor observabilidad.js estaba inerte; no se reactiva telemetría ni almacenamiento remoto.

Gran Hermano reutiliza el único script consumo-v44.js en lugar de mantener una copia inline distinta. Todas las páginas que usan ese script pueden guardar el consumo Cloudflare de las cabeceras que ya recibían. Hoy por defecto en fecha argentina; historial completo opcional sin borrado, fecha y hora completas, registros nuevos primero, encabezados fijos en contenedor desplazable. Resumen de Firebase y solicitudes Worker; desglose por pedido con etiquetas para KV, SQL público/administrativo, coordinador, alarmas y marcadores. Campos desconocidos siguen null/Sin medición; no se reconstruyen consumos ausentes del historial antiguo. Valores porcoordinador son operaciones registradas; no facturación ni totaldecuenta.

No hay fetch extra al filtrar/renderizar, consultas de sincronización, sondeo ni escrituras servidor agregadas. Se conserva validación/autorización diagnóstica existente (solicitud existente), capacidad de ocho horas, historial hasta160 filas y compartición explícita existente. Compartir sigue siendo una acción opcional que sí envía una copia al servidor; no se ejecuta automáticamente.

Prueba de integración VM con grabador completo y DOM simulado: validación, captura de cabeceras, fecha zonaargentina, filtro, orden, registros sinfecha, encabezadofijo, coordinador, null, conservación del historial y ninguna llamada extra alrenderizar/filtrar. Sintaxis JS y publicación HTML/scripts aprobadas. No se accedió a registros privados reales del usuario ni se certificó costo de toda sucuenta.
