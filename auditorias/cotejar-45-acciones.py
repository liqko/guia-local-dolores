#!/usr/bin/env python3
"""Cotejo reproducible de las acciones pendientes con rutas y condiciones del código congelado.
No modifica producción, no declara ejecución real ni borra candidatos históricos."""
import json,zipfile,collections
from pathlib import Path
SPECS=json.loads("[{\"aud\":\"AUD-00013\",\"entry\":[\"plataforma/administracion.html\",1476,\"ghGoView('configuracion');ghSelectConfig('territorio')\"],\"markers\":[[\"plataforma/administracion.html\",3923,\"name==='territorio'\"],[\"plataforma/administracion.html\",1222,\"'/superadmin/territory'\"],[\"worker/worker206.txt\",7282,\"/superadmin/territory\"],[\"worker/worker206.txt\",1193,\"cache.get(ADMIN_KEY)\"]],\"include\":[1186,1193],\"excludeMode\":\"other_worker\",\"description\":\"Ciudades -> Configuración/Territorio, con copia diaria o GET administrativo condicionado\"},{\"aud\":\"AUD-00074\",\"entry\":[\"plataforma/administracion.html\",3465,\"'/sales/contracts/close'\"],\"markers\":[[\"worker/worker206.txt\",8801,\"/superadmin/sales/contracts/close\"],[\"worker/worker206.txt\",8817,\"gldCoefAdmin173\"],[\"worker/worker206.txt\",8919,\"db.patch('anunciantes_administracion'\"],[\"worker/worker206.txt\",8923,\"patchGuideAdminFieldsV2\"],[\"worker/worker206.txt\",8926,\"cache.put('publicity:contract\"]],\"include\":[1770,4875,4902,4903,4910,5078,5088,8383,8386,8388,8676,8679,8681,8825,8919,8926],\"exclude\":[8701,8702],\"description\":\"POST cierre de contrato -> cotización -> escritura con control de versión y sincronización; guardar coeficientes es ruta distinta\"},{\"aud\":\"AUD-00136\",\"entry\":[\"plataforma/administracion.html\",4008,\"'/superadmin/publications/recent'\"],\"markers\":[[\"worker/worker206.txt\",10912,\"'/superadmin/publications/recent'\"],[\"worker/worker206.txt\",10915,\"request.method==='POST'\"],[\"worker/worker206.txt\",10916,\"body.action!=='retirar'\"],[\"worker/worker206.txt\",10925,\"syncPublicationReviewV77\"],[\"worker/worker206.txt\",10796,\"collection==='actividades'\"],[\"worker/worker206.txt\",10797,\"collection==='publicidades'\"]],\"include\":[10796,10797,1414,1422,1423,1467,1473,1479,1483,1485,1946,1952,2052,2057,2066,4875,6190,6193,6207,6215,6301,6307],\"excludeMode\":\"other_worker\",\"description\":\"POST retirar, colección limitada a eventos/actividades/anunciantes/publicidades, sincronización por colección\"},{\"aud\":\"AUD-00154\",\"entry\":[\"plataforma/administracion.html\",1046,\"'/support/resolve'\"],\"markers\":[[\"worker/worker206.txt\",10661,\"/superadmin/support/resolve\"],[\"worker/worker206.txt\",10672,\"request.method===\\\"POST\\\"\"],[\"worker/worker206.txt\",10676,\"decision_revision==='RECHAZAR'\"],[\"worker/worker206.txt\",10677,\"cache.get(key)||await db.get\"],[\"worker/worker206.txt\",10683,\"db.patch(collection,id,patch\"],[\"worker/worker206.txt\",10684,\"cache.put(key\"]],\"include\":[],\"excludeMode\":\"other_worker\",\"extra\":[[\"worker/worker206.txt\",10677,\"cache/db.get\"],[\"worker/worker206.txt\",10683,\"db.patch\"],[\"worker/worker206.txt\",10684,\"cache.put\"],[\"worker/worker206.txt\",10667,\"listado tras actualizar\"]],\"description\":\"Atender/cerrar soporte usa ruta support/resolve sin rechazo definitivo, consulta y modifica ticket solo si cambió\"},{\"aud\":\"AUD-00155\",\"entry\":[\"plataforma/administracion.html\",1042,\"'/support/resolve'\"],\"markers\":[[\"worker/worker206.txt\",399,\"const REVIEW102\"],[\"worker/worker206.txt\",435,\"async function rejectReview102\"],[\"worker/worker206.txt\",444,\"db.commitPatches\"],[\"worker/worker206.txt\",445,\"cache.put('support:record\"],[\"worker/worker206.txt\",446,\"syncPublicationReviewV77\"],[\"worker/worker206.txt\",10676,\"return rejectReview102\"],[\"worker/worker206.txt\",10792,\"collection==='empleos'\"],[\"worker/worker206.txt\",10793,\"collection==='promos'\"],[\"worker/worker206.txt\",10795,\"collection==='eventos'\"],[\"worker/worker206.txt\",10796,\"collection==='actividades'\"],[\"worker/worker206.txt\",10797,\"collection==='publicidades'\"]],\"include\":[445,10796,10797,11103,11559,11562,11563,11566,1377,1380,1414,1422,1423,1467,1473,1479,1483,1485,1946,1952,2052,2057,2066],\"excludeMode\":\"other_worker\",\"extra\":[[\"worker/worker206.txt\",436,\"ticket versionado\"],[\"worker/worker206.txt\",439,\"publicación versionada\"],[\"worker/worker206.txt\",444,\"commitPatches\"],[\"worker/worker206.txt\",446,\"sincronización por tipo\"]],\"description\":\"Rechazo definitivo revisa ticket y publicación, confirma ambos cambios, sincroniza según tipo, sin rama de anunciantes\"},{\"aud\":\"AUD-00387\",\"entry\":[\"plataforma/gh-publicidad.js\",37,\"'/publicidad'\"],\"markers\":[[\"worker/worker206.txt\",484,\"'/superadmin/publicidad'\"],[\"worker/worker206.txt\",507,\"request.method!=='POST'\"],[\"worker/worker206.txt\",509,\"['pausar','eliminar']\"],[\"worker/worker206.txt\",510,\"db.getVersioned\"],[\"worker/worker206.txt\",512,\"publicityDeleteMonthlyV101\"],[\"worker/worker206.txt\",516,\"publicityCommitV101\"],[\"worker/worker206.txt\",518,\"syncPublicityPreparedV2\"]],\"include\":[1414,1422,1423,2052,2057,2066,517,545,560,746],\"exclude\":[490,491,495,496,497,499,505],\"excludeMode\":\"other_loads\",\"extra\":[[\"worker/worker206.txt\",510,\"versión de publicidad\"],[\"worker/worker206.txt\",516,\"pausa condicional\"],[\"worker/worker206.txt\",518,\"sincronización condicional\"]],\"description\":\"POST publicidad con pausar/eliminar; la preparación y GET del listado pertenecen a otros controles\"},{\"aud\":\"AUD-00098\",\"entry\":[\"plataforma/administracion.html\",1262,\"\\\\'RECHAZAR\\\\'\"],\"markers\":[[\"plataforma/administracion.html\",1125,\"async function resolverPendiente\"],[\"plataforma/administracion.html\",1146,\"'/superadmin/moderation/resolve'\"],[\"worker/worker206.txt\",9822,\"/superadmin/moderation/resolve\"],[\"worker/worker206.txt\",9831,\"resolvePendingV3\"],[\"worker/worker206.txt\",9552,\"kind === \\\"ANUNCIANTE\\\"\"],[\"worker/worker206.txt\",9553,\"db.get(\\\"solicitudes_anunciante\\\"\"],[\"worker/worker206.txt\",9560,\"!isTopAdmin(auth)\"],[\"worker/worker206.txt\",9568,\"dec === \\\"RECHAZAR\\\"\"],[\"worker/worker206.txt\",9569,\"db.patch(\\\"solicitudes_anunciante\\\"\"],[\"worker/worker206.txt\",9575,\"return { success: true\"],[\"worker/worker206.txt\",7372,\"SUPERADMIN_PRINCIPAL\"]],\"include\":[9553,9569],\"exclude\":[9562,9584,9595,9608,9623,9628,9638],\"excludeMode\":\"other_worker\",\"description\":\"Rechazo de solicitud de anunciante: ruta POST moderation/resolve, lectura y patch de solicitud; retorno antes de crear anunciante, sede, relación o sincronizaciones. Rama ADMIN_LOCAL RECLAMAR es inaccesible por guarda isTopAdmin previo.\",\"extra\":[[\"worker/worker206.txt\",9560,\"barrera de rol para reclamo\"],[\"worker/worker206.txt\",9575,\"retorno antes de escrituras de aprobación\"],[\"worker/worker206.txt\",7372,\"ADMIN_LOCAL no es isTopAdmin\"]]},{\"aud\":\"AUD-00097\",\"entry\":[\"plataforma/administracion.html\",1262,\"\\\\'APROBAR\\\\'\"],\"markers\":[[\"plataforma/administracion.html\",1131,\"modo==='RECLAMAR'\"],[\"plataforma/administracion.html\",1136,\"decision==='APROBAR'\"],[\"plataforma/administracion.html\",1146,\"'/superadmin/moderation/resolve'\"],[\"worker/worker206.txt\",9822,\"/superadmin/moderation/resolve\"],[\"worker/worker206.txt\",9831,\"resolvePendingV3\"],[\"worker/worker206.txt\",9552,\"kind === \\\"ANUNCIANTE\\\"\"],[\"worker/worker206.txt\",9553,\"db.get(\\\"solicitudes_anunciante\\\"\"],[\"worker/worker206.txt\",9560,\"!isTopAdmin(auth)\"],[\"worker/worker206.txt\",9578,\"modo === \\\"CREAR\\\"\"],[\"worker/worker206.txt\",9584,\"db.patch(\\\"anunciantes\\\"\"],[\"worker/worker206.txt\",9595,\"db.patch(\\\"anunciantes_administracion\\\"\"],[\"worker/worker206.txt\",9608,\"db.patch(\\\"anunciantes_sedes\\\"\"],[\"worker/worker206.txt\",9622,\"modo === \\\"RECLAMAR\\\"\"],[\"worker/worker206.txt\",9628,\"db.patch(\\\"suscriptor_anunciante\\\"\"],[\"worker/worker206.txt\",9637,\"revokeSubscriberSessions\"],[\"worker/worker206.txt\",9638,\"db.patch(\\\"solicitudes_anunciante\\\"\"],[\"worker/worker206.txt\",9648,\"syncGuideAdvertiserV2\"],[\"worker/worker206.txt\",9649,\"syncAdvertiserIndexV2\"],[\"worker/worker206.txt\",7372,\"SUPERADMIN_PRINCIPAL\"]],\"include\":[9553,9584,9595,9608,9623,9628,9638,4818,4819,4820,4821,4822,4823,4846,4850,4852,5062,5063,5064,5065,5070],\"exclude\":[9562,9569],\"excludeMode\":\"other_worker\",\"description\":\"Aprobar solicitud ANUNCIANTE: POST moderation/resolve; validar nivel o titularidad; según CREAR, crear ficha, administración y sede; según RECLAMAR, validar ficha existente; en ambos modos guardar vínculo, revocar sesiones, marcar solicitud aprobada; en CREAR sincronizar guía e índice. Cada escritura y sincronización conserva sus condiciones.\",\"extra\":[[\"worker/worker206.txt\",2702,\"revocar sesiones via AccessRecord201 (Durable Object)\"],[\"worker/worker206.txt\",9560,\"barrera de rol imposibilita ADMIN_LOCAL con RECLAMAR\"],[\"worker/worker206.txt\",9646,\"sincronización sólo para modo CREAR\"]]}]")
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
            if site['archivo']=='worker/worker206.txt' and site['linea'] in include: result='dependencia_condicional_vinculada'
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

# Diagnóstico focalizado de las dos acciones de moderación de contenidos.
for aud in ('AUD-00095','AUD-00096'):
    row=next(x for x in results if x['AUD']==aud)
    exact=[{'archivo':sites[q['idSitio']]['archivo'],'linea':sites[q['idSitio']]['linea'],'funcion':sites[q['idSitio']].get('funcion'),'id':q['idSitio']} for q in actions[aud]['dependenciasDelArbolSinCadena']]
    groups=collections.defaultdict(list)
    for x in exact: groups[x['archivo']].append(x['linea'])
    print('PASO3_MODERACION_PENDIENTE',json.dumps({'AUD':aud,'total':len(exact),'porArchivo':{k:sorted(set(v)) for k,v in groups.items()}},ensure_ascii=False))
