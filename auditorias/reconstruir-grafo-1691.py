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
        if re.search(r'new\\s+Promise\\s*\\(',line):
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
