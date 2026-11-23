#!/usr/bin/env python3
"""Paso 3: cotejar funciones alcanzables en los árboles actuales sin uniones por nombre.
No equipara 'nodo en árbol' con ejecución real ni salda identidades modificadas.
"""
import collections,json
from pathlib import Path
temp=Path("auditorias/temporal")
g=json.loads((temp/"GRAFO_COMPLETO_1691.json").read_text())
r=json.loads((temp/"REMAPPING_AST_989.json").read_text())
m=json.loads((temp/"MODELO_COBERTURA_989_CONCILIADO.json").read_text())
n=json.loads(Path("nuevo/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
fn={f["id"]:f for f in n["functionGraph"]}
actions=n["trees"]
byid=collections.defaultdict(list)
byentry=collections.defaultdict(list)
for t in actions:
    a=t["action"]
    byid[a["id"]].append(t)
    if a.get("entry"):byentry[a["entry"]].append(t)
full=r["fullMap"]
historicos={"AUD-00395","AUD-00418","AUD-00419","AUD-00865","AUD-00866"}
mapped=[];notmapped=[]
for a in m["acciones"]:
    aud=a["AUD"];start=a["start"];ev=a.get("evidenciaArbolActual") or {}
    if aud in historicos:
        assert a["estadoConsolidado"]=="control_historico_reemplazado_paso1"
        continue
    if a["estadoConsolidado"]=="subexpresion_historica_asociada_al_registro_actual":
        assert ev["AUDActual"]
        continue
    specific=ev.get("nuevo") or ev.get("accionVigente")
    candidates=byid.get(specific["id"],[]) if specific else byid.get(start.get("id"),[])
    proof="id_accion_fuente"
    if specific:proof="accion_conciliada_con_receptor"
    if len(candidates)!=1:
        entry=start.get("entry")
        current=full.get(entry,{}).get("newId") if entry else None
        candidates=byentry.get(current,[]) if current else []
        proof="entrada_AST_remapeada_SHA"
        # Una misma función atiende varios botones: no elegir arbitrariamente
        # el primer árbol. Recuperar el control por evento, receptor, handler
        # literal y etiqueta, conservando sólo un candidato único.
        filters=[
          ("archivo_y_tipo",lambda x:x["action"].get("file")==start.get("file") and x["action"].get("kind")==start.get("kind")),
          ("handler_literal",lambda x:bool(start.get("handler")) and
              (x["action"].get("handler")==start.get("handler") or
               str(x["action"].get("handler") or "").startswith(str(start.get("handler"))))),
          ("evento",lambda x:x["action"].get("event")==start.get("event")),
          ("receptor",lambda x:x["action"].get("receiver")==start.get("receiver")),
          ("elemento",lambda x:x["action"].get("elementId")==start.get("elementId")),
          ("rotulo",lambda x:x["action"].get("label")==start.get("label")),
        ]
        for label,pred in filters:
            if len(candidates)<=1:break
            refined=[c for c in candidates if pred(c)]
            if refined and len(refined)<len(candidates):
                candidates=refined
                proof+="_"+label
    if len(candidates)>1 and aud in ("AUD-00412","AUD-00413"):
        # Dos botones idénticos Promocioná para eventos distintos comparten
        # función y atributos. La equivalencia usa orden y corrimiento
        # de líneas idéntico en ambas ediciones, NO el primer candidato.
        grupo=[x for x in m["acciones"] if x["AUD"] in ("AUD-00412","AUD-00413")]
        grupo=sorted(grupo,key=lambda x:x["start"]["line"])
        orden=sorted(candidates,key=lambda x:x["action"]["line"])
        assert len(grupo)==len(orden)==2
        assert len({x["start"]["handler"] for x in grupo})==1
        assert len({x["action"]["handler"] for x in orden})==1
        deltas={x["action"]["line"]-y["start"]["line"] for y,x in zip(grupo,orden)}
        if len(deltas)==1 and len({x["action"]["id"] for x in orden})==2:
            idx=next(i for i,x in enumerate(grupo) if x["AUD"]==aud)
            candidates=[orden[idx]]
            proof+="_orden_estable_y_delta_linea_constante"
    if len(candidates)==1:
        t=candidates[0]
        assert t["action"]["file"]==start.get("file"),(aud,t["action"]["file"],start.get("file"))
        mapped.append({"AUD":aud,"arbolActual":t["action"]["id"],"prueba":proof,
          "funcionesAST":[node["id"] for node in t.get("nodes",[]) if node.get("type")=="function" and
              node.get("id") in fn and not fn[node["id"]].get("synthetic")]})
    else:
        notmapped.append({"AUD":aud,"cantidadCandidatos":len(candidates),"origen":start,
          "estadoConsolidado":a["estadoConsolidado"]})
allReach={fid for item in mapped for fid in item["funcionesAST"]}
ledger={v["oldId"]:v for v in r["ledger"]}
assert len(ledger)==1691
audByNew=collections.defaultdict(list)
for item in mapped:
    for fid in item["funcionesAST"]:audByNew[fid].append(item["AUD"])
verified=[];unknown=[]
for record in g["funciones"]:
    fid=record["idAST"]
    resolved=ledger[fid]["newId"]
    if resolved is None:
        unknown.append({"idAST":fid,"estadoHistorico":record["estado"],
          "motivo":"cuerpo_AST_modificado_sin_remapeo_unico"})
    else:
        verified.append({"idAST":fid,"idActual":resolved,
          "estadoHistorico":record["estado"],
          "alcanzadoEnArbolActual":resolved in allReach,
          "AUD":sorted(set(audByNew[resolved]))[:30]})
historicMissing={x["idAST"] for x in g["funciones"] if x["estado"]=="falta_enlace_a_entrada"}
assert len(historicMissing)==155
coveredHistoric=[x for x in verified if x["idAST"] in historicMissing and x["alcanzadoEnArbolActual"]]
uncoveredHistoric=[x for x in verified if x["idAST"] in historicMissing and not x["alcanzadoEnArbolActual"]]
assert len(verified)+len(unknown)==1691
summary={
 "accionesCatalogo":989,"accionesHistoricasReemplazadas":5,
 "accionesSubexpresionesHistoricas":4,
 "accionesVigentesConArbolIdentificado":len(mapped),
 "accionesVigentesSinArbolUnico":len(notmapped),
 "funcionesActualesEnArbolesIdentificados":len(allReach),
 "funcionesHistoricasRemapeadas":len(verified),
 "funcionesHistoricasSinRemapeo":len(unknown),
 "remapeadasAlcanzadasEnArbolActual":sum(x["alcanzadoEnArbolActual"] for x in verified),
 "remapeadasNoAparecenEnArbolesAUDDirectos":sum(not x["alcanzadoEnArbolActual"] for x in verified),
 "advertenciaAlcance":"Los árboles directos no incluyen raíces IIFE, callbacks de host y entradas de script acreditadas en el grafo histórico; NO son funciones sin enlace",
 "historicas155ConArbolNuevo":len(coveredHistoric),
 "historicas155SinArbolAUDDirecto":len(uncoveredHistoric),
 "historicas155SinRemapeo":sum(x["idAST"] in historicMissing for x in unknown),
 "saldoActualSinEnlace":None,
 "limite":"Alcance AST en árbol con origen de catálogo enlazado; no prueba de condiciones, runtime, ni revalidación funcional completa"}
result={"resumen":summary,"funciones":verified,"pendientesRemapeo":unknown,
 "accionesConArbol":mapped,"accionesSinArbol":notmapped,
 "historicasSinEnlaceAhoraConArbol":coveredHistoric,
 "historicasSinEnlaceAunSinArbol":uncoveredHistoric}
(temp/"CRUCE_989_1691_ACTUAL.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
print("PASO3_CRUCE_989_1691",json.dumps(summary,ensure_ascii=False))
print("PASO3_ACCIONES_SIN_ARBOL",json.dumps(notmapped,ensure_ascii=False)[:6000])
print("PASO3_FUNCIONES_155_RECUPERADAS_EN_ARBOL",json.dumps(coveredHistoric,ensure_ascii=False)[:6000])
