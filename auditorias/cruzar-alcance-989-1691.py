#!/usr/bin/env python3
"""Paso 3: cotejar funciones alcanzables en los árboles actuales sin uniones por nombre.
No equipara 'nodo en árbol' con ejecución real ni salda identidades modificadas.
"""
import collections,json,zipfile
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
# Cotejo de las 218 asociaciones modificadas: una petición sólo pertenece
# a una AUD si su callId existe en el árbol actual de ESA acción.
# Se contrastan método, destinos y condiciones del Worker; sin inferir runtime.
with zipfile.ZipFile("paso2/auditorias/transversal/CATALOGO_MAESTRO.zip") as z:
    definitive=json.loads(z.read("CATALOGO_MAESTRO.json"))
entries={e["id"]:e for e in definitive["entries"]}
differences=json.loads((temp/"COMPATIBILIDAD_989_PASO3.json").read_text())["diferenciasAcciones"]
assert len(differences)==218 and len(entries)==989
mapped_by_aud={a["AUD"]:a for a in mapped}
review=[]
for diff in differences:
    aud=diff["AUD"]
    expected=entries[aud].get("network") or []
    t=None
    if aud in mapped_by_aud:
        matches=byid[mapped_by_aud[aud]["arbolActual"]]
        assert len(matches)==1,(aud,len(matches))
        t=matches[0]
    actual_http=[x for x in (t or {}).get("nodes",[]) if x.get("type")=="http"]
    by_call=collections.defaultdict(list)
    for x in actual_http:
        by_call[x.get("callId")].append(x)
    checks=[]
    for req in expected:
        same=by_call.get(req.get("callId"),[])
        if len(same)!=1:
            verdict="sin_callId_unico_en_arbol_vigente"
            reasons=["Cantidad de coincidencias para callId: "+str(len(same))]
        else:
            node=same[0]
            reasons=[]
            for key in ("verb","target","candidates","routeStatus"):
                if (req.get(key) or None)!=(node.get(key) or None):
                    reasons.append(key+"_distinto")
            # La lista de receptores y sus guardas debe permanecer íntegra.
            def normalized_worker(rows):
                return sorted(json.dumps({
                    k:item.get(k) for k in ("pattern","flags","file","line",
                      "handlers","inlineTerminal","guard","target")
                },sort_keys=True,ensure_ascii=False) for item in rows or [])
            if normalized_worker(req.get("worker"))!=normalized_worker(node.get("worker")):
                reasons.append("receptores_o_guardas_worker_distintos")
            verdict="asociacion_estatica_identica_en_arbol_de_accion" if not reasons else "diferencia_de_contrato_o_destino"
        checks.append({"callId":req.get("callId"),"metodo":req.get("verb"),
                       "rutas":req.get("candidates"),"estado":verdict,
                       "razones":reasons})
    review.append({"AUD":aud,"camposModificados":diff["camposModificados"],
       "sustituida":aud in historicos,
       "arbolActual":mapped_by_aud.get(aud,{}).get("arbolActual"),
       "peticionesDefinitivas":len(expected),"peticionesEnArbol":len(actual_http),
       "comprobaciones":checks,
       "dictamen":("control_historico_reemplazado" if aud in historicos else
         "sin_red_en_catalogo_definitivo" if not expected else
         "red_estatica_concordante" if all(c["estado"]=="asociacion_estatica_identica_en_arbol_de_accion" for c in checks)
         else "requiere_revision_de_asociacion")})
assert len(review)==218
network_review=[x for x in review if x["peticionesDefinitivas"]]
review_summary={
 "asociacionesConDiferenciasEstructurales":218,
 "asociacionesConRedDefinitiva":len(network_review),
 "solicitudesDefinitivasContrastadas":sum(x["peticionesDefinitivas"] for x in review),
 "porDictamen":dict(collections.Counter(x["dictamen"] for x in review)),
 "peticionesPorEstado":dict(collections.Counter(c["estado"] for x in review for c in x["comprobaciones"])),
 "razonesDeDiferencia":dict(collections.Counter(reason for x in review for c in x["comprobaciones"] for reason in c["razones"])),
 "limite":"Comparacion estática por callId dentro del árbol individual, sin prueba de ejecución, permisos runtime ni respuesta de red"}
(temp/"CONTRASTE_218_ASOCIACIONES_ACTUALES.json").write_text(json.dumps(
 {"resumen":review_summary,"acciones":review},ensure_ascii=False,indent=2)+"\n")
print("PASO3_CONTRASTE_218",json.dumps(review_summary,ensure_ascii=False))
print("PASO3_CONTRASTE_MUESTRAS",json.dumps([{"AUD":x["AUD"],"arbol":x["arbolActual"],"casos":x["comprobaciones"][:2]} for x in review if x["dictamen"]=="requiere_revision_de_asociacion"][:8],ensure_ascii=False)[:8000])
# Revalidar el conjunto histórico completo con activaciones indirectas,
# no sólo con los árboles AUD directos. Las cadenas se vuelven a contrastar
# contra IDs y llamadas del AST actual, sin reconstruir el inventario.
callback_pairs=set()
for binding in n.get("callbackBindings",[]):
    src=binding["binding"].split("|")[0]
    for dst in binding["targets"]:
        if src in fn and dst in fn:callback_pairs.add((src,dst))
current_startups={(c.get("file"),c.get("line")) for c in n.get("startupCalls",[])}
old_source_hashes=json.loads(Path("baseline/auditorias/transversal/ARBOL_ACCIONES.json").read_text())["sourceHashes"]
current_actions=set(mapped_by_aud)
revalidated=[]
for old_rec in g["funciones"]:
    fid=old_rec["idAST"];now=ledger[fid]["newId"]
    historic_state=old_rec["estado"]
    item={"idASTHistorico":fid,"idASTActual":now,
          "estadoHistorico":historic_state,"AUDHistorica":old_rec.get("AUD"),
          "evidenciaHistorica":old_rec.get("inicio"),
          "clasificacionActual":None,"limites":[]}
    if not now:
        item["clasificacionActual"]="identidad_transformada_sin_equivalencia_certificada"
        item["limites"].append("No vincular por coincidencia nominal")
    elif historic_state=="falta_enlace_a_entrada":
        item["clasificacionActual"]="sin_consumidor_acreditado_en_revision_historica"
        item["limites"].append("No equivale a ausencia actual de consumidor ni código obsoleto")
    elif "cadena" in old_rec:
        chain=old_rec["cadena"]
        new_chain=[full.get(x,{}).get("newId") for x in chain]
        item["cadenaActualCandidata"]=new_chain
        item["cadenaHistorica"]=chain
        item["cadenaHistoricaLongitud"]=len(chain)
        if not all(x in fn for x in new_chain):
            item["clasificacionActual"]="cadena_indirecta_con_identidad_intermedia_no_remapeada"
        else:
            checks=[]
            old_kinds=old_rec.get("aristas") or []
            for pos,(src,dst) in enumerate(zip(new_chain,new_chain[1:])):
                calls=[c for c in fn[src].get("calls",[]) if c.get("to")==dst]
                if calls:
                    checks.append("llamada_AST_actual")
                elif (src,dst) in callback_pairs:
                    checks.append("callback_registrado_AST_actual_condicional")
                else:
                    # Portar únicamente aristas indirectas ya certificadas en
                    # el corte anterior cuando AMBAS fuentes son byte a byte
                    # idénticas y ambas identidades AST permanecen idénticas.
                    src_old,dst_old=chain[pos],chain[pos+1]
                    source_src,source_dst=fn[src]["file"],fn[dst]["file"]
                    same_src=(source_src in old_source_hashes and
                        n["sourceHashes"].get(source_src)==old_source_hashes[source_src])
                    same_dst=(source_dst in old_source_hashes and
                        n["sourceHashes"].get(source_dst)==old_source_hashes[source_dst])
                    kind=old_kinds[pos] if pos<len(old_kinds) else None
                    if (same_src and same_dst and src==src_old and dst==dst_old
                        and kind and kind!="llamada_resuelta"):
                        checks.append("arista_indirecta_historica_sha_inalterada")
                    else:
                        checks.append("arista_historica_no_correspondida_en_AST_actual")
            item["aristasActuales"]=checks
            if any(x=="arista_historica_no_correspondida_en_AST_actual" for x in checks):
                item["clasificacionActual"]="cadena_indirecta_requiere_verificacion_de_receptor"
            elif historic_state=="cadena_desde_accion_confirmada_estaticamente":
                aud=old_rec.get("AUD")
                if aud in current_actions:
                    selected=byid[mapped_by_aud[aud]["arbolActual"]]
                    if len(selected)==1 and selected[0]["action"].get("entry")==new_chain[0]:
                        item["clasificacionActual"]="cadena_AST_revalidada_con_raiz_AUD_exacta"
                    else:
                        item["clasificacionActual"]="cadena_AST_sin_raiz_de_AUD_acreditada"
                else:
                    item["clasificacionActual"]="cadena_AST_sin_AUD_vigente_acreditada"
            elif historic_state=="cadena_desde_inicio_script_confirmada_estaticamente":
                root=fn[new_chain[0]]
                if (root["file"],root["line"]) in current_startups:
                    item["clasificacionActual"]="cadena_AST_revalidada_con_arranque_script"
                else:
                    item["clasificacionActual"]="cadena_AST_con_arranque_pendiente_de_confirmar"
            else:
                item["clasificacionActual"]="cadena_AST_revalidada_con_raiz_externa_condicional"
            if any(x=="callback_registrado_AST_actual_condicional" for x in checks):
                item["limites"].append("La inscripción de callback no prueba su disparo")
        if historic_state=="cadena_desde_accion_confirmada_estaticamente":
            item["limites"].append("No implica ejecución real de la acción")
    else:
        file=fn[now]["file"]
        same_source=(file in n["sourceHashes"] and
          file in old_source_hashes and
          n["sourceHashes"][file]==old_source_hashes[file])
        item["clasificacionActual"]=("disponibilidad_externa_documentada_fuente_inalterada"
            if same_source else "disponibilidad_historica_en_fuente_modificada")
        item["limites"].append("Exportación o miembro disponible no implica consumidor o invocación")
    assert item["clasificacionActual"],fid
    revalidated.append(item)
assert len(revalidated)==1691 and len({x["idASTHistorico"] for x in revalidated})==1691
indirect_summary={"universo":1691,
 "clasificadosConDictamen":len(revalidated),
 "porClasificacion":dict(collections.Counter(x["clasificacionActual"] for x in revalidated)),
 "advertencia":"Los dictámenes de impedimento son clasificaciones, no equivalencias ni cierre acreditado"}
(temp/"REVALIDACION_INDIRECTA_1691_ACTUAL.json").write_text(json.dumps(
 {"resumen":indirect_summary,"funciones":revalidated},ensure_ascii=False,indent=2)+"\n")
print("PASO3_REVALIDACION_INDIRECTA_1691",json.dumps(indirect_summary,ensure_ascii=False))
result={"resumen":summary,"funciones":verified,"pendientesRemapeo":unknown,
 "accionesConArbol":mapped,"accionesSinArbol":notmapped,
 "historicasSinEnlaceAhoraConArbol":coveredHistoric,
 "historicasSinEnlaceAunSinArbol":uncoveredHistoric}
(temp/"CRUCE_989_1691_ACTUAL.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
print("PASO3_CRUCE_989_1691",json.dumps(summary,ensure_ascii=False))
print("PASO3_ACCIONES_SIN_ARBOL",json.dumps(notmapped,ensure_ascii=False)[:6000])
print("PASO3_FUNCIONES_155_RECUPERADAS_EN_ARBOL",json.dumps(coveredHistoric,ensure_ascii=False)[:6000])
