#!/usr/bin/env python3
"""Paso 3: trazar acciones del catálogo -> activadores -> funciones por rango AST.
Sólo agrega conexiones con evidencia fuente; NO equipara pertenencia a árbol con activación.
Produce registro por las 1691 funciones originales y brechas explícitas."""
import collections,json,re,zipfile
from pathlib import Path
ROOT=Path('auditorias/transversal')
OUT=Path('auditorias/temporal')
OUT.mkdir(exist_ok=True)
with zipfile.ZipFile(ROOT/'COBERTURA_ACTIVACIONES.zip') as z:
    gps=json.loads(z.read('COBERTURA_ACTIVACIONES.json'))
with zipfile.ZipFile(ROOT/'CATALOGO_MAESTRO.zip') as z:
    catalog=json.loads(z.read('CATALOGO_MAESTRO.json'))
rows=gps['filas']
entries=catalog['entries']
assert len(entries)==987 and len(rows)==3625
open_status={'invocador_identificado_sin_entrada','registro_o_asignacion_sin_invocacion_comprobada','declaracion_sin_invocador_resuelto','uso_no_localizado_revision_por_accion'}
pending=[r for r in rows if r.get('estadoDeCobertura') in open_status]
assert len(pending)==1691

# Las aristas del anexo tienen AST file:line:offset:name. Reconstituir la misma identidad.
PAT=re.compile(r'^(.*?:\d+:\d+):')
def ast_key(raw):
    m=PAT.match(str(raw or ''))
    return m.group(1) if m else None
def own_key(r):
    ast=r.get('cuerpoAST') or {}
    return f"{r['archivo']}:{r['linea']}:{ast['inicio']}" if ast.get('inicio') is not None else None
def normalized_name(name):
    if not name:return ''
    return re.sub(r'^callback@.*$', 'callback', str(name))
# Vincular nodos GPS a identidades de catálogo sólo si la fila es única por archivo/línea/nombre.
gps_index=collections.defaultdict(list)
for r in rows:gps_index[(r.get('archivo'),r.get('linea'),normalized_name(r.get('nombre')))].append(r)
full_to_ast={}
for f in catalog['functions']:
    matches=gps_index.get((f.get('file'),f.get('line'),normalized_name(f.get('name'))),[])
    if len(matches)==1 and own_key(matches[0]):full_to_ast[f['id']]=own_key(matches[0])
def normalized_node(raw):
    return ast_key(raw) or full_to_ast.get(raw) or str(raw)

incoming=collections.defaultdict(dict)
def add_edge(before,after,kind,source):
    b=normalized_node(before);a=normalized_node(after)
    if not b or not a or b==a:return
    incoming[a][(b,kind)]=source

# Llamadas de función y referencias reconocidas en el análisis AST: no agregar relación por mera vecindad.
for r in rows:
    for edge in r.get('entradasLocales') or []:
        before=edge.get('desde');after=edge.get('hacia')
        if before and after:add_edge(before,after,'llamada_local_'+str(edge.get('clase') or ''),edge.get('sitio'))
    for site in r.get('sitiosDeLlamada') or []:
        if isinstance(site,list) and site:
            before=site[0]
            after=own_key(r)
            if before and after:add_edge(before,after,'sitio_llamada',site[1:] if len(site)>1 else None)

# Callbacks registrados/pasados a métodos identificados. La arista es condicionada: registro no implica ejecución.
callback_contracts={'map','flatMap','filter','forEach','some','every','find','findIndex','findLast','findLastIndex','reduce','reduceRight','sort','then','catch','finally','setTimeout','setInterval','addEventListener'}
contract_count=collections.Counter()
for r in rows:
    activation=r.get('activacion') or {}
    if not r.get('padre') or not own_key(r):continue
    typ=activation.get('tipo')
    expr=str(activation.get('expr') or '')
    method_match=re.search(r'\.([A-Za-z]+)\s*$',expr)
    method=method_match.group(1) if method_match else expr
    is_standard=(typ=='funcion_pasada_como_argumento' and method in callback_contracts)
    is_timer=(typ=='callback_programado' and method in callback_contracts)
    if is_standard or is_timer:
        add_edge(r['padre'],own_key(r),'callback_condicionado_'+str(method),activation.get('sitio'))
        contract_count[method]+=1
    elif typ=='invocada_en_su_declaracion':
        add_edge(r['padre'],own_key(r),'invocacion_inmediata',activation.get('sitio'))

# Efectos candidato_local sólo son pistas, NO aristas cerradas.
effect_candidates=[e for e in catalog.get('effects',[]) if e.get('resolution')=='candidate_local' and e.get('to')]

# Entradas AUD originales: la raíz está definida por el manejador exacto (incluye offset).
roots=collections.defaultdict(set)
root_details={}
for entry in entries:
    raw=(entry.get('start') or {}).get('entry')
    if raw:
        node=normalized_node(raw)
        roots[node].add(entry['id'])
        root_details[entry['id']]=entry['start']
# Funciones que el catálogo marcó como parte de una unidad AUD (no se usan como raíz).
tree_membership=collections.defaultdict(set)
for fn in catalog['functions']:
    key=normalized_node(fn.get('id'))
    for aud in fn.get('units') or []:tree_membership[key].add(aud)

# Rastrear en sentido contrario desde cada función hasta una acción verdadera.
from collections import deque
def trace(target):
    start=normalized_node(target)
    q=deque([(start,[],False)])
    seen={start}
    while q:
        node,steps,conditional=q.popleft()
        if node in roots:
            return {'resultado':'cadena_hasta_accion_de_catalogo','acciones':sorted(roots[node]),
                    'recorrido':list(reversed(steps)),'condicional':conditional,'nodos':len(steps)+1}
        if len(steps)>=100:continue
        for (before,kind),sitio in incoming.get(node,{}).items():
            if before not in seen:
                seen.add(before)
                q.append((before,steps+[{'desde':before,'hasta':node,'evidencia':kind,'sitio':sitio}],
                          conditional or kind.startswith('callback_condicionado')))
    return {'resultado':'sin_entrada_de_accion','alcanceReverso':len(seen),
            'unidadesPorPertenencia':sorted(tree_membership.get(start,[])),
            'invocadoresInmediatos':len(incoming.get(start,{}))}
out=[]
for i,r in enumerate(pending,1):
    key=own_key(r)
    route=trace(key)
    out.append({'fila':i,'identidadGPS':r['idGPS'],'identidadAST':key,
                'archivo':r['archivo'],'linea':r['linea'],
                'activacion':r.get('activacion'),'estadoOriginal':r.get('estadoDeCobertura'),
                'traza':route,'padre':r.get('padre'),'operaciones':r.get('operaciones'),
                'sitiosDeLlamada':r.get('sitiosDeLlamada'),
                'candidatos':r.get('candidatos')})
# Reconstrucción adicional desde pertenencia explícita al árbol y punto de activación.
# Es distinta de una cadena de aristas: conservar ambas evidencias por separado.
entry_by_id={entry['id']:entry for entry in entries}
by_key={own_key(row):row for row in rows if own_key(row)}
for item in out:
    row=pending[item['fila']-1]
    activation=row.get('activacion') or {}
    parent=row.get('padre')
    parent_key=ast_key(parent)
    parent_row=by_key.get(parent_key)
    direct=set(row.get('unidadesExactas') or row.get('unidades') or [])
    parent_units=set(row.get('unidadesDelPadre') or [])
    parent_units|=tree_membership.get(parent_key,set())
    parent_units={u for u in parent_units if u in entry_by_id}
    direct={u for u in direct if u in entry_by_id}
    m=re.search(r'\.([A-Za-z]+)\s*
cond_count=sum(x['traza'].get('condicional',False) for x in out)
chain_states=collections.Counter(x['estadoCadena'] for x in out)
summary={'revision':gps['revision'],'total':len(out),'acciones_catalogo':len(entries),
         'entradasAST':len(roots),'aristas_individuales':sum(len(x) for x in incoming.values()),
         'callbacksConContrato':sum(contract_count.values()),'candidatosLocalNoAsumidos':len(effect_candidates),
         'resultados':dict(stats),'clasificacionCadenas':dict(chain_states),'cadenasConCondicion':cond_count,
         'nota':'Se acredita recorrido estático a entrada cuando existe cadena; callbacks y ramas de ejecución siguen condicionados. No equivale a prueba funcional ni de consumo.'}
(OUT/'CADENAS_PASO3_1691.json').write_text(json.dumps({'resumen':summary,'cadenas':out},ensure_ascii=False,indent=2)+'\n')
(OUT/'CADENAS_PASO3_RESUMEN.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print('CADENAS_PASO3',json.dumps(summary,ensure_ascii=False))
print('EJEMPLOS_CADENAS',json.dumps([x for x in out if x['traza']['resultado']=='cadena_hasta_accion_de_catalogo'][:3],ensure_ascii=False)[:7000])
,str(activation.get('expr') or ''))
    method=m.group(1) if m else ''
    typ=activation.get('tipo')
    callback_known=(typ=='funcion_pasada_como_argumento' and method in callback_contracts) or (typ=='callback_programado' and method in callback_contracts) or typ=='invocada_en_su_declaracion'
    if item['traza']['resultado']=='cadena_hasta_accion_de_catalogo':
        state='cadena_de_aristas_hasta_accion'
        possible=item['traza']['acciones']
    elif direct:
        state='funcion_en_arbol_sin_cadena_de_activacion'
        possible=sorted(direct)
    elif parent_units and callback_known:
        state='accion_arbol_y_callback_vinculados_falta_tramo_intermedio'
        possible=sorted(parent_units)
    elif parent_units:
        state='padre_en_arbol_sin_activacion_demostrada'
        possible=sorted(parent_units)
    else:
        state='sin_enlace_a_accion_comprobado'
        possible=[]
    item['estadoCadena']=state
    item['accionesCandidatas']=possible
    item['evidenciaDeEnlace']={'padreAST':parent_key,'pertenenciaPadre':sorted(parent_units),
      'metodoCallback':method if callback_known else None,'tipoActivacion':typ}
    # Mostrar dependencias del árbol asociadas a las acciones, no atribuidas al callback específico.
    item['accionesContexto']=[{
       'AUD':u,
       'accion':{k:entry_by_id[u]['start'].get(k) for k in ('file','line','kind','label','handler','event','receiver','entry')},
       'dependenciasDelArbol':{
           'red':[{'metodo':x.get('verb'),'destinos':x.get('candidates'),'estadoRuta':x.get('routeStatus')} for x in entry_by_id[u].get('network',[])],
           'datos':[{'operacion':x.get('operation'),'coleccion':x.get('key')} for x in entry_by_id[u].get('data',[])]
       }
     } for u in possible[:8]]

stats=collections.Counter(x['traza']['resultado'] for x in out)
cond_count=sum(x['traza'].get('condicional',False) for x in out)
summary={'revision':gps['revision'],'total':len(out),'acciones_catalogo':len(entries),
         'entradasAST':len(roots),'aristas_individuales':sum(len(x) for x in incoming.values()),
         'callbacksConContrato':sum(contract_count.values()),'candidatosLocalNoAsumidos':len(effect_candidates),
         'resultados':dict(stats),'cadenasConCondicion':cond_count,
         'nota':'Se acredita recorrido estático a entrada cuando existe cadena; callbacks y ramas de ejecución siguen condicionados. No equivale a prueba funcional ni de consumo.'}
(OUT/'CADENAS_PASO3_1691.json').write_text(json.dumps({'resumen':summary,'cadenas':out},ensure_ascii=False,indent=2)+'\n')
(OUT/'CADENAS_PASO3_RESUMEN.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print('CADENAS_PASO3',json.dumps(summary,ensure_ascii=False))
print('EJEMPLOS_CADENAS',json.dumps([x for x in out if x['traza']['resultado']=='cadena_hasta_accion_de_catalogo'][:3],ensure_ascii=False)[:7000])
