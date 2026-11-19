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

# Módulo de clasificación exportado a window.GLD_CLASSIFICATION.
# Las llamadas desde otras pantallas eran etiquetadas "external_method"
# pese a que la implementación se encuentra en clasificacion.js.
classification_src=(Path('baseline')/'plataforma/clasificacion.js').read_text().splitlines()
assert 'root.GLD_CLASSIFICATION=gldClassificationV86()' in classification_src[17-1]
assert 'return {text,ids,flag,levelNumber,name,findLevel,rules,active:' in classification_src[15-1]
cls_methods={f['name']:f['id'] for f in F.values()
             if f['file']=='plataforma/clasificacion.js' and
             f['parent']=='plataforma/clasificacion.js:2:17:gldClassificationV86'}
assert len(cls_methods)>=10
classification_links=[]
src_files={}
for f in F.values():
    if f['file']=='plataforma/clasificacion.js':continue
    for c in f.get('calls',[]):
        method=c.get('method')
        if method not in cls_methods:continue
        path=f['file']
        if path not in src_files:
            fp=Path('baseline')/path
            src_files[path]=fp.read_text().splitlines() if fp.exists() else []
        line=c.get('line')
        if not isinstance(line,int) or not (1<=line<=len(src_files[path])):continue
        source=src_files[path][line-1]
        # Identificar receptor, no coincidir sólo por el nombre del método.
        if re.search(r'\bGLD_CLASSIFICATION\s*(?:\?\.|\.)\s*'+re.escape(method)+r'\s*\(',source):
            adj[f['id']][cls_methods[method]]=('namespace_exportado_y_llamada_comprobados',path+':'+str(line))
            classification_links.append((f['id'],method,path,line))
print('CLASIFICACION_EXPORTS_VINCULADOS',len(classification_links))

# El paquete de ciudad exporta el objeto que devuelve client(...).
# Resolver sus dos métodos públicos, distinguiéndolos del homónimo
# storage.get() interno que no es el API usado por las interfaces.
package_src=(Path('baseline')/'plataforma/paquete-ciudad.js').read_text().splitlines()
assert 'root.GLD_PAQUETE_CIUDAD = client({' in package_src[185-1]
assert 'const api = { get(cityId)' in package_src[112-1]
assert '},async module(cityId,family,context)' in package_src[127-1]
package_api={'get':'plataforma/paquete-ciudad.js:112:6551:get',
             'module':'plataforma/paquete-ciudad.js:127:7200:module'}
assert all(target in F for target in package_api.values())
package_links=[]
for f in F.values():
    if f['file']=='plataforma/paquete-ciudad.js':continue
    for c in f.get('calls',[]):
        method=c.get('method')
        if method not in package_api:continue
        file=f['file'];line=c.get('line')
        if file not in src_files:
            fp=Path('baseline')/file
            src_files[file]=fp.read_text().splitlines() if fp.exists() else []
        if not isinstance(line,int) or not 1<=line<=len(src_files[file]):continue
        source=src_files[file][line-1]
        if re.search(r'\bGLD_PAQUETE_CIUDAD\s*(?:\?\.|\.)\s*'+method+r'\s*\(',source):
            adj[f['id']][package_api[method]]=('api_paquete_ciudad_exportada_y_uso_comprobados',file+':'+str(line))
            package_links.append((file,line,method))
print('PAQUETE_CIUDAD_EXPORTS_VINCULADOS',len(package_links))

# La interfaz renombra GLD_PLANES_RESUMEN como "fmt"; resolver el
# alias sólo en los dos ámbitos donde la asignación está demostrada.
plans_src=(Path('baseline')/'plataforma/planes-resumen.js').read_text().splitlines()
assert 'root.GLD_PLANES_RESUMEN={number,flag,active,summary,sections,glossary,name,price,publishPrice,definitions}' in plans_src[135-1]
plan_methods={f['name']:f['id'] for f in F.values()
              if f['file']=='plataforma/planes-resumen.js' and
                 f['parent']=='plataforma/planes-resumen.js:2:86:iife@2'}
plan_method_names=set('number flag active summary sections name price publishPrice'.split())
assert plan_method_names.issubset(plan_methods)
plan_aliases={
  'plataforma/planes-publicos.js':('plataforma/planes-publicos.js:1:1:iife@1',6),
  'plataforma/administracion.html':('plataforma/administracion.html:3700:236285:ghRenderResumenNiveles108',3702)
}
plan_alias_links=[]
for file,(scope,alias_line) in plan_aliases.items():
    if file not in src_files:src_files[file]=(Path('baseline')/file).read_text().splitlines()
    assert 'fmt=window.GLD_PLANES_RESUMEN' in src_files[file][alias_line-1]
    for f in F.values():
        if f['file']!=file:continue
        cur=f['id'];belongs=False
        for i in range(55):
            if cur==scope:belongs=True;break
            cur=(F.get(cur) or {}).get('parent')
            if cur is None:break
        if not belongs:continue
        for c in f.get('calls',[]):
            method=c.get('method')
            if method not in plan_method_names:continue
            line=c.get('line')
            if not isinstance(line,int) or line<alias_line or line>len(src_files[file]):continue
            if re.search(r'\bfmt\s*\.\s*'+re.escape(method)+r'\s*\(',src_files[file][line-1]):
                adj[f['id']][plan_methods[method]]=('alias_global_planes_verificado',file+':'+str(line))
                plan_alias_links.append((file,line,method))
print('PLANES_RESUMEN_ALIAS_VINCULADOS',len(plan_alias_links))

# Los 34 callbacks "load" de relaciones preparadas se ejecutan desde
# getPreparedRelationsV1 sólo si falta la relación en el documento o caché.
# El rastreador AST veía db.queryEqual, pero perdía el salto al callback
# cuando éste se pasaba como propiedad de un objeto.
assert 'return load();' in worker_lines[1416-1]
prepared_load_bindings=[]
for fn in F.values():
    if fn['file']!='worker/worker206.txt' or fn['name']!='load' or not fn.get('parent'):continue
    n=fn['line']
    fragment='\n'.join(worker_lines[max(0,n-6):min(len(worker_lines),n+2)])
    if 'getPreparedRelationsV1' not in fragment:continue
    if not re.search(r'\bload\s*:\s*\(?',fragment):continue
    if fn['parent'] not in F:continue
    adj[fn['parent']][fn['id']]=('callback_load_condicionado_a_cache_miss','worker/worker206.txt:'+str(n))
    prepared_load_bindings.append(fn['id'])
assert len(prepared_load_bindings)>=30,len(prepared_load_bindings)
print('RELACIONES_PREPARADAS_CALLBACKS_VINCULADOS',len(prepared_load_bindings))

# Cruce general del índice AST de exportaciones de namespaces. En
# lugar de añadir módulo por módulo, resolver los 74 registros de
# namespaceExports que el árbol ya extrajo del mismo código congelado.
namespace_index=collections.defaultdict(list)
for export in tree.get('namespaceExports',[]):
    targets=[target for target in export.get('targets',[]) if target in F]
    if len(targets)==1:
        namespace_index[(export['namespace'],export['method'])].append((targets[0],export))
namespace_linked=set()
namespace_unresolved=[]
for fn in F.values():
    for call in fn.get('calls',[]):
        method=call.get('method');line=call.get('line')
        if not method or not isinstance(line,int):continue
        file=fn['file']
        if file not in src_files:
            fp=Path('baseline')/file
            src_files[file]=fp.read_text().splitlines() if fp.exists() else []
        if line<1 or line>len(src_files[file]):continue
        source=src_files[file][line-1]
        for (namespace,exported),destinations in namespace_index.items():
            if exported!=method:continue
            if not re.search(r'\b'+re.escape(namespace)+r'\s*(?:\?\.|\.)\s*'+re.escape(method)+r'\s*\(',source):continue
            if len({x[0] for x in destinations})!=1:
                namespace_unresolved.append((file,line,namespace,method));continue
            target=destinations[0][0]
            adj[fn['id']][target]=('namespace_export_AST_verificado',file+':'+str(line))
            namespace_linked.add((fn['id'],target,file,line))
print('EXPORTACIONES_AST_GLOBALES',json.dumps({
    'exports':len(tree.get('namespaceExports',[])),
    'enlacesExactos':len(namespace_linked),
    'ambiguos':len(namespace_unresolved),
    'muestras':list(namespace_linked)[:8]},ensure_ascii=False)[:2100])

OPEN={'invocador_identificado_sin_entrada','registro_o_asignacion_sin_invocacion_comprobada',
      'declaracion_sin_invocador_resuelto','uso_no_localizado_revision_por_accion'}
pending=[r for r in coverage['filas'] if r.get('estadoDeCobertura') in OPEN]
assert len(pending)==1691
std={'map','flatMap','filter','forEach','some','every','find','findIndex','findLast',
     'findLastIndex','reduce','reduceRight','sort','then','catch','finally'}
src_cache={}
callbacks_verified=0
for r in coverage['filas']:
    ast=r.get('cuerpoAST') or {}
    node=index.get((r['archivo'],r['linea'],ast.get('inicio')),[])
    if len(node)!=1:continue
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
# Recuperar llamadas explícitas de la cobertura, con ubicación exacta.
explicit_callsite_links=[]
for row in coverage['filas']:
    ast=row.get('cuerpoAST') or {}
    hits=index.get((row['archivo'],row['linea'],ast.get('inicio')),[])
    if len(hits)!=1:continue
    target=hits[0]
    name=F[target]['name']
    if not name.isidentifier():continue
    for site in row.get('sitiosDeLlamada') or []:
        if not isinstance(site,(tuple,list)) or len(site)<3:continue
        caller,file,line=site[:3]
        if caller not in F or not isinstance(line,int):continue
        fp=Path('baseline')/file
        if not fp.exists():continue
        if file not in src_cache:src_cache[file]=fp.read_text().splitlines()
        if line<1 or line>len(src_cache[file]):continue
        source_line=src_cache[file][line-1]
        expression=re.escape(name)+r'\s*\('
        if not re.search(expression,source_line):continue
        adj[caller][target]=('invocacion_fuente_verificada',file+':'+str(line))
        explicit_callsite_links.append((caller,target,file,line))
print('INVOCACIONES_EXPLICITAS_RECUPERADAS',len(explicit_callsite_links))
# Resolver llamadas directas aún etiquetadas externas por el analizador:
# únicamente nombres globales únicos dentro del mismo archivo.
globals_by_file=collections.defaultdict(list)
for f in F.values():
    if f['parent'] is None:globals_by_file[(f['file'],f['name'])].append(f['id'])
direct_global_links=[]
for f in F.values():
    for call in f.get('calls',[]):
        if call.get('to') in F:continue
        name=call.get('method')
        targets=globals_by_file.get((f['file'],name),[])
        if len(targets)!=1 or not name or not name.isidentifier():continue
        file=f['file'];line=call.get('line')
        if not isinstance(line,int):continue
        if file not in src_cache:
            fp=Path('baseline')/file
            src_cache[file]=fp.read_text().splitlines() if fp.exists() else []
        if not 1<=line<=len(src_cache[file]):continue
        source_line=src_cache[file][line-1]
        if not re.search(r'(?<![.\w])'+re.escape(name)+r'\s*\(',source_line):continue
        adj[f['id']][targets[0]]=('llamada_global_unica_verificada',file+':'+str(line))
        direct_global_links.append((f['id'],targets[0],line))
print('LLAMADAS_GLOBALES_UNICAS_RECUPERADAS',len(direct_global_links))
# Cotejo de las 37 acciones aún no cerradas con el mismo grafo:
# llegar realmente al dueño AST del sitio, no inferir por coincidir
# su nombre ("load", "get", etc.). Conserva todas las brechas.
with zipfile.ZipFile(ROOT/'CADENAS_DEPENDENCIAS_PASO_3.zip') as z:
    action_data=json.loads(z.read('CADENAS_DEPENDENCIAS_PASO_3.json'))
with_existing={x['AUD']:x for x in action_data['acciones']}
pending_actions=list(action_data['rondaCompleta']['pendientes'])
completed_static={'AUD-00013','AUD-00074','AUD-00097','AUD-00098',
                  'AUD-00136','AUD-00154','AUD-00155','AUD-00387'}
assert len(pending_actions)==45 and completed_static.issubset(pending_actions)
pending_actions=[x for x in pending_actions if x not in completed_static]
assert len(pending_actions)==37
sites_by_id=action_data['sitios']
from collections import deque
cross_result=[]
for aud in pending_actions:
    action=with_existing[aud]
    source=(action.get('entrada') or {}).get('entry')
    if source not in F:
        cross_result.append({'AUD':aud,'estado':'sin_raiz_AST',
                             'sitiosPendientes':len(action['dependenciasDelArbolSinCadena'])})
        continue
    visited={source};q=deque([source])
    while q:
        for nxt in adj.get(q.popleft(),{}):
            if nxt not in visited:
                visited.add(nxt);q.append(nxt)
    found=[];missing=[]
    for gap in action['dependenciasDelArbolSinCadena']:
        target=gap['idSitio']
        entry=sites_by_id[target]
        owner=entry.get('funcion')
        item={'idSitio':target,'funcionAST':owner}
        if owner in visited:
            found.append(item)
        else:missing.append(item)
    cross_result.append({'AUD':aud,'estado':'cruce_AST_por_entrada','sitiosPendientes':len(found)+len(missing),
      'sitiosAlcanzablesConCondiciones':len(found),'sinTrayectoResuelto':len(missing),
      'vinculados':found,'noVinculados':missing})
cross_summary={'accionesRestantes':len(cross_result),'sitiosConTrayectoDeFuncion':
    sum(x.get('sitiosAlcanzablesConCondiciones',0) for x in cross_result),
    'sitiosSinTrayectoDeFuncion':sum(x.get('sinTrayectoResuelto',0) for x in cross_result),
    'sinRaiz':sum(x['estado']=='sin_raiz_AST' for x in cross_result),
    'nota':'Propagación de aristas estáticas; no acredita condiciones verdaderas, ejecución real ni consume cuotas.'}
(OUT/'CRUCE_DIRECTO_37_ACCIONES.json').write_text(json.dumps(
    {'resumen':cross_summary,'acciones':cross_result},ensure_ascii=False,indent=2)+'\n')
print('CRUCE_37_ACCIONES_AST',json.dumps(cross_summary,ensure_ascii=False))
print('CRUCE_37_MUESTRAS',json.dumps([{'AUD':x['AUD'],'s':x.get('sitiosAlcanzablesConCondiciones'),
   'f':x.get('sinTrayectoResuelto')} for x in cross_result],ensure_ascii=False)[:3500])

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
# Además de eventos de interfaz hay inicios reales por ejecución de script.
# Son IIFE invocadas al evaluar el módulo, no meras declaraciones.
# Mantener esta categoría SEPARADA de una acción AUD y conservar cada arista.
startup_roots={}
for call in tree['startupCalls']:
    expr=call.get('expression','')
    if not re.search(r'^\s*\(\s*(?:\(\s*\)?\s*=>|function\b)',expr):continue
    candidates=[fid for fid,fn in F.items()
        if fn['file']==call['file'] and fn['line']==call['line']
        and fn['name'].startswith('iife@') and fn['parent'] is None]
    assert len(candidates)==1,(call['file'],call['line'],candidates)
    fid=candidates[0]
    source=(Path('baseline')/call['file']).read_text().splitlines()
    assert (re.search(r'^\s*\(\s*(?:\(\s*\)?\s*=>|function\b)',source[call['line']-1]) or re.search(r'=\s*\(\s*\(\s*\)?\s*=>',source[call['line']-1]) or re.search(r'=\s*\(\s*\(\s*\)?\s*=>\s*\{',source[call['line']-1])),(call['file'],call['line'])
    startup_roots[fid]={'file':call['file'],'line':call['line'],
                         'tipo':'iife_invocada_por_evaluacion_de_script'}
assert len(startup_roots)==58,len(startup_roots)
startup_predecessor={key:None for key in startup_roots}
startup_conditional={}
startup_queue=deque(startup_roots)
while startup_queue:
    current=startup_queue.popleft()
    for child,reason in adj.get(current,{}).items():
        if child in startup_predecessor:continue
        startup_predecessor[child]=(current,reason)
        startup_queue.append(child)
def startup_route(fid):
    route=[fid];conditions=[]
    current=fid
    while startup_predecessor[current] is not None:
        previous,reason=startup_predecessor[current]
        route.append(previous)
        conditions.append(reason[0])
        current=previous
        assert len(route)<110
    route.reverse()
    return {'inicio':startup_roots[current],'cadena':route,
            'aristas':list(reversed(conditions)),
            'condicional':any('condicionado' in k for k in conditions)}
print('INICIOS_SCRIPT_AST',json.dumps({'iife':len(startup_roots),
    'funcionesAlcanzables':len(startup_predecessor)},ensure_ascii=False))

# Raíz real del servidor: Cloudflare invoca fetch por cada solicitud.
# Mantenerla diferenciada de la acción de interfaz: conocer el Worker
# no acredita todavía el enlace cliente -> ruta -> operación concreta.
worker_fetch='worker/worker206.txt:13177:858197:fetch'
assert worker_fetch in F
assert 'var app_main_v35_default = {' in worker_lines[13176-1]
assert 'async fetch(request,env,execution)' in worker_lines[13177-1]
worker_reach={worker_fetch:None}
worker_queue=deque([worker_fetch])
while worker_queue:
    current=worker_queue.popleft()
    for child,edge in adj.get(current,{}).items():
        if child in worker_reach:continue
        worker_reach[child]=(current,edge)
        worker_queue.append(child)
print('WORKER_FETCH_ALCANZABLE',len(worker_reach))
def worker_route(fid):
    route=[fid]
    reasons=[]
    while worker_reach[route[-1]] is not None:
        parent,edge=worker_reach[route[-1]]
        reasons.append(edge[0])
        route.append(parent)
        assert len(route)<150
    return {'inicio':'fetch Cloudflare Worker','cadena':list(reversed(route)),'aristas':list(reversed(reasons))}
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
    elif fid in startup_predecessor:
        record={'idAST':fid,'estado':'cadena_desde_inicio_script_confirmada_estaticamente',
                **startup_route(fid)}
    elif fid in worker_reach:
        record={'idAST':fid,'estado':'cadena_desde_fetch_worker_sin_cliente_asociado',**worker_route(fid)}
    else:
        record={'idAST':fid,'estado':'falta_enlace_a_entrada','activacion':row.get('activacion'),
                'padre':row.get('padre'),'sitiosDeLlamada':row.get('sitiosDeLlamada')}
    records.append(record)
counts=collections.Counter(x['estado'] for x in records)
summary={'revision':coverage['revision'],'catalogo':len(catalog['entries']),
         'funcionesExactas':len(F),'accionesConRaizAST':len(roots),
         'grupoRevisado':1691,'iniciosScriptIIFE':len(startup_roots),'callbacksFuente':callbacks_verified,'resultados':dict(counts),
         'limitacion':'Traza estática a AUD o inicio de script inequívoco, categorías separadas; no prueba ejecución de callbacks ni carga real del módulo.'}
(OUT/'GRAFO_COMPLETO_1691.json').write_text(json.dumps({'resumen':summary,'funciones':records},ensure_ascii=False,indent=2)+'\n')
print('GRAFO_COMPLETO_1691',json.dumps(summary,ensure_ascii=False))
