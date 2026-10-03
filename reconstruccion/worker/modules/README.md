# Módulos Worker — reconstrucción

Estos módulos son la base del Worker nuevo. No dependen del Worker viejo ni de sus helpers globales.

Reglas:
- cada módulo declara sus colecciones y operaciones;
- territorio NO se carga dentro de ningún módulo: llega por /territory/public;
- getPanelData devuelve sólo datos propios del módulo;
- ninguna lectura pública escribe Firestore;
- ninguna mutación invalida todo: sólo claves/cidades realmente afectadas;
- los servicios db/cache/auth se inyectan desde el núcleo.
