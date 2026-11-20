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
     'findLastIndex','reduce','reduceRight','sort','then','catch','finally','replace','replaceAll','from'}
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
        if 'from' in valid and not (expression.startswith('Array.from') or expression.startswith('Uint8Array.from')):
            valid=[method for method in valid if method!='from']
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
# Arista explícita de callback por nombre, Array.map(hidratarItem)
# El cuerpo de cargarGuiaSeleccionada contiene data.map(hidratarItem),
# y la definición hidratarItem es local al mismo cuerpo. El analizador
# omite invocaciones al pasar la referencia, ya que no hay paréntesis.
hidratar_parent='plataforma/anunciantes.html:1691:23211:cargarGuiaSeleccionada'
hidratar_child='plataforma/anunciantes.html:2023:42775:hidratarItem'
assert hidratar_parent in F and hidratar_child in F
assert F[hidratar_child]['parent']==hidratar_parent
assert 'const anunciantesData = data.map(hidratarItem);' in (Path('baseline')/'plataforma/anunciantes.html').read_text().splitlines()[2089-1]
adj[hidratar_parent][hidratar_child]=('callback_array_map_referencia_directa','plataforma/anunciantes.html:2089')
print('PASO3_CALLBACK_NOMBRADO',json.dumps({'padre':hidratar_parent,'hijo':hidratar_child,'sitio':'plataforma/anunciantes.html:2089','mecanismo':'Array.map(hidratarItem)'},ensure_ascii=False))

# Evento: callback nominal de Array.filter(matchesInitialAdvertiser)
# Solo vincular si la función de la que sale la referencia pertenece al
# mismo ámbito léxico o a un ámbito hijo de la declaración llamada.
events_named='plataforma/eventos.html:1012:11474:matchesInitialAdvertiser'
assert events_named in F
events_parent=F[events_named]['parent']
event_callers=[x['id'] for x in F.values() if x['file']=='plataforma/eventos.html'
               and x['name']=='procesarEventosResponse']
assert len(event_callers)==1,len(event_callers)
event_caller=event_callers[0]
scope=event_caller;ancestors=set()
while scope in F and scope not in ancestors:
    ancestors.add(scope);scope=F[scope].get('parent')
assert events_parent in ancestors or (events_parent is None and scope is None),(events_parent,event_caller)
assert 'eventosFiltrados = eventosCiudad.filter(matchesInitialAdvertiser);' in (Path('baseline')/'plataforma/eventos.html').read_text().splitlines()[1976-1]
adj[event_caller][events_named]=('callback_array_filter_referencia_directa','plataforma/eventos.html:1976')
print('PASO3_CALLBACK_EVENTOS',json.dumps({'padre':event_caller,'hijo':events_named,'sitio':'plataforma/eventos.html:1976'},ensure_ascii=False))

# Resolver declaraciones locales por ámbito léxico comprobado.
# No enlazar por nombre homónimo entre archivos: el destino debe ser una
# declaración de función única en el ámbito de la función invocadora o uno
# de sus ancestros. Excluir llamadas por propiedad, constructor y casos
# con nombre ambiguo en una misma línea.
local_decl=collections.defaultdict(list)
for fn in F.values():
    name=fn['name'];scope=fn.get('parent')
    if not scope or scope not in F or not name.isidentifier():continue
    file=fn['file']
    if file not in src_cache:
        fp=Path('baseline')/file
        src_cache[file]=fp.read_text().splitlines() if fp.exists() else []
    n=fn.get('line')
    if not isinstance(n,int) or not 1<=n<=len(src_cache[file]):continue
    decl=src_cache[file][n-1]
    if not re.search(r'\b(?:async\s+)?function\s+'+re.escape(name)+r'\s*\(',decl):continue
    local_decl[(file,scope,name)].append(fn['id'])
local_edges=[]
for caller in F.values():
    file=caller['file']
    for call in caller.get('calls',[]):
        if call.get('to') in F:continue
        name=call.get('method');line=call.get('line')
        if not name or not name.isidentifier() or not isinstance(line,int):continue
        if file not in src_cache:src_cache[file]=(Path('baseline')/file).read_text().splitlines()
        if not 1<=line<=len(src_cache[file]):continue
        snippet=src_cache[file][line-1]
        if not re.search(r'(?<![.\w$])'+re.escape(name)+r'\s*\(',snippet):continue
        if re.search(r'(?:\.|\?\.)\s*'+re.escape(name)+r'\s*\(',snippet):continue
        scope=caller['id']
        for _ in range(80):
            choices=local_decl.get((file,scope,name),[])
            if choices:
                if len(choices)==1:
                    target=choices[0]
                    adj[caller['id']][target]=('llamada_lexica_local_comprobada',file+':'+str(line))
                    local_edges.append((caller['id'],target,file,line))
                break
            scope=(F.get(scope) or {}).get('parent')
            if not scope:break
print('PASO3_LLAMADAS_LOCALES_AST',json.dumps({'declaracionesUnicas':sum(len(x)==1 for x in local_decl.values()),
    'enlacesNuevos':len(local_edges),'muestras':local_edges[:15]},ensure_ascii=False))

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

# Puentes concretos entre funciones pasadas como propiedades: no se unen
# por coincidencia genérica de nombres get/json, sólo por receptor y línea.
def exact_function(file,name,line):
    ids=[f['id'] for f in F.values() if f['file']==file and f['name']==name and f['line']==line]
    assert len(ids)==1,(file,name,line,ids)
    return ids[0]
admin_src=(Path('baseline')/'plataforma/administracion.html').read_text().splitlines()
assert 'json:async()=>prefetched' in admin_src[1079-1]
assert 'await r.json()' in admin_src[1082-1]
app_owner=exact_function('plataforma/administracion.html','abrirApp',1077)
prefetched_json=exact_function('plataforma/administracion.html','json',1079)
assert F[prefetched_json]['parent']==app_owner
adj[app_owner][prefetched_json]=('propiedad_json_prefetched_invocada_por_r_condicionada','plataforma/administracion.html:1079,1082')

carcasa_src=(Path('baseline')/'plataforma/carcasa.html').read_text().splitlines()
farma_src=(Path('baseline')/'plataforma/farmacias-ciclo.js').read_text().splitlines()
assert 'src="/plataforma/farmacias-ciclo.js?v=147"' in carcasa_src[3-1]
assert 'farmaCycles=GLDFarmCycle.client(' in carcasa_src[1740-1]
assert 'await farmaCycles.get(city)' in carcasa_src[1837-1]
assert 'root.GLDFarmCycle={turns,client}' in farma_src[41-1]
assert 'async get(city,' in farma_src[25-1]
farm_get=exact_function('plataforma/farmacias-ciclo.js','get',25)
farm_caller=[f['id'] for f in F.values() if f['file']=='plataforma/carcasa.html'
             and any(c.get('line')==1837 and c.get('method')=='get' for c in f.get('calls',[]))]
assert len(farm_caller)==1,farm_caller
adj[farm_caller[0]][farm_get]=('cliente_farmacia_devuelto_y_metodo_get_invocado','plataforma/carcasa.html:1740,1837')
print('PASO3_PUENTES_DE_PROPEDADES_CONFIRMADOS',json.dumps({
    'puentes':[[app_owner,prefetched_json],[farm_caller[0],farm_get]],
    'condicional':True,
    'sin_prueba_de_navegador':True},ensure_ascii=False))

# Métodos del mismo Durable Object: el receptor 'this' dentro de un método
# GldPublicCache119.prototype.* es la instancia de esa clase. El AST no
# siempre resuelve this.otroMetodo, pero la identidad del receptor sí es fija.
actor_by_method={}
for f in F.values():
    if f['file']=='worker/worker206.txt' and f['name'].startswith('GldPublicCache119.prototype.'):
        actor_by_method[f['name'].split('.prototype.',1)[1]]=f['id']
typed_this_links=[]
for f in F.values():
    if f['file']!='worker/worker206.txt' or not f['name'].startswith('GldPublicCache119.prototype.'):continue
    for c in f.get('calls',[]):
        method=c.get('method')
        target=actor_by_method.get(method)
        line=c.get('line')
        if not target or not isinstance(line,int) or not 1<=line<=len(worker_lines):continue
        source=worker_lines[line-1]
        if not re.search(r'\bthis\s*\.\s*'+re.escape(method)+r'\s*\(',source):continue
        if target in adj[f['id']]:continue
        adj[f['id']][target]=('metodo_this_prototype_misma_instancia_comprobado','worker/worker206.txt:'+str(line))
        typed_this_links.append({'de':f['id'],'a':target,'linea':line})
print('PASO3_ACTOR_THIS_TIPADO',json.dumps({'vinculos':len(typed_this_links),
    'ejemplos':typed_this_links[:30],
    'metodo':'receptor exacto this, llamada AST con línea en mismo prototype',
    'condicional':True},ensure_ascii=False))

# Los wrappers de escritura journalDb retornan objetos con métodos de
# persistencia; esos métodos llaman al actor vía un receptor verificado.
# El enlace es POTENCIAL/CONDICIONAL: construir el wrapper no escribe.
guide_wrapper='worker/worker206.txt:12700:'
biz_wrapper='worker/worker206.txt:12911:'
guide_ids=[f['id'] for f in F.values() if f['file']=='worker/worker206.txt' and f['name']=='guideJournalDb132' and f['line']==12700]
biz_ids=[f['id'] for f in F.values() if f['file']=='worker/worker206.txt' and f['name']=='journal' and f['line']==12911]
assert len(guide_ids)==len(biz_ids)==1
guide_target='GldPublicCache119.prototype.beginGuide132'
biz_target='GldPublicCache119.prototype.beginBusiness143'
actor_names={f['name']:f['id'] for f in F.values() if f['file']=='worker/worker206.txt' and f['name'].startswith('GldPublicCache119.prototype.')}
assert guide_target in actor_names and biz_target in actor_names
assert "const begin=entries=>actor.beginGuide132(" in worker_lines[12703-1]
assert "GLD_BUSINESS143.journal(guideJournalDb132(db,env),env)" in worker_lines[13209-1]
assert "actor.beginBusiness143(" in worker_lines[12914-1]
assert "actor.beginBusiness143(" in worker_lines[12915-1]
assert "actor.beginBusiness143(" in worker_lines[12916-1]
assert "key==='__gldBusinessActor143'?this" in worker_lines[13011-1]
assert "key==='__gldGuideActor132'?this" in worker_lines[12788-1]
for from_id,target in [(guide_ids[0],guide_target),(biz_ids[0],biz_target)]:
    adj[from_id][actor_names[target]]=('wrapper_de_escritura_expuesto_con_actor_tipado_condicional','worker/worker206.txt:12703,12914-12916')
print('PASO3_JOURNALS_ACTOR_TIPADOS',json.dumps({
 'wrappers':[guide_ids[0],biz_ids[0]],
 'destinos':[actor_names[guide_target],actor_names[biz_target]],
 'nota':'Métodos retornados invocados únicamente si se realiza operación; no se infiere escritura por la construcción del wrapper'},ensure_ascii=False))

# Resolver receptor local inequívoco para readback de invalidación GH:
# source = createDb(env) (1028), luego source.get/queryEqual (1030,1034).
# Las llamadas sólo se realizan bajo el condicional de invalidación.
source_owner=exact_function('worker/worker206.txt','invalidateGhDetailsFromWrites210',1006)
db_get=exact_function('worker/worker206.txt','get',917)
db_query=exact_function('worker/worker206.txt','queryEqual',980)
assert 'const source=createDb(env);' in worker_lines[1028-1]
assert "source.get('publicidades',pid)" in worker_lines[1030-1]
assert "source.queryEqual('suscriptor_anunciante'" in worker_lines[1034-1]
for target,site in [(db_get,1030),(db_query,1034)]:
    assert F[target]['parent']==exact_function('worker/worker206.txt','createDb',888)
    adj[source_owner][target]=('receptor_source_createDb_contrato_comprobado_condicional','worker/worker206.txt:'+str(site))
print('PASO3_CREATE_DB_RECEPTORES_VERIFICADOS',json.dumps({
    'origen':source_owner,'destinos':[db_get,db_query],
    'llamadasCondicionales':[1030,1034],'sinInferirConsumos':True},ensure_ascii=False))

# KV preparado: cache=createCache(scoped) y accesos explícitos cache.get/put.
# Sólo vincular en el proceso de preparación de paquete diario, no ingreso.
prepared_owner=exact_function('worker/worker206.txt','prepareEntry195',11168)
kv_get=exact_function('worker/worker206.txt','get',1054)
kv_put=exact_function('worker/worker206.txt','put',1063)
assert 'cache=createCache(scoped)' in worker_lines[11169-1]
assert "cache.get('territorio:admin:v1')" in worker_lines[11173-1]
assert "cache.put('territorio:admin:v1'" in worker_lines[11178-1]
assert F[kv_get]['parent']==F[kv_put]['parent']==exact_function('worker/worker206.txt','createCache',1047)
for target,site in [(kv_get,11173),(kv_put,11178)]:
    adj[prepared_owner][target]=('receptor_cache_createCache_en_preparacion_diaria','worker/worker206.txt:'+str(site))
print('PASO3_CREATE_CACHE_RECEPTORES_VERIFICADOS',json.dumps({
    'origen':prepared_owner,'destinos':[kv_get,kv_put],
    'lecturaCondicional':11173,'escrituraSoloAlFaltarPaquete':11178,
    'sinInferirConsumos':True},ensure_ascii=False))

# Contrato de envoltorios compuesto en el fetch principal:
# withPanelCacheV48(withAuthCacheV58(withPrivateCacheV46(...))).
# Los métodos no se activan por crear los envoltorios: las aristas
# representan la delegación condicional al llamarse la operación.
assert 'withPanelCacheV48(withAuthCacheV58(withPrivateCacheV46(' in worker_lines[13208-1]
assert 'return {...db,' in worker_lines[10390-1]
assert 'return {...db,' in worker_lines[10449-1]
assert 'return {' in worker_lines[10095-1]
wrapper_methods=[
 ('get',10410,'get',10473,'get',10114,10410,10473),
 ('patch',10412,'patch',10482,'patch',10134,10417,10482),
 ('delete',10422,'delete',10483,'delete',10158,10424,10483),
 ('commitPatches',10400,'commitPatches',10474,'commitPatches',10116,10402,10480),
 ('queryEqual',10411,None,None,'queryEqual',10115,10411,10115)
]
validated_wrapper=[]
for outer,outer_line,middle,middle_line,inner,inner_line,outer_call,middle_call in wrapper_methods:
    src=exact_function('worker/worker206.txt',outer,outer_line)
    dest=exact_function('worker/worker206.txt',middle,middle_line) if middle else exact_function('worker/worker206.txt',inner,inner_line)
    # Es un método del objeto envuelto. Para los métodos interceptados,
    # comprobar que el cuerpo delega explícitamente a db.metodo.
    if middle:
        assert any('db.'+middle+'(' in worker_lines[i-1] for i in range(outer_line,min(outer_line+15,10436)))
        assert any('db.'+middle+'(' in worker_lines[i-1] for i in range(middle_line,min(middle_line+13,10485)))
    else:
        assert 'db.queryEqual(' in worker_lines[10411-1]
        assert 'async queryEqual(' not in '\n'.join(worker_lines[10449-1:10485])
    adj[src][dest]=('contrato_metodo_retornado_delegado_y_receptor_tipado','worker/worker206.txt:'+str(outer_call))
    validated_wrapper.append([src,dest])
    if middle:
        nested=exact_function('worker/worker206.txt',inner,inner_line)
        adj[dest][nested]=('delegacion_auth_a_privateCache_verificada','worker/worker206.txt:'+str(middle_call))
        validated_wrapper.append([dest,nested])
print('PASO3_WRAPPERS_DB_TIPADOS',json.dumps({'aristas':len(validated_wrapper),'pares':validated_wrapper,'condicion':'sólo si método devuelto se invoca'},ensure_ascii=False))

# Las rutas que guardan Promos se despachan desde fetch con ctx.db
# compuesto; conectar sólo acciones realmente presentes en esa ruta.
promos_route=exact_function('worker/worker206.txt','routeAdminPromosV91',11114)
assert 'const promosAdmin=await routeAdminPromosV91(ctx)' in worker_lines[13232-1]
assert 'db.delete(\'promos\'' in worker_lines[11151-1]
assert 'db.patch(\'promos\'' in worker_lines[11164-1]
for method,line in [('delete',10422),('patch',10412)]:
    adj[promos_route][exact_function('worker/worker206.txt',method,line)]=('ctx_db_compuesto_en_fetch_y_ruta_promos_condicionada','worker/worker206.txt:11151,11164')
print('PASO3_PROMOS_DB_WRAPPER',{ 'enlaces':2,'ruta':'routeAdminPromosV91','guardas':'confirmación, permisos y estado' })

# Vista privada de sólo lectura de los paneles: 'panelReadDb' retorna
# get:panelGet y queryEqual:panelQuery (no escritura). Las rutas invocan
# esos métodos sólo si el readback no viene de otra fuente.
panel_reader=exact_function('worker/worker206.txt','panelReadDb',10408)
panel_get=exact_function('worker/worker206.txt','panelGet',10260)
panel_query=exact_function('worker/worker206.txt','panelQuery',10246)
assert "panelReadDb(scope={}){return {...db,get:(c,id)=>panelGet(c,id,scope),queryEqual:panelQuery};}" in worker_lines[10408-1]
for target in [panel_get,panel_query]:
    adj[panel_reader][target]=('vista_panel_lectura_devuelta_por_metodo_con_destino_exacto','worker/worker206.txt:10408')
for route_name,line,site in [('routePublicationsV77',10890,10895),('routeAdminPromosV91',11114,11148)]:
    route=exact_function('worker/worker206.txt',route_name,line)
    assert 'db.panelReadDb?db.panelReadDb():db' in worker_lines[site-1]
    assert ('routePublicationsV77(ctx)' if route_name=='routePublicationsV77' else 'routeAdminPromosV91(ctx)') in worker_lines[(13235 if route_name=='routePublicationsV77' else 13232)-1]
    adj[route][panel_reader]=('ctx_db_panelread_condicionado_por_ruta','worker/worker206.txt:'+str(site))
print('PASO3_PANEL_READ_DB',json.dumps({'vista':panel_reader,'destinos':[panel_get,panel_query],'rutas':['routePublicationsV77','routeAdminPromosV91'],'solo_lectura':True},ensure_ascii=False))

# Otras operaciones del dispatcher de publicaciones y moderación:
# ctx.db es la pila de wrappers del fetch (13208), y cada ruta aplica
# guardas propias antes de invocar la operación.
publication_route=exact_function('worker/worker206.txt','routePublicationsV77',10890)
assert 'const publications=await routePublicationsV77(ctx)' in worker_lines[13235-1]
assert "db.getVersioned(collection,ref)" in worker_lines[10902-1]
assert "db.patch(collection,ref,patch" in worker_lines[10908-1]
assert "db.get('anunciantes',aid)" in worker_lines[10939-1]
assert "db.patch('solicitudes_anunciante',id" in worker_lines[10941-1]
assert "db.patch('anunciantes',aid" in worker_lines[11019-1]
assert "db.patch('anunciantes_administracion',aid" in worker_lines[11020-1]
publication_links=[]
for method,ln in [('getVersioned',12312),('get',10410),('patch',10412)]:
    target=exact_function('worker/worker206.txt',method,ln)
    adj[publication_route][target]=('ctx_db_compuesto_publicaciones_guardado_por_subruta','worker/worker206.txt:10902-11024')
    publication_links.append(target)
admin_route=exact_function('worker/worker206.txt','routeAdminV10',9405)
assert 'const admin=await routeAdminV11(ctx)' in worker_lines[13243-1]
assert 'superadminLoginV2({ env, db, body })' in worker_lines[9413-1]
assert 'dailyDashboard195(env' in worker_lines[9418-1]
assert 'dailyDashboard195(env,auth)' in worker_lines[9425-1]
# Login/dashboard ya poseen llamadas AST, no asignarles operaciones que
# sólo pertenecen al productor diario. No se crea arista de escritura.
panel_route=exact_function('worker/worker206.txt','routePanelV10',6385)
assert "commerceSetDatosV3({ db, cache" in worker_lines[6414-1]
assert "commerceSetSedesV3({ db, cache" in worker_lines[6421-1]
assert "commerceDeleteSedeV3({ db," in worker_lines[6435-1]
print('PASO3_RUTAS_PUB_DB',json.dumps({'publicaciones':publication_route,
    'metodos_compuestos':publication_links,
    'admin':admin_route,'panel':panel_route,
    'guardas':['/superadmin/publications/blocked','/superadmin/publications/recent','/suscriptores action solicitar_anunciante'],
    'sin_inferir_escrituras':True},ensure_ascii=False))

# Callback nominal de autorización (no es homonimia): verifyAdmin pasa
# verifyAdminUncached138 a GLD_ACTIONS138.authenticate; authenticate recibe
# el parámetro verify y lo llama como verify(env,request), con memoización
# por Request y env. Un hit de la autorización confiable evita la llamada.
assert 'GLD_ACTIONS138.authenticate(env,request2,verifyAdminUncached138)' in worker_lines[1113-1]
assert 'async function authenticate(env,request,verify)' in worker_lines[79-1]
assert 'verify(env,request)' in worker_lines[81-1]
assert 'return {readJson,authenticate,' in worker_lines[294-1]
verify_parent=exact_function('worker/worker206.txt','verifyAdmin',1113)
verify_child=exact_function('worker/worker206.txt','verifyAdminUncached138',1114)
authenticate_owner=exact_function('worker/worker206.txt','authenticate',79)
adj[verify_parent][verify_child]=('callback_autenticacion_nominal_por_GLDACTIONS138_condicionado','worker/worker206.txt:79,81,1113')
print('PASO3_AUTH_CALLBACK_VERIFICADO',json.dumps({'desde':verify_parent,'hacia':verify_child,
 'intermediario':authenticate_owner,'cache':'Promise por request/env','condicional':True},ensure_ascii=False))

# Despacho transversal de rutas independientes al MISMO ctx.db compuesto,
# con chequeo de invocación en cada rama y comprobación del dispatcher.
# No equivale a ejecutar todas las rutas ni a duplicar lecturas/escrituras.
ROUTE_DB_CONTRACT=[
 ('routeDirectories102',360,13229,[
    ('get',10410,408),('getVersioned',922,436),('commitPatches',10400,444),('queryEqual',10411,417)]),
 ('routeAdminPublicityV101',482,13231,[
    ('listCollection',968,491),('getVersioned',922,510),('queryEqual',10411,545),('commitPatches',10400,559)]),
 ('routeSupportV73',10632,13237,[
    ('get',10410,10651),('patch',10412,10656),('queryEqual',10411,10668)]),
 ('routeModeratorsV72',10690,13242,[
    ('get',10410,10757),('queryEqual',10411,10758),('getVersioned',922,10762),('patch',10412,10737),('delete',10422,10716)]),
 ('routeEmpleo109',11587,13228,[
    ('getVersioned',922,11598),('commitPatches',10400,11605),('get',10410,11612)]),
 ('routePanelV15',7203,13240,[
    ('queryEqual',10411,7232),('get',10410,7254),('patch',10412,7264)])
]
route_db_edges=[]
for route_name,route_line,entry_line,methods in ROUTE_DB_CONTRACT:
    route=exact_function('worker/worker206.txt',route_name,route_line)
    assert 'await '+route_name+'(ctx)' in worker_lines[entry_line-1],(route_name,entry_line)
    for method,target_line,call_line in methods:
        target=exact_function('worker/worker206.txt',method,target_line)
        source=worker_lines[call_line-1]
        assert re.search(r'\b(?:db|read)\.'+re.escape(method)+r'\s*\(',source),(route_name,method,call_line,source)
        # 'read' is the optional panelReadDb view; the method name and
        # contract are still part of the same typed ctx.db composition.
        adj[route][target]=('ctx_db_compuesto_guardado_por_ruta_y_metodo','worker/worker206.txt:'+str(call_line))
        route_db_edges.append({'ruta':route_name,'operacion':method,'linea':call_line,'destino':target})
print('PASO3_OTRAS_RUTAS_DB',json.dumps({'rutas':len(ROUTE_DB_CONTRACT),
 'operaciones_condicionales':len(route_db_edges),
 'evidencia':route_db_edges,'lecturas_escrituras_reales_no_medidas':True},ensure_ascii=False))
# Login: contrato exacto del callback buildRelations161 y del método
# retornado por withPrivateCacheV46, conservado por los wrappers externos.
# En cache hit el callback NO se ejecuta ni consulta las relaciones.
assert 'const buildRelations161=async()=>{' in worker_lines[5624-1]
assert 'db.loginAuthorizationBundle161(sid,Number(state.version||0),buildRelations161)' in worker_lines[5647-1]
assert 'async loginAuthorizationBundle161(sid,sv,build)' in worker_lines[10098-1]
assert 'const relations=await build();' in worker_lines[10104-1]
login_caller=exact_function('worker/worker206.txt','subscriberLoginV2',5607)
login_bundle=exact_function('worker/worker206.txt','loginAuthorizationBundle161',10098)
login_builder=exact_function('worker/worker206.txt','buildRelations161',5624)
assert F[login_builder]['parent']==login_caller
assert F[login_bundle]['parent']==exact_function('worker/worker206.txt','withPrivateCacheV46',9953)
adj[login_caller][login_bundle]=('metodo_bundle_login_con_receptor_tipado','worker/worker206.txt:5647,10098')
adj[login_bundle][login_builder]=('callback_build_condicionado_a_cache_miss','worker/worker206.txt:5647,10104')
# Dentro del callback de cache miss, las relaciones se leen por el
# método concreto y cada relación se enriquece mediante Array.map.
assert 'db.loginRelations?db.loginRelations(sid)' in worker_lines[5625-1]
assert 'relations.map(async rel=>' in worker_lines[5628-1]
assert 'db.loginAdvertiser?db.loginAdvertiser("anunciantes",aid)' in worker_lines[5631-1]
assert 'db.loginAdvertiser?db.loginAdvertiser("anunciantes_administracion",aid)' in worker_lines[5632-1]
login_relations=exact_function('worker/worker206.txt','loginRelations',10183)
login_advertiser=exact_function('worker/worker206.txt','loginAdvertiser',10196)
login_map=[f['id'] for f in F.values() if f['file']=='worker/worker206.txt' and
           f['line']==5628 and f['parent']==login_builder and f['name'].startswith('callback@')]
assert len(login_map)==1,login_map
adj[login_builder][login_relations]=('relaciones_login_si_bundle_sin_cache','worker/worker206.txt:5625,10183')
adj[login_builder][login_map[0]]=('callback_array_map_relaciones_login_condicionado','worker/worker206.txt:5628')
adj[login_map[0]][login_advertiser]=('lectura_advertiser_login_condicionada_por_relacion','worker/worker206.txt:5631,5632,10196')
print('BUNDLE_LOGIN_CALLBACK_COTEJADO',5)

# Segundo bloque: métodos concretos de DB compuesto, sólo en llamadas
# con receptor db explícito y parámetros recibidos por las rutinas listadas.
# Cada rama es condicional; no se cuenta como petición efectivamente realizada.
PRIVATE_DB_CALLS=[
 ('listFavoritesV2',5282,'subscriberFavorites',10175,5287,'db.subscriberFavorites?db.subscriberFavorites('),
 ('subscriberDetailV2',5163,'subscriberRelations',10184,5167,'db.subscriberRelations(sid)'),
 ('ensureGuideBaseFromPrivateInternal',4862,'panelAdministration',10190,4866,'db.panelAdministration?db.panelAdministration('),
 ('commerceMaster205',6132,'commerceMasterRead209',10391,6134,'db.commerceMasterRead209(advertiserId)'),
 ('GldPublicCache119.prototype.repairGuide132',12756,'repairPrivateGuide132',10110,12770,'db.repairPrivateGuide132(')
]
private_db_edges=[]
for owner_name,owner_line,method,method_line,site,needle in PRIVATE_DB_CALLS:
    owner=exact_function('worker/worker206.txt',owner_name,owner_line)
    target=exact_function('worker/worker206.txt',method,method_line)
    assert needle in worker_lines[site-1],(owner_name,site)
    assert F[target]['parent'] in (
        exact_function('worker/worker206.txt','withPrivateCacheV46',9953),
        exact_function('worker/worker206.txt','withPanelCacheV48',10227))
    adj[owner][target]=('metodo_db_compuesto_con_receptor_db_condicionado','worker/worker206.txt:'+str(site))
    private_db_edges.append((owner_name,method,site))
print('PRIVATE_DB_METODOS_VERIFICADOS',json.dumps(private_db_edges))

# Tercer bloque: autenticación (ambas interfaces), lectura del perfil,
# soporte y reparación de la guía. Mismo objeto ctx.db y guardas explícitas.
AUTH_PANEL_DB_CALLS=[
 ('subscriberLoginV2',5607,'loginAccount',10450,5612,'db.loginAccount(mail,clave,originalMail)'),
 ('superadminLoginV2',9336,'loginAccount',10450,9341,'db.loginAccount(mail,clave,original)'),
 ('superadminLoginV2',9336,'loginAdminBundle',10460,9348,'db.loginAdminBundle(sid)'),
 ('subscriberDetailV2',5163,'cachedSubscriberProjection',10472,5166,'db.cachedSubscriberProjection(sid)'),
 ('routeSupportV73',10632,'prepareNewPanelList',10407,10657,'db.prepareNewPanelList('),
 ('routeSupportV73',10632,'rememberPanelRows',10406,10681,'db.rememberPanelRows('),
 ('GldPublicCache119.prototype.repairGuide132',12756,'repairPanelGuide132',10393,12771,'db.repairPanelGuide132('),
 ('prepareEntry195',11168,'cachedPanelRows',10399,11187,'db.cachedPanelRows(')
]
auth_panel_db_edges=[]
for owner_name,owner_line,method,method_line,site,needle in AUTH_PANEL_DB_CALLS:
    owner=exact_function('worker/worker206.txt',owner_name,owner_line)
    target=exact_function('worker/worker206.txt',method,method_line)
    assert needle in worker_lines[site-1],(owner_name,site)
    assert F[target]['parent'] in (
        exact_function('worker/worker206.txt','withAuthCacheV58',10436),
        exact_function('worker/worker206.txt','withPanelCacheV48',10227))
    adj[owner][target]=('ctx_db_tipado_con_guarda_y_receptor','worker/worker206.txt:'+str(site))
    auth_panel_db_edges.append((owner_name,method,site))
print('AUTH_PANEL_DB_METODOS_VERIFICADOS',json.dumps(auth_panel_db_edges))

# Paso 3, continuación: métodos concretos de los paneles y relaciones
# preparadas. Distinguir los destinos reales del objeto db de otras
# propiedades homónimas; estas aristas no significan operaciones cobradas.
PANEL_MORE_TYPED_CALLS=[
 ('eventDuplicateCheckV75',3412,'cachedPanelRows',10399,3415,'db.cachedPanelRows(\'eventos\''),
 ('advertiserUsageV62',5120,'cachedPanelRows',10399,5123,'db.cachedPanelRows(c,'),
 ('deleteEventV3',3717,'rememberPanelRows',10406,3725,'db.rememberPanelRows(\'evento_programacion\''),
 ('patchChildRowsV1',6494,'rememberPanelRows',10406,6495,'db.rememberPanelRows(collection,previous)'),
 ('routePublicationsV77',10890,'rememberPanelRows',10406,11024,'db.rememberPanelRows(\'anunciantes\''),
 ('routePublicationsV77',10890,'prepareNewPanelList',10407,11017,'db.prepareNewPanelList(\'anunciantes_sedes\''),
]
panel_more_edges=[]
for caller,caller_line,method,method_line,site,needle in PANEL_MORE_TYPED_CALLS:
    source=exact_function('worker/worker206.txt',caller,caller_line)
    dest=exact_function('worker/worker206.txt',method,method_line)
    assert needle in worker_lines[site-1],(caller,method,site)
    assert F[dest]['parent']==exact_function('worker/worker206.txt','withPanelCacheV48',10227)
    adj[source][dest]=('panel_db_method_call_with_guard','worker/worker206.txt:'+str(site))
    panel_more_edges.append((caller,method,site))
print('PANEL_MORE_TYPED_CALLS_VERIFIED',json.dumps(panel_more_edges))

# El listado paginado del directorio usa el método listPage102 del
# createDb nativo. Los wrappers con spread no lo reemplazan.
dir_owner=exact_function('worker/worker206.txt','routeDirectories102',360)
dir_list_page=exact_function('worker/worker206.txt','listPage102',963)
assert 'db.listPage102(DIRECTORY102[kind],progress.pageToken)' in worker_lines[372-1]
assert F[dir_list_page]['parent']==exact_function('worker/worker206.txt','createDb',888)
assert 'withPanelCacheV48(withAuthCacheV58(withPrivateCacheV46(' in worker_lines[13208-1]
adj[dir_owner][dir_list_page]=('listado_paginado_directorio_con_receptor_db_nativo','worker/worker206.txt:372')
print('DIRECTORY_LISTPAGE102_VERIFIED',1)

# Cache KV retornada por createCache(env) en fetch: enlaces a del.
# delete ocurre sólo en las ramas de finalización/invalidación indicadas.
assert 'const cache=createCache(env)' in worker_lines[13210-1]
cache_del=exact_function('worker/worker206.txt','del',1066)
assert F[cache_del]['parent']==exact_function('worker/worker206.txt','createCache',1047)
cache_del_links=[]
for name,origin,site,needle in [
 ('routeAdminPromosV91',11114,11135,'await cache.del(key)'),
 ('routeEmpleo109',11587,11562,'await cache.del(key)')
]:
    # Verificar que el punto realmente pertenece al ámbito de la función
    # antes de afirmar una conexión del router.
    if site<origin:continue
    assert needle in worker_lines[site-1]
    source=exact_function('worker/worker206.txt',name,origin)
    adj[source][cache_del]=('cache_createCache_del_con_guarda','worker/worker206.txt:'+str(site))
    cache_del_links.append((name,site))
assert cache_del_links==[('routeAdminPromosV91',11135)]
print('CREATECACHE_DEL_TYPED',json.dumps(cache_del_links))

# Contrato del Durable Object: transactionSync(fn) ejecuta el
# callback recibido sincrónicamente dentro de la transacción SQLite.
# Cada callback está definido en el mismo ámbito del invocador.
TX_CALLBACKS=[
 ('directory',8953,8957,'this.state.storage.transactionSync(()=>'),
 ('recover',8970,8977,'this.state.storage.transactionSync(()=>'),
 ('cityBookShared',11803,11815,'this.state.storage.transactionSync(()=>'),
 ('cityBookShared',11803,11827,'this.state.storage.transactionSync(()=>'),
 ('read',11865,11870,'this.state.storage.transactionSync(()=>'),
 ('read',11865,11894,'this.state.storage.transactionSync(()=>'),
 ('GldPublicCache119.prototype.moduleSnapshot125',12370,12406,'this.state.storage.transactionSync(()=>')
]
tx_added=[]
for parent_name,parent_line,site,needle in TX_CALLBACKS:
    parent=exact_function('worker/worker206.txt',parent_name,parent_line)
    source=worker_lines[site-1]
    assert needle in source,(parent_name,site,source)
    targets=[f['id'] for f in F.values() if f['file']=='worker/worker206.txt'
             and f['line']==site and f['parent']==parent
             and f['name'].startswith('callback@')]
    assert len(targets)==1,(parent_name,site,targets)
    adj[parent][targets[0]]=('callback_storage_transactionSync_condicionado','worker/worker206.txt:'+str(site))
    tx_added.append((parent_name,site))
print('TX_CALLBACKS_CONTRATO_VERIFICADO',json.dumps(tx_added))

# Trazado de receptor interno del wrapper privado a requestDb119:
# createDb -> observeDbV41 -> roleSourceDb192 -> requestDb119
# -> withPrivateCacheV46, según el ensamblaje fijo en fetch:13208.
# RequestDb119 intercepta los cinco métodos, no se llega directamente
# al createDb original cuando se invocan desde el wrapper privado.
assert 'withPrivateCacheV46(requestDb119(roleSourceDb192(observeDbV41(createDb(env),report),env),report),env)' in worker_lines[13208-1]
DB_PRIVATE_REQUEST=[
 ('get',10114,'get',12311,10114,'db.get(collection,id)'),
 ('queryEqual',10115,'queryEqual',12313,10115,'db.queryEqual(...args)'),
 ('commitPatches',10116,'commitPatches',12316,10127,'db.commitPatches(entries)'),
 ('patch',10134,'patch',12314,10148,'db.patch(collection,id,patch,options)'),
 ('delete',10158,'delete',12315,10167,'db.delete(collection,id,options)')
]
db_private_links=[]
for p_name,p_line,inner_name,inner_line,site,needle in DB_PRIVATE_REQUEST:
    source=exact_function('worker/worker206.txt',p_name,p_line)
    target=exact_function('worker/worker206.txt',inner_name,inner_line)
    assert needle in worker_lines[site-1],(p_name,site)
    assert F[source]['parent']==exact_function('worker/worker206.txt','withPrivateCacheV46',9953)
    assert F[target]['parent']==exact_function('worker/worker206.txt','requestDb119',12296)
    adj[source][target]=('delegacion_private_a_requestDb119_con_receptor_verificado','worker/worker206.txt:'+str(site))
    db_private_links.append((p_name,site,inner_line))
print('REQUESTDB119_WRAPPER_LINKS_VERIFIED',json.dumps(db_private_links))

# Segunda capa debajo de requestDb119: roleSourceDb192 despacha
# solamente colecciones privadas al actor; el resto sigue hacia observeDbV41.
assert 'requestDb119(roleSourceDb192(observeDbV41(createDb(env),report),env),report)' in worker_lines[13208-1]
ROLE_REQUEST_DB_EDGES=[
 ('patch',12314,'patch',9036,12314,'db.patch(c,id,patch,options)'),
 ('delete',12315,'delete',9037,12315,'db.delete(c,id,options)'),
 ('commitPatches',12316,'commitPatches',9038,12316,'db.commitPatches(entries)')
]
role_request_edges=[]
for outer,outer_line,inner,inner_line,site,needle in ROLE_REQUEST_DB_EDGES:
    source=exact_function('worker/worker206.txt',outer,outer_line)
    dest=exact_function('worker/worker206.txt',inner,inner_line)
    assert needle in worker_lines[site-1]
    assert 'ROLE_SOURCE192.has' in worker_lines[inner_line-1]
    assert F[source]['parent']==exact_function('worker/worker206.txt','requestDb119',12296)
    assert F[dest]['parent']==exact_function('worker/worker206.txt','roleSourceDb192',9035)
    adj[source][dest]=('requestDb119_a_roleSourceDb192_condicionada_por_coleccion','worker/worker206.txt:'+str(site))
    role_request_edges.append((outer,site,inner_line))
print('ROLE_SOURCE_WRAPPER_LINKS_VERIFIED',json.dumps(role_request_edges))

# roleSourceDb192 intercepta escrituras de roles; para cualquier
# colección no privada delega a observeDbV41(db,report). ObserveDbV41
# construye observed[operation] en el bucle y reemplaza commitPatches
# por su observador específico, verificando el método real del receptor.
assert 'roleSourceDb192(observeDbV41(createDb(env),report),env)' in worker_lines[13208-1]
assert 'for (const operation of Object.keys(db))' in worker_lines[9847-1]
assert 'observed[operation] = async (...args) =>' in worker_lines[9848-1]
assert 'observed.commitPatches=async entries=>' in worker_lines[9869-1]
observed_general=exact_function('worker/worker206.txt','observed[operation]',9848)
observed_commit=exact_function('worker/worker206.txt','observed.commitPatches',9869)
assert F[observed_general]['parent']==F[observed_commit]['parent']==exact_function('worker/worker206.txt','observeDbV41',9845)
for operation,site,needle,target in [
 ('patch',9036,'db.patch(c,id,patch,options)',observed_general),
 ('delete',9037,'db.delete(c,id,options)',observed_general),
 ('commitPatches',9038,'db.commitPatches(entries)',observed_commit)
]:
    src=exact_function('worker/worker206.txt',operation,site)
    assert needle in worker_lines[site-1]
    assert 'ROLE_SOURCE192.has' in worker_lines[site-1]
    adj[src][target]=('role_source_a_observador_en_rama_no_privada','worker/worker206.txt:'+str(site))
print('ROLE_TO_OBSERVE_WRAPPER_LINKS_VERIFIED',3)

# La capa observeDbV41 tiene despacho dinámico, pero acotado:
# for (operation of Object.keys(db)), where db=createDb(env). Cada
# operación expuesta se invoca como db[operation](...args).
# Se enlaza a cada propiedad exacta, no a funciones de otros ámbitos.
assert 'for (const operation of Object.keys(db))' in worker_lines[9847-1]
assert 'const result = await db[operation](...args)' in worker_lines[9856-1]
assert 'observeDbV41(createDb(env),report)' in worker_lines[13208-1]
obs_dispatch=exact_function('worker/worker206.txt','observed[operation]',9848)
native_db=exact_function('worker/worker206.txt','createDb',888)
OBS_NATIVE_OPERATIONS=[
 ('get',917),('getVersioned',922),('patch',927),('delete',944),
 ('listPage102',963),('listCollection',968),('queryEqual',980)
]
obs_native_pairs=[]
for method,line in OBS_NATIVE_OPERATIONS:
    target=exact_function('worker/worker206.txt',method,line)
    assert F[target]['parent']==native_db
    adj[obs_dispatch][target]=('observador_operacion_tipado_por_clave','worker/worker206.txt:9847-9856')
    obs_native_pairs.append((method,line))
commit_native=exact_function('worker/worker206.txt','commitPatches',901)
obs_commit=exact_function('worker/worker206.txt','observed.commitPatches',9869)
assert 'db.commitPatches(entries)' in worker_lines[9871-1]
assert F[commit_native]['parent']==native_db
adj[obs_commit][commit_native]=('observador_commitPatches_especifico','worker/worker206.txt:9871')
print('OBSERVE_NATIVE_METHODS_VERIFIED',json.dumps(obs_native_pairs+ [('commitPatches',901)]))

# requestDb119 contiene helpers por solicitud que sí son
# invocados por los métodos retornados. No son llamadas de red nuevas:
# epoch/invalidate/once/remember administran el caché en memoria.
REQUEST_HELPER_EDGES=[
 ('get',12311,'once',12301,12311,'once(c,'),
 ('queryEqual',12313,'once',12301,12313,'once(c,'),
 ('getVersioned',12312,'once',12301,12312,'once(c,'),
 ('getVersioned',12312,'epoch',12299,12312,'epoch(c)'),
 ('getVersioned',12312,'remember',12309,12312,'remember(c,id,value.doc)'),
 ('patch',12314,'invalidate',12300,12314,'invalidate(c)'),
 ('patch',12314,'epoch',12299,12314,'epoch(c)'),
 ('patch',12314,'remember',12309,12314,'remember(c,id,row)'),
 ('delete',12315,'invalidate',12300,12315,'invalidate(c)'),
 ('delete',12315,'epoch',12299,12315,'epoch(c)'),
 ('delete',12315,'remember',12309,12315,'remember(c,id,null)'),
 ('commitPatches',12316,'invalidate',12300,12316,'invalidate(c)'),
 ('commitPatches',12316,'epoch',12299,12316,'epoch(c)'),
 ('commitPatches',12316,'remember',12309,12316,'remember(e.collection,e.id,result[i])'),
 ('once',12301,'epoch',12299,12304,'epoch(c)'),
 ('invalidate',12300,'epoch',12299,12300,'epoch(c)')
]
request_helpers=[]
parent=exact_function('worker/worker206.txt','requestDb119',12296)
for owner,owner_line,helper,helper_line,site,needle in REQUEST_HELPER_EDGES:
    src=exact_function('worker/worker206.txt',owner,owner_line)
    dst=exact_function('worker/worker206.txt',helper,helper_line)
    assert F[src]['parent']==parent and F[dst]['parent']==parent
    assert needle in worker_lines[site-1],(owner,helper,site)
    adj[src][dst]=('request_cache_helper_invocado_en_rama_especifica','worker/worker206.txt:'+str(site))
    request_helpers.append((owner,helper,site))
print('REQUESTDB119_HELPERS_VERIFIED',json.dumps(request_helpers))

# Vaciado al salir de fetch y encadenamiento de los dos niveles
# de caché privada/panel. Los métodos flushLoginCache son exportaciones
# del mismo db compuesto (no escrituras implícitas al crearlo).
assert 'const traced=async' in worker_lines[13182-1]
assert 'await db.flushLoginCache()' in worker_lines[13183-1]
assert 'flushLoginCache:flush' in worker_lines[10409-1]
assert 'flushLoginCache:flush' in worker_lines[10097-1]
assert 'if(db.flushLoginCache)await db.flushLoginCache()' in worker_lines[10337-1]
tracer=exact_function('worker/worker206.txt','traced',13182)
panel_flush=exact_function('worker/worker206.txt','flush',10317)
private_flush=exact_function('worker/worker206.txt','flush',10029)
assert F[panel_flush]['parent']==exact_function('worker/worker206.txt','withPanelCacheV48',10227)
assert F[private_flush]['parent']==exact_function('worker/worker206.txt','withPrivateCacheV46',9953)
adj[tracer][panel_flush]=('salida_fetch_flushLoginCache_tipado','worker/worker206.txt:13183')
adj[panel_flush][private_flush]=('flush_panel_delega_flush_private','worker/worker206.txt:10337')
event_duplicate=exact_function('worker/worker206.txt','eventDuplicateCheckV75',3412)
panel_note=exact_function('worker/worker206.txt','notePanelCacheCheck',10398)
assert 'db.notePanelCacheCheck?.(' in worker_lines[3417-1]
assert F[panel_note]['parent']==exact_function('worker/worker206.txt','withPanelCacheV48',10227)
adj[event_duplicate][panel_note]=('marca_memoria_duplicados_si_coincidencia','worker/worker206.txt:3417')
print('PANEL_FLUSH_AND_NOTE_VERIFIED',3)

# La rama de propietarios que vive DENTRO de app_main_v35_default.fetch
# utiliza el método panelAdministration del db compuesto, no createDb.
# Esta lectura es sólo potencial en la rama de gestión de relaciones.
fetch_entry=exact_function('worker/worker206.txt','fetch',13177)
private_panel_admin=exact_function('worker/worker206.txt','panelAdministration',10190)
assert 'db.panelAdministration?db.panelAdministration(aid)' in worker_lines[13278-1]
assert 'withPanelCacheV48(withAuthCacheV58(withPrivateCacheV46(' in worker_lines[13208-1]
assert F[private_panel_admin]['parent']==exact_function('worker/worker206.txt','withPrivateCacheV46',9953)
adj[fetch_entry][private_panel_admin]=('lectura_admin_relaciones_condicional','worker/worker206.txt:13278')
print('FETCH_OWNER_PANEL_ADMIN_VERIFIED',1)

# routeModeratorsV72 usa read=db.panelReadDb() y la vista
# panelReadDb conserva via spread cachedAdminSettings126 de withAuthCacheV58.
# El GET de moderadores lo invoca sólo tras autenticar superadministrador.
assert 'const read=db.panelReadDb?db.panelReadDb():db;' in worker_lines[10700-1]
assert 'if(read.cachedAdminSettings126)row=await read.cachedAdminSettings126(sid)' in worker_lines[10702-1]
assert 'panelReadDb(scope={}){return {...db,get:' in worker_lines[10408-1]
assert 'async cachedAdminSettings126(id)' in worker_lines[10453-1]
moderators_route=exact_function('worker/worker206.txt','routeModeratorsV72',10690)
auth_admin_settings=exact_function('worker/worker206.txt','cachedAdminSettings126',10453)
assert F[auth_admin_settings]['parent']==exact_function('worker/worker206.txt','withAuthCacheV58',10436)
adj[moderators_route][auth_admin_settings]=('panelReadDb_spread_hereda_cache_admin','worker/worker206.txt:10702')
print('MODERATOR_AUTH_CACHE_READ_VERIFIED',1)

# El preprocesador de publicaciones (13221) reemplaza ctx.db por
# publicationDbV77(...) exclusivamente en POST permitido; el router de
# publicaciones posterior recibe ese mismo ctx y llama a db.get/patch.
# No activar este wrapper para GET ni rutas interceptadas antes del 13221.
assert 'await preparePublicationV77(ctx)' in worker_lines[13221-1]
assert 'ctx.db=publicationDbV77(ctx.db,ctx.publication,ctx.cache)' in worker_lines[10849-1]
assert 'const publications=await routePublicationsV77(ctx)' in worker_lines[13235-1]
assert 'return wrap(base)' in worker_lines[10831-1]
publish_route=exact_function('worker/worker206.txt','routePublicationsV77',10890)
publication_owner=exact_function('worker/worker206.txt','publicationDbV77',10809)
publication_wrapper_pairs=[]
for method,ln,site,needle in [
 ('get',10811,10939,"db.get('anunciantes',aid)"),
 ('patch',10813,11019,"db.patch('anunciantes',aid")
]:
    assert needle in worker_lines[site-1]
    dest=exact_function('worker/worker206.txt',method,ln)
    assert F[dest]['parent']==exact_function('worker/worker206.txt','wrap',10810)
    adj[publish_route][dest]=('post_preprocesado_db_publicacion_condicional','worker/worker206.txt:'+str(site))
    publication_wrapper_pairs.append((method,ln,site))
print('PUBLICATION_WRAPPER_POST_VERIFIED',json.dumps(publication_wrapper_pairs))

# rolesRead192 crea una vista de lectura con métodos propios.
# gldRolesGuardarConjunto191 obtiene precisamente esa vista en 9091;
# las consultas subsiguientes usan read.get/read.queryEqual de su retorno.
assert 'read=await rolesRead192(ctx,sid)' in worker_lines[9091-1]
assert "read.get('superadmins',sid)" in worker_lines[9093-1]
assert "read.queryEqual('superadmins','suscriptor_id',sid,5)" in worker_lines[9097-1]
assert 'return {...base,' in worker_lines[9044-1]
roles_owner=exact_function('worker/worker206.txt','rolesRead192',9040)
roles_save=exact_function('worker/worker206.txt','gldRolesGuardarConjunto191',9082)
role_view_pairs=[]
for method,line,site in [('get',9045,9093),('queryEqual',9051,9097)]:
    dest=exact_function('worker/worker206.txt',method,line)
    assert F[dest]['parent']==roles_owner
    adj[roles_save][dest]=('metodo_vista_rolesRead192_con_receptor_read','worker/worker206.txt:'+str(site))
    role_view_pairs.append((method,line,site))
print('ROLES_VIEW_METHODS_VERIFIED',json.dumps(role_view_pairs))

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

# Diagnóstico transversal de las 583 funciones sin enlace de entrada
missing_records=[r for r in records if r['estado']=='falta_enlace_a_entrada']
# Censo de referencias a funciones nominales como callback de colecciones
# Inspección: no agregar aristas hasta cotejar dueño AST, método y ámbito.
nominal_candidates=[]
for rec in missing_records:
    fn=F[rec['idAST']]
    name=fn['name']
    if not name.isidentifier() or name.startswith('callback@'):continue
    file=fn['file']
    if file not in src_cache:src_cache[file]=(Path('baseline')/file).read_text().splitlines()
    lines=src_cache[file]
    for n,line in enumerate(lines,1):
        if n==fn['line'] or name not in line:continue
        for method in ('map','filter','flatMap','forEach','some','every','find','sort','then','catch','finally'):
            if re.search(r'\\.\\s*'+method+r'\\s*\\(\\s*'+re.escape(name)+r'\\s*\\)',line):
                owners=[x['id'] for x in F.values() if x['file']==file and any(c.get('line')==n and c.get('method')==method for c in x.get('calls',[]))]
                if owners:
                    nominal_candidates.append({'idAST':fn['id'],'archivo':file,'linea':n,'metodo':method,
                         'invocadoresAST':owners[:10],'declaracion':fn['line']})
print('PASO3_CALLBACKS_NOMINALES_CANDIDATOS',json.dumps({
 'cantidad':len(nominal_candidates),
 'sinEntradaActual':len(missing_records),
 'filas':nominal_candidates[:80]},ensure_ascii=False))


assert len(missing_records)<=583,len(missing_records)
reverse=collections.defaultdict(set)
for source,targets in adj.items():
    for target in targets:
        if target in F:reverse[target].add(source)
reached=set(seen)|set(startup_predecessor)|set(worker_reach)
missing_groups=collections.defaultdict(list)
for rec in missing_records:
    fid=rec['idAST'];fn=F[fid];parent=fn.get('parent');ins=reverse.get(fid,set())
    if parent in reached:
        reason='padre_con_entrada_sin_callback_comprobado'
    elif ins:
        reason='invocadores_locales_sin_entrada'
    elif parent and parent in F:
        reason='anidada_en_cierre_sin_entrada'
    elif parent:
        reason='padre_sin_identidad_ast'
    else:
        reason='global_sin_invocador_comprobado'
    missing_groups[reason].append((rec,fn,len(ins)))
assert sum(map(len,missing_groups.values()))==len(missing_records)
print('PASO3_583_CAUSAS',json.dumps({'total':len(missing_records),'grupoOriginal':583,'porCausa':{k:len(v) for k,v in missing_groups.items()},'porArchivo':dict(collections.Counter(F[r['idAST']]['file'] for r in missing_records)),'muestras':{k:[{'id':x['idAST'],'line':fn.get('line'),'activacion':(x.get('activacion') or {}).get('tipo'),'invocadoresAST':degree} for x,fn,degree in v[:12]] for k,v in missing_groups.items()}},ensure_ascii=False))

# Censo conservador de declaraciones locales sin referencias textuales
# Sólo es candidato a código no utilizado si la declaración es local a un
# ámbito léxico AST existente y el nombre no vuelve a aparecer en el archivo.
unused_local=[]
source_by_file={}
for rec in missing_records:
    fn=F[rec['idAST']];name=fn['name'];file=fn['file'];parent=fn.get('parent')
    if not name.isidentifier() or parent not in F:continue
    if (rec.get('activacion') or {}).get('tipo')!='declaracion_local':continue
    if file not in source_by_file:source_by_file[file]=(Path('baseline')/file).read_text()
    src=source_by_file[file];lines=src.splitlines();line=fn['line']
    if not (1<=line<=len(lines)):continue
    declaration=lines[line-1]
    if not re.search(r'\bfunction\s+'+re.escape(name)+r'\b',declaration):continue
    uses=list(re.finditer(r'\b'+re.escape(name)+r'\b',src))
    if len(uses)!=1:continue
    unused_local.append({'idAST':rec['idAST'],'file':file,'line':line,'name':name,'parent':parent,'referenciasEnArchivo':1})
print('PASO3_583_DECLARACIONES_SIN_REFERENCIA',json.dumps({'grupoOriginal':583,'sinEntradaActual':len(missing_records),'declaracionesLocalesSinReferencia':len(unused_local),'porArchivo':dict(collections.Counter(x['file'] for x in unused_local)),'muestras':unused_local[:25],'limitacion':'Sólo ausencia de referencias léxicas en archivo y ámbito local; no se atribuye automáticamente a error de producción ni a ahorro de consumo.'},ensure_ascii=False))

# Mantener la evidencia de excepciones en el mismo resultado del grafo.
# No se borran las 583 entradas originales ni se supone que toda función
# sin enlace sea un defecto. Se separan sólo 16 declaraciones locales
# cuya única referencia léxica en el archivo es su propia declaración.
gpath=OUT/'GRAFO_COMPLETO_1691.json'
gdata=json.loads(gpath.read_text())
verified_unreferenced={x['idAST'] for x in unused_local}
assert verified_unreferenced.issubset({r['idAST'] for r in missing_records})
for row in gdata['funciones']:
    if row['idAST'] in verified_unreferenced:
        row['evaluacionFuente']='declaracion_local_sin_referencia_fuera_de_su_definicion'
gdata['resumen']['funcionesSinEntradaBrutas']=len(missing_records)
gdata['resumen']['declaracionesLocalesSinReferencia']=len(unused_local)
gdata['resumen']['funcionesSinEntradaPorClasificar']=len(missing_records)-len(unused_local)
gdata['excepcionesSinReferencia']=unused_local
gpath.write_text(json.dumps(gdata,ensure_ascii=False,indent=2)+'\n')
print('PASO3_583_DEPURADO',json.dumps({'sinEntradaBrutas':len(missing_records),
    'declaracionesLocalesSinReferencia':len(unused_local),
    'aunPorClasificar':len(missing_records)-len(unused_local),
    'evidencia':'identidad AST, ámbito padre local y única referencia de nombre en fuente; no es prueba funcional en navegador'},ensure_ascii=False))

# PASO 3: veredicto de inspección de los 239 con padre conectado
# El padre alcanzable NO prueba activación del hijo. Distinguir sin borrarlo:
# a) sin referencia del nombre fuera de declaración,
# b) callback programado o de evento cuyo enlace debe cotejarse,
# c) referencia local comprobable, pero sin recorrido certificado.
parent_attached=[(rec,F[rec['idAST']]) for rec in missing_records
                 if F[rec['idAST']].get('parent') in reached]
assert len(parent_attached)<=239,len(parent_attached)
verdicts=collections.defaultdict(list)
for rec,fn in parent_attached:
    activation=(rec.get('activacion') or {})
    t=activation.get('tipo') or 'sin_tipo'
    fid=rec['idAST']
    if fid in verified_unreferenced:
        verdict='declaracion_local_sin_referencia_textual'
    elif t in ('callback_programado','funcion_pasada_como_argumento',
               'funcion_pasada_a_constructor','propiedad_de_objeto',
               'metodo_o_accesor'):
        verdict='callback_propiedad_o_metodo_sin_prueba_de_activacion'
    elif t in ('declaracion_local','declaracion_global'):
        verdict='declaracion_con_parent_alcanzado_pero_sin_invocacion'
    else:
        verdict='otra_activacion_sin_prueba'
    verdicts[verdict].append({
       'idAST':fid,'archivo':fn['file'],'linea':fn['line'],
       'tipo':t,'padre':fn.get('parent'),
       'invocadoresAST':len(reverse.get(fid,set())),
       'sitiosDeLlamada':len(rec.get('sitiosDeLlamada') or [])
    })
assert sum(len(v) for v in verdicts.values())==len(parent_attached)
print('PASO3_PADRES_ALCANZADOS_DESGLOSE',json.dumps({
   'total':len(parent_attached),
   'porVeredicto':{k:len(v) for k,v in verdicts.items()},
   'porTipoActivacion':dict(collections.Counter((r.get('activacion') or {}).get('tipo') or 'sin_tipo' for r,_ in parent_attached)),
   'muestras':{k:v[:14] for k,v in verdicts.items()}
},ensure_ascii=False))
gdata['revisionPadresAlcanzados']={'total':len(parent_attached),
  'porVeredicto':{k:len(v) for k,v in verdicts.items()},
  'casos':[{'veredicto':k,**x} for k,v in verdicts.items() for x in v]}
gpath.write_text(json.dumps(gdata,ensure_ascii=False,indent=2)+'\n')

# PASO 3: bloqueos compartidos de invocación, sin duplicar 223 inspecciones
# Para cada nodo con invocadores locales pero sin entrada, remontar las
# llamadas dentro del subgrafo no alcanzado, conservando ciclos y múltiples
# posibles raíces, para distinguir causas comunes de casos independientes.
blocked={r['idAST'] for r in missing_records}
locally_called=[r['idAST'] for r in missing_records
                if reverse.get(r['idAST'],set()) and F[r['idAST']].get('parent') not in reached]
def root_obstacles(fid):
    todo=[fid];seen_local=set();heads=set()
    while todo:
        node=todo.pop()
        if node in seen_local:continue
        seen_local.add(node)
        sources=[x for x in reverse.get(node,()) if x in blocked]
        if not sources:heads.add(node)
        else:todo.extend(sources)
        if len(seen_local)>1691:raise AssertionError('Ciclo de análisis')
    return heads or {fid}
clusters=collections.defaultdict(list)
for fid in locally_called:
    heads=root_obstacles(fid)
    key=tuple(sorted(heads))
    clusters[key].append(fid)
sizes=sorted(clusters.items(),key=lambda x:-len(x[1]))
print('PASO3_BLOQUEOS_223',json.dumps({
    'funcionesConInvocadorLocalNoAlcanzado':len(locally_called),
    'conjuntosRaizCompartida':len(clusters),
    'familiasMayores':[{'raices':list(key)[:5],'cantidad':len(members),
       'muestras':members[:4]} for key,members in sizes[:20]]
},ensure_ascii=False))
gdata['bloqueosDeInvocadoresLocales']={
    'total':len(locally_called),'grupos':len(clusters),
    'familias':[{'raices':list(k),'miembros':v} for k,v in sizes]}
gpath.write_text(json.dumps(gdata,ensure_ascii=False,indent=2)+'\n')

# Paso 3: nombres sin segunda referencia en toda la fuente congelada
# Este es un censo documental, NO elimina código ni prueba que no existan
# invocaciones dinámicas. Sólo usa nombres suficientemente específicos y
# exige referencia única en TODOS los archivos del corte, no solo su módulo.
all_source_files=sorted({fn['file'] for fn in F.values()})
eligible={}
for rec in missing_records:
    fn=F[rec['idAST']]
    name=fn['name']
    if (not name.isidentifier() or len(name)<7 or name.startswith('callback')
        or fn['file'].startswith('worker/') and len(name)<15):continue
    if fn['file'] not in src_cache:
        src_cache[fn['file']]=(Path('baseline')/fn['file']).read_text().splitlines()
    lines=src_cache[fn['file']]
    if not 1<=fn['line']<=len(lines):continue
    if not re.search(r'\b(?:async\s+)?function\s+'+re.escape(name)+r'\s*\(',lines[fn['line']-1]):continue
    eligible[rec['idAST']]=name
name_set=set(eligible.values())
if name_set:
    name_pattern=re.compile(r'\b(?:'+'|'.join(re.escape(n) for n in sorted(name_set,key=len,reverse=True))+r')\b')
    all_occurrences=collections.Counter()
    for file in all_source_files:
        source=(Path('baseline')/file).read_text()
        all_occurrences.update(m.group() for m in name_pattern.finditer(source))
else:all_occurrences={}
source_unreferenced=[{'idAST':fid,'nombre':name,'archivo':F[fid]['file'],
                      'linea':F[fid]['line']} for fid,name in eligible.items()
                     if all_occurrences[name]==1]
source_unreferenced_ids={x['idAST'] for x in source_unreferenced}
assert source_unreferenced_ids.issubset({x['idAST'] for x in missing_records})
# Separar las declaraciones locales que ya estaban identificadas de
# las nuevas funciones globales / locales con nombre único en todo el corte.
new_source_unreferenced=source_unreferenced_ids-verified_unreferenced
print('PASO3_REFERENCIA_UNICA_FUENTE',json.dumps({
 'brutoSinEntrada':len(missing_records),
 'nombresCandidatos':len(name_set),
 'sinSegundaReferenciaEnTodaFuente':len(source_unreferenced),
 'nuevosRespectoA16':len(new_source_unreferenced),
 'porArchivo':dict(collections.Counter(x['archivo'] for x in source_unreferenced)),
 'muestras':[x for x in source_unreferenced if x['idAST'] in new_source_unreferenced][:45],
 'limitacion':'Ausencia de otra referencia textual en archivos del corte; no excluye invocación dinámica externa, ni acredita funcionamiento, ni autoriza borrar código'
},ensure_ascii=False))
gdata['declaracionesSinSegundaReferenciaEnCorte']=source_unreferenced
gdata['resumen']['declaracionesSinSegundaReferenciaEnCorte']=len(source_unreferenced)
gdata['resumen']['aunSinClasificacionFuente']=len(missing_records)-len(verified_unreferenced|source_unreferenced_ids)
gpath.write_text(json.dumps(gdata,ensure_ascii=False,indent=2)+'\n')

# Solapamiento comprobado de exportaciones del listado GH: el script
# gh-listados.js se carga DESPUÉS de gh-promos.js y reasigna dos nombres.
# Es una clasificación estática, NO se declara inalcanzable al export anterior:
# puede existir una carrera durante el arranque asincrónico del panel.
admin_lines=(Path('baseline')/'plataforma/administracion.html').read_text().splitlines()
promos_lines=(Path('baseline')/'plataforma/gh-promos.js').read_text().splitlines()
lists_lines=(Path('baseline')/'plataforma/gh-listados.js').read_text().splitlines()
assert 'src="/plataforma/gh-promos.js?v=91"' in admin_lines[161-1]
assert 'src="/plataforma/gh-listados.js?v=119"' in admin_lines[4098-1]
assert 'window.ghPromosLoadV91=function' in promos_lines[36-1]
assert 'window.ghPromosPrepareV91=async function' in promos_lines[40-1]
assert 'window.ghPromosLoadV91=' in lists_lines[92-1]
assert 'window.ghPromosPrepareV91=' in lists_lines[92-1]
shadowed=[]
for name,line in [('window.ghPromosLoadV91',36),('window.ghPromosPrepareV91',40)]:
    candidates=[rec for rec in missing_records if F[rec['idAST']]['file']=='plataforma/gh-promos.js'
                and F[rec['idAST']]['line']==line and F[rec['idAST']]['name']==name]
    assert len(candidates)==1,(name,len(candidates))
    fid=candidates[0]['idAST']
    assert fid not in verified_unreferenced|source_unreferenced_ids
    shadowed.append({'idAST':fid,'export':name,'origen':'plataforma/gh-promos.js:'+str(line),
                     'reasignadaEn':'plataforma/gh-listados.js:92',
                     'limitacion':'Escritura posterior a la misma propiedad; un evento previo a la reasignación no queda descartado'})
for row in gdata['funciones']:
    if row['idAST'] in {x['idAST'] for x in shadowed}:
        row['evaluacionFuente']='exportacion_sombreada_por_script_posterior_en_carga_normal'
gdata['exportacionesSombreadasGH']=shadowed
gdata['resumen']['exportacionesSombreadasGH']=len(shadowed)
gdata['resumen']['aunSinClasificacionFuente']=len(missing_records)-len(verified_unreferenced|source_unreferenced_ids|{x['idAST'] for x in shadowed})
gpath.write_text(json.dumps(gdata,ensure_ascii=False,indent=2)+'\n')
print('PASO3_GH_EXPORTACIONES_SOMBREADAS',json.dumps({
    'sinEntradaBrutas':len(missing_records),
    'sombreadas':len(shadowed),
    'excepcionesFuenteAcumuladas':len(verified_unreferenced|source_unreferenced_ids|{x['idAST'] for x in shadowed}),
    'aunPorClasificar':gdata['resumen']['aunSinClasificacionFuente'],
    'detalle':shadowed,
    'sin_prueba_ejecucion_ni_consumo':True
},ensure_ascii=False))

# Diagnóstico reproducible de las funciones del Worker sin camino a entrada:
# agrupa por forma de activación y dueño léxico, con identidades AST completas.
worker_missing=[rec for rec in missing_records if F[rec['idAST']]['file']=='worker/worker206.txt']
worker_groups=collections.defaultdict(list)
for rec in worker_missing:
    fn=F[rec['idAST']]
    a=(rec.get('activacion') or {})
    kind=a.get('tipo') or 'sin_tipo'
    parent=fn.get('parent')
    reason=('padre_alcanzable' if parent in reached else
        'invocador_sin_entrada' if reverse.get(rec['idAST']) else
        'anidada' if parent in F else 'global_sin_invocador')
    worker_groups[(reason,kind)].append({'idAST':rec['idAST'],'nombre':fn['name'],
        'linea':fn['line'],'padre':parent,'invocadores':len(reverse.get(rec['idAST'],set()))})
worker_report={'total':len(worker_missing),
    'porMotivo':dict(collections.Counter(k[0] for k,v in worker_groups.items() for _ in v)),
    'porActivacion':dict(collections.Counter(k[1] for k,v in worker_groups.items() for _ in v)),
    'grupos':[{'motivo':k[0],'activacion':k[1],'cantidad':len(v),
       'casos':v[:25]} for k,v in sorted(worker_groups.items(),key=lambda t:-len(t[1]))]}
(OUT/'WORKER_FUNCIONES_SIN_ENTRADA.json').write_text(json.dumps(worker_report,ensure_ascii=False,indent=2)+'\n')
print('PASO3_WORKER_SIN_ENTRADA_DESGLOSE',json.dumps(worker_report,ensure_ascii=False))
