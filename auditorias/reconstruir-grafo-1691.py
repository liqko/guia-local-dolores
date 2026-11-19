#!/usr/bin/env python3
"""Paso 3: reconstruir tramas desde entradas AUD con identidades AST exactas.
Aristas sólo de llamadas resueltas y callbacks con contrato comprobado en fuente;
no representa ejecución en navegador ni consumos reales."""
import collections, json, re, zipfile
from pathlib import Path

ROOT=Path('auditorias/transversal')
OUT=Path('auditorias/temporal')
OUT.mkdir(exist_ok=True,parents=True)
TREE=Path('baseline/auditorias/transversal/ARBOL_ACCIONES.json')
with zipfile.ZipFile(ROOT/'CATALOGO_MAESTRO.zip') as z:
    catalog=json.loads(z.read('CATALOGO_MAESTRO.json'))
with zipfile.ZipFile(ROOT/'COBERTURA_ACTIVACIONES.zip') as z:
    coverage=json.loads(z.read('COBERTURA_ACTIVACIONES.json'))
tree=json.loads(TREE.read_bytes())
t_hash=tree.get('sourceHashes') or {}
c_hash=catalog['baseline']['sourceHashes']
common=set(t_hash)&set(c_hash)
assert common and all(t_hash[k]==c_hash[k] for k in common), {'common':len(common),'mismatches':[k for k in common if t_hash[k]!=c_hash[k]][:10]}
assert len(common)>=60, {'source_tree':len(t_hash),'source_catalog':len(c_hash),'common':len(common)}
assert coverage['revision']==catalog['baseline']['revision']
assert len(catalog['entries'])==987
F={f['id']:f for f in tree['functionGraph']}
assert len(F)==len(tree['functionGraph'])
index=collections.defaultdict(list)
for fid,f in F.items():
    p=re.match(r'^(.*):([0-9]+):([0-9]+):([^:]*)$',fid)
    if p:index[(p.group(1),int(p.group(2)),int(p.group(3)))].append(fid)
roots=collections.defaultdict(set)
for e in catalog['entries']:
    raw=(e.get('start') or {}).get('entry')
    if raw in F:roots[raw].add(e['id'])
adj=collections.defaultdict(dict)
for f in F.values():
    for c in f['calls']:
        t=c.get('to')
        if t in F:adj[f['id']][t]=('llamada_resuelta',c['id'])
    # Las alternativas de destino no son conexiones comprobadas y NO se incluyen.
for b in tree.get('callbackBindings',[]):
    src=b['binding'].split('|')[0]
    for target in b['targets']:
        if src in F and target in F:adj[src][target]=('vinculo_condicionado',b['binding'])
# Enlace perdido por el analizador: el despacho de Durable Object usa
# una única línea larga con llamadas condicionales this.metodo(...).
# Se verifica la clase, el IIFE con this léxico y cada método de su prototype.
worker_lines=(Path('baseline')/'worker/worker206.txt').read_text().splitlines()
actor_dispatch='worker/worker206.txt:11974:759560:iife@11974'
assert actor_dispatch in F
assert 'class GldPublicCache119' in worker_lines[11735-1]
assert 'async process127(request)' in worker_lines[11973-1]
assert '(async()=>{' in worker_lines[11974-1]
actor_source=worker_lines[11976-1]
assert 'body.op' in actor_source and 'this.businessSave143(' in actor_source
actor_prototypes={
    f['name'].split('.prototype.',1)[1]:f['id']
    for f in F.values()
    if f['file']=='worker/worker206.txt' and
       f['name'].startswith('GldPublicCache119.prototype.')
}
actor_resolved=[]
for method in sorted(set(re.findall(r'\bthis\.([A-Za-z_$][\w$]*)\s*\(',actor_source))):
    target=actor_prototypes.get(method)
    if target:
        adj[actor_dispatch][target]=('despacho_do_condicionado_por_op','worker/worker206.txt:11976')
        actor_resolved.append(method)
assert 'businessSave143' in actor_resolved and 'guideSave132' in actor_resolved
print('DESPACHOS_DO_RECONSTRUIDOS',json.dumps(actor_resolved))

# Exportaciones de namespaces IIFE realmente utilizadas por el despacho
# principal. El AST marcaba como externas estas llamadas pese a que
# return {route/dispatch} identifica el destino inequívocamente.
namespace_links=[
  ('worker/worker206.txt:13177:858197:fetch',
   'worker/worker206.txt:270:19337:route',
   13217,'GLD_ACTIONS138.route(ctx,report)',294,'return {readJson,authenticate,changed,equal,actorName,Coordinator,route,'),
  ('worker/worker206.txt:13177:858197:fetch',
   'worker/worker206.txt:12860:829695:dispatch',
   13218,'GLD_BUSINESS143.dispatch(ctx)',12924,'return {dispatch,journal,equal,quotaError,restoreContract,trusted}'),
  ('worker/worker206.txt:12860:829695:dispatch',
   'worker/worker206.txt:13123:853381:dispatch',
   12863,'GLD_EVENTS145.dispatch(ctx)',13173,'return {scope,publicRows,matches,geo,hasVirtual,dispatch,repair,revision,result}')
]
for src,dest,site,call,return_line,export in namespace_links:
    assert src in F and dest in F,(src,dest)
    assert call in worker_lines[site-1],(site,call)
    assert export in worker_lines[return_line-1],(return_line,export)
    adj[src][dest]=('llamada_exportada_namespace_comprobada','worker/worker206.txt:'+str(site))
print('DESPACHOS_NAMESPACE_VERIFICADOS',len(namespace_links))

# El coordinador territorial recibe un callback en serialized(fn)
# y lo ejecuta mediante fn(). Enlazar sus dos invocaciones reales.
assert 'await fn()' in worker_lines[235-1]
for line,owner,callback in [
    (236,'worker/worker206.txt:236:16868:fetch','worker/worker206.txt:236:16923:callback@236'),
    (252,'worker/worker206.txt:252:18134:alarm','worker/worker206.txt:252:18184:callback@252')
]:
    assert owner in F and callback in F
    assert 'this.serialized(async()=>{' in worker_lines[line-1]
    assert F[callback]['parent']==owner
    adj[owner][callback]=('callback_serializado_con_invocacion_fn_verificada','worker/worker206.txt:'+str(line))
print('CALLBACKS_COORDINADOR_VERIFICADOS',2)

# El coordinador recibe territoryAdapter por defecto; sus métodos
# prepare y bootstrap están definidos en el mismo cierre y utilizados
# por execute/load. El AST no resolvió this.adapter.metodo.
assert 'const territoryAdapter={' in worker_lines[136-1]
assert 'identify,prepare,' in worker_lines[137-1]
assert 'async bootstrap(' in worker_lines[140-1]
assert 'adapter=territoryAdapter' in worker_lines[147-1]
assert 'this.adapter=adapter' in worker_lines[148-1]
assert 'this.adapter.bootstrap(' in worker_lines[156-1] or 'this.adapter.bootstrap(' in worker_lines[157-1]
assert any('this.adapter.prepare(' in l for l in worker_lines[215:238])
for src,dest in [
  ('worker/worker206.txt:153:10764:load','worker/worker206.txt:140:9649:bootstrap'),
  ('worker/worker206.txt:216:15111:execute','worker/worker206.txt:105:7100:prepare')
]:
    assert src in F and dest in F
    adj[src][dest]=('adaptador_territorial_concreto_comprobado','worker/worker206.txt:148')
print('ADAPTADOR_TERRITORIAL_VERIFICADO',2)

# El Durable Object deriva a GLD_ACTIONS138.Coordinator si ya fue
# inicializado; no es una llamada a un servicio externo.
assert 'this.actions138.fetch(request)' in worker_lines[11965-1]
assert 'this.actions138.alarm(' in worker_lines[12800-1]
assert any('new GLD_ACTIONS138.Coordinator' in line for line in worker_lines[11973:11978])
for src,dest,site,needle in [
    ('worker/worker206.txt:11964:759119:fetch','worker/worker206.txt:236:16868:fetch',11965,'this.actions138.fetch(request)'),
    ('worker/worker206.txt:12799:824441:GldPublicCache119.prototype.alarm','worker/worker206.txt:252:18134:alarm',12800,'this.actions138.alarm(')
]:
    assert src in F and dest in F
    assert needle in worker_lines[site-1]
    adj[src][dest]=('coordinador_actions138_con_tipo_verificado','worker/worker206.txt:'+str(site))
print('COORDINADOR_ACTIONS138_CONECTADO',2)

OPEN={'invocador_identificado_sin_entrada','registro_o_asignacion_sin_invocacion_comprobada',
      'declaracion_sin_invocador_resuelto','uso_no_localizado_revision_por_accion'}
pending=[r for r in coverage['filas'] if r.get('estadoDeCobertura') in OPEN]
assert len(pending)==1691
std={'map','flatMap','filter','forEach','some','every','find','findIndex','findLast',
     'findLastIndex','reduce','reduceRight','sort','then','catch','finally'}
src_cache={}
callbacks_verified=0
for r in pending:
    ast=r.get('cuerpoAST') or {}
    node=index.get((r['archivo'],r['linea'],ast.get('inicio')),[])
    assert len(node)==1,(r['idGPS'],node)
    a=r.get('activacion') or {}
    parent=r.get('padre')
    if parent not in F:continue
    kind=a.get('tipo')
    if kind=='funcion_pasada_como_argumento':
        if r['archivo'] not in src_cache:
            src_cache[r['archivo']]=(Path('baseline')/r['archivo']).read_text().splitlines()
        lines=src_cache[r['archivo']]
        n=r['linea']
        # Un callback multilinea puede declararse muchas lineas despues del
        # inicio de la llamada. Verificar su localizacion exacta y el sitio de
        # activacion AST, no depender del final de la expresion.
        site=a.get('sitio') or ''
        msite=re.search(r':([0-9]+)$',site)
        site_line=int(msite.group(1)) if msite else n
        local='\n'.join(lines[max(0,n-3):min(len(lines),n+4)])
        invocation='\n'.join(lines[max(0,site_line-3):min(len(lines),site_line+4)])
        expression=str(a.get('expr') or '')
        candidates=set(re.findall(r'[.]([A-Za-z]+)\s*\(',expression))
        candidates|=set(re.findall(r'[.]([A-Za-z]+)\s*\(',local))
        candidates|=set(re.findall(r'[.]([A-Za-z]+)\s*\(',invocation))
        valid=[method for method in sorted(candidates) if method in std and
               (re.search(r'[.]\s*'+re.escape(method)+r'\s*\(',local) or
                re.search(r'[.]\s*'+re.escape(method)+r'\s*\(',invocation))]
        if not valid:continue
        adj[parent][node[0]]=('callback_estandar_condicionado',a.get('sitio'))
        callbacks_verified+=1
    elif kind=='funcion_pasada_a_constructor' and str(a.get('expr') or '')=='Promise':
        # new Promise(executor) invoca el ejecutor inmediatamente. Probar
        # constructora y callback en la misma ubicación del código.
        if r['archivo'] not in src_cache:
            src_cache[r['archivo']]=(Path('baseline')/r['archivo']).read_text().splitlines()
        line=src_cache[r['archivo']][r['linea']-1]
        if re.search(r'new\s+Promise\s*\(',line):
            adj[parent][node[0]]=('constructor_promise_sincronico',a.get('sitio'))
    elif kind=='callback_programado':
        adj[parent][node[0]]=('callback_temporizador_condicionado',a.get('sitio'))
    elif kind=='invocada_en_su_declaracion':
        adj[parent][node[0]]=('invocacion_inmediata',a.get('sitio'))
# Trazas: una ruta reproducible hasta una acción, no ejecución del callback.
from collections import deque
queue=deque([(key,aud) for key,auds in roots.items() for aud in sorted(auds)])
seen={}
while queue:
    key,aud=queue.popleft()
    if key in seen:continue
    seen[key]={'accion':aud,'from':None,'edge':None}
    for nxt,kind in adj.get(key,{}).items():
        if nxt not in seen:
            queue.append((nxt,aud))
            # Guardar el primer predecesor para reconstruirlo al procesar el nodo.
            seen.setdefault('__pred__'+nxt,{'from':key,'edge':kind,'accion':aud})
# El BFS anterior guarda un predecesor candidato por nodo. Nunca contar esos __pred__ como funciones.
records=[]
for row in pending:
    ast=row['cuerpoAST']
    fid=index[(row['archivo'],row['linea'],ast['inicio'])][0]
    cur=seen.get(fid)
    if cur:
        chain=[fid]
        guard=[]
        while True:
            pred=seen.get('__pred__'+chain[-1])
            if pred is None:break
            guard.append(pred['edge'][0])
            chain.append(pred['from'])
            if len(chain)>100:raise RuntimeError('Ciclo en traza '+fid)
        chain.reverse()
        status='cadena_desde_accion_confirmada_estaticamente'
        record={'idAST':fid,'estado':status,'AUD':cur['accion'],
                'cadena':chain,'aristas':list(reversed(guard)),
                'condicional':any('condicionado' in x for x in guard)}
    else:
        record={'idAST':fid,'estado':'falta_enlace_a_entrada','activacion':row.get('activacion'),
                'padre':row.get('padre'),'sitiosDeLlamada':row.get('sitiosDeLlamada')}
    records.append(record)
counts=collections.Counter(x['estado'] for x in records)
summary={'revision':coverage['revision'],'catalogo':len(catalog['entries']),
         'funcionesExactas':len(F),'accionesConRaizAST':len(roots),
         'grupoRevisado':1691,'callbacksFuente':callbacks_verified,'resultados':dict(counts),
         'limitacion':'Traza estática a una acción; las condiciones de cada callback no se probaron en navegador.'}
(OUT/'GRAFO_COMPLETO_1691.json').write_text(json.dumps({'resumen':summary,'funciones':records},ensure_ascii=False,indent=2)+'\n')
print('GRAFO_COMPLETO_1691',json.dumps(summary,ensure_ascii=False))
