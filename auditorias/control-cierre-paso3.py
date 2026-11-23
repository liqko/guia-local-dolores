#!/usr/bin/env python3
"""Paso 3: control de cierre verificable, por identidad AST, sin descuentos por nombre."""
import collections
import json
from pathlib import Path
import re

path=Path("auditorias/temporal/GRAFO_COMPLETO_1691.json")
grafo=json.loads(path.read_text())
filas=grafo["funciones"]
assert len(filas)==1691, f"Esperadas 1691 identidades; hay {len(filas)}"
ids=[f["idAST"] for f in filas]
assert len(set(ids))==1691, "Identidades AST duplicadas"
faltantes=[f for f in filas if f["estado"]=="falta_enlace_a_entrada"]
assert len(faltantes)==155, f"Cambio de saldo: {len(faltantes)}, revisar antes de actualizar control"
por_fuente=collections.Counter(f["idAST"].split(":")[0] for f in faltantes)
por_evaluacion=collections.Counter(f.get("evaluacionFuente") or "sin_evaluacion_especifica" for f in faltantes)
evidencia=[]
for f in faltantes:
    evaluacion=f.get("evaluacionFuente") or "sin_evaluacion_especifica"
    evidencia.append({
        "idAST":f["idAST"],
        "estadoConexion":"falta_enlace_a_entrada",
        "evaluacionFuente":evaluacion,
        "clasificacionCausalDisponible":evaluacion!="sin_evaluacion_especifica",
        "pruebaRequerida":"demostrar una cadena de activacion desde entrada AUD, o declarar excepcion historica con evidencia de fuente, alcance y receptor; no convertir coincidencias nominales en aristas"
    })

# Cotejo documental independiente de las evaluaciones producidas por el
# reconstructor. Lee el AST original y la fuente, no infiere llamadas por nombres.
tree=json.loads(Path("baseline/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
funciones={f["id"]:f for f in tree["functionGraph"]}
assert len(funciones)==len(tree["functionGraph"])
reverse=collections.defaultdict(set)
for function in funciones.values():
    for call in function.get("calls") or []:
        dst=call.get("to")
        if dst in funciones:reverse[dst].add(function["id"])
restantes={r["idAST"] for r in faltantes}
dictamenes=[]
for f in faltantes:
    fid=f["idAST"]
    assert fid in funciones, ("identidad ausente del AST",fid)
    fn=funciones[fid]
    archivo=fn["file"]
    lineas=Path("baseline",archivo).read_text().splitlines()
    linea=fn["line"]
    assert 1<=linea<=len(lineas)
    padre=fn.get("parent")
    invocadores=sorted(reverse.get(fid,set()))
    nominal=fn.get("name") or ""
    # Coincidencia solo nominal y dentro de la MISMA fuente; se registra
    # únicamente como evidencia léxica, nunca como arista.
    if nominal.isidentifier() and len(nominal)>=3:
        patron=re.compile(r"(?<![A-Za-z0-9_$])"+re.escape(nominal)+r"(?![A-Za-z0-9_$])")
        ocurrencias=[n for n,texto in enumerate(lineas,1) if patron.search(texto)]
    else:
        ocurrencias=[]
    if padre in funciones and padre not in restantes:
        causa="padre_fuera_de_saldo_sin_activacion_de_hijo_acreditada"
    elif invocadores:
        causa="invocacion_AST_local_existente_sin_recorrido_AUD"
    elif padre in funciones:
        causa="declaracion_anidada_sin_invocador_AST_acreditado"
    else:
        causa="declaracion_sin_invocador_AST_acreditado"
    if not invocadores and ocurrencias==[linea]:
        causa+="_y_unica_referencia_nominal_en_fuente"
    dictamenes.append({
        "idAST":fid,"archivo":archivo,"linea":linea,
        "nombre":nominal,"padreAST":padre,"invocadoresAST":invocadores,
        "sitiosNominalesMismoArchivo":ocurrencias[:30],
        "cantidadSitiosNominales":len(ocurrencias),
        "fragmentoFuente":lineas[linea-1].strip()[:240],
        "causaASTComprobada":causa,
        "evaluacionPrevia":f.get("evaluacionFuente") or None,
        "limite":"Diagnostico estatico; no implica ejecucion o desuso"
    })
assert len(dictamenes)==155 and len({r["idAST"] for r in dictamenes})==155
assert set(r["idAST"] for r in dictamenes)==restantes
por_causa=collections.Counter(r["causaASTComprobada"] for r in dictamenes)
sin_previa=[r for r in dictamenes if not r["evaluacionPrevia"]]
assert len(sin_previa)==63, f"Cambio en evaluaciones previas: {len(sin_previa)}"
complemento={
    "nodosConEvidenciaDeFuenteIndividual":len(dictamenes),
    "nodosSinEvaluacionPreviaConEvidenciaAST":len(sin_previa),
    "clasificacionPorCausa":dict(sorted(por_causa.items())),
    "fronteraPendiente":"155 sin recorrido acreditado a AUD; se requiere investigar activaciones dinamicas/externas y excepciones historicas",
    "casos":dictamenes
}
ruta_complemento=Path("auditorias/temporal/DICTAMEN_INDEPENDIENTE_155.json")
ruta_complemento.write_text(json.dumps(complemento,ensure_ascii=False,indent=2)+"\n")
print("PASO3_DICTAMEN_INDEPENDIENTE",json.dumps({
    "total":len(dictamenes),"evaluacionesPreviasAusentesCotejadas":len(sin_previa),
    "porCausa":dict(sorted(por_causa.items())),
    "aristasRecuperadas":0,"funcionesAunSinEntrada":155
},ensure_ascii=False))
# Prioridad inmediata: 15 invocadores locales y 24 hijos cuyo padre no está en el saldo.
prioritarios=[r for r in dictamenes if r["causaASTComprobada"].startswith(("invocacion_AST_local_existente","padre_fuera_de_saldo"))]
assert len(prioritarios)==39, len(prioritarios)
for item in prioritarios:
    print("PASO3_PRIORITARIO_39",json.dumps({k:item[k] for k in ("idAST","nombre","padreAST","invocadoresAST","fragmentoFuente","causaASTComprobada")},ensure_ascii=False))
sin_evaluacion=[f["idAST"] for f in evidencia if not f["clasificacionCausalDisponible"]]
resultado={
    "corte":"e6362836e6078a14a361732d79a8212258934056",
    "totalIdentidades":1691,
    "faltantesEnlace":len(faltantes),
    "porArchivo":dict(sorted(por_fuente.items())),
    "evaluacionesFuente":dict(sorted(por_evaluacion.items())),
    "sinEvaluacionEspecifica":sin_evaluacion,
    "puedeCerrarPaso3":False,
    "razonNoCierre":"Las 155 funciones conservan estado falta_enlace_a_entrada; las clasificaciones causales no certifican recorrido accion-efecto. Falta revalidacion independiente 3.4.",
    "identidades":evidencia
}
salida=Path("auditorias/temporal/CONTROL_CIERRE_PASO3_155.json")
salida.write_text(json.dumps(resultado,ensure_ascii=False,indent=2)+"\n")
print("PASO3_CONTROL_CIERRE",json.dumps({k:v for k,v in resultado.items() if k!="identidades"},ensure_ascii=False))

# Validación independiente 3.4 del estado ACTUAL, sin sustituir el
# control histórico de 155 ni afirmar cierre a partir de sumas.
p_indirecta=Path("auditorias/temporal/REVALIDACION_INDIRECTA_1691_ACTUAL.json")
p_red=Path("auditorias/temporal/CONTRASTE_218_ASOCIACIONES_ACTUALES.json")
p_cruce=Path("auditorias/temporal/CRUCE_989_1691_ACTUAL.json")
a=json.loads(p_indirecta.read_text())
b=json.loads(p_red.read_text())
c=json.loads(p_cruce.read_text())
actual=json.loads(Path("nuevo/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
func_actual={f["id"]:f for f in actual["functionGraph"]}
assert len(a["funciones"])==1691
assert len({f["idASTHistorico"] for f in a["funciones"]})==1691
assert all(f["clasificacionActual"] for f in a["funciones"])
assert len(b["acciones"])==218
assert len({x["AUD"] for x in b["acciones"]})==218
assert c["resumen"]["accionesVigentesSinArbolUnico"]==0
assert c["resumen"]["accionesVigentesConArbolIdentificado"]==980
assert len(c["pendientesRemapeo"])==sum(x["idASTActual"] is None for x in a["funciones"])
# Comprobar de manera independiente las aristas que se declaran válidas:
# si un par no existe en el AST vigente o en callbackBindings, rechazar.
callbacks=set()
for record in actual.get("callbackBindings",[]):
    src=record["binding"].split("|")[0]
    for dst in record["targets"]: callbacks.add((src,dst))
verified_chains=0
historic_source=json.loads(Path("baseline/auditorias/transversal/ARBOL_ACCIONES.json").read_text())["sourceHashes"]
current_source=actual["sourceHashes"]
for row in a["funciones"]:
    chain=row.get("cadenaActualCandidata")
    edges=row.get("aristasActuales")
    if edges is None:continue
    assert chain is not None and len(edges)==len(chain)-1
    historical_chain=row.get("cadenaHistorica") or []
    if "arista_indirecta_historica_sha_inalterada" in edges:
        assert len(historical_chain)==len(chain),row["idASTHistorico"]
    for ix,(src,dst,kind) in enumerate(zip(chain,chain[1:],edges)):
        if kind=="arista_indirecta_historica_sha_inalterada":
            assert src==historical_chain[ix] and dst==historical_chain[ix+1]
            sf,df=func_actual[src]["file"],func_actual[dst]["file"]
            assert sf in historic_source and df in historic_source
            assert current_source.get(sf)==historic_source[sf]
            assert current_source.get(df)==historic_source[df]
        elif kind=="llamada_AST_actual":
            assert any(call.get("to")==dst for call in func_actual[src].get("calls",[])),row["idASTHistorico"]
        elif kind=="callback_registrado_AST_actual_condicional":
            assert (src,dst) in callbacks,row["idASTHistorico"]
        else:
            assert kind=="arista_historica_no_correspondida_en_AST_actual"
    if row["clasificacionActual"].startswith("cadena_AST_revalidada"):
        assert "arista_historica_no_correspondida_en_AST_actual" not in edges
        verified_chains+=1
import zipfile
with zipfile.ZipFile("paso2/auditorias/transversal/CATALOGO_MAESTRO.zip") as z:
    paso2=json.loads(z.read("CATALOGO_MAESTRO.json"))
p2hash=paso2.get("baseline",{}).get("sourceHashes",{})
current_aud_by_id={t["action"]["id"]:t for t in actual["trees"]}
original_tree_for_http=json.loads(Path("baseline/auditorias/transversal/ARBOL_ACCIONES.json").read_text())
historic_http_functions={x["id"]:x for x in original_tree_for_http["functionGraph"]}
remap_for_http=json.loads(Path("auditorias/temporal/REMAPPING_AST_989.json").read_text())["fullMap"]
definitive_network_by_aud={e["id"]:e.get("network") or [] for e in paso2["entries"]}

for row in b["acciones"]:
    tree_now=current_aud_by_id.get(row.get("arbolActual"))
    tree_functions={n.get("id") for n in (tree_now or {}).get("nodes",[]) if n.get("type")=="function"}
    for check in row["comprobaciones"]:
        if check["estado"]=="asociacion_estatica_identica_en_arbol_de_accion":
            assert not check["razones"]
        elif check["estado"] in ("contrato_paso2_certificado_por_identidad_AST_y_SHA",
                                "contrato_paso2_en_caller_AST_sin_nodo_http_generado",
                                "contrato_paso2_por_sitio_http_AST_unico_misma_linea_y_SHA"):
            ev=check.get("evidenciaAST") or {}
            assert ev.get("fuentesSHAInalteradas")
            if check["estado"]!="contrato_paso2_por_sitio_http_AST_unico_misma_linea_y_SHA":
                assert ev.get("callIdEnFuncionAST")
            assert ev.get("callerEnArbolAccion") and ev.get("ownerASTActual") in tree_functions
            owner=func_actual[ev["ownerASTActual"]]
            if check["estado"]=="contrato_paso2_por_sitio_http_AST_unico_misma_linea_y_SHA":
                assert ev.get("sitioHttpASTUnicoMismaLinea")
                candidates=[c for c in owner.get("calls",[]) if c.get("id")==ev.get("idSitioHttpActual") and c.get("kind")=="http"]
                assert len(candidates)==1
            else:
                assert any(c.get("id")==check["callId"] for c in owner.get("calls",[]))
            expected_entry=next(x for x in paso2["entries"] if x["id"]==row["AUD"])
            contracts=[x for x in expected_entry.get("network") or [] if x.get("callId")==check["callId"]]
            assert contracts
            for req in contracts:
                source=req.get("file")
                if source is None and req.get("callId") and str(req["callId"]).startswith(owner["file"]+":") and any(
                        c.get("id")==req["callId"] for c in owner.get("calls",[])):
                    source=owner["file"]
                paths=[source]+[w.get("file") for w in req.get("worker") or []]
                assert source and all(k in p2hash and actual["sourceHashes"].get(k)==p2hash[k] for k in paths)
        elif check["estado"]=="sitio_http_remapeado_por_cuerpo_y_ordinal_AST_exacto":
            ev=check["evidenciaAST"]
            old_function=historic_http_functions[ev["funcionHistorica"]]
            new_function=func_actual[ev["funcionActual"]]
            equivalent=remap_for_http[old_function["id"]]
            assert equivalent["newId"]==new_function["id"] and not equivalent.get("modifiedBody")
            assert equivalent["proof"]==ev["identidadCuerpo"]
            old_calls,new_calls=old_function["calls"],new_function["calls"]
            idx=ev["ordinalLlamada"]
            assert len(old_calls)==len(new_calls) and idx<len(old_calls)
            assert all(a.get("kind")==b.get("kind") and a.get("method")==b.get("method")
                       for a,b in zip(old_calls,new_calls))
            assert old_calls[idx]["id"]==check["callId"]
            assert new_calls[idx]["id"]==ev["sitioHttpASTActual"]
            assert new_calls[idx]["kind"]=="http"
            assert ev["funcionActual"] in tree_functions
            matching_contracts=[x for x in definitive_network_by_aud[row["AUD"]]
                                if x.get("callId")==check["callId"]]
            assert len(matching_contracts)==1
            assert all(w["file"] in p2hash and current_source.get(w["file"])==p2hash[w["file"]]
                       for w in matching_contracts[0].get("worker") or [])
        elif check["estado"]=="sitio_http_historico_de_control_reemplazado":
            assert row["AUD"] in ("AUD-00395","AUD-00418")
            assert check["rutas"]==["/advertisers/claim-options"]
            assert check["metodo"]=="GET"
            assert check["evidenciaAST"]["equivalenciaHistorica"]=="AUD-00988"
            assert row["arbolActual"] is None
        elif check["estado"]=="reclamos_http_mismo_sitio_literal_con_receptor_modificado":
            assert row["AUD"]=="AUD-00417" and check["metodo"]=="GET"
            assert check["rutas"]==["/advertisers/claim-options"]
            assert check["evidenciaAST"]["sitioLiteralExactoPreservado"]
            old_fn=historic_http_functions[check["evidenciaAST"]["funcionOrigenHistorica"]]
            new_fn=func_actual[check["evidenciaAST"]["funcionOrigenVigente"]]
            assert old_fn["name"]==new_fn["name"]=="buscarAnuncioReclamo155"
            assert new_fn["id"] in tree_functions
            assert all(any(c.get("kind")=="http" and c.get("method")=="fetch" for c in f.get("calls",[]))
                       for f in (old_fn,new_fn))
            source_line="const r=await fetch(WORKER_ORIGIN+'/advertisers/claim-options?q='+encodeURIComponent(term),{headers:gldAuthHeaders_()});"
            assert all(Path(path).read_text().count(source_line)==1 for path in
                       ("baseline/plataforma/login.html","nuevo/plataforma/login.html"))
        elif check["estado"]=="contrato_http_funcion_AST_id_cuerpo_inmutable_en_fuente_modificada":
            ev=check["evidenciaAST"]
            remap=remap_for_http.get(ev["equivalenciaFuncionHistorica"])
            assert remap and remap["newId"]==ev["equivalenciaFuncionActual"]
            assert not remap.get("modifiedBody")
            assert remap.get("proof")==ev["equivalenciaPrueba"]
            owner=func_actual[ev["equivalenciaFuncionActual"]]
            assert owner["id"] in tree_functions and owner["file"]=="plataforma/login.html"
            assert ev["equivalenciaFuncionHistorica"]==owner["id"] or bool(remap["proof"])
            assert any(call.get("id")==check["callId"] for call in owner.get("calls",[]))
            # El catálogo permite método dinámico (verb=null). No inventar
            # GET/POST: comprobar sólo que conserva exactamente ese contrato.
            assert any(x.get("callId")==check["callId"] and x.get("verb")==check["metodo"]
                       for x in definitive_network_by_aud[row["AUD"]])
            for req in definitive_network_by_aud[row["AUD"]]:
                if req.get("callId")!=check["callId"]:continue
                assert all(w.get("file") in p2hash and
                           p2hash[w["file"]]==current_source.get(w["file"])
                           for w in req.get("worker") or [])
        elif check["estado"]=="contrato_paso2_documental_con_worker_sin_locator_AST_y_SHA_inmutable":
            ev=check["evidenciaAST"]
            assert ev.get("receptorDocumentalPaso2") and ev.get("workerSinArchivoIndividual")
            assert ev.get("workerSHAInmutable") and ev.get("callerEnArbolAccion")
            owner=func_actual[ev["ownerASTActual"]]
            assert owner["id"] in tree_functions
            assert any(c.get("id")==check["callId"] for c in owner.get("calls",[]))
            assert p2hash["worker/worker206.txt"]==current_source["worker/worker206.txt"]
            for req in definitive_network_by_aud[row["AUD"]]:
                if req.get("callId")!=check["callId"]:continue
                assert req["file"]==owner["file"]
                assert p2hash[req["file"]]==current_source[req["file"]]
                assert req.get("worker") and all(
                    isinstance(w.get("evidencia"),str) and w["evidencia"].strip() and
                    not w.get("file") for w in req["worker"])
        elif check["estado"]=="recorrido_interrumpido_sitio_global_sin_cadena_desde_AUD":
            ev=check.get("evidenciaAST") or {}
            proof=ev.get("evidenciaRecorridoInterrumpido") or {}
            assert proof.get("callId")==check["callId"]
            assert proof.get("sinNodoHttpEnAccion") is True
            assert proof.get("arbolAccion")==row["arbolActual"]
            assert proof.get("archivo") and proof.get("linea")
            matches=[e for e in actual["endpoints"] if e.get("callId")==check["callId"]]
            assert len(matches)==1
            assert matches[0].get("file")==proof["archivo"]
            assert matches[0].get("line")==proof["linea"]
            assert not any(n.get("type")=="http" and n.get("callId")==check["callId"]
                           for n in (tree_now or {}).get("nodes",[]))
        elif check["estado"]=="diferencia_de_contrato_o_destino":
            assert check["razones"]
        else:
            assert check["estado"] in ("callId_sin_coincidencia_unica_en_AST_actual","peticion_en_AST_global_sin_ruta_desde_esta_accion")
# Control 3.4: cada recorrido sin vínculo debe identificar el eslabón
# concreto y no solamente aparecer como "pendiente" en un contador.
direct_invokers={}
for source in func_actual.values():
    for callsite in source.get("calls",[]):
        if callsite.get("to") in func_actual:
            direct_invokers.setdefault(callsite["to"],set()).add(source["id"])
for row in a["funciones"]:
    state=row["clasificacionActual"]
    if state=="cadena_indirecta_requiere_verificacion_de_receptor":
        failures=row.get("aristasSinReceptorComprobado") or []
        assert failures and all(x.get("origenASTActual") in func_actual and
                                x.get("destinoASTActual") in func_actual and
                                x.get("causa") for x in failures)
        for broken in failures:
            source=func_actual[broken["origenASTActual"]]
            assert not any(c.get("to")==broken["destinoASTActual"] for c in source.get("calls",[]))
            assert (broken["origenASTActual"],broken["destinoASTActual"]) not in callbacks
    elif state=="cadena_indirecta_con_identidad_intermedia_no_remapeada":
        missing=row.get("identidadesIntermediasSinEquivalencia") or []
        assert missing and all(x.get("idASTActual") not in func_actual for x in missing)
    elif state=="cadena_AST_sin_raiz_de_AUD_acreditada":
        evidence=row.get("origenAUDActual") or {}
        assert evidence.get("AUD") and evidence.get("causa")
        assert evidence.get("raizAST")!=evidence.get("raizHistoricaRemapeada")
    elif state=="cadena_AST_sin_AUD_vigente_acreditada":
        assert row.get("origenAUDActual",{}).get("AUD")
    elif state=="consumidor_AST_identificado_sin_entrada_o_receptor_acreditado":
        assert row.get("cantidadConsumidoresASTVigentes",0)>0
        assert row.get("consumidoresASTVigentes")
    elif state=="sin_consumidor_AST_identificado_en_codigo_actual":
        assert row.get("cantidadConsumidoresASTVigentes")==0
        assert row["idASTActual"] not in direct_invokers
issues={
 "identidadesSinEquivalencia":sum(x["idASTActual"] is None for x in a["funciones"]),
 "cadenasSinRaizOReceptorConfirmado":sum(x["clasificacionActual"] in (
   "cadena_indirecta_con_identidad_intermedia_no_remapeada",
   "cadena_indirecta_requiere_verificacion_de_receptor",
   "cadena_AST_sin_raiz_de_AUD_acreditada",
   "cadena_AST_sin_AUD_vigente_acreditada",
   "cadena_AST_con_arranque_pendiente_de_confirmar") for x in a["funciones"]),
 "asociacionesDeRedSinConcordanciaEstatica":sum(
   check["estado"] not in ("asociacion_estatica_identica_en_arbol_de_accion","contrato_paso2_certificado_por_identidad_AST_y_SHA","contrato_paso2_por_sitio_http_AST_unico_misma_linea_y_SHA","sitio_http_remapeado_por_cuerpo_y_ordinal_AST_exacto","reclamos_http_mismo_sitio_literal_con_receptor_modificado","sitio_http_historico_de_control_reemplazado","contrato_http_funcion_AST_id_cuerpo_inmutable_en_fuente_modificada","contrato_paso2_documental_con_worker_sin_locator_AST_y_SHA_inmutable","recorrido_interrumpido_sitio_global_sin_cadena_desde_AUD")
   for row in b["acciones"] for check in row["comprobaciones"]),
 "sinConsumidorASTActualIdentificado":sum(x["clasificacionActual"]==
   "consumidor_AST_identificado_sin_entrada_o_receptor_acreditado" for x in a["funciones"]),
 "sinConsumidorASTActualDetectado":sum(x["clasificacionActual"]==
   "sin_consumidor_AST_identificado_en_codigo_actual" for x in a["funciones"])
}
report={
 "control":"Paso 3.4 independiente, código actualizado 9b7fd659",
 "integridad989":c["resumen"]["accionesVigentesConArbolIdentificado"]==980,
 "integridad1691":True,
 "integridad218":True,
 "cadenasASTRevalidadas":verified_chains,
 "impedimentosDeCertificacion":issues,
 "paso3Cerrado":False,
 "motivo":"Faltan pruebas de equivalencia, raíz o receptor, y concordancia de asociaciones antes del cierre; los dictámenes históricos no equivalen a prueba actual"
}
Path("auditorias/temporal/VALIDACION_INDEPENDIENTE_3_4_ACTUAL.json").write_text(
 json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print("PASO3_VALIDACION_INDEPENDIENTE_3_4",json.dumps(report,ensure_ascii=False))
