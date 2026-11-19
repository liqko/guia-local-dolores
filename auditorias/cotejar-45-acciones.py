#!/usr/bin/env python3
"""Cotejo reproducible de las acciones pendientes con rutas y condiciones del código congelado.
No modifica producción, no declara ejecución real ni borra candidatos históricos."""
import json,zipfile,collections
from pathlib import Path
SPECS=json.loads("[{\"aud\":\"AUD-00013\",\"entry\":[\"plataforma/administracion.html\",1476,\"ghGoView('configuracion');ghSelectConfig('territorio')\"],\"markers\":[[\"plataforma/administracion.html\",3923,\"name==='territorio'\"],[\"plataforma/administracion.html\",1222,\"'/superadmin/territory'\"],[\"worker/worker206.txt\",7282,\"/superadmin/territory\"],[\"worker/worker206.txt\",1193,\"cache.get(ADMIN_KEY)\"]],\"include\":[1186,1193],\"excludeMode\":\"other_worker\",\"description\":\"Ciudades -> Configuración/Territorio, con copia diaria o GET administrativo condicionado\"},{\"aud\":\"AUD-00074\",\"entry\":[\"plataforma/administracion.html\",3465,\"'/sales/contracts/close'\"],\"markers\":[[\"worker/worker206.txt\",8801,\"/superadmin/sales/contracts/close\"],[\"worker/worker206.txt\",8817,\"gldCoefAdmin173\"],[\"worker/worker206.txt\",8919,\"db.patch('anunciantes_administracion'\"],[\"worker/worker206.txt\",8923,\"patchGuideAdminFieldsV2\"],[\"worker/worker206.txt\",8926,\"cache.put('publicity:contract\"]],\"include\":[1770,4875,4902,4903,4910,5078,5088,8383,8386,8388,8676,8679,8681,8825,8919,8926],\"exclude\":[8701,8702],\"description\":\"POST cierre de contrato -> cotización -> escritura con control de versión y sincronización; guardar coeficientes es ruta distinta\"},{\"aud\":\"AUD-00136\",\"entry\":[\"plataforma/administracion.html\",4008,\"'/superadmin/publications/recent'\"],\"markers\":[[\"worker/worker206.txt\",10912,\"'/superadmin/publications/recent'\"],[\"worker/worker206.txt\",10915,\"request.method==='POST'\"],[\"worker/worker206.txt\",10916,\"body.action!=='retirar'\"],[\"worker/worker206.txt\",10925,\"syncPublicationReviewV77\"],[\"worker/worker206.txt\",10796,\"collection==='actividades'\"],[\"worker/worker206.txt\",10797,\"collection==='publicidades'\"]],\"include\":[10796,10797,1414,1422,1423,1467,1473,1479,1483,1485,1946,1952,2052,2057,2066,4875,6190,6193,6207,6215,6301,6307],\"excludeMode\":\"other_worker\",\"description\":\"POST retirar, colección limitada a eventos/actividades/anunciantes/publicidades, sincronización por colección\"},{\"aud\":\"AUD-00154\",\"entry\":[\"plataforma/administracion.html\",1046,\"'/support/resolve'\"],\"markers\":[[\"worker/worker206.txt\",10661,\"/superadmin/support/resolve\"],[\"worker/worker206.txt\",10672,\"request.method===\\\"POST\\\"\"],[\"worker/worker206.txt\",10676,\"decision_revision==='RECHAZAR'\"],[\"worker/worker206.txt\",10677,\"cache.get(key)||await db.get\"],[\"worker/worker206.txt\",10683,\"db.patch(collection,id,patch\"],[\"worker/worker206.txt\",10684,\"cache.put(key\"]],\"include\":[],\"excludeMode\":\"other_worker\",\"extra\":[[\"worker/worker206.txt\",10677,\"cache/db.get\"],[\"worker/worker206.txt\",10683,\"db.patch\"],[\"worker/worker206.txt\",10684,\"cache.put\"],[\"worker/worker206.txt\",10667,\"listado tras actualizar\"]],\"description\":\"Atender/cerrar soporte usa ruta support/resolve sin rechazo definitivo, consulta y modifica ticket solo si cambió\"},{\"aud\":\"AUD-00155\",\"entry\":[\"plataforma/administracion.html\",1042,\"'/support/resolve'\"],\"markers\":[[\"worker/worker206.txt\",399,\"const REVIEW102\"],[\"worker/worker206.txt\",435,\"async function rejectReview102\"],[\"worker/worker206.txt\",444,\"db.commitPatches\"],[\"worker/worker206.txt\",445,\"cache.put('support:record\"],[\"worker/worker206.txt\",446,\"syncPublicationReviewV77\"],[\"worker/worker206.txt\",10676,\"return rejectReview102\"],[\"worker/worker206.txt\",10792,\"collection==='empleos'\"],[\"worker/worker206.txt\",10793,\"collection==='promos'\"],[\"worker/worker206.txt\",10795,\"collection==='eventos'\"],[\"worker/worker206.txt\",10796,\"collection==='actividades'\"],[\"worker/worker206.txt\",10797,\"collection==='publicidades'\"]],\"include\":[445,10796,10797,11103,11559,11562,11563,11566,1377,1380,1414,1422,1423,1467,1473,1479,1483,1485,1946,1952,2052,2057,2066],\"excludeMode\":\"other_worker\",\"extra\":[[\"worker/worker206.txt\",436,\"ticket versionado\"],[\"worker/worker206.txt\",439,\"publicación versionada\"],[\"worker/worker206.txt\",444,\"commitPatches\"],[\"worker/worker206.txt\",446,\"sincronización por tipo\"]],\"description\":\"Rechazo definitivo revisa ticket y publicación, confirma ambos cambios, sincroniza según tipo, sin rama de anunciantes\"},{\"aud\":\"AUD-00387\",\"entry\":[\"plataforma/gh-publicidad.js\",37,\"'/publicidad'\"],\"markers\":[[\"worker/worker206.txt\",484,\"'/superadmin/publicidad'\"],[\"worker/worker206.txt\",507,\"request.method!=='POST'\"],[\"worker/worker206.txt\",509,\"['pausar','eliminar']\"],[\"worker/worker206.txt\",510,\"db.getVersioned\"],[\"worker/worker206.txt\",512,\"publicityDeleteMonthlyV101\"],[\"worker/worker206.txt\",516,\"publicityCommitV101\"],[\"worker/worker206.txt\",518,\"syncPublicityPreparedV2\"]],\"include\":[1414,1422,1423,2052,2057,2066,517,545,560,746],\"exclude\":[490,491,495,496,497,499,505],\"excludeMode\":\"other_loads\",\"extra\":[[\"worker/worker206.txt\",510,\"versión de publicidad\"],[\"worker/worker206.txt\",516,\"pausa condicional\"],[\"worker/worker206.txt\",518,\"sincronización condicional\"]],\"description\":\"POST publicidad con pausar/eliminar; la preparación y GET del listado pertenecen a otros controles\"},{\"aud\":\"AUD-00098\",\"entry\":[\"plataforma/administracion.html\",1262,\"\\\\'RECHAZAR\\\\'\"],\"markers\":[[\"plataforma/administracion.html\",1125,\"async function resolverPendiente\"],[\"plataforma/administracion.html\",1146,\"'/superadmin/moderation/resolve'\"],[\"worker/worker206.txt\",9822,\"/superadmin/moderation/resolve\"],[\"worker/worker206.txt\",9831,\"resolvePendingV3\"],[\"worker/worker206.txt\",9552,\"kind === \\\"ANUNCIANTE\\\"\"],[\"worker/worker206.txt\",9553,\"db.get(\\\"solicitudes_anunciante\\\"\"],[\"worker/worker206.txt\",9560,\"!isTopAdmin(auth)\"],[\"worker/worker206.txt\",9568,\"dec === \\\"RECHAZAR\\\"\"],[\"worker/worker206.txt\",9569,\"db.patch(\\\"solicitudes_anunciante\\\"\"],[\"worker/worker206.txt\",9575,\"return { success: true\"],[\"worker/worker206.txt\",7372,\"SUPERADMIN_PRINCIPAL\"]],\"include\":[9553,9569],\"exclude\":[9562,9584,9595,9608,9623,9628,9638],\"excludeMode\":\"other_worker\",\"description\":\"Rechazo de solicitud de anunciante: ruta POST moderation/resolve, lectura y patch de solicitud; retorno antes de crear anunciante, sede, relación o sincronizaciones. Rama ADMIN_LOCAL RECLAMAR es inaccesible por guarda isTopAdmin previo.\",\"extra\":[[\"worker/worker206.txt\",9560,\"barrera de rol para reclamo\"],[\"worker/worker206.txt\",9575,\"retorno antes de escrituras de aprobación\"],[\"worker/worker206.txt\",7372,\"ADMIN_LOCAL no es isTopAdmin\"]]},{\"aud\":\"AUD-00097\",\"entry\":[\"plataforma/administracion.html\",1262,\"\\\\'APROBAR\\\\'\"],\"markers\":[[\"plataforma/administracion.html\",1131,\"modo==='RECLAMAR'\"],[\"plataforma/administracion.html\",1136,\"decision==='APROBAR'\"],[\"plataforma/administracion.html\",1146,\"'/superadmin/moderation/resolve'\"],[\"worker/worker206.txt\",9822,\"/superadmin/moderation/resolve\"],[\"worker/worker206.txt\",9831,\"resolvePendingV3\"],[\"worker/worker206.txt\",9552,\"kind === \\\"ANUNCIANTE\\\"\"],[\"worker/worker206.txt\",9553,\"db.get(\\\"solicitudes_anunciante\\\"\"],[\"worker/worker206.txt\",9560,\"!isTopAdmin(auth)\"],[\"worker/worker206.txt\",9578,\"modo === \\\"CREAR\\\"\"],[\"worker/worker206.txt\",9584,\"db.patch(\\\"anunciantes\\\"\"],[\"worker/worker206.txt\",9595,\"db.patch(\\\"anunciantes_administracion\\\"\"],[\"worker/worker206.txt\",9608,\"db.patch(\\\"anunciantes_sedes\\\"\"],[\"worker/worker206.txt\",9622,\"modo === \\\"RECLAMAR\\\"\"],[\"worker/worker206.txt\",9628,\"db.patch(\\\"suscriptor_anunciante\\\"\"],[\"worker/worker206.txt\",9637,\"revokeSubscriberSessions\"],[\"worker/worker206.txt\",9638,\"db.patch(\\\"solicitudes_anunciante\\\"\"],[\"worker/worker206.txt\",9648,\"syncGuideAdvertiserV2\"],[\"worker/worker206.txt\",9649,\"syncAdvertiserIndexV2\"],[\"worker/worker206.txt\",7372,\"SUPERADMIN_PRINCIPAL\"]],\"include\":[9553,9584,9595,9608,9623,9628,9638,4818,4819,4820,4821,4822,4823,4846,4850,4852,5062,5063,5064,5065,5070],\"exclude\":[9562,9569],\"excludeMode\":\"other_worker\",\"description\":\"Aprobar solicitud ANUNCIANTE: POST moderation/resolve; validar nivel o titularidad; según CREAR, crear ficha, administración y sede; según RECLAMAR, validar ficha existente; en ambos modos guardar vínculo, revocar sesiones, marcar solicitud aprobada; en CREAR sincronizar guía e índice. Cada escritura y sincronización conserva sus condiciones.\",\"extra\":[[\"worker/worker206.txt\",2702,\"revocar sesiones via AccessRecord201 (Durable Object)\"],[\"worker/worker206.txt\",9560,\"barrera de rol imposibilita ADMIN_LOCAL con RECLAMAR\"],[\"worker/worker206.txt\",9646,\"sincronización sólo para modo CREAR\"]]}]")
# Moderación de EVENTO/ACTIVIDAD: aprobación y rechazo comparten despacho,
# pero el tipo y la decisión seleccionan ramas distintas. Clasificación parcial
# de sitios comprobados, sin dar por resueltos los demás.
for action,decision in [('AUD-00095','APROBAR'),('AUD-00096','RECHAZAR')]:
    SPECS.append({
        'aud':action,
        'entry':['plataforma/administracion.html',1238,decision],
        'markers':[
            ['plataforma/administracion.html',1125,'async function resolverPendiente'],
            ['plataforma/administracion.html',1146,"'/superadmin/moderation/resolve'"],
            ['worker/worker206.txt',9822,'/superadmin/moderation/resolve'],
            ['worker/worker206.txt',9831,'resolvePendingV3'],
            ['worker/worker206.txt',9504,'if (kind === "EVENTO")'],
            ['worker/worker206.txt',9505,'resolveEventModerationV2'],
            ['worker/worker206.txt',9514,'if (kind === "ACTIVIDAD")'],
            ['worker/worker206.txt',7254,'db.get("eventos"'],
            ['worker/worker206.txt',7259,'getPreparedRelationsV1'],
            ['worker/worker206.txt',7264,'db.patch("eventos"'],
            ['worker/worker206.txt',9515,'db.get("actividades"'],
            ['worker/worker206.txt',9518,'getPreparedRelationsV1'],
            ['worker/worker206.txt',9527,'db.patch("actividades"'],
            ['worker/worker206.txt',9552,'if (kind === "ANUNCIANTE")'],
            ['worker/worker206.txt',13127,"'/superadmin/moderation/resolve'"],
            ['worker/worker206.txt',13209,'GLD_BUSINESS143.journal'],
            ['worker/worker206.txt',12905,"entry.collection==='publicidades'"],
            ['worker/worker206.txt',12906,"entry.collection==='eventos'"],
            ['plataforma/administracion.html',1165,"decision==='APROBAR'"],
            ['plataforma/administracion.html',458,"/events-new"],
            ['worker/worker206.txt',1710,'/events-new'],
            ['worker/worker206.txt',1711,'getEventsCityV2'],
        ],
        'include':[1414,1422,1423,1467,1473,1479,1483,1485,1946,1952,7254,7259,7264,9515,9523,9527,12906]+([1492] if decision=='APROBAR' else []),
        'exclude':[
            496,517,603,604,639,646,730,743,
            3618,3724,3744,3763,4383,4430,4431,
            4818,4819,4820,4821,4822,4823,4846,4850,4852,
            5062,5063,5064,5065,5070,6602,6691,7078,7081,
            7883,7885,7892,7897,7903,7918,7929,7942,7957,7962,7971,
            9553,9562,9569,9584,9595,9608,9623,9628,9638,
            10796,10797,12905,13142
        ]+([1492] if decision=='RECHAZAR' else []),
        'description':'Aprobar/rechazar EVENTO o ACTIVIDAD con POST y guardas verificadas; relaciones preparadas y sincronización de sus respectivas copias. Se descartan solicitudes de publicidad, edición/borrado del anunciante, módulo de farmacias, resolución V2 sustituida y ruta de soporte. Journal de evento condicionado al despacho por actor: 12906 sólo con programación anterior no embebida; se descarta 12905 porque exige colección publicidades. El GET público posterior condicionado a aprobación de EVENTO y ciudad enlaza 1492 a /events-new; sin GET en rechazo.',
    })

# Cotejo arranque Anunciantes 00766: las ramas se diferencian por la
# URL exacta y por la condición de sesión/paquete. Las rutas de catálogos
# privados, precios y funcionalidades no son solicitadas desde este arranque.
SPECS.append({
    'aud':'AUD-00766',
    'entry':['plataforma/anunciantes.html',3640,'iniciarAnunciantes();'],
    'markers':[
        ['plataforma/anunciantes.html',3625,'async function iniciarAnunciantes'],
        ['plataforma/anunciantes.html',3636,'prefetchGuia('],
        ['plataforma/anunciantes.html',3637,'gldCargarFavoritosAnunciantes()'],
        ['plataforma/anunciantes.html',1271,"'/guide'"],
        ['plataforma/anunciantes.html',1375,'async function gldCargarFavoritosAnunciantes'],
        ['plataforma/anunciantes.html',1387,'GLD_SUSCRIPTORES_API'],
        ['plataforma/anunciantes.html',3461,'obtenerBannersPromise()'],
        ['plataforma/anunciantes.html',3462,'obtenerEventosPromise()'],
        ['plataforma/anunciantes.html',3463,'obtenerPromosPromise()'],
        ['plataforma/anunciantes.html',3464,'obtenerActividadesPromise()'],
        ['worker/worker206.txt',1705,'/guide'],
        ['worker/worker206.txt',1707,'/promos'],
        ['worker/worker206.txt',1710,'/events-new'],
        ['worker/worker206.txt',2020,'/actividades'],
        ['worker/worker206.txt',5352,'listFavoritesV2'],
        ['worker/worker206.txt',1301,'cache.get(guideCityKey'],
        ['worker/worker206.txt',1388,'cache.get(promoCityKey'],
        ['worker/worker206.txt',1492,'cache.get(eventsCityKey'],
        ['worker/worker206.txt',1959,'cache.get(activityCityKeyV2'],
        ['worker/worker206.txt',5287,'subscriberFavorites'],
    ],
    'include':[1301,1388,1492,1959,5287],
    'exclude':[1186,1753,1755,1767,3755,8383,8386,8388,8473,8476,8478],
    'description':'Inicio de Anunciantes: /guide y favoritos con sesión; módulos secundarios eventos/promos/actividades sólo tras guía, mediante paquete o GET. Se excluyen territorio y bootstrap no invocados y rutas privadas de panel, precios y funcionalidades sin llamada desde el inicio. No se confunde precarga local con solicitud facturable.'
})

# Cotejo GET de actualización de lista del anunciante (Publicidad).
# Guardas: click sobre refresh -> loadPublicidadUI(true) -> GET getpaneldata,
# auth y cache. No confundir con POST guardar/eliminar ni con GH Promos.
SPECS.append({
  'aud':'AUD-00471',
  'entry':['plataforma/login.html',5242,"refresh.addEventListener('click'"],
  'markers':[
    ['plataforma/login.html',5246,'loadPublicidadUI(true)'],
    ['plataforma/login.html',5131,'async function loadPublicidadUI'],
    ['plataforma/login.html',5144,"fetch(url,{mode:'cors'"],
    ['worker/worker206.txt',4633,'getpaneldata'],
    ['worker/worker206.txt',4637,'publicidadPanelDataV2'],
    ['worker/worker206.txt',4416,'async function publicidadPanelDataV2'],
    ['worker/worker206.txt',4419,'commerceMaster205'],
    ['worker/worker206.txt',4430,'getPreparedRelationsV1'],
    ['worker/worker206.txt',4431,'getPreparedRelationsV1'],
    ['worker/worker206.txt',4440,'cache.get(contractKey)'],
    ['worker/worker206.txt',4441,'cache.put(contractKey'],
    ['worker/worker206.txt',4444,"cache.get('publicity:usage"],
    ['plataforma/login.html',1894,'GLD_CATALOGO_TERRITORIAL.load'],
    ['plataforma/territorio-cache.js',32,'fetch(ENDPOINT'],
  ],
  'include':[1414,1753,1755,1770,4420,4430,4431,4440,4441,4444,8473,8476,8478],
  'excludeMode':'other_worker',
  'includeOther':{'plataforma/login.html':[5144],'plataforma/territorio-cache.js':[18,32]},
  'excludeOther':{'plataforma/administracion.html':[536],'plataforma/consumo-v44.js':[78],
    'plataforma/gh-promos.js':[13],'plataforma/publicacion-pedidos.js':[20,21,22],
    'plataforma/login.html':[3237,4240,9410]},
  'extra':[
    ['worker/worker206.txt',6132,'master por anunciante, que usa actor de copias'],
    ['worker/worker206.txt',4420,'panel GET con relación al anunciante'],
    ['worker/worker206.txt',4441,'KV put condicional si falta copia de contrato'],
    ['plataforma/territorio-cache.js',32,'GET territorio sólo si no hay copia incluida o local'],
  ],
  'description':'Actualizar lista Publicidad: GET panel por anunciante con sesión; read del master y catálogos y relaciones preparadas, KV put sólo si falta contrato; territorio cacheado o GET adicional. POST y operaciones GH descartadas por método/ruta.'
})

# POST Publicidad, dos acciones independientes de una misma ruta
for action,aud,entryLine,entryNeedle,callLine,handlerLine,handlerName,workerMethod in [
    ('actualizar_activos','AUD-00470',5237,"aplicarActivos.addEventListener('click'",4935,6854,'publicityActiveMonthlyV101','actualizar_activos'),
    ('guardar','AUD-00472',5255,"save.addEventListener('click'",5300,6843,'publicitySaveMonthlyV101','guardar')
]:
    relevant={'publicityStateV101','publicityCommitV101','syncPublicityPreparedV2',
              'getPreparedRelationsV1','putPreparedRelationsV1','gldFuncPacket166',
              'GldPublicCache119.prototype.beginBusiness143',
              'GldPublicCache119.prototype.businessState143',
              'GldPublicCache119.prototype.storeBusiness143',
              'GldPublicCache119.prototype.businessSave143'}
    if action=='guardar':
        relevant.update(['publicitySaveMonthlyV101','publicityScopeV101','publicitySaveV4',
                         'getPublicidadCatalogs','getCommerceCatalogs','getEventsCityV2','getActivitiesCityV2'])
    else:
        relevant.update(['publicityActiveMonthlyV101','publicityActiveChangeV4'])
    SPECS.append({
      'aud':aud,
      'entry':['plataforma/login.html',entryLine,entryNeedle],
      'markers':[
        ['plataforma/login.html',callLine,'postJson(WORKER_PUBLICIDAD_URL'],
        ['plataforma/login.html',3237,'fetch(url'],
        ['worker/worker206.txt',12869,"request.method!=='POST'"],
        ['worker/worker206.txt',12870,"'/publicidad'"],
        ['worker/worker206.txt',12873,workerMethod],
        ['worker/worker206.txt',12892,'business-save143'],
        ['worker/worker206.txt',13218,'GLD_BUSINESS143.dispatch'],
        ['worker/worker206.txt',11976,'business-save143'],
        ['worker/worker206.txt',6824,'/publicidad'],
        ['worker/worker206.txt',handlerLine,workerMethod],
        ['worker/worker206.txt',701 if action=='actualizar_activos' else 597,'async function '+handlerName],
        ['worker/worker206.txt',559,'db.commitPatches'],
        ['worker/worker206.txt',560,"cache.put('publicity:usage"],
        ['worker/worker206.txt',12905,"entry.collection==='publicidades'"],
      ],
      'include':[],
      'includeOwner':sorted(relevant),
      'includeLine':([12905,8473,8476,8478,1414,1422,1423,2052,2057,2066] if action=='actualizar_activos' else
                      [12905,8473,8476,8478,1414,1422,1423,1492,1959,2052,2057,2066]),
      'excludeMode':'other_worker',
      'includeOther':{
        'plataforma/login.html':[3237,5144],
        'plataforma/publicacion-pedidos.js':[20,21,22],
        'plataforma/territorio-cache.js':[18,32],
        'plataforma/consumo-v44.js':[78]
      },
      'excludeOther':{
        'plataforma/administracion.html':[536],
        'plataforma/gh-promos.js':[13],
        'plataforma/login.html':[4240,9410]
      },
      'description':'POST /publicidad desde Anunciante: rama '+action+' despachada a BusinessActor143 y ruta V13, motor mensual V101 y copias; diferencias de GET y reintentos por recuperación conservadas. Rutas administrativas y handlers de otros módulos descartados.',
      'extra':[
        ['worker/worker206.txt',12892,'despacho a Durable Object business-save143'],
        ['worker/worker206.txt',12905,'journal preparado para publicidad existente'],
        ['worker/worker206.txt',560,'KV put de usage tras commit condicional'],
      ]
    })

# Paso 3: acción múltiple de Actividades (6 variantes de UI)
SPECS.append({
  'aud':'AUD-00445',
  'entry':['plataforma/login.html',4125,"btn.addEventListener('click'"],
  'markers':[
    ['plataforma/login.html',4126,'btn.dataset.id'],
    ['plataforma/login.html',4127,'btn.dataset.actAction'],
    ['plataforma/login.html',4130,"action==='edit'"],
    ['plataforma/login.html',4135,"action==='duplicate'"],
    ['plataforma/login.html',4155,"action==='eliminar'"],
    ['plataforma/login.html',4162,'postJson(WORKER_ACTIVIDADES_URL'],
    ['plataforma/login.html',3237,'fetch(url'],
    ['worker/worker206.txt',6754,'"/actividades"'],
    ['worker/worker206.txt',6758,'"guardar"'],
    ['worker/worker206.txt',6763,'sessionAllows'],
    ['worker/worker206.txt',6771,'activityActionV3'],
    ['worker/worker206.txt',6677,'async function activityActionV3'],
    ['worker/worker206.txt',6684,'queryEqual("actividades"'],
    ['worker/worker206.txt',6691,'getPreparedRelationsV1'],
    ['worker/worker206.txt',6696,'db.delete("actividad_horarios"'],
    ['worker/worker206.txt',6698,'db.delete("actividades"'],
    ['worker/worker206.txt',6722,'db.patch("actividades"'],
    ['worker/worker206.txt',1952,'cache.put(key3'],
  ],
  'include':[1414,1422,1423,1946,1952,6679,6682,6684,6691,6696,6698,6718,6722,8473,8476,8478],
  'includeOwner':['activityActionV3','syncActivityPreparedV2','getPreparedRelationsV1','putPreparedRelationsV1'],
  'excludeMode':'other_worker',
  'includeOther':{
     'plataforma/login.html':[3237],
     'plataforma/publicacion-pedidos.js':[20,21,22]
  },
  'excludeOther':{
     'plataforma/administracion.html':[536],
     'plataforma/gh-promos.js':[13],
     'plataforma/login.html':[4240,5144,9410],
     'plataforma/consumo-v44.js':[78],
     'plataforma/territorio-cache.js':[18,32]
  },
  'extra':[
      ['plataforma/login.html',4130,'editar abre formulario local sin POST inmediato'],
      ['plataforma/login.html',4135,'duplicar abre formulario tras verificar cupos locales; guardar es otra acción'],
      ['worker/worker206.txt',6677,'solo pausar, reanudar, renovar y eliminar'],
      ['worker/worker206.txt',6691,'horarios embebidos o relación preparada / lectura alternativa'],
      ['worker/worker206.txt',6718,'patch sólo si changedFieldsV1 arroja delta'],
      ['worker/worker206.txt',1952,'KV put sólo por ciudad afectada en sincronización'],
  ],
  'description':'Acción delegada de Actividades: editar y duplicar sólo formularios; pausar/reanudar/renovar/eliminar POST /actividades autenticado, con validación de titularidad/cupo, horarios embebidos o preparados, eliminar o patch condicional y sincronizar copias por ciudad. 454 candidatos históricos conservados.'
})

base=Path('baseline')
src_cache={}
def match(file,line,needle):
    if file not in src_cache:src_cache[file]=(base/file).read_text().splitlines()
    line_text=src_cache[file][line-1]
    assert needle in line_text,(file,line,needle,line_text)
with zipfile.ZipFile('auditorias/transversal/CADENAS_DEPENDENCIAS_PASO_3.zip') as z:
    data=json.loads(z.read('CADENAS_DEPENDENCIAS_PASO_3.json'))
pending=set(data['rondaCompleta']['pendientes'])
assert len(pending)==45
actions={x['AUD']:x for x in data['acciones']}
sites=data['sitios']
results=[]
for aud in sorted(pending):
    original=actions[aud]['dependenciasDelArbolSinCadena']
    spec=next((s for s in SPECS if s['aud']==aud),None)
    row={'AUD':aud,'totalSitiosOriginales':len(original),'estado':'pendiente','candidatosConservados':[x['idSitio'] for x in original]}
    if spec:
        match(*spec['entry'])
        for m in spec['markers']:match(*m)
        include=set(spec['include']);exclude=set(spec.get('exclude',[]))
        existing={sites[x['idSitio']]['linea'] for x in original if sites[x['idSitio']]['archivo']=='worker/worker206.txt'}
        assert include|exclude<=existing,(aud,include|exclude-existing)
        classified=[]
        for x in original:
            site=sites[x['idSitio']]
            if site['archivo']=='worker/worker206.txt' and (site['linea'] in include or site['linea'] in spec.get('includeLine',[]) or str(site.get('funcion','')).rsplit(':',1)[-1] in spec.get('includeOwner',[])): result='dependencia_condicional_vinculada'
            elif site['archivo'] in spec.get('includeOther',{}) and site['linea'] in spec['includeOther'][site['archivo']]:result='dependencia_condicional_vinculada'
            elif site['archivo'] in spec.get('excludeOther',{}) and site['linea'] in spec['excludeOther'][site['archivo']]:result='descartado_por_ruta_o_interfaz_ajena'
            elif site['archivo']=='worker/worker206.txt' and site['linea'] in exclude:result='descartado_por_metodo_o_guarda'
            elif site['archivo']=='worker/worker206.txt' and spec.get('excludeMode')=='other_worker':result='descartado_por_ruta_ajena'
            elif site['archivo']=='worker/worker206.txt' and spec.get('excludeMode')=='other_loads' and str(site.get('funcion','')).endswith(':load'):result='descartado_callback_de_otra_ruta'
            else:result='requiere_cotejo'
            classified.append({'idSitio':x['idSitio'],'estado':result})
        outstanding=sum(c['estado']=='requiere_cotejo' for c in classified)
        row.update(estado='cotejo_de_rama_completado' if not outstanding else 'rama_parcial',
            detalle=spec['description'],comprobacionesFuente=[spec['entry']]+spec['markers'],
            dependenciasNuevasFuente=spec.get('extra',[]),
            candidatosClasificados=classified,porTipo=dict(collections.Counter(c['estado'] for c in classified)),
            faltantesDeRama=outstanding)
    results.append(row)
# No deducir la exclusión de un sitio por nombre: las dos acciones
# conservan el inventario completo y reportan la clasificación por ID.
# El GET público después de APROBAR EVENTO requiere cotejo de ruta propio.
# El journal común del Worker permanece pendiente de vinculación concreta.
# El cruce de raíz AST -> dueño de sitio, ejecutado sobre la misma
# revisión y guardado por reconstruir-grafo-1691.py, acredita las
# dependencias condicionales de las tres entradas Worker.
graph_file=Path('auditorias/temporal/CRUCE_DIRECTO_37_ACCIONES.json')
if graph_file.exists():
    graph=json.loads(graph_file.read_text())
    assert graph['resumen']['accionesRestantes']==37
    by_aud={x['AUD']:x for x in graph['acciones']}
    for row in results:
        if row['AUD'] not in ('AUD-00985','AUD-00986','AUD-00987'):continue
        evidence=by_aud[row['AUD']]
        assert evidence['estado']=='cruce_AST_por_entrada'
        assert evidence['sinTrayectoResuelto']==0,(row['AUD'],evidence['sinTrayectoResuelto'])
        assert {x['idSitio'] for x in evidence['vinculados']}==set(row['candidatosConservados'])
        row.update(estado='cotejo_de_rama_completado_estatico_condicionado',
                   detalle='Entrada Worker: todos los sitios originalmente pendientes tienen un trayecto AST al dueño; cada guarda de operación, estado y caché se conserva.',
                   candidatosClasificados=[{'idSitio':x['idSitio'],'estado':'dependencia_condicional_vinculada_AST',
                      'funcionAST':x['funcionAST']} for x in evidence['vinculados']],
                   porTipo={'dependencia_condicional_vinculada_AST':len(evidence['vinculados'])},
                   faltantesDeRama=0)

finished=[r['AUD'] for r in results if r['estado'] in ('cotejo_de_rama_completado','cotejo_de_rama_completado_estatico_condicionado')]
summary={'pendientesIniciales':45,'cotejosCompletos':len(finished),'completados':finished,
         'pendientesRestantes':45-len(finished),'funciones1691':'pendientes de cotejo propio',
         'criterio':'Rutas de acción verificadas con código del corte; funciones/ramas condicionales se conservan para paso 4, sin afirmar ejecución ni consumo.'}
out=Path('auditorias/temporal');out.mkdir(exist_ok=True,parents=True)
(out/'COTEJO_45_RESULTADO.json').write_text(json.dumps({'resumen':summary,'acciones':results},ensure_ascii=False,indent=2)+'\n')
print('PASO3_COTEJO_45',json.dumps(summary,ensure_ascii=False))

for aud in ('AUD-00095','AUD-00096'):
    r=next(x for x in results if x['AUD']==aud)
    print('PASO3_MODERACION_CLASIFICADA',json.dumps({
        'AUD':aud,'total':r['totalSitiosOriginales'],
        'porTipo':r.get('porTipo'),'restantes':r.get('faltantesDeRama'),
        'restantesIds':[x['idSitio'] for x in r.get('candidatosClasificados',[]) if x['estado']=='requiere_cotejo']
    },ensure_ascii=False))

# Diagnóstico focalizado de las dos acciones de moderación de contenidos.
for aud in ('AUD-00095','AUD-00096'):
    row=next(x for x in results if x['AUD']==aud)
    exact=[{'archivo':sites[q['idSitio']]['archivo'],'linea':sites[q['idSitio']]['linea'],'funcion':sites[q['idSitio']].get('funcion'),'id':q['idSitio']} for q in actions[aud]['dependenciasDelArbolSinCadena']]
    groups=collections.defaultdict(list)
    for x in exact: groups[x['archivo']].append(x['linea'])
    print('PASO3_MODERACION_PENDIENTE',json.dumps({'AUD':aud,'total':len(exact),'porArchivo':{k:sorted(set(v)) for k,v in groups.items()}},ensure_ascii=False))

# Agrupación de acciones aún pendientes por conjuntos idénticos de sitios.
open_rows=[r for r in results if r['estado']=='pendiente']
clusters=collections.defaultdict(list)
for r in open_rows:
    candidates=actions[r['AUD']]['dependenciasDelArbolSinCadena']
    signature=tuple(sorted(sites[q['idSitio']]['linea'] for q in candidates))
    clusters[signature].append(r['AUD'])
print('PASO3_GRUPOS_32',json.dumps({
    'acciones':len(open_rows),
    'gruposDeSitios':len(clusters),
    'grupos':[{'AUD':aud_list,'sitiosPorAccion':len(signature),
      'sitiosPrimeraAccion':[(sites[q['idSitio']]['archivo'],sites[q['idSitio']]['linea'])
       for q in actions[aud_list[0]]['dependenciasDelArbolSinCadena'][:12]],
      'entrada':actions[aud_list[0]].get('entrada')}
      for signature,aud_list in sorted(clusters.items(),key=lambda kv:(-len(kv[1]),kv[1][0]))]
},ensure_ascii=False))

# Censo exacto del arranque de Anunciantes AUD-00766.
for aud in ('AUD-00766',):
    row=actions[aud]
    print('PASO3_ARRANQUE_ANUNCIANTES',json.dumps({'AUD':aud,'entrada':row['entrada'],'sitios':[{'id':q['idSitio'],'file':sites[q['idSitio']]['archivo'],'line':sites[q['idSitio']]['linea'],'funcion':sites[q['idSitio']].get('funcion')} for q in row['dependenciasDelArbolSinCadena']]},ensure_ascii=False))

# PASO3 FAMILIA COMPARTIDA
family=['AUD-00445','AUD-00450','AUD-00470','AUD-00471','AUD-00472','AUD-00477','AUD-00478','AUD-00488','AUD-00489','AUD-00499','AUD-00502','AUD-00518','AUD-00523','AUD-00533','AUD-00536']
for aud in family:
    a=actions[aud];e=a.get('entrada') or {}
    print('PASO3_FAMILY_ENTRY',json.dumps({'AUD':aud,'file':e.get('file'),'line':e.get('line'),'handler':e.get('handler'),'entry':e.get('entry'),'kind':e.get('kind')},ensure_ascii=False))
source=actions[family[0]]['dependenciasDelArbolSinCadena']
counts=collections.Counter(sites[q['idSitio']]['archivo'] for q in source)
functions=collections.Counter(sites[q['idSitio']].get('funcion') for q in source)
print('PASO3_FAMILY_454',json.dumps({'candidatos':len(source),'archivos':dict(counts),'funcionesMasFrecuentes':functions.most_common(35),'muestrasPorArchivo':{file:[{'line':sites[q['idSitio']]['linea'],'owner':sites[q['idSitio']].get('funcion')} for q in source if sites[q['idSitio']]['archivo']==file][:18] for file in counts}},ensure_ascii=False))

# PASO3 PUBLICIDAD GET: sitios candidatos reales
aud='AUD-00471'
xs=[sites[q['idSitio']] for q in actions[aud]['dependenciasDelArbolSinCadena']]
selected=[x for x in xs if x['archivo']=='worker/worker206.txt' and (1400<=x['linea']<=1430 or 1750<=x['linea']<=1800 or 4400<=x['linea']<=4480 or 4600<=x['linea']<=4660 or any(word in str(x.get('funcion','')) for word in ['commerceMaster','getPublicidadCatalogs','publicidadPanelData','getPreparedRelations','publicityUsage']))]
print('PASO3_PUBLICIDAD_GET_CANDIDATOS',json.dumps([{'linea':x['linea'],'fn':x.get('funcion'),'id':x.get('idSitio')} for x in selected],ensure_ascii=False))

for aud in ('AUD-00470','AUD-00471','AUD-00472'):
    row=next(x for x in results if x['AUD']==aud)
    print('PASO3_PUBLICIDAD_TRES',json.dumps({'AUD':aud,'estado':row['estado'],'porTipo':row.get('porTipo'),'sinClasificar':row.get('faltantesDeRama')},ensure_ascii=False))

for aud in ('AUD-00445',):
 a=actions[aud];rows=[sites[q['idSitio']] for q in a['dependenciasDelArbolSinCadena']]
 print('PASO3_ACTIVIDADES_00445_SITIOS',json.dumps({'AUD':aud,'original':len(rows),'filas':[{'archivo':x['archivo'],'linea':x['linea'],'funcion':x.get('funcion'),'tipo':x.get('tipo')} for x in rows]},ensure_ascii=False))
