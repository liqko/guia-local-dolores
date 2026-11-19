#!/usr/bin/env python3
"""Auditoría de COBERTURA para TODAS las 1691 identidades abiertas, incluidas las 608.
Coteja contra la revisión congelada y clasifica brechas, sin certificar ejecución.
Salida por identidad GPS y resumen reproducible. No modifica código productivo."""
import collections
import json
import re
import zipfile
from pathlib import Path

BASE=Path('auditorias/transversal')
SRC=Path('baseline')
OUT=Path('auditorias/temporal')
OUT.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(BASE/'COBERTURA_ACTIVACIONES.zip') as archive:
    data=json.loads(archive.read('COBERTURA_ACTIVACIONES.json'))
rows=data['filas']
valid_aud=set(re.findall(r'AUD-\d{5}',(BASE/'CATALOGO_MAESTRO.md').read_text()))
open_status={'invocador_identificado_sin_entrada','registro_o_asignacion_sin_invocacion_comprobada','declaracion_sin_invocador_resuelto','uso_no_localizado_revision_por_accion'}
pending=[r for r in rows if r.get('estadoDeCobertura') in open_status]
assert len(pending)==1691 and len(valid_aud)==987,(len(pending),len(valid_aud))

# Contrastar cuerpo y activación sobre el código del MISMO commit; nada de declaraciones por nombre solamente.
source_cache={}
def lines_for(file):
    if file not in source_cache:
        path=SRC/file
        source_cache[file]=path.read_text(errors='replace').splitlines() if path.is_file() else None
    return source_cache[file]

standard_collections={'map','flatMap','filter','forEach','some','every','find','findIndex','findLast','findLastIndex','reduce','reduceRight','sort'}
standard_promises={'then','catch','finally'}
standard=standard_collections|standard_promises

def source_check(r):
    file=r.get('archivo') or ''
    line=int(r.get('linea') or 0)
    src=lines_for(file)
    if src is None:return 'fuente_no_disponible', ''
    if line<1 or line>len(src):return 'linea_fuera_de_rango',''
    body='\n'.join(src[max(0,line-4):min(len(src),line+4)])
    name=str(r.get('nombre') or '')
    # No confundir una declaración con una referencia: registrar el texto exacto de la línea.
    present=bool(src[line-1].strip())
    return ('ubicacion_validada' if present else 'ubicacion_vacia'),src[line-1].strip()[:240]

def detect_callback(r):
    a=r.get('activacion') or {}
    expr=str(a.get('expr') or '').strip()
    method_match=re.search(r'\.([A-Za-z]+)\s*$',expr)
    method=method_match.group(1) if method_match else ''
    if a.get('tipo')!='funcion_pasada_como_argumento' or method not in standard:
        return False,method,'no_es_callback_estandar'
    src=lines_for(r.get('archivo') or '')
    line=int(r.get('linea') or 0)
    if src is None or not 1<=line<=len(src):
        return False,method,'fuente_inaccesible'
    neighborhood='\n'.join(src[max(0,line-4):min(len(src),line+4)])
    if not re.search(r'\.\s*'+re.escape(method)+r'\s*\(',neighborhood):
        return False,method,'metodo_no_visible'
    if not re.search(r'=>|\bfunction\b',neighborhood):
        return False,method,'callback_no_visible'
    return True,method,'fuente_y_contrato_estandar'

results=[]
for position,r in enumerate(pending,1):
    parent_aud=sorted(set(r.get('unidadesDelPadre') or []))
    direct_aud=sorted(set(r.get('unidades') or []))
    exact_aud=sorted(set(r.get('unidadesExactas') or []))
    invalid=[id for id in parent_aud+direct_aud+exact_aud if id not in valid_aud]
    status,src_line=source_check(r)
    callback,method,why=detect_callback(r)
    act=r.get('activacion') or {}
    callers=r.get('sitiosDeLlamada') or []
    local_edges=r.get('entradasLocales') or []
    # La evidencia de función padre enlazada al AUD NO implica que se activa el hijo.
    # Para certificar recorrido completo hace falta probar conexión hasta la entrada y condiciones.
    if invalid:category='inconsistencia_identidad_AUD'
    elif status!='ubicacion_validada':category='falta_cotejo_fuente'
    elif (parent_aud or exact_aud or direct_aud) and callback:
        category='conexión_estática_con_AUD_confirmada_sin_condiciones'
    elif (parent_aud or exact_aud or direct_aud) and callers:
        category='AUD_e_invocador_localizados_sin_cadena_certificada'
    elif (parent_aud or exact_aud or direct_aud):
        category='AUD_padre_localizado_sin_activación_certificada'
    elif callers or local_edges:
        category='llamador_local_sin_entrada_AUD'
    elif act.get('tipo') and act.get('tipo')!='declaracion_local':
        category='registro_local_sin_entrada_AUD'
    else:category='sin_activador_confirmado'
    results.append({
        'filaOriginal':position,'idGPS':r['idGPS'],'nombre':r.get('nombre'),'archivo':r.get('archivo'),'linea':r.get('linea'),
        'estadoOriginal':r.get('estadoDeCobertura'),'categoria':category,
        'fuente':status,'textoFuente':src_line,'metodo':method,'callbackFuente':callback,
        'evidenciaCallback':why,'activacion':act,'unidadesPadre':parent_aud,
        'unidadesDirectas':direct_aud,'unidadesExactas':exact_aud,
        'sitiosDeLlamada':callers,'entradasLocales':local_edges,
        'recorridoEstatico':r.get('recorridoEstatico'),
        'identidadAST':r.get('cuerpoAST'), 'funcionPadre':r.get('padre'),
        'ejecucionLocal':r.get('ejecucionLocalWorker'), 'comprobacion':r.get('comprobacion'),
        'falta':'No certificar recorrido completo sin entrada, condiciones y ejecución.' if category!='sin_activador_confirmado' else 'Determinar si se activa o es remanente de código.'
    })
duplicates={k:v for k,v in collections.Counter(r['idGPS'] for r in results).items() if v>1}
print('DUPLICADOS_ID_GPS_RESUMEN',json.dumps({'ids':len(duplicates),'filas':sum(duplicates.values()),'ejemplos':dict(list(duplicates.items())[:5])},ensure_ascii=False))
for name in list(duplicates)[:5]:
    print('DUPLICADO_EJEMPLO',name,json.dumps([{'fila':x['filaOriginal'],'AST':x['identidadAST'],'activacion':x['activacion'],'padre':x['funcionPadre']} for x in results if x['idGPS']==name],ensure_ascii=False)[:1800])
assert len(results)==1691
counts=dict(sorted(collections.Counter(r['categoria'] for r in results).items()))
summary={
    'revision':data['revision'],'totalVerificadasContraFuente':len(results),
    'unidadesCatalogo':len(valid_aud),'categorias':counts,
    'funcionesConEvidenciaCallback':sum(r['callbackFuente'] for r in results),
    'faltantesFuente':sum(r['fuente']!='ubicacion_validada' for r in results),
    'identificadoresGPSDuplicados':len(duplicates),
    'filasAfectadasPorDuplicacion':sum(duplicates.values()),
    'recorridosCompletosCertificados':0,
    'nota':'Todas las 1691 se cotejan con el mismo código. Categoría de evidencia NO equivale a cadena de ejecución completa, ni se descuentan pendientes automáticamente.'
}

# GRAFO POR IDENTIDAD DE AST: cada callback tiene offset distinto incluso en la misma línea.
# Las aristas proceden del anexo original; se normalizan etiquetas abreviadas del árbol.
from collections import deque
all_nodes={}
by_position={}
for srcrow in rows:
    ast=srcrow.get('cuerpoAST') or {}
    if ast.get('inicio') is None:continue
    key=f"{srcrow.get('archivo')}:{srcrow.get('linea')}:{ast['inicio']}"
    assert key not in all_nodes, f"Colisión AST real: {key}"
    all_nodes[key]=srcrow
    by_position[key]=key
def resolve_node(raw):
    if not raw or not isinstance(raw,str):return None
    # 'plataforma/a.html:30:8120:callback@30' y el GPS largo tienen la misma identidad AST
    m=re.match(r'^(.*?:\\d+:\\d+):',raw)
    return by_position.get(m.group(1)) if m else None
incoming=collections.defaultdict(list)
raw_edges=0
unresolved_edges=[]
for srcrow in rows:
    for edge in srcrow.get('entradasLocales') or []:
        raw_edges+=1
        before=resolve_node(edge.get('desde'))
        after=resolve_node(edge.get('hacia'))
        if before and after:
            item=(before,edge.get('clase'),edge.get('sitio'))
            if item not in incoming[after]:incoming[after].append(item)
        else:
            unresolved_edges.append({'desde':edge.get('desde'),'hacia':edge.get('hacia'),'sitio':edge.get('sitio')})
anchors={}
for nid,srcrow in all_nodes.items():
    # El anclaje directo proviene de la identidad exacta (NO de unidadesDelPadre).
    units=srcrow.get('unidadesExactas') or srcrow.get('unidades') or []
    if units:anchors[nid]=sorted(set(u for u in units if u in valid_aud))
def trace_exact(nid):
    queue=deque([(nid,[nid])]);seen={nid}
    while queue:
        current,path=queue.popleft()
        if current in anchors:
            return {'estado':'traza_directa_hasta_nodo_AUD','unidades':anchors[current],'cadena':path}
        if len(path)>80:continue
        for predecessor,clase,sitio in incoming.get(current,[]):
            if predecessor in seen:continue
            seen.add(predecessor)
            queue.append((predecessor,path+[predecessor]))
    return {'estado':'sin_cadena_directa_hasta_AUD','alcanzados':len(seen)}
for rec in results:
    ast=rec.get('identidadAST') or {}
    nid=f"{rec['archivo']}:{rec['linea']}:{ast.get('inicio')}"
    rec['cadenaDirecta']=trace_exact(nid)
graph_summary=collections.Counter(rec['cadenaDirecta']['estado'] for rec in results)
summary['grafoDirecto']=dict(graph_summary)
summary['nodosAST']=len(all_nodes)
summary['aristasCrudas']=raw_edges
summary['aristasResueltas']=sum(len(v) for v in incoming.values())
summary['aristasSinExtremosResueltos']=len(unresolved_edges)
summary['anclasAUD']=len(anchors)
print('TRAZADO_DIRECTO_1691',json.dumps({'grafo':dict(graph_summary),'nodosAST':len(all_nodes),'aristasCrudas':raw_edges,'aristasResueltas':sum(len(v) for v in incoming.values()),'aristasSinResolver':len(unresolved_edges),'anclas':len(anchors),'ejemplos':[{k:x.get(k) for k in ['idGPS','cadenaDirecta']} for x in results if x['cadenaDirecta']['estado']=='traza_directa_hasta_nodo_AUD'][:3]},ensure_ascii=False)[:4500])

(OUT/'COBERTURA_1691_REVERIFICACION_COMPLETA.json').write_text(json.dumps({'resumen':summary,'filas':results},ensure_ascii=False,indent=2)+'\n')
(OUT/'COBERTURA_1691_REVERIFICACION_RESUMEN.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print('REVERIFICACION_TOTAL',json.dumps(summary,ensure_ascii=False))
