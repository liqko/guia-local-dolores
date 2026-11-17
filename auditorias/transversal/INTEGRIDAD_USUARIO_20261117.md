# Comprobación de integridad de los árboles de Usuario

Código oficial: 534db35b2d7d7306500d41df6cad39ef3835f0a5. Fecha: 17/11/2026.

**Resultado: se detectaron entradas del código que no tienen una entrada propia en los árboles generados.**
Los árboles existentes se conservan: esta comprobación no demuestra fallos funcionales ni consumos duplicados de la plataforma.

| Conjunto | Fuente igual a oficial | Mismos identificadores de entrada | Árboles existentes | Entradas omitidas detectadas | Árboles truncados |
|---|---|---|---:|---:|---:|
| plataforma/suscriptores.html | Sí | Sí | 34 | 5 | 10 |
| plataforma/carcasa.html | Sí | Sí | 44 | 3 | 4 |

## Omisiones concretas

- plataforma/suscriptores.html:926, event_property: `btn.onclick=()=>goToCityId(btn.dataset.goCity)`.
- plataforma/suscriptores.html:930, event_property: `btn.onclick=async()=>{ btn.disabled=true; try{ await apiFavorito('quitar_favorito',btn.dataset.removeFav,btn.dataset.ref); await renderMiGuia(); }catch(e){ btn.disabled=false; } }`.
- plataforma/suscriptores.html:974, event_property: `el('personal-tab').onclick=()=>personalEmploymentTab(false)`.
- plataforma/suscriptores.html:975, event_property: `el('employment-tab').onclick=()=>personalEmploymentTab(true)`.
- plataforma/suscriptores.html:976, event_property: `el('empleo-opt-in').onchange=()=>{const enabled=el('empleo-opt-in').checked;try{localStorage.setItem('gld_empleo_opt_in:'+employmentAccount,String(enabled));}catch{}el('employment-tab').hidden=!enable`.
- plataforma/carcasa.html:1555, event_property: `no.onclick=()=>{ gldSkipCityPreference(session,ciudadId); gldClearCityChangePending(); overlay?.classList.remove('activo'); if(overlay){overlay.style.top='';overlay.style.left='';} }`.
- plataforma/carcasa.html:1564, event_property: `favorite.onclick=async()=>{ favorite.disabled=true; if(yes) yes.disabled=true; if(no) no.disabled=true; if(status){status.textContent='Guardando en favoritas...';status.className='gld-city-pref-status`.
- plataforma/carcasa.html:1606, event_property: `yes.onclick=async()=>{ yes.disabled=true; if(favorite) favorite.disabled=true; if(no) no.disabled=true; if(status){status.textContent='Guardando...';status.className='gld-city-pref-status';} try{ cons`.

## Cortes internos del generador

Hay nodos de tipo limit con motivo node_limit. El generador interrumpe la expansión al superar 2400 nodos, pero counts.unresolved y el estado del árbol no cuentan estos cortes. Cero unresolved no acredita finalización.
Los 228 marcadores de corte pertenecen a 14 árboles; no son 228 acciones ni 228 fallos funcionales.

## Árboles truncados (identificador y entrada)

- plataforma/suscriptores.html:1273, 91e3bf4f397c550f, callback@1273: 17 marcadores de corte.
- plataforma/suscriptores.html:1321, eb30742de2a5bcf7, callback@1321: 8 marcadores de corte.
- plataforma/suscriptores.html:1431, 0a6d319e67be9a4d, login: 18 marcadores de corte.
- plataforma/suscriptores.html:1432, c079dd47788f2a0f, register: 16 marcadores de corte.
- plataforma/suscriptores.html:1433, 602e77b0309cbdd3, confirmVerification: 18 marcadores de corte.
- plataforma/suscriptores.html:1434, 562c1cbc88c65fca, callback@1434: 18 marcadores de corte.
- plataforma/suscriptores.html:1436, ef07ed22860e6e4c, requestRecovery: 18 marcadores de corte.
- plataforma/suscriptores.html:1437, 05ccee7155fefa21, resetRecoveryPassword: 18 marcadores de corte.
- plataforma/suscriptores.html:1441, 2f3bfe4898bc8a9d, deleteAccount: 18 marcadores de corte.
- plataforma/suscriptores.html:1442, 3686c9f49c1a5831, callback@1442: 9 marcadores de corte.
- plataforma/carcasa.html:1384, 275d631d2e557070, gldLoginSubscriber: 17 marcadores de corte.
- plataforma/carcasa.html:1391, d4638bfc0684e0a3, gldRequestRecovery: 17 marcadores de corte.
- plataforma/carcasa.html:1392, be37d15d3194514b, gldResetRecoveryPassword: 18 marcadores de corte.
- plataforma/carcasa.html:1396, 6ab673178b4ba8ce, callback@1396: 18 marcadores de corte.

## Alcance y límites

- Análisis estático: no mide consumo ni demuestra fallo funcional de la plataforma.
- Inventario independiente de atributos HTML, addEventListener, asignaciones on*, llamadas de inicio y sitios fetch/almacenamiento en los dos HTML.
- Cobertura por archivo y línea; no prueba todas las decisiones ni todos los scripts externos. Los elementos no cubiertos no se declaran código muerto.
- El listado de inicio distingue invocación superior de cuerpo de callback; no afirma que todas las llamadas de inicio sean peticiones de red.

Reproducción: regenerar ARBOL_ACCIONES.json en el checkout de auditoría y en el checkout oficial con el generador existente; ejecutar comprobar-integridad-usuario.cjs con el directorio oficial como argumento. Ejecutar --self-test para comprobar detección de entradas deliberadamente omitidas.

Siguiente acción: completar el generador con entradas por propiedades de eventos y arranques y corregir el truncamiento; repetir este contraste antes de certificar integridad total. No se modificó el generador ni código productivo en esta comprobación.
