# Reducir operaciones repetidas al crear ciudades

Autoriza26/10/2026: minimizar repeticiones sin alterar autorización ni guardados simultáneos. Alcance exclusivamente interfaz administrativa de ciudades; no se modifica Worker139, permisos ni recuperación/concurrencia del coordinador.

La interfaz impide repetir el envío del mismo formulario mientras está pendiente y bloquea sus campos/botón con Guardando. Distintos formularios conservan independencia. Ante rechazo recupera los controles; una confirmación tardía de una alta no elimina un formulario nuevo. Al confirmar usa la ciudad devuelta por el servidor para actualizar únicamente esa fila en el catálogo local; conserva las otras y ordena. No reconsulta todo el catálogo. Actualizar manual sigue disponible para incorporar cambios de otros administradores.

Respuesta139 devuelve ciudad confirmada; si una respuesta exitosa no la contiene se avisa usar Actualizar sin repetir el alta, en vez de inventar confirmación local. No se usa ese caso para hacer un GET automático.

Medición anterior real26/10:POST11:05:04 y11:05:06 más2GETterritory;4Worker,KVget12/put2,Firestorewrite1,coordinador2. No se atribuye el segundo POST a un clic real probado. La protección nueva cubre pulsaciones/invocaciones concurrentes del mismo formulario.

Pruebas con manejador real extraído del HTML/VM: doble llamada produce1POST,0GET; datos confirmados del servidor se incorporan sin perder existentes; errores restauran controles sin agregar filas; dos altas solapadas conservan ambas; respuesta tardía conserva otro formulario; validación evita solicitudes. Scripts GH, entrada porroles y grabador/exportación de medición aprobados.

Reducción por alta normal frente al recorrido anterior POST+GET: se elimina1Worker y3lecturasKV de la recarga automática. Si el usuario pulsaba de nuevo pendiente se evita además esePOST y su recarga. No se prometen cifras de cuota/factura del servidor a partir de la simulación; falta medición real posterior al despliegue, sin pedir crear ciudades ficticias. Lecturas de autorización y registro recuperable servidor siguen iguales.
