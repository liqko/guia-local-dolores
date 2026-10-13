# Reglas para el panel de anunciantes

- Hacer correcciones puntuales. Conservar registros, acciones existentes (editar, pausar, reanudar, duplicar y eliminar), IDs de controles, validaciones y límites.
- Ordenar formularios y botones en una columna tanto en escritorio como en móvil. Mantener campos obligatorios visibles y agrupar opciones secundarias en desplegables con títulos claros.
- Usar áreas de texto de al menos cuatro renglones para texto libre y aclaraciones; permitir ampliar su altura. Mantener controles específicos para fechas, enlaces, teléfonos y búsquedas.
- Los cambios de presentación no deben agregar lecturas, escrituras ni eliminaciones en Firestore. Reutilizar los datos ya cargados.
- Al cambiar la presentación de listas, comprobar que los registros y sus acciones siguen visibles en escritorio y móvil; revisar reglas CSS anteriores que puedan ocultarlos.
- Corregir la función o regla original; no acumular bloques de parche que sobrescriben otros. Centralizar reglas compartidas y conservar una única ruta para cada comportamiento.
- Las imágenes publicitarias y sus CTA deben navegar en la pestaña actual, usando el mismo enlace nativo con target _top cuando estén embebidos. No forzar window.open desde sus controladores.
- Usar las mismas etiquetas en todos los módulos de anunciantes: Editar, Pausar, Reanudar, Duplicar y Borrar. Para confirmar un borrado, usar Confirmar borrado. Mantener los IDs y acciones internas existentes.

- En listas de registros del anunciante, mostrar título y estado en la cabecera; agrupar datos secundarios y acciones dentro de un desplegable por registro. Aplicar por módulo conservando los controles y verificando su funcionamiento.
