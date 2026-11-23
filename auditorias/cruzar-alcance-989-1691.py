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
sha_paso2=definitive.get("baseline",{}).get("sourceHashes",{})
sha_actual=n.get("sourceHashes",{})
# Correspondencias de llamadas en funciones con cuerpo idéntico entre cortes.
# Su posición se conserva sólo cuando los vectores AST de llamadas coinciden.
legacy_functions={x["id"]:x for x in json.loads(Path("baseline/auditorias/transversal/ARBOL_ACCIONES.json").read_text())["functionGraph"]}

differences=json.loads((temp/"COMPATIBILIDAD_989_PASO3.json").read_text())["diferenciasAcciones"]
assert len(differences)==218 and len(entries)==989
mapped_by_aud={a["AUD"]:a for a in mapped}
global_endpoints=collections.defaultdict(list)
for endpoint in n.get("endpoints",[]):
    global_endpoints[endpoint.get("callId")].append(endpoint)
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
    reached_fn={x.get("id") for x in (t or {}).get("nodes",[]) if x.get("type")=="function"}
    by_call=collections.defaultdict(list)
    for x in actual_http:
        by_call[x.get("callId")].append(x)
    checks=[]
    for req in expected:
        same=by_call.get(req.get("callId"),[])
        if len(same)!=1:
            global_matches=global_endpoints.get(req.get("callId"),[])
            verdict=("peticion_en_AST_global_sin_ruta_desde_esta_accion"
                if not same and len(global_matches)==1 else
                "callId_sin_coincidencia_unica_en_AST_actual")
            reasons=["Coincidencias en árbol de la acción: "+str(len(same)),
                     "Coincidencias en endpoints globales: "+str(len(global_matches))]
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
        # Reusar prueba definitiva del Paso 2 solamente si caller, callId,
        # receptor real y toda fuente afectada permanecen idénticos.
        owner=fn.get(req.get("from"))
        # El catálogo admite peticiones con "file" vacío. Recuperar el
        # archivo exclusivamente desde el propietario AST si callId pertenece
        # a esa función; no derivar origen por semejanza de ruta.
        file_declared=req.get("file")
        source_file=file_declared
        if (not source_file and owner and req.get("callId") and
            str(req["callId"]).startswith(owner["file"]+":") and
            any(c.get("id")==req["callId"] for c in owner.get("calls",[]))):
            source_file=owner["file"]
        all_files=[source_file]+[w.get("file") for w in req.get("worker") or []]
        stable=bool(all_files) and all(bool(file) and file in sha_paso2 and
                     sha_paso2[file]==sha_actual.get(file) for file in all_files)
        owner_contains_call=bool(owner and any(c.get("id")==req.get("callId") for c in owner.get("calls",[])))
        owner_reached=bool(owner and owner["id"] in reached_fn)
        matching_line_calls=[c for c in (owner or {}).get("calls",[]) if
                             c.get("file")==req.get("file") and c.get("line")==req.get("line") and
                             c.get("kind")=="http"]
        unique_site=bool(len(matching_line_calls)==1)
        hashes_no_coincidentes=[{"archivo":file,
              "hashPaso2Existe":file in sha_paso2,"hashActualExiste":file in sha_actual,
              "diferente":file in sha_paso2 and file in sha_actual and sha_paso2[file]!=sha_actual[file]}
              for file in all_files if not file or sha_paso2.get(file)!=sha_actual.get(file)
              or file not in sha_paso2 or file not in sha_actual]
        evidence={"fuentesSHAInalteradas":stable,"ownerASTActual":owner["id"] if owner else None,
                  "callerEnArbolAccion":owner_reached,"callIdEnFuncionAST":owner_contains_call,
                  "sitioHttpASTUnicoMismaLinea":unique_site,
                  "idSitioHttpActual":matching_line_calls[0]["id"] if unique_site else None,
                  "fuentesNoCorrespondidas":hashes_no_coincidentes,
                  "archivoHTTPDeclarado":file_declared,
                  "archivoHTTPPorPropietarioAST":source_file if not file_declared else None}
        if stable and owner_contains_call and owner_reached and len(same)==1:
            verdict="contrato_paso2_certificado_por_identidad_AST_y_SHA"
            # Los metadatos de un generador diferente NO sustituyen el
            # contrato definitivo mientras código y receptor no cambiaron.
        elif stable and owner_contains_call and owner_reached and not same:
            verdict="contrato_paso2_en_caller_AST_sin_nodo_http_generado"
        elif stable and owner_reached and unique_site and not same:
            verdict="contrato_paso2_por_sitio_http_AST_unico_misma_linea_y_SHA"
        elif (not stable and owner and owner_reached and owner_contains_call
              and len(same)==1 and req.get("file")=="plataforma/login.html"
              and full.get(req.get("from"),{}).get("newId")==owner["id"]
              and not full.get(req.get("from"),{}).get("modifiedBody")
              and all(w.get("file") in sha_paso2 and
                      sha_paso2.get(w.get("file"))==sha_actual.get(w.get("file"))
                      for w in (req.get("worker") or []))):
            verdict="contrato_http_funcion_AST_id_cuerpo_inmutable_en_fuente_modificada"
            evidence["equivalenciaFuncionHistorica"]=req.get("from")
            evidence["equivalenciaFuncionActual"]=owner["id"]
            evidence["equivalenciaPrueba"]=full[req["from"]]["proof"]
        if verdict=="callId_sin_coincidencia_unica_en_AST_actual" and aud not in historicos:
            legacy_owner=legacy_functions.get(req.get("from"))
            equivalent=full.get(req.get("from")) or {}
            current_owner=fn.get(equivalent.get("newId"))
            source_calls=(legacy_owner or {}).get("calls") or []
            dest_calls=(current_owner or {}).get("calls") or []
            match_positions=[i for i,c in enumerate(source_calls) if c.get("id")==req.get("callId")]
            same_order=(len(source_calls)==len(dest_calls) and all(
                x.get("kind")==y.get("kind") and x.get("method")==y.get("method")
                for x,y in zip(source_calls,dest_calls)))
            unique_position=len(match_positions)==1 and match_positions[0]<len(dest_calls)
            candidate_call=dest_calls[match_positions[0]] if unique_position else None
            same_scope=(current_owner is not None and
                legacy_owner.get("file")==current_owner.get("file")==req.get("file"))
            owner_in_action=bool(current_owner and current_owner["id"] in reached_fn)
            body_proof=bool(equivalent.get("proof") and not equivalent.get("modifiedBody"))
            worker_unchanged=all(w.get("file") in sha_paso2 and
                sha_paso2.get(w.get("file"))==sha_actual.get(w.get("file"))
                for w in (req.get("worker") or []))
            if (same_scope and owner_in_action and body_proof and same_order
                and unique_position and candidate_call.get("kind")=="http"
                and worker_unchanged):
                verdict="sitio_http_remapeado_por_cuerpo_y_ordinal_AST_exacto"
                evidence.update({
                    "funcionHistorica":req.get("from"),
                    "funcionActual":current_owner["id"],
                    "identidadCuerpo":equivalent.get("proof"),
                    "mismoOrdenLlamadasAST":True,
                    "ordinalLlamada":match_positions[0],
                    "sitioHttpASTActual":candidate_call["id"],
                    "receptorWorkerSHAInalterado":True
                })
        # Tres entradas antiguas de Reclamos conservaron un sitio de red
        # que fue sustituido. Dos pertenecen a controles reemplazados;
        # el registro de cambio de ciudad mantiene la búsqueda, aunque
        # la función receptora se modificó en el nuevo código.
        if (verdict=="callId_sin_coincidencia_unica_en_AST_actual"
            and req.get("file")=="plataforma/login.html"
            and req.get("candidates")==["/advertisers/claim-options"]
            and req.get("verb")=="GET"):
            if aud in ("AUD-00395","AUD-00418"):
                verdict="sitio_http_historico_de_control_reemplazado"
                evidence["equivalenciaHistorica"]={
                    "AUD-00395":"AUD-00988","AUD-00418":"AUD-00988"}[aud]
                evidence["advertencia"]="No agregar conexión a control histórico sustituido"
            elif aud=="AUD-00417":
                old_claim=[x for x in legacy_functions.values() if
                    x.get("file")=="plataforma/login.html" and x.get("name")=="buscarAnuncioReclamo155"]
                new_claim=[x for x in fn.values() if
                    x.get("file")=="plataforma/login.html" and x.get("name")=="buscarAnuncioReclamo155"]
                source_line="const r=await fetch(WORKER_ORIGIN+'/advertisers/claim-options?q='+encodeURIComponent(term),{headers:gldAuthHeaders_()});"
                old_source=Path("baseline/plataforma/login.html").read_text()
                new_source=Path("nuevo/plataforma/login.html").read_text()
                if (len(old_claim)==len(new_claim)==1 and
                    old_source.count(source_line)==new_source.count(source_line)==1 and
                    new_claim[0]["id"] in reached_fn and
                    any(c.get("kind")=="http" and c.get("method")=="fetch"
                        for c in old_claim[0].get("calls",[])) and
                    any(c.get("kind")=="http" and c.get("method")=="fetch"
                        for c in new_claim[0].get("calls",[]))):
                    verdict="reclamos_http_mismo_sitio_literal_con_receptor_modificado"
                    evidence["funcionOrigenHistorica"]=old_claim[0]["id"]
                    evidence["funcionOrigenVigente"]=new_claim[0]["id"]
                    evidence["sitioLiteralExactoPreservado"]=True
                    evidence["callerEnArbolAccion"]=True
        checks.append({"callId":req.get("callId"),"metodo":req.get("verb"),"evidenciaAST":evidence,
                       "rutas":req.get("candidates"),"estado":verdict,
                       "razones":reasons})
    review.append({"AUD":aud,"camposModificados":diff["camposModificados"],
       "sustituida":aud in historicos,
       "arbolActual":mapped_by_aud.get(aud,{}).get("arbolActual"),
       "peticionesDefinitivas":len(expected),"peticionesEnArbol":len(actual_http),
       "comprobaciones":checks,
       "dictamen":("control_historico_reemplazado" if aud in historicos else
         "sin_red_en_catalogo_definitivo" if not expected else
         "red_estatica_concordante" if all(c["estado"] in ("asociacion_estatica_identica_en_arbol_de_accion","contrato_paso2_certificado_por_identidad_AST_y_SHA","contrato_paso2_por_sitio_http_AST_unico_misma_linea_y_SHA","sitio_http_remapeado_por_cuerpo_y_ordinal_AST_exacto","reclamos_http_mismo_sitio_literal_con_receptor_modificado","contrato_http_funcion_AST_id_cuerpo_inmutable_en_fuente_modificada") for c in checks)
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
 "archivosNoCorrespondidosPorFamilia":dict(collections.Counter(
     z.get("archivo") or "(sin archivo)" for x in review for c in x["comprobaciones"]
     if c["estado"]=="diferencia_de_contrato_o_destino"
     for z in c.get("evidenciaAST",{}).get("fuentesNoCorrespondidas",[]))),
 "limite":"Comparacion estática por callId dentro del árbol individual, sin prueba de ejecución, permisos runtime ni respuesta de red"}
(temp/"CONTRASTE_218_ASOCIACIONES_ACTUALES.json").write_text(json.dumps(
 {"resumen":review_summary,"acciones":review},ensure_ascii=False,indent=2)+"\n")
review_summary["sinCallIdPorArchivo"]=dict(collections.Counter(c["callId"].split(":")[0] for x in review for c in x["comprobaciones"] if c["estado"]=="callId_sin_coincidencia_unica_en_AST_actual"))
print("PASO3_CONTRASTE_218",json.dumps(review_summary,ensure_ascii=False))
print("PASO3_CONTRATOS_SIN_HASH",json.dumps([
 {"AUD":x["AUD"],"callId":c["callId"],"hash":c["evidenciaAST"].get("fuentesNoCorrespondidas"),
 "worker":next((q.get("worker") for q in entries[x["AUD"]].get("network") or []
                  if q.get("callId")==c["callId"]),None)}
 for x in review for c in x["comprobaciones"]
 if c["estado"]=="diferencia_de_contrato_o_destino"
][:12],ensure_ascii=False)[:12500])
print("PASO3_80_SITIOS_NO_ENLAZADOS",json.dumps([
 {"AUD":x["AUD"],"arbol":x["arbolActual"],"sitios":[c for c in x["comprobaciones"] if c["estado"]=="callId_sin_coincidencia_unica_en_AST_actual"][:3]}
 for x in review if any(c["estado"]=="callId_sin_coincidencia_unica_en_AST_actual" for c in x["comprobaciones"])
][:15],ensure_ascii=False)[:12000])
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
# Fuentes de consumidores actuales por identidad AST, nunca por nombre.
reverse_current=collections.defaultdict(list)
for origin in fn.values():
    for c in origin.get("calls",[]):
        dest=c.get("to")
        if dest in fn:
            reverse_current[dest].append({"origen":origin["id"],"tipo":"llamada_AST","sitio":c.get("id")})
for src,dst in callback_pairs:
    reverse_current[dst].append({"origen":src,"tipo":"callback_registrado","sitio":None})
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
        incoming=reverse_current.get(now,[])
        item["consumidoresASTVigentes"]=incoming[:60]
        item["cantidadConsumidoresASTVigentes"]=len(incoming)
        if incoming:
            item["clasificacionActual"]="consumidor_AST_identificado_sin_entrada_o_receptor_acreditado"
            item["limites"].append("Existe invocador en AST actual; falta probar cadena desde raíz/guardas")
        else:
            item["clasificacionActual"]="sin_consumidor_AST_identificado_en_codigo_actual"
            item["limites"].append("Sin invocador AST/registro callback en grafo actual; no implica código obsoleto")
        item["limites"].append("La falta de consumidor textual no excluye entrada dinámica externa")
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
                    elif len(selected)==1 and any(z.get("type")=="function" and
                          z.get("id")==new_chain[0] for z in selected[0].get("nodes",[])):
                        item["clasificacionActual"]="cadena_AST_revalidada_desde_funcion_intermedia_de_AUD"
                        item["limites"].append("Función intermedia acreditada en árbol; cadena previa desde botón no verificada aquí")
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
